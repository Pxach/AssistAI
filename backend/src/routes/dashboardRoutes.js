const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');

// GET /api/dashboard/stats - Fetch overview and analytics data for dashboard
router.get('/stats', dashboardController.getDashboardStats);

module.exports = router;