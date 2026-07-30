import express from 'express';
import {
  getAppointments,
  checkAvailability,
  createAppointment,
  processBooking
} from '../controllers/appointmentController.js';

const router = express.Router();

// GET /api/appointments
router.get('/', getAppointments);

// GET /api/appointments/check-availability
router.get('/check-availability', checkAvailability);

// POST /api/appointments
router.post('/', createAppointment);

// POST /api/appointments/process
router.post('/process', processBooking);

export default router;