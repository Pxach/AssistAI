import db from '../database/db.js';
import { convertToCSV } from '../utils/csvFormatter.js';

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

/**
 * GET /api/dashboard/export-csv
 * Exports appointment records as a downloadable CSV file.
 */
export const exportCsv = async (req, res) => {
    try {
        const records = await db('appointments')
            .leftJoin('services', 'appointments.service_id', 'services.id')
            .leftJoin('specialists', 'appointments.specialist_id', 'specialists.id')
            .select(
                'appointments.id',
                'appointments.customer_name',
                'appointments.contact_info',
                'services.name as service_name',
                'specialists.name as specialist_name',
                'appointments.appointment_date',
                'appointments.appointment_time',
                'appointments.status',
                'appointments.created_at'
            );

        const csvData = convertToCSV(records);

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="appointments_export.csv"');
        
        return res.status(200).send(csvData);
    } catch (error) {
        console.error('Error generating CSV export:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to generate CSV export',
            error: error.message
        });
    }
};