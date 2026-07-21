const express = require('express');
const router = express.Router();
const handoverController = require('../controllers/handoverController');

// GET /api/handover - List pending handover requests for managers
router.get('/', handoverController.getHandoverRequests);

// POST /api/handover/request - Trigger human intervention flag
router.post('/request', handoverController.requestHandover);

// POST /api/handover/respond - Manager accepts or declines handover
router.post('/respond', handoverController.respondToHandover);

module.exports = router;