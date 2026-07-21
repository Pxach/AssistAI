const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');

// GET /api/reviews - Fetch review list
router.get('/', reviewController.getReviews);

// POST /api/reviews - Submit review and get redirection URL
router.post('/', reviewController.submitReview);

module.exports = router;