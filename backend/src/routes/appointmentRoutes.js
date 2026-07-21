const express = require('express');
const router = express.Router();
const appointmentController = require('../controllers/appointmentController');

// GET /api/appointments - Fetch all appointments
router.get('/', appointmentController.getAppointments);

// GET /api/appointments/check-availability
router.get('/check-availability', appointmentController.checkAvailability);

// POST /api/appointments - Create temporary or confirmed appointment
router.post('/', appointmentController.createAppointment);

// POST /api/appointments/process - Process AI decision matrix payload
router.post('/process', appointmentController.processBooking);

module.exports = router;