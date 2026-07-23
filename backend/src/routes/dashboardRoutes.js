import express from 'express';
import { getDashboardStats, exportCsv } from '../controllers/dashboardController.js';

const router = express.Router();

// GET /api/dashboard/stats - Fetch overview and analytics data for dashboard
router.get('/stats', getDashboardStats);

// GET /api/dashboard/export-csv - Download appointment records as CSV
router.get('/export-csv', exportCsv);

export default router;