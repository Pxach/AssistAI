const express = require('express');
const router = express.Router();
const appointmentRoutes = require('./appointmentRoutes');
const reviewRoutes = require('./reviewRoutes');
const dashboardRoutes = require('./dashboardRoutes');
const authRoutes = require('./authRoutes');
const handoverRoutes = require('./handoverRoutes');

// Base API Endpoint
router.get('/', (req, res) => {
    res.json({ message: 'Assist AI API v1 active' });
});

// Appointment Routes
router.use('/appointments', appointmentRoutes);
router.use('/reviews', reviewRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/auth', authRoutes);
router.use('/handover', handoverRoutes);

module.exports = router;