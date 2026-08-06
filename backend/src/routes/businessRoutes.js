import express from 'express';
import multer from 'multer';
import { parseDocument } from '../controllers/documentController.js';
import db from '../database/db.js';

const router = express.Router();

// ── Multer: in-memory storage, 10 MB cap ────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

/**
 * POST /api/business/upload
 *
 * Accepts a single file under the field name `document`.
 * Supported types: .txt, .pdf, .doc, .docx
 *
 * Phase 2: extracts text → LLM → seeds services + knowledge_base tables.
 */
router.post('/upload', upload.single('document'), parseDocument);

/**
 * GET /api/business/knowledge-base
 *
 * Returns the active knowledge base content (most recent ingestion).
 * Called by backend-engine/configService.js to ground AI responses.
 */
router.get('/knowledge-base', async (req, res) => {
  try {
    const row = await db('knowledge_base').orderBy('created_at', 'desc').first();
    if (!row) {
      return res.status(200).json({ content: '', message: 'No knowledge base content ingested yet.' });
    }
    return res.status(200).json({ content: row.content, source_file: row.source_file, updated_at: row.updated_at });
  } catch (err) {
    console.error('[businessRoutes] GET /knowledge-base error:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/business/services
 *
 * Returns all services currently in the database (seeded from ingestion).
 */
router.get('/services', async (req, res) => {
  try {
    const services = await db('services').select('*').orderBy('id', 'asc');
    return res.status(200).json({ services });
  } catch (err) {
    console.error('[businessRoutes] GET /services error:', err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;

