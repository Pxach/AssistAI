import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import knex from '../database/db.js'; // path to your knex instance

const router = express.Router();

// Ensure uploads/documents directory exists
const uploadDir = path.join(process.cwd(), 'uploads/documents');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage setup for company documents
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  },
});
const upload = multer({ storage });

// Helper to extract companyId safely from req.user
const getCompanyId = (req) => {
  const id = req.user?.companyId || req.user?.company_id;
  return id !== undefined ? id : null;
};

// -----------------------------------------------------------------------------
// CONFIGURATION KEYS ENDPOINTS
// -----------------------------------------------------------------------------

// GET /api/settings/configs
router.get('/configs', async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    
    let query = knex('company_configs');
    if (companyId !== null) {
      query = query.where({ company_id: companyId });
    }
    
    const config = await query.first();
    res.json(config || {});
  } catch (error) {
    console.error('Error in GET /configs:', error);
    res.status(500).json({ error: 'Failed to fetch configurations' });
  }
});

// POST /api/settings/configs
router.post('/configs', async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const {
      gemini_api_key,
      grok_api_key,
      openrouter_api_key,
      mistral_api_key,
      calendar_id,
      google_client_email,
      google_private_key,
      google_review_url,
      tally_form_url,
      dashboard_api_url,
    } = req.body;

    const payload = {
      company_id: companyId,
      gemini_api_key,
      grok_api_key,
      openrouter_api_key,
      mistral_api_key,
      calendar_id,
      google_client_email,
      google_private_key,
      google_review_url,
      tally_form_url,
      dashboard_api_url,
      updated_at: knex.fn.now(),
    };

    if (companyId !== null) {
      await knex('company_configs')
        .insert(payload)
        .onConflict('company_id')
        .merge();
    } else {
      await knex('company_configs').insert(payload);
    }

    res.json({ message: 'Settings saved successfully' });
  } catch (error) {
    console.error('Error in POST /configs:', error);
    res.status(500).json({ error: 'Failed to save configurations' });
  }
});

// -----------------------------------------------------------------------------
// DOCUMENT MANAGEMENT ENDPOINTS
// -----------------------------------------------------------------------------

// GET /api/settings/documents
router.get('/documents', async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    
    // Returns a fresh query instance each time to avoid Knex mutation errors
    const getBaseQuery = () => {
      let q = knex('company_documents');
      if (companyId !== null) {
        q = q.where((builder) => {
          builder.where({ company_id: companyId }).orWhereNull('company_id');
        });
      }
      return q;
    };

    let docs;
    try {
      // 1. Try ordering by created_at
      docs = await getBaseQuery().orderBy('created_at', 'desc');
    } catch (err) {
      try {
        // 2. Fallback to ordering by id if created_at doesn't exist
        docs = await getBaseQuery().orderBy('id', 'desc');
      } catch (idErr) {
        // 3. Final fallback: return all matching documents without ordering
        docs = await getBaseQuery();
      }
    }

    res.json(docs || []);
  } catch (error) {
    console.error('Error in GET /documents:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// POST /api/settings/documents (Upload single file)
router.post('/documents', upload.single('file'), async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const newDocData = {
      company_id: companyId,
      file_name: req.file.originalname,
      file_url: `/uploads/documents/${req.file.filename}`,
      file_type: req.file.mimetype,
      file_size_bytes: req.file.size,
    };

    const insertResult = await knex('company_documents')
      .insert(newDocData)
      .returning('*');

    // Handle cross-database output structures
    let createdDoc;
    if (Array.isArray(insertResult) && insertResult.length > 0) {
      if (typeof insertResult[0] === 'object') {
        createdDoc = insertResult[0];
      } else {
        const insertedId = insertResult[0];
        createdDoc = await knex('company_documents').where({ id: insertedId }).first();
      }
    } else {
      createdDoc = await knex('company_documents')
        .where({ file_url: newDocData.file_url })
        .first();
    }

    res.json(createdDoc || newDocData);
  } catch (error) {
    console.error('Error in POST /documents:', error);
    res.status(500).json({ error: error.message || 'Failed to save document record' });
  }
});

// DELETE /api/settings/documents/:id
router.delete('/documents/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = getCompanyId(req);

    if (!id || id === 'undefined' || id === 'null') {
      return res.status(400).json({ error: 'Invalid document ID provided' });
    }

    // 1. Fetch document record
    let doc = null;
    try {
      let query = knex('company_documents').where({ id });
      if (companyId !== null) {
        query = query.andWhere({ company_id: companyId });
      }
      doc = await query.first();
    } catch (queryErr) {
      console.warn(`[DELETE] Primary key lookup failed for ID ${id}:`, queryErr.message);
    }

    if (!doc) {
      doc = await knex('company_documents')
        .where({ id })
        .first()
        .catch(() => null);
    }

    if (!doc) {
      return res.status(404).json({ error: 'Document not found in database' });
    }

    // 2. Clean up physical file on disk
    if (doc.file_url) {
      const filename = path.basename(doc.file_url);
      const fullPath = path.join(uploadDir, filename);
      
      if (fs.existsSync(fullPath)) {
        try {
          fs.unlinkSync(fullPath);
        } catch (fsErr) {
          console.error(`[DELETE] Failed to delete disk file ${fullPath}:`, fsErr);
        }
      }
    }

    // 3. Delete record from DB
    await knex('company_documents').where({ id: doc.id }).delete();

    res.json({ message: 'Document removed successfully' });
  } catch (error) {
    console.error('Error in DELETE /documents/:id:', error);
    res.status(500).json({ error: error.message || 'Failed to delete document' });
  }
});

export default router;