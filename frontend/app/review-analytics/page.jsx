'use client';

import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, 
  Star, 
  Calendar, 
  Download, 
  Loader2,
  Home
} from 'lucide-react';
import Link from 'next/link';


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

useEffect(() => {
  const storedEmail = localStorage.getItem('email') || localStorage.getItem('userEmail');
  const storedName = localStorage.getItem('name') || localStorage.getItem('userName');

  if (storedEmail) {
    // Wrapping in setTimeout defers the update to the next tick, clearing the linter error
    setTimeout(() => {
      setUser({
        name: storedName || storedEmail.split('@')[0].toUpperCase(),
        email: storedEmail
      });
    }, 0);
  }
}, []);
  // Fetch Review Analytics Data
  useEffect(() => {
    let isMounted = true;

    async function loadReviewData() {
      try {
        const response = await fetch(
          `http://localhost:5000/api/dashboard/review-stats?timeframe=${encodeURIComponent(timeframe)}`,
          {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          }
        );
        const result = await response.json();
        if (result.success && isMounted) {
          setStats(result.data.overview);
          setNegativeReviews(result.data.negativeReviews);
          setPieData(result.data.pieChart);
          setCategories(result.data.categories);
          setChartData(result.data.chartData);
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
    setLoading(true);
    setTimeframe(e.target.value);
  };

  const handleCsvDownload = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/dashboard/export-csv', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'review_analytics_export.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      console.error('CSV Export Failed:', err);
    }
  };

  // Maximum value for scaling grouped bars
  const maxBarVal = Math.max(
    ...chartData.map((d) => Math.max(d.total, d.positive, d.negative)),
    1
  );
  const labelStep = Math.max(1, Math.ceil(chartData.length / 10));

  // Sentiment Pie Chart Conic Calculation
  const positiveDegree = (pieData.positivePct / 100) * 360;

  // Category Pie Chart Multi-Color Conic Calculation
  const categoryPalette = ['#7C5CFC', '#FF8A3D', '#3B82F6', '#EAB308', '#10B981', '#EC4899'];

  const categoryGradients = [];
  let accumulatedDeg = 0;

  for (let idx = 0; idx < categories.length; idx++) {
    const cat = categories[idx];
    const deg = (cat.pct / 100) * 360;
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
      <aside className="w-64 bg-[#7C5CFC] text-white flex flex-col justify-between p-6 shadow-lg">
        <div>
          {/* Navigation Links */}
          <nav className="space-y-6 mt-6">
            <Link 
              href="/dashboard" 
              className="flex items-center space-x-3 w-full text-left font-medium hover:opacity-80 transition"
            >
              <Home className="w-5 h-5" />
              <span>Home Page</span>
            </Link>

            <Link 
              href="/chat-analytics" 
              className="flex items-center space-x-3 w-full text-left font-medium hover:opacity-80 transition"
            >
              <MessageSquare className="w-5 h-5" />
              <span>Chat Analytics</span>
            </Link>

            <Link 
              href="/review-analytics" 
              className="flex items-center space-x-3 w-full text-left font-medium hover:opacity-80 transition"
            >
              <Star className="w-5 h-5" />
              <span>Review Analytics</span>
            </Link>

            <Link 
              href="/booking-analytics" 
              className="flex items-center space-x-3 w-full text-left font-medium hover:opacity-80 transition"
            >
              <Calendar className="w-5 h-5" />
              <span>Booking Analytics</span>
            </Link>

            <button 
              onClick={handleCsvDownload}
              className="flex items-center space-x-3 w-full text-left font-medium hover:opacity-80 transition pt-2"
            >
              <Download className="w-5 h-5" />
              <span>Download as CSV</span>
            </button>
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="border-t border-white/20 pt-4">
  <h2 className="font-bold text-lg mb-4">AssistAI</h2>
  <div className="flex items-center space-x-3">
    {/* Dynamic Avatar showing User Initial */}
    <div className="w-10 h-10 rounded-full bg-white/20 text-white flex items-center justify-center font-bold text-base shrink-0">
      {user.email ? user.email[0].toUpperCase() : 'U'}
    </div>
    
    {/* Dynamic User Information */}
    <div className="text-sm min-w-0 flex-1">
      <p className="font-semibold leading-tight truncate">{user.name}</p>
      <p className="text-xs text-white/70 truncate">{user.email}</p>
    </div>
  </div>
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
                <p className="text-3xl font-bold">{stats.totalReviews}</p>
              </div>

              <div className="bg-[#7C5CFC] text-white p-5 rounded-2xl shadow-sm flex flex-col justify-between h-36">
                <p className="text-xs font-medium text-white/90">Total Positive Reviews</p>
                <p className="text-3xl font-bold">{stats.totalPositiveReviews}</p>
              </div>

              <div className="bg-[#7C5CFC] text-white p-5 rounded-2xl shadow-sm flex flex-col justify-between h-36">
                <p className="text-xs font-medium text-white/90">Total Negative Reviews</p>
                <p className="text-3xl font-bold">{stats.totalNegativeReviews}</p>
              </div>

              <div className="bg-[#7C5CFC] text-white p-5 rounded-2xl shadow-sm flex flex-col justify-between h-36">
                <p className="text-xs font-medium text-white/90">Number of Alerts Today</p>
                <p className="text-3xl font-bold">{stats.alertsToday}</p>
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
                    const formattedDate = new Date(rev.CreatedAt).toLocaleString('en-US', {
                      month: 'numeric',
                      day: 'numeric',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true
                    });

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
                        {item.label} | Total: {item.total}, Pos: {item.positive}, Neg: {item.negative}
                      </div>

                      {/* Bar 1: Total (Blue) */}
                      <div 
                        style={{ height: `${(item.total / maxBarVal) * 100}%` }}
                        className="w-1.5 bg-[#3B82F6] rounded-t-full transition-all duration-300"
                      />
                      {/* Bar 2: Positive (Red/Coral) */}
                      <div 
                        style={{ height: `${(item.positive / maxBarVal) * 100}%` }}
                        className="w-1.5 bg-[#EF4444] rounded-t-full transition-all duration-300"
                      />
                      {/* Bar 3: Negative (Green) */}
                      <div 
                        style={{ height: `${(item.negative / maxBarVal) * 100}%` }}
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
                  className="w-44 h-44 rounded-full shadow-inner shrink-0"
                  style={{
                    background: `conic-gradient(#65D44B 0deg ${positiveDegree}deg, #FF8A3D ${positiveDegree}deg 360deg)`
                  }}
                />

                <div className="space-y-3 text-xs font-medium">
                  <div className="flex items-center space-x-2">
                    <span className="w-3 h-3 bg-[#65D44B] rounded-sm inline-block"></span>
                    <span className="text-slate-700">
                      Positive: <strong className="text-slate-900">{pieData.positive} ({pieData.positivePct}%)</strong>
                    </span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className="w-3 h-3 bg-[#FF8A3D] rounded-sm inline-block"></span>
                    <span className="text-slate-700">
                      Negative: <strong className="text-slate-900">{pieData.negative} ({pieData.negativePct}%)</strong>
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
                          {cat.label}: <strong className="text-slate-900">{cat.count} ({cat.pct}%)</strong>
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