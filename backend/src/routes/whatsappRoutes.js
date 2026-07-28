import express from 'express';
import {
  getStatus,
  connectWhatsApp,
  disconnectWhatsApp,
  sendHumanMessage,
  getActiveSessions,
  getChatLogs,
  toggleHandover 
} from '../controllers/whatsappController.js';


const router = express.Router();

router.get('/status', getStatus);
router.post('/connect', connectWhatsApp);
router.post('/disconnect', disconnectWhatsApp);
router.post('/send-message', sendHumanMessage);
router.post('/toggle-handover', toggleHandover);
router.get('/sessions', getActiveSessions);
router.get('/logs/:phoneNumber', getChatLogs);

export default router;