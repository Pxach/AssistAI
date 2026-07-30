import express from 'express';
import {
  getHandoverRequests,
  requestHandover,
  respondToHandover
} from '../controllers/handoverController.js';

const router = express.Router();

// GET /api/handover - List pending handover requests for managers
router.get('/', getHandoverRequests);

// POST /api/handover/request - Trigger human intervention flag
router.post('/request', requestHandover);

// POST /api/handover/respond - Manager accepts or declines handover
router.post('/respond', respondToHandover);

export default router;