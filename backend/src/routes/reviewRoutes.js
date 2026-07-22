import express from 'express';
import { getReviews, submitReview } from '../controllers/reviewController.js';

const router = express.Router();

// GET /api/reviews - Fetch review list
router.get('/', getReviews);

// POST /api/reviews - Submit review and get redirection URL
router.post('/', submitReview);

export default router;