// Mock Data Store for Reviews
let mockReviews = [
    {
        ReviewID: 'rev-101',
        CustomerID: 'cust-001',
        Rating: 5,
        ReviewText: 'Great customer service and fast response!',
        Sentiment: 'positive',
        Category: 'General Inquiry',
        CreatedAt: new Date().toISOString()
    }
];

// Get all reviews (For Dashboard Analytics)
export const getReviews = async (req, res) => {
    try {
        res.status(200).json({ success: true, count: mockReviews.length, data: mockReviews });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch reviews', error: error.message });
    }
};

// Submit customer review & determine redirection logic
export const submitReview = async (req, res) => {
    const { rating, reviewText, phoneNumber } = req.body;

    if (!rating) {
        return res.status(400).json({ success: false, message: 'Rating is required.' });
    }

    // Classify sentiment based on rating threshold
    const sentiment = rating >= 4 ? 'positive' : 'negative';
    
    // Determine redirection link according to project requirements
    const redirectUrl = sentiment === 'positive'
        ? 'https://search.google.com/local/writereview?placeid=YOUR_GOOGLE_PLACE_ID'
        : 'https://tally.so/r/troubleshooting-darija-form';

    const newReview = {
        ReviewID: `rev-${Date.now()}`,
        CustomerID: `cust-${phoneNumber || Date.now()}`,
        Rating: rating,
        ReviewText: reviewText || '',
        Sentiment: sentiment,
        Category: sentiment === 'negative' ? 'Service Quality' : 'General',
        CreatedAt: new Date().toISOString()
    };

    mockReviews.push(newReview);

    res.status(201).json({
        success: true,
        message: 'Review received and classified',
        sentiment: sentiment,
        redirectUrl: redirectUrl,
        data: newReview
    });
};