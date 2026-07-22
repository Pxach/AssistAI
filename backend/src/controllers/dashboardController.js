// Mock Dashboard Analytics Metrics
export const getDashboardStats = async (req, res) => {
    try {
        res.status(200).json({
            success: true,
            data: {
                overview: {
                    totalConversations: 128,
                    totalReviews: 42,
                    totalBookings: 19,
                    humanInterventionsNeeded: 3,
                    window24HourAlerts: 2
                },
                reviewMetrics: {
                    positivePercentage: 81,
                    negativePercentage: 19,
                    positiveCount: 34,
                    negativeCount: 8,
                    negativeCauseCategories: [
                        { category: 'Long Response Delay', count: 5 },
                        { category: 'Wrong Availability Slot', count: 3 }
                    ]
                },
                bookingMetrics: {
                    bookingsToday: 4,
                    bookingsThisWeek: 12,
                    peakBookingHour: '14:00 - 15:00',
                    peakBookingDay: 'Wednesday'
                },
                chatMetrics: {
                    conversationsPerDay: 18,
                    chatbotUsefulnessRate: '92%'
                }
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch dashboard statistics',
            error: error.message
        });
    }
};