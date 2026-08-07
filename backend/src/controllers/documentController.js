// src/controllers/documentController.js
//
// Phase 2 — Document Ingestion Controller
//
// Pipeline:
//   1. Accept uploaded file (multer memoryStorage)
//   2. Extract raw text (.txt / .pdf / .docx / .doc)
//   3. Send raw text to LLM → structured extraction:
//        { services: [...], company_info: "..." }
//   4. Seed `services` table with extracted service records
//   5. Upsert `knowledge_base` table with company_info string
//   6. Return 200 with both created DB records
//
// ─────────────────────────────────────────────────────────────────────────────

import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';
import path from 'path';
import db from '../database/db.js';
import { callAI } from '../services/llmService.js';

// ─── Supported MIME types ─────────────────────────────────────────────────────
const SUPPORTED_TYPES = new Set([
  'text/plain',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
]);

function getExtension(filename) {
  return path.extname(filename).toLowerCase();
}

// ─── LLM Extraction Prompt ────────────────────────────────────────────────────
function buildExtractionPrompt(rawText) {
  return `
You are a precise data extraction assistant. Your ONLY job is to analyze the following business document and extract structured, factual information from it.

Return ONLY a raw JSON object (no markdown, no code blocks, no extra text) with EXACTLY these two keys:

1. "services": An array of service objects representing ALL bookable services mentioned in the document.
   - You MUST include EVERY service explicitly mentioned. Do NOT omit any. Do NOT invent or assume services not stated.
   - Each object must have:
     * "name": string — the exact name of the service as written in the document.
     * "department": string — the department or category (e.g., "IT", "finance", "legal", "consulting"). Use "General" if not specified.
     * "duration": number — estimated duration in minutes as an integer. Use 60 if not specified.
   - Deduplicate: if the same service appears multiple times, include it only ONCE.
   - If no bookable services are mentioned at all, return an empty array []. Never fabricate services.

2. "company_info": A single comprehensive string summarizing ALL other business details found in the document.
   Include (if present): company name, location/address, business hours, contact details (phone, email, website),
   pricing, booking policies, cancellation policies, and any other information relevant to a customer-facing AI.
   Write it as clear, complete prose. Do NOT include the service list here — only supporting business context.

DOCUMENT TEXT:
---
${rawText}
---

CRITICAL: Return a valid JSON object. No markdown. No code fences. No extra commentary. Nothing else.
`;
}

