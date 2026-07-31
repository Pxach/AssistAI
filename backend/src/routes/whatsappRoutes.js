import express from 'express';
import {
  getStatus,
  connectWhatsApp,
  disconnectWhatsApp,
  sendHumanMessage,
  getActiveSessions,
  getChatLogs,
  toggleHandover,
  updateSessionStatus,
  syncChatMessage,
  syncHandover
} from '../controllers/whatsappController.js';

const router = express.Router();

router.get('/status', getStatus);
router.post('/connect', connectWhatsApp);
router.post('/disconnect', disconnectWhatsApp);
router.patch('/session-status', updateSessionStatus);
router.post('/sync-message', syncChatMessage);
router.post('/sync-handover', syncHandover);
router.post('/send-message', sendHumanMessage);
router.post('/toggle-handover', toggleHandover);
router.get('/sessions', getActiveSessions);
router.get('/logs/:phoneNumber', getChatLogs);

export default router;