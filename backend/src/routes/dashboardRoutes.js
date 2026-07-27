import express from 'express';
import db from '../database/db.js'; // Adjust path to your database file if needed
import { getDashboardStats, exportCsv } from '../controllers/dashboardController.js';
const router = express.Router();
router.get('/stats', getDashboardStats);
router.get('/export-csv', exportCsv);
// ==========================================
// 1. BOOKING ANALYTICS ENDPOINT
// ==========================================
router.get('/booking-stats', async (req, res) => {
  try {
    const { timeframe = 'All-time' } = req.query;

    let startDate = null;
    const now = new Date();

    if (timeframe === 'Per Day') {
      startDate = new Date(now.setHours(0, 0, 0, 0));
    } else if (timeframe === 'Per Week') {
      startDate = new Date(now.setDate(now.getDate() - 7));
    } else if (timeframe === 'Per Month') {
      startDate = new Date(now.setMonth(now.getMonth() - 1));
    } else if (timeframe === 'Per Year') {
      startDate = new Date(now.setFullYear(now.getFullYear() - 1));
    }

    const applyDateFilter = (query) => {
      if (startDate) {
        return query.where('created_at', '>=', startDate);
      }
      return query;
    };

    const totalRequestsRes = await applyDateFilter(db('appointments')).count('id as count').first();
    const totalBookingRequests = parseInt(totalRequestsRes.count, 10) || 0;

    const confirmedRes = await applyDateFilter(db('appointments'))
      .whereIn('status', ['confirmed', 'completed'])
      .count('id as count')
      .first();
    const totalConfirmedBookings = parseInt(confirmedRes.count, 10) || 0;

    const unconfirmedRes = await applyDateFilter(db('appointments'))
      .whereIn('status', ['pending', 'unconfirmed'])
      .count('id as count')
      .first();
    const totalUnconfirmedBookings = parseInt(unconfirmedRes.count, 10) || 0;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayRes = await db('appointments')
      .where('created_at', '>=', todayStart)
      .count('id as count')
      .first();
    const bookingsToday = parseInt(todayRes.count, 10) || 0;

    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    const weekRes = await db('appointments')
      .where('created_at', '>=', weekStart)
      .count('id as count')
      .first();
    const bookingsThisWeek = parseInt(weekRes.count, 10) || 0;

    const peakMonthRes = await applyDateFilter(
      db('appointments')
        .select(db.raw("TRIM(TO_CHAR(appointment_date, 'Month')) as month_name"))
        .count('id as count')
        .groupBy(db.raw("TRIM(TO_CHAR(appointment_date, 'Month'))"))
        .orderBy('count', 'desc')
    ).first();
    const peakBookingMonth = peakMonthRes ? peakMonthRes.month_name : 'N/A';

    const mostBookedSlotRes = await applyDateFilter(
      db('appointments')
        .select('appointment_time')
        .count('id as count')
        .groupBy('appointment_time')
        .orderBy('count', 'desc')
    ).first();

    let mostBookedTimeSlot = 'N/A';
    if (mostBookedSlotRes && mostBookedSlotRes.appointment_time) {
      const timeStr = mostBookedSlotRes.appointment_time;
      const hour = parseInt(timeStr.split(':')[0], 10);
      const ampm = hour >= 12 ? 'pm' : 'am';
      const formattedHour = hour % 12 || 12;
      mostBookedTimeSlot = `${formattedHour}${ampm}`;
    }

    const totalPie = totalConfirmedBookings + totalUnconfirmedBookings;
    const confirmedPct = totalPie > 0 ? ((totalConfirmedBookings / totalPie) * 100).toFixed(1) : 0;
    const unconfirmedPct = totalPie > 0 ? ((totalUnconfirmedBookings / totalPie) * 100).toFixed(1) : 0;

    let chartQuery;
    if (timeframe === 'Per Day' || timeframe === 'Per Week') {
      chartQuery = applyDateFilter(
        db('appointments')
          .select(db.raw("TO_CHAR(created_at, 'MM/DD') as label"))
          .count('id as val')
          .groupBy(db.raw("TO_CHAR(created_at, 'MM/DD')"))
          .orderBy('label', 'asc')
      );
    } else {
      chartQuery = applyDateFilter(
        db('appointments')
          .select(db.raw("UPPER(TO_CHAR(created_at, 'Mon')) as label"))
          .count('id as val')
          .groupBy(db.raw("UPPER(TO_CHAR(created_at, 'Mon'))"))
      );
    }

    const rawChartData = await chartQuery;
    const chartData = rawChartData.map((row) => ({
      label: row.label,
      val: parseInt(row.val, 10)
    }));

    return res.json({
      success: true,
      data: {
        overview: {
          totalBookingRequests,
          totalConfirmedBookings,
          totalUnconfirmedBookings,
          bookingsToday,
          bookingsThisWeek,
          peakBookingMonth,
          mostBookedTimeSlot
        },
        pieChart: {
          confirmed: totalConfirmedBookings,
          confirmedPct: parseFloat(confirmedPct),
          unconfirmed: totalUnconfirmedBookings,
          unconfirmedPct: parseFloat(unconfirmedPct)
        },
        chartData
      }
    });
  } catch (err) {
    console.error('Error fetching booking analytics:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});


// ==========================================
// 2. REVIEW ANALYTICS ENDPOINT
// ==========================================
router.get('/review-stats', async (req, res) => {
  try {
    const { timeframe = 'All-time' } = req.query;

    let startDate = null;
    const now = new Date();

    if (timeframe === 'Per Day') {
      startDate = new Date(now.setHours(0, 0, 0, 0));
    } else if (timeframe === 'Per Week') {
      startDate = new Date(now.setDate(now.getDate() - 7));
    } else if (timeframe === 'Per Month') {
      startDate = new Date(now.setMonth(now.getMonth() - 1));
    } else if (timeframe === 'Per Year') {
      startDate = new Date(now.setFullYear(now.getFullYear() - 1));
    }

    const applyDateFilter = (query) => {
      if (startDate) {
        return query.where('CreatedAt', '>=', startDate);
      }
      return query;
    };

    const totalReviewsRes = await applyDateFilter(db('Review')).count('ReviewID as count').first();
    const totalReviews = parseInt(totalReviewsRes.count, 10) || 0;

    const positiveRes = await applyDateFilter(db('Review'))
      .where(function() {
        this.where('Sentiment', 'Positive').orWhere('Rating', '>=', 4);
      })
      .count('ReviewID as count')
      .first();
    const totalPositiveReviews = parseInt(positiveRes.count, 10) || 0;

    const negativeRes = await applyDateFilter(db('Review'))
      .where(function() {
        this.where('Sentiment', 'Negative').orWhere('Rating', '<=', 2);
      })
      .count('ReviewID as count')
      .first();
    const totalNegativeReviews = parseInt(negativeRes.count, 10) || 0;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const alertsTodayRes = await db('Review')
      .where('CreatedAt', '>=', todayStart)
      .where(function() {
        this.where('Sentiment', 'Negative').orWhere('Rating', '<=', 2);
      })
      .count('ReviewID as count')
      .first();
    const alertsToday = parseInt(alertsTodayRes.count, 10) || 0;

    const recentNegativeReviews = await applyDateFilter(
      db('Review')
        .select('ReviewID', 'CreatedAt', 'ReviewText', 'Category')
        .where(function() {
          this.where('Sentiment', 'Negative').orWhere('Rating', '<=', 2);
        })
        .orderBy('CreatedAt', 'desc')
        .limit(5)
    );

    const totalPie = totalPositiveReviews + totalNegativeReviews;
    const positivePct = totalPie > 0 ? ((totalPositiveReviews / totalPie) * 100).toFixed(1) : 0;
    const negativePct = totalPie > 0 ? ((totalNegativeReviews / totalPie) * 100).toFixed(1) : 0;

    const categoryCounts = await applyDateFilter(
      db('Review')
        .select('Category')
        .count('ReviewID as count')
        .where(function() {
          this.where('Sentiment', 'Negative').orWhere('Rating', '<=', 2);
        })
        .whereNotNull('Category')
        .groupBy('Category')
        .orderBy('count', 'desc')
    );

    const totalCategoryReviews = categoryCounts.reduce((acc, cur) => acc + parseInt(cur.count, 10), 0);
    const categoriesData = categoryCounts.map((cat) => {
      const count = parseInt(cat.count, 10);
      const pct = totalCategoryReviews > 0 ? ((count / totalCategoryReviews) * 100).toFixed(1) : 0;
      return {
        label: cat.Category || 'General',
        count,
        pct: parseFloat(pct)
      };
    });

    let dateFormat = "UPPER(TO_CHAR(\"CreatedAt\", 'Mon'))";
    if (timeframe === 'Per Day' || timeframe === 'Per Week') {
      dateFormat = "TO_CHAR(\"CreatedAt\", 'MM/DD')";
    }

    const groupedChartRaw = await applyDateFilter(
      db('Review')
        .select(
          db.raw(`${dateFormat} as label`),
          db.raw('COUNT("ReviewID") as total'),
          db.raw("COUNT(CASE WHEN \"Sentiment\" = 'Positive' OR \"Rating\" >= 4 THEN 1 END) as positive"),
          db.raw("COUNT(CASE WHEN \"Sentiment\" = 'Negative' OR \"Rating\" <= 2 THEN 1 END) as negative")
        )
        .groupBy(db.raw(dateFormat))
    );

    const chartData = groupedChartRaw.map((row) => ({
      label: row.label,
      total: parseInt(row.total, 10),
      positive: parseInt(row.positive, 10),
      negative: parseInt(row.negative, 10)
    }));

    return res.json({
      success: true,
      data: {
        overview: {
          totalReviews,
          totalPositiveReviews,
          totalNegativeReviews,
          alertsToday
        },
        negativeReviews: recentNegativeReviews,
        pieChart: {
          positive: totalPositiveReviews,
          positivePct: parseFloat(positivePct),
          negative: totalNegativeReviews,
          negativePct: parseFloat(negativePct)
        },
        categories: categoriesData,
        chartData
      }
    });
  } catch (err) {
    console.error('Error fetching review stats:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});
// ==========================================
// CHAT ANALYTICS ENDPOINT
// ==========================================
router.get('/chat-stats', async (req, res) => {
  try {
    const { timeframe = 'All-time' } = req.query;

    let startDate = null;
    const now = new Date();

    if (timeframe === 'Per Day') {
      startDate = new Date(now.setHours(0, 0, 0, 0));
    } else if (timeframe === 'Per Week') {
      startDate = new Date(now.setDate(now.getDate() - 7));
    } else if (timeframe === 'Per Month') {
      startDate = new Date(now.setMonth(now.getMonth() - 1));
    } else if (timeframe === 'Per Year') {
      startDate = new Date(now.setFullYear(now.getFullYear() - 1));
    }

    const applyDateFilter = (query, dateCol = 'created_at') => {
      if (startDate) {
        return query.where(dateCol, '>=', startDate);
      }
      return query;
    };

    // 1. Total Conversations Count
    const totalConvsRes = await applyDateFilter(db('conversations')).count('id as count').first();
    const totalConversations = parseInt(totalConvsRes?.count, 10) || 0;

    // 2. Chatbot vs Human vs Unanswered Conversations
    const chatbotHandledRes = await applyDateFilter(db('conversations'))
      .where('handled_by', 'bot')
      .count('id as count')
      .first();
    const chatbotHandled = parseInt(chatbotHandledRes?.count, 10) || 0;

    const humanHandledRes = await applyDateFilter(db('conversations'))
      .where('handled_by', 'human')
      .count('id as count')
      .first();
    const humanHandled = parseInt(humanHandledRes?.count, 10) || 0;

    const unansweredRes = await applyDateFilter(db('conversations'))
      .where('status', 'unanswered')
      .count('id as count')
      .first();
    const unanswered = parseInt(unansweredRes?.count, 10) || 0;

    // Percentages
    const pieTotal = chatbotHandled + humanHandled + unanswered || 1;
    const chatbotPct = parseFloat(((chatbotHandled / pieTotal) * 100).toFixed(1));
    const humanPct = parseFloat(((humanHandled / pieTotal) * 100).toFixed(1));
    const unansweredPct = parseFloat(((unanswered / pieTotal) * 100).toFixed(1));

    // Percent metrics for top cards
    const usefulnessPct = parseFloat(((chatbotHandled / pieTotal) * 100).toFixed(0));
    const humanInterventionPct = parseFloat(((humanHandled / pieTotal) * 100).toFixed(0));

    // 3. Total Flagged Customer & Bot Responses
    const flaggedCustomerRes = await applyDateFilter(db('chat_messages'))
      .where('sender_type', 'customer')
      .where('is_flagged', true)
      .count('id as count')
      .first();
    const totalFlaggedCustomer = parseInt(flaggedCustomerRes?.count, 10) || 0;

    const flaggedBotRes = await applyDateFilter(db('chat_messages'))
      .where('sender_type', 'bot')
      .where('is_flagged', true)
      .count('id as count')
      .first();
    const totalFlaggedBot = parseInt(flaggedBotRes?.count, 10) || 0;

    // 4. Flagged Message Detail Lists
    const flaggedCustomerList = await applyDateFilter(
      db('chat_messages')
        .select('id', 'conversation_id', 'message_text', 'created_at', 'flag_reason')
        .where('sender_type', 'customer')
        .where('is_flagged', true)
        .orderBy('created_at', 'desc')
        .limit(10)
    );

    const flaggedBotList = await applyDateFilter(
      db('chat_messages')
        .select('id', 'conversation_id', 'message_text', 'created_at', 'flag_reason')
        .where('sender_type', 'bot')
        .where('is_flagged', true)
        .orderBy('created_at', 'desc')
        .limit(10)
    );

    // 5. Monthly Breakdown Chart (Conversations per month)
    const monthlyChartRaw = await applyDateFilter(
      db('conversations')
        .select(
          db.raw("UPPER(TO_CHAR(created_at, 'Mon')) as month_label"),
          db.raw("EXTRACT(MONTH FROM created_at) as month_num"),
          db.raw("COUNT(CASE WHEN handled_by = 'bot' THEN 1 END) as bot_count"),
          db.raw("COUNT(CASE WHEN handled_by = 'human' THEN 1 END) as human_count")
        )
        .groupBy(db.raw("UPPER(TO_CHAR(created_at, 'Mon')), EXTRACT(MONTH FROM created_at)"))
        .orderBy(db.raw("EXTRACT(MONTH FROM created_at)"), 'asc')
    );

    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const monthlyMap = new Map(monthlyChartRaw.map((m) => [m.month_label, m]));

    const chartData = months.map((m) => {
      const match = monthlyMap.get(m);
      return {
        label: m,
        chatbot: match ? parseInt(match.bot_count, 10) : 0,
        human: match ? parseInt(match.human_count, 10) : 0
      };
    });

    return res.json({
      success: true,
      data: {
        overview: {
          usefulnessPct,
          humanInterventionPct,
          totalFlaggedCustomer,
          totalFlaggedBot
        },
        flaggedCustomerResponses: flaggedCustomerList,
        flaggedBotResponses: flaggedBotList,
        pieChart: {
          chatbot: chatbotHandled,
          chatbotPct,
          human: humanHandled,
          humanPct,
          unanswered,
          unansweredPct
        },
        chartData
      }
    });
  } catch (err) {
    console.error('Error fetching chat analytics:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});
export default router;