// ─── Step 2: Text Extraction ──────────────────────────────────────────────────
async function extractText(buffer, mimetype, originalname) {
  const ext = getExtension(originalname);

  if (mimetype === 'text/plain' || ext === '.txt') {
    return buffer.toString('utf-8');
  }

  if (mimetype === 'application/pdf' || ext === '.pdf') {
    const parser = new PDFParse();
    const pdfData = await parser.parse(buffer);
    return pdfData.text;
  }

  if (
    mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimetype === 'application/msword' ||
    ext === '.docx' ||
    ext === '.doc'
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  throw new Error(`Unsupported file type: ${mimetype} (${ext})`);
}

// ─── Step 3: LLM Structured Extraction ───────────────────────────────────────
async function extractStructuredData(rawText) {
  const prompt = buildExtractionPrompt(rawText);
  const aiResponse = await callAI(prompt, { jsonMode: true });

  let parsed;
  try {
    parsed = JSON.parse(aiResponse);
  } catch (e) {
    throw new Error(`LLM returned invalid JSON. Raw response: ${aiResponse.slice(0, 500)}`);
  }

  // Validate shape
  if (!Array.isArray(parsed.services)) {
    parsed.services = [];
  }
  if (typeof parsed.company_info !== 'string') {
    parsed.company_info = '';
  }

  // Normalise service records — ensure required fields have sensible defaults
  parsed.services = parsed.services
    .filter((s) => s && typeof s.name === 'string' && s.name.trim().length > 0)
    .map((s) => ({
      name:             s.name.trim(),
      department:       (typeof s.department === 'string' && s.department.trim()) ? s.department.trim().toLowerCase() : 'general',
      duration_minutes: (Number.isInteger(s.duration) && s.duration > 0) ? s.duration : 60,
    }));

  return parsed;
}

// ─── Step 4: Seed services table ─────────────────────────────────────────────
//
// Strategy: clear ALL existing services, then insert the freshly extracted list
// in a single transaction. This ensures the database always reflects the most
// recently uploaded document and completely eliminates the need for manual seed
// files (backend/src/database/seeds/01_initial_services.js is now obsolete).
//
async function seedServices(services) {
  return db.transaction(async (trx) => {
    // 1. Wipe the current catalog so stale entries from previous uploads are removed.
    await trx('services').delete();

    // 2. Nothing to insert — return empty array gracefully.
    if (!services || services.length === 0) return [];

    // 3. Bulk-insert the new catalog and return all created rows.
    const inserted = await trx('services').insert(services).returning('*');
    return inserted;
  });
}

// ─── Step 5: Upsert knowledge_base ───────────────────────────────────────────
async function upsertKnowledgeBase(content, sourceFile) {
  if (!content || !content.trim()) return null;

  // Strategy: delete-then-insert — keeps only the most recent ingestion active.
  // This prevents stale data from piling up across multiple uploads.
  await db('knowledge_base').delete();

  const [row] = await db('knowledge_base')
    .insert({
      content:     content.trim(),
      source_file: sourceFile,
      updated_at:  db.fn.now(),
    })
    .returning('*');

  return row;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN HANDLER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/business/upload
 *
 * Accepts a single file under the field name `document`.
 * Supported types: .txt, .pdf, .doc, .docx
 *
 * Success response:
 * {
 *   success:      true,
 *   fileName:     "company_profile.pdf",
 *   services:     [ { id, name, department, duration_minutes }, ... ],
 *   knowledge_base: { id, content, source_file, created_at, updated_at }
 * }
 */
export async function parseDocument(req, res) {
  try {
    // ── 1. Guard: file presence & type ─────────────────────────────────────
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded. Attach a file using the field name "document".',
      });
    }

    const { buffer, originalname, mimetype } = req.file;
    const ext = getExtension(originalname);

    const isKnownType =
      SUPPORTED_TYPES.has(mimetype) ||
      ['.txt', '.pdf', '.doc', '.docx'].includes(ext);

    if (!isKnownType) {
      return res.status(400).json({
        success: false,
        error: `Unsupported file type: "${mimetype}" (${ext}). Accepted: .txt, .pdf, .doc, .docx`,
      });
    }

    // ── 2. Extract raw text ────────────────────────────────────────────────
    const rawText = await extractText(buffer, mimetype, originalname);
    const cleanText = rawText.replace(/\n{3,}/g, '\n\n').trim();

    if (!cleanText) {
      return res.status(422).json({
        success: false,
        error: 'The document appears to be empty or contains no extractable text.',
      });
    }
    // ── 3. LLM structured extraction ───────────────────────────────────────
    let structuredData;
    try {
      structuredData = await extractStructuredData(cleanText);
    } catch (llmErr) {
      console.error('[Ingestion] LLM extraction failed:', llmErr.message);
      return res.status(502).json({
        success: false,
        error: 'LLM extraction failed. Check AI provider keys in backend/.env',
        detail: llmErr.message,
      });
    }
    // ── 4. Seed services ───────────────────────────────────────────────────
    //    Atomically replaces the entire services catalog with what was
    //    extracted from this document. No manual seed files needed.
    let insertedServices = [];
    let servicesError = null;
    try {
      insertedServices = await seedServices(structuredData.services);
      console.log(`[Ingestion] ✅ Services catalog replaced: ${insertedServices.length} service(s) ingested from "${originalname}".`);
    } catch (dbErr) {
      console.error('[Ingestion] Services DB replace failed:', dbErr.message);
      servicesError = dbErr.message;
      // Non-fatal — continue to save knowledge base
    }

    // ── 5. Upsert knowledge base ───────────────────────────────────────────
    let kbRow = null;
    let kbError = null;
    try {
      kbRow = await upsertKnowledgeBase(structuredData.company_info, originalname);
    } catch (dbErr) {
      console.error('[Ingestion] Knowledge base DB upsert failed:', dbErr.message);
      kbError = dbErr.message;
    }

    // ── 6. Response ────────────────────────────────────────────────────────
    const hasErrors = servicesError || kbError;

    return res.status(hasErrors ? 207 : 200).json({
      success:       !hasErrors,
      fileName:      originalname,
      services:      insertedServices,
      knowledge_base: kbRow,
      ...(servicesError && { services_error: servicesError }),
      ...(kbError       && { knowledge_base_error: kbError }),
    });

  } catch (err) {
    console.error('[documentController] Unexpected error:', err);
    return res.status(500).json({
      success: false,
      error:   'An unexpected error occurred during document ingestion.',
      detail:  err.message,
    });
  }
}
