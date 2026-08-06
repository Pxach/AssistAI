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
You are a precise data extraction assistant. Your job is to analyze the following business document and extract structured information from it.

Return ONLY a raw JSON object (no markdown, no code blocks, no extra text) with EXACTLY these two keys:

1. "services": An array of service objects. Each object must have:
   - "name": string — the exact name of the service offered (e.g., "Haircut", "Tax Consultation")
   - "department": string — the department or category (e.g., "beauty", "finance", "it", "legal"). Use "general" if not specified.
   - "duration": number — duration in minutes as an integer. Use 60 if not specified.
   If no services are mentioned, return an empty array.

2. "company_info": A single comprehensive string summarizing ALL other business details found in the document. This should include (if present): company name, location/address, business hours, contact details (phone, email, website), pricing policies, booking policies, cancellation policies, and any other relevant information for a customer-facing AI assistant. Write it as clear, complete prose.

DOCUMENT TEXT:
---
${rawText}
---

IMPORTANT: Your response must be a valid JSON object. Nothing else.
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
async function seedServices(services, fileName) {
  if (services.length === 0) return [];

  // Insert with onConflict ignored so re-uploading the same doc won't double-insert.
  // The `name` column has no unique constraint in the schema, so we do a plain insert.
  // Return the inserted rows by re-querying the names we just inserted.
  await db('services').insert(services);

  const names = services.map((s) => s.name);
  const inserted = await db('services').whereIn('name', names).select('*');
  return inserted;
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
    let insertedServices = [];
    let servicesError = null;
    try {
      insertedServices = await seedServices(structuredData.services, originalname);
    } catch (dbErr) {
      console.error('[Ingestion] Services DB insert failed:', dbErr.message);
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
