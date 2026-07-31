import db from '../database/db.js';

// Get all reviews (For Dashboard Analytics)
export const getReviews = async (req, res) => {
    try {
        const reviews = await db('Review').select('*');
        res.status(200).json({ success: true, count: reviews.length, data: reviews });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch reviews', error: error.message });
    }
};

// Submit customer review & determine redirection logic
export const submitReview = async (req, res) => {
    try {
        const { rating, reviewText, phoneNumber } = req.body;

        if (!rating) {
            return res.status(400).json({ success: false, message: 'Rating is required.' });
        }

        // Classify sentiment based on rating threshold
        const sentiment = rating >= 4 ? 'Positive' : 'Negative';
        
        // Determine redirection link according to project requirements
        const redirectUrl = sentiment === 'Positive'
            ? 'https://search.google.com/local/writereview?placeid=YOUR_GOOGLE_PLACE_ID'
            : 'https://tally.so/r/troubleshooting-darija-form';

        const newReview = {
            ReviewID: `rev-${Date.now()}`,
            CustomerID: `cust-${phoneNumber || Date.now()}`,
            Rating: rating,
            ReviewText: reviewText || '',
            Sentiment: sentiment,
            Category: sentiment === 'Negative' ? 'Service Quality' : 'General',
            CreatedAt: new Date().toISOString()
        };

        await db('Review').insert(newReview);

        res.status(201).json({
            success: true,
            message: 'Review received and classified',
            sentiment: sentiment,
            redirectUrl: redirectUrl,
            data: newReview
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to submit review', error: error.message });
    }
};