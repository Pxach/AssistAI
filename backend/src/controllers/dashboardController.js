import db from '../database/db.js';
import { convertToCSV } from '../utils/csvFormatter.js';

/**
 * Helper to apply dynamic timeframe filters based on request query params
 */
const applyTimeframeFilter = (query, timeframe, dateColumn = 'created_at') => {
  const getSubtractedDate = (days = 0, months = 0, years = 0) => {
    const d = new Date();
    if (days) d.setDate(d.getDate() - days);
    if (months) d.setMonth(d.getMonth() - months);
    if (years) d.setFullYear(d.getFullYear() - years);
    return d;
  };

  switch (timeframe?.toLowerCase()) {
    case 'today':
    case 'per day':
    case 'day':
      return query.where(dateColumn, '>=', getSubtractedDate(1));
    case 'this week':
    case 'per week':
    case 'week':
      return query.where(dateColumn, '>=', getSubtractedDate(7));
    case 'this month':
    case 'per month':
    case 'month':
      return query.where(dateColumn, '>=', getSubtractedDate(0, 1));
    case 'this year':
    case 'per year':
    case 'year':
      return query.where(dateColumn, '>=', getSubtractedDate(0, 0, 1));
    case 'all-time':
    default:
      return query;
  }
};

/**
 * GET /api/dashboard/stats
 */
export const getDashboardStats = async (req, res) => {
  try {
    const { timeframe = 'All-time', chartView = 'month' } = req.query;

    // 1. STAT CARDS CALCULATIONS
    const conversationsCount = await applyTimeframeFilter(db('conversations'), timeframe, 'created_at')
      .count('id as count')
      .first();

    const reviewsCount = await applyTimeframeFilter(db('Review'), timeframe, 'CreatedAt')
      .count('ReviewID as count')
      .first();

    const bookingsCount = await applyTimeframeFilter(db('appointments'), timeframe, 'created_at')
      .count('id as count')
      .first();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const negativeReviewsToday = await db('Review')
      .where('CreatedAt', '>=', todayStart)
      .where(function () {
        this.where('Sentiment', 'Negative').orWhere('Rating', '<=', 2);
      })
      .count('ReviewID as count')
      .first();

    const flaggedToday = await db('FlaggedMessages')
      .where('created_at', '>=', todayStart)
      .count('id as count')
      .first();

    const alertsToday =
      (parseInt(negativeReviewsToday?.count || 0, 10)) +
      (parseInt(flaggedToday?.count || 0, 10));

    // 2. ACTIVITY BAR CHART CALCULATIONS
    let truncUnit = 'month';
    if (chartView === 'day') truncUnit = 'day';
    else if (chartView === 'week') truncUnit = 'week';
    else if (chartView === 'year') truncUnit = 'year';

    const activityDataRaw = await applyTimeframeFilter(db('conversations'), timeframe, 'created_at')
      .select(
        db.raw(`DATE_TRUNC('${truncUnit}', "created_at") as period`),
        db.raw('COUNT("id")::integer as val')
      )
      .groupBy('period')
      .orderBy('period', 'asc');

    const activityData = activityDataRaw.map((row) => {
      const date = new Date(row.period);
      let label = date.toLocaleString('default', { month: 'short' }).toUpperCase();
      if (truncUnit === 'day') label = `${date.getMonth() + 1}/${date.getDate()}`;
      if (truncUnit === 'year') label = `${date.getFullYear()}`;
      return { label, val: row.val };
    });

    // 3. HUMAN INTERVENTION LIST (Flagged Messages needing review)
    const humanInterventions = await db('FlaggedMessages')
      .select(
        'id',
        'conversation_id',
        'flagged_by',
        'message_text',
        'flag_reason',
        'created_at'
      )
      .orderBy('created_at', 'desc')
      .limit(5);

    return res.status(200).json({
      success: true,
      data: {
        overview: {
          totalConversations: parseInt(conversationsCount?.count || 0, 10),
          totalReviews: parseInt(reviewsCount?.count || 0, 10),
          totalBookings: parseInt(bookingsCount?.count || 0, 10),
          alertsToday,
        },
        activityData,
        humanInterventions,
      },
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard statistics',
      error: error.message,
    });
  }
};

/**
 * GET /api/dashboard/export-csv
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
      error: error.message,
    });
  }
};