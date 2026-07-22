import express from 'express';
import { getDashboardStats } from '../controllers/dashboardController.js';

const router = express.Router();

// GET /api/dashboard/stats - Fetch overview and analytics data for dashboard
router.get('/stats', getDashboardStats);

export default router;