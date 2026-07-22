import express from 'express';
import appointmentRoutes from './appointmentRoutes.js';
import authRoutes from './authRoutes.js';
import reviewRoutes from './reviewRoutes.js';
import handoverRoutes from './handoverRoutes.js';
import dashboardRoutes from './dashboardRoutes.js';

const router = express.Router();

router.use('/appointments', appointmentRoutes);
router.use('/auth', authRoutes);
router.use('/reviews', reviewRoutes);
router.use('/handover', handoverRoutes);
router.use('/dashboard', dashboardRoutes);

export default router;