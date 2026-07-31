'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  MessageSquare, 
  Star, 
  Calendar, 
  Download, 
  Loader2,
  Home,
  Headphones,
  Smartphone
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function ReviewAnalyticsPage() {
  const [stats, setStats] = useState({
    totalReviews: 0,
    totalPositiveReviews: 0,
    totalNegativeReviews: 0,
    alertsToday: 0
  });

  const [negativeReviews, setNegativeReviews] = useState([]);
  const [expandedReviewId, setExpandedReviewId] = useState(null);

  const [pieData, setPieData] = useState({
    positive: 0,
    positivePct: 0,
    negative: 0,
    negativePct: 0
  });

  const [categories, setCategories] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [timeframe, setTimeframe] = useState('All-time');
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState({
    name: 'Admin User',
    email: 'admin@example.com'
  });

  // Safely sync user info from localStorage without triggering cascading render warnings
  useEffect(() => {
    const storedEmail = localStorage.getItem('email') || localStorage.getItem('userEmail');
    const storedName = localStorage.getItem('name') || localStorage.getItem('userName');

    if (storedEmail) {
      queueMicrotask(() => {
        setUser({
          name: storedName || storedEmail.split('@')[0].toUpperCase(),
          email: storedEmail
        });
      });
    }
  }, []);

  // Fetch Review Analytics Data
  useEffect(() => {
    let isMounted = true;

    async function loadReviewData() {
      try {
        setLoading(true);
        const response = await fetch(
          `${API_BASE}/api/dashboard/review-stats?timeframe=${encodeURIComponent(timeframe)}`,
          {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            cache: 'no-store'
          }
        );
        const result = await response.json();
        if (result.success && isMounted) {
          setStats(result.data.overview || {});
          setNegativeReviews(result.data.negativeReviews || []);
          setPieData(result.data.pieChart || {});
          setCategories(result.data.categories || []);
          setChartData(result.data.chartData || []);
        }
      } catch (err) {
        console.error('Failed to load review analytics:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadReviewData();

    return () => {
      isMounted = false;
    };
  }, [timeframe]);

  const handleTimeframeChange = (e) => {
    setTimeframe(e.target.value);
  };

  const handleCsvDownload = async () => {
    try {
      // Passes current timeframe selection to CSV export endpoint
      const response = await fetch(
        `${API_BASE}/api/dashboard/export-csv?timeframe=${encodeURIComponent(timeframe)}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `review_analytics_${timeframe.toLowerCase().replace(/\s+/g, '_')}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      console.error('CSV Export Failed:', err);
    }
  };

  // Maximum value for scaling grouped bars
  const maxBarVal = Math.max(
    ...chartData.map((d) => Math.max(d.total || 0, d.positive || 0, d.negative || 0)),
    1
  );
  const labelStep = Math.max(1, Math.ceil(chartData.length / 10));

  // Sentiment Pie Chart Conic Calculation
  const totalReviewPie = (pieData.positive || 0) + (pieData.negative || 0);
  const positiveDegree = ((pieData.positivePct || 0) / 100) * 360;
  const reviewPieStyle = totalReviewPie > 0
    ? `conic-gradient(#65D44B 0deg ${positiveDegree}deg, #FF8A3D ${positiveDegree}deg 360deg)`
    : 'conic-gradient(#E2E8F0 0deg 360deg)';

  // Category Pie Chart Multi-Color Conic Calculation
  const categoryPalette = ['#7C5CFC', '#FF8A3D', '#3B82F6', '#EAB308', '#10B981', '#EC4899'];

  const categoryGradients = [];
  let accumulatedDeg = 0;

  for (let idx = 0; idx < categories.length; idx++) {
    const cat = categories[idx];
    const deg = ((cat.pct || 0) / 100) * 360;
    const start = accumulatedDeg;
    accumulatedDeg += deg;
    const color = categoryPalette[idx % categoryPalette.length];
    categoryGradients.push(`${color} ${start}deg ${accumulatedDeg}deg`);
  }

  const categoryConicStyle = categoryGradients.length > 0 
    ? `conic-gradient(${categoryGradients.join(', ')})`
    : 'conic-gradient(#E2E8F0 0deg 360deg)';

  return (
    <div className="flex h-screen bg-[#F8F9FD] text-slate-800 font-sans overflow-hidden">
      
      {/* SIDEBAR */}
<aside className="w-64 bg-[#7C5CFC] text-white flex flex-col justify-between p-6 shadow-lg shrink-0">
  <div>
    {/* Navigation Links */}
    <nav className="space-y-6 mt-6">
      {/* 1. Home Page */}
      <Link 
        href="/dashboard" 
        className="flex items-center space-x-3 w-full text-left font-medium hover:opacity-80 transition"
      >
        <Home className="w-5 h-5" />
        <span>Home Page</span>
      </Link>

      {/* 2. Chat Analytics */}
      <Link 
        href="/chat-analytics" 
        className="flex items-center space-x-3 w-full text-left font-medium hover:opacity-80 transition"
      >
        <MessageSquare className="w-5 h-5" />
        <span>Chat Analytics</span>
      </Link>

      {/* 3. Live Intervention Hub */}
      <Link 
        href="/LiveIntervention" 
        className="flex items-center justify-between w-full font-medium hover:opacity-80 transition group"
      >
        <div className="flex items-center space-x-3">
          <Headphones className="w-5 h-5" />
          <span>Live Intervention</span>
        </div>
        <span className="flex items-center text-[10px] bg-red-500/20 text-red-200 border border-red-400/40 font-bold px-2 py-0.5 rounded-full">
          <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-ping mr-1" />
          LIVE
        </span>
      </Link>

      {/* 4. Connect Device */}
      <Link 
        href="/connect-device" 
        className="flex items-center space-x-3 w-full text-left font-medium hover:opacity-80 transition"
      >
        <Smartphone className="w-5 h-5" />
        <span>Connect Device</span>
      </Link>

      {/* 5. Review Analytics */}
      <Link 
        href="/review-analytics" 
        className="flex items-center space-x-3 w-full text-left font-medium hover:opacity-80 transition"
      >
        <Star className="w-5 h-5" />
        <span>Review Analytics</span>
      </Link>

      {/* 6. Booking Analytics */}
      <Link 
        href="/booking-analytics" 
        className="flex items-center space-x-3 w-full text-left font-medium hover:opacity-80 transition"
      >
        <Calendar className="w-5 h-5" />
        <span>Booking Analytics</span>
      </Link>

      {/* 7. Download Action */}
      <button 
        onClick={handleCsvDownload}
        className="flex items-center space-x-3 w-full text-left font-medium hover:opacity-80 transition pt-2"
      >
        <Download className="w-5 h-5" />
        <span>Download as CSV</span>
      </button>
    </nav>
  </div>
</aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 overflow-y-auto p-8 min-w-0">
        
        {/* HEADER */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Review Analytics</h1>
          {loading && <Loader2 className="w-5 h-5 animate-spin text-[#7C5CFC]" />}
        </div>

        {/* SINGLE GLOBAL TIMEFRAME DROPDOWN */}
        <div className="mb-8 inline-block relative">
          <div className="flex items-center bg-white border border-slate-200 rounded-full px-5 py-2.5 text-sm text-slate-600 shadow-sm">
            <span className="mr-2">Timeframe:</span>
            <select 
              value={timeframe} 
              onChange={handleTimeframeChange}
              className="font-semibold text-slate-800 bg-transparent outline-none cursor-pointer pr-2"
            >
              <option value="All-time">All-time</option>
              <option value="Per Year">Per Year</option>
              <option value="Per Month">Per Month</option>
              <option value="Per Week">Per Week</option>
              <option value="Per Day">Per Day</option>
            </select>
          </div>
        </div>

        {/* MAIN DASHBOARD GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* LEFT COLUMN: 4 SQUARES + NEGATIVE REVIEWS CARD */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* 4 Stat Cards */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#7C5CFC] text-white p-5 rounded-2xl shadow-sm flex flex-col justify-between h-36">
                <p className="text-xs font-medium text-white/90">Total Reviews</p>
                <p className="text-3xl font-bold">{stats.totalReviews || 0}</p>
              </div>

              <div className="bg-[#7C5CFC] text-white p-5 rounded-2xl shadow-sm flex flex-col justify-between h-36">
                <p className="text-xs font-medium text-white/90">Total Positive Reviews</p>
                <p className="text-3xl font-bold">{stats.totalPositiveReviews || 0}</p>
              </div>

              <div className="bg-[#7C5CFC] text-white p-5 rounded-2xl shadow-sm flex flex-col justify-between h-36">
                <p className="text-xs font-medium text-white/90">Total Negative Reviews</p>
                <p className="text-3xl font-bold">{stats.totalNegativeReviews || 0}</p>
              </div>

              <div className="bg-[#7C5CFC] text-white p-5 rounded-2xl shadow-sm flex flex-col justify-between h-36">
                <p className="text-xs font-medium text-white/90">Number of Alerts Today</p>
                <p className="text-3xl font-bold">{stats.alertsToday || 0}</p>
              </div>
            </div>

            {/* Negative Reviews List Card */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="text-xs font-semibold text-slate-500 mb-4">Negative Reviews</h3>

              <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                {negativeReviews.length > 0 ? (
                  negativeReviews.map((rev, idx) => {
                    const reviewId = rev.ReviewID || idx;
                    const isExpanded = expandedReviewId === reviewId;
                    const formattedDate = rev.CreatedAt 
                      ? new Date(rev.CreatedAt).toLocaleString('en-US', {
                          month: 'numeric',
                          day: 'numeric',
                          year: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true
                        })
                      : 'N/A';

                    return (
                      <div 
                        key={reviewId}
                        onClick={() => setExpandedReviewId(isExpanded ? null : reviewId)}
                        className="w-full bg-[#FF8A3D] text-white rounded-xl shadow-sm cursor-pointer transition-all duration-200 hover:opacity-95 overflow-hidden"
                      >
                        {/* Header Row */}
                        <div className="py-3 px-4 flex items-center justify-between text-xs font-medium">
                          <span>Review {idx + 1}: {formattedDate}</span>
                          <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full select-none">
                            {isExpanded ? 'Hide' : 'View Content'}
                          </span>
                        </div>

                        {/* Expandable Review Content */}
                        {isExpanded && (
                          <div className="px-4 pb-3.5 pt-2 border-t border-white/20 bg-[#f27e30] text-white/95">
                            {rev.Category && (
                              <span className="inline-block bg-white text-[#FF8A3D] text-[10px] font-bold px-2 py-0.5 rounded mb-2">
                                {rev.Category}
                              </span>
                            )}
                            <p className="text-xs leading-relaxed italic">
                              {rev.ReviewText || 'No detailed text available for this review.'}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <p className="text-xs text-slate-400">No negative reviews reported.</p>
                )}
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: GROUPED BAR CHART & 2 PIE CHARTS */}
          <div className="lg:col-span-7 space-y-8 min-w-0">
            
            {/* 1. GROUPED BAR CHART */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between min-w-0 relative">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-semibold text-slate-700">Reviews</h3>
              </div>

              {/* Grouped Bar Chart Container */}
              <div className="h-52 flex items-end justify-between gap-1 pt-10 border-b border-slate-100 pb-2">
                {chartData.length > 0 ? (
                  chartData.map((item, idx) => (
                    <div key={idx} className="flex-1 flex items-end justify-center gap-1 h-full min-w-0 group relative">
                      {/* Tooltip */}
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover:flex bg-slate-800 text-white text-[10px] font-medium py-1 px-2 rounded shadow-md z-30 whitespace-nowrap pointer-events-none">
                        {item.label} | Total: {item.total || 0}, Pos: {item.positive || 0}, Neg: {item.negative || 0}
                      </div>

                      {/* Bar 1: Total (Blue) */}
                      <div 
                        style={{ height: `${((item.total || 0) / maxBarVal) * 100}%` }}
                        className="w-1.5 bg-[#3B82F6] rounded-t-full transition-all duration-300"
                      />
                      {/* Bar 2: Positive (Red/Coral) */}
                      <div 
                        style={{ height: `${((item.positive || 0) / maxBarVal) * 100}%` }}
                        className="w-1.5 bg-[#EF4444] rounded-t-full transition-all duration-300"
                      />
                      {/* Bar 3: Negative (Green) */}
                      <div 
                        style={{ height: `${((item.negative || 0) / maxBarVal) * 100}%` }}
                        className="w-1.5 bg-[#22C55E] rounded-t-full transition-all duration-300"
                      />
                    </div>
                  ))
                ) : (
                  <div className="w-full flex items-center justify-center text-xs text-slate-400">
                    No review records found for this period.
                  </div>
                )}
              </div>

              {/* Chart Legend */}
              <div className="flex justify-center space-x-6 text-xs text-slate-500 mt-3 font-medium">
                <div className="flex items-center space-x-1.5">
                  <span className="w-2.5 h-2.5 bg-[#3B82F6] rounded-sm inline-block"></span>
                  <span>Reviews</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <span className="w-2.5 h-2.5 bg-[#EF4444] rounded-sm inline-block"></span>
                  <span>Positive</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <span className="w-2.5 h-2.5 bg-[#22C55E] rounded-sm inline-block"></span>
                  <span>Negative</span>
                </div>
              </div>

              {/* X-Axis Labels */}
              <div className="flex justify-between text-[10px] text-slate-400 font-medium mt-2">
                {chartData.map((item, idx) => (
                  <span key={idx} className="flex-1 text-center truncate px-0.5">
                    {idx % labelStep === 0 ? item.label : ''}
                  </span>
                ))}
              </div>
            </div>

            {/* 2. PIE CHART 1: REVIEW PERCENTAGES */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="text-sm font-semibold text-slate-700 mb-4">Pie Chart</h3>
              <p className="text-xs font-semibold text-slate-600 mb-4">Review Percentages</p>

              <div className="flex flex-col sm:flex-row items-center justify-around gap-6">
                <div 
                  className="w-44 h-44 rounded-full shadow-inner shrink-0 transition-all duration-500"
                  style={{
                    background: reviewPieStyle
                  }}
                />

                <div className="space-y-3 text-xs font-medium">
                  <div className="flex items-center space-x-2">
                    <span className="w-3 h-3 bg-[#65D44B] rounded-sm inline-block"></span>
                    <span className="text-slate-700">
                      Positive: <strong className="text-slate-900">{pieData.positive || 0} ({pieData.positivePct || 0}%)</strong>
                    </span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className="w-3 h-3 bg-[#FF8A3D] rounded-sm inline-block"></span>
                    <span className="text-slate-700">
                      Negative: <strong className="text-slate-900">{pieData.negative || 0} ({pieData.negativePct || 0}%)</strong>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. PIE CHART 2: NEGATIVE REVIEW CATEGORIES */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="text-xs font-semibold text-slate-600 mb-6">Negative Review Categories</h3>

              <div className="flex flex-col sm:flex-row items-center justify-around gap-6">
                <div 
                  className="w-44 h-44 rounded-full shadow-inner shrink-0 transition-all duration-500"
                  style={{ background: categoryConicStyle }}
                />

                <div className="space-y-2 text-xs font-medium">
                  {categories.length > 0 ? (
                    categories.map((cat, idx) => (
                      <div key={idx} className="flex items-center space-x-2">
                        <span 
                          className="w-3 h-3 rounded-sm inline-block shrink-0" 
                          style={{ backgroundColor: categoryPalette[idx % categoryPalette.length] }}
                        />
                        <span className="text-slate-700">
                          {cat.label}: <strong className="text-slate-900">{cat.count || 0} ({cat.pct || 0}%)</strong>
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400">No negative review categories recorded.</p>
                  )}
                </div>
              </div>
            </div>

          </div>

        </div>

      </main>
    </div>
  );
}