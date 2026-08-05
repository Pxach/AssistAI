import express from 'express';
import {
  getAppointments,
  checkAvailability,
  createAppointment,
  processBooking,
  syncAppointment,
  getAppointmentsTomorrow,
  getAppointmentsEndedToday
} from '../controllers/appointmentController.js';

const router = express.Router();

// GET /api/appointments
router.get('/', getAppointments);

// GET /api/appointments/tomorrow
router.get('/tomorrow', getAppointmentsTomorrow);

// GET /api/appointments/concluded-today
router.get('/concluded-today', getAppointmentsEndedToday);

// GET /api/appointments/check-availability
router.get('/check-availability', checkAvailability);

// POST /api/appointments
router.post('/', createAppointment);

// POST /api/appointments/process
router.post('/process', processBooking);

// POST /api/appointments/sync
router.post('/sync', syncAppointment);

export default router;