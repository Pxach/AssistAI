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

export default function BookingAnalyticsPage() {
  const [stats, setStats] = useState({
    totalBookingRequests: 0,
    totalConfirmedBookings: 0,
    totalUnconfirmedBookings: 0,
    bookingsToday: 0,
    bookingsThisWeek: 0,
    peakBookingMonth: '-',
    mostBookedTimeSlot: '-'
  });

  const [pieData, setPieData] = useState({
    confirmed: 0,
    confirmedPct: 0,
    unconfirmed: 0,
    unconfirmedPct: 0
  });

  const [chartData, setChartData] = useState([]);
  const [timeframe, setTimeframe] = useState('All-time');
  const [loading, setLoading] = useState(true);

  // Fetch Booking Analytics Data from DB
  useEffect(() => {
    let isMounted = true;

    async function loadBookingData() {
      try {
        const response = await fetch(
          `http://localhost:5000/api/dashboard/booking-stats?timeframe=${encodeURIComponent(timeframe)}`,
          {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          }
        );
        const result = await response.json();
        if (result.success && isMounted) {
          setStats(result.data.overview);
          setPieData(result.data.pieChart);
          setChartData(result.data.chartData);
        }
      } catch (err) {
        console.error('Failed to load booking analytics:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadBookingData();

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
      a.download = 'booking_analytics_export.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      console.error('CSV Export Failed:', err);
    }
  };

  const maxChartVal = Math.max(...chartData.map((d) => d.val), 1);
  const labelStep = Math.max(1, Math.ceil(chartData.length / 12));

  // Conic Gradient for Pie Chart SVG calculation
  const confirmedDegree = (pieData.confirmedPct / 100) * 360;

  return (
    <div className="flex h-screen bg-[#F8F9FD] text-slate-800 font-sans overflow-hidden">
      
      {/* SIDEBAR */}
      <aside className="w-64 bg-[#7C5CFC] text-white flex flex-col justify-between p-6 shadow-lg shrink-0">
        <div>
          <nav className="space-y-6 mt-6">
            <button className="flex items-center space-x-3 w-full text-left font-medium hover:opacity-80 transition">
              <Home className="w-5 h-5" />
              <span>Home Page</span>
            </button>
            <button className="flex items-center space-x-3 w-full text-left font-medium hover:opacity-80 transition">
              <MessageSquare className="w-5 h-5" />
              <span>Chat Analytics</span>
            </button>
            <button className="flex items-center space-x-3 w-full text-left font-medium hover:opacity-80 transition">
              <Star className="w-5 h-5" />
              <span>Review Analytics</span>
            </button>
            <button className="flex items-center space-x-3 w-full text-left font-medium hover:opacity-80 transition text-white/100 font-bold">
              <Calendar className="w-5 h-5" />
              <span>Booking Analytics</span>
            </button>
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
          <p className="text-xs text-white/60 mb-2">Company Logo</p>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden">
              <img 
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80" 
                alt="User Avatar" 
                className="w-full h-full object-cover"
              />
            </div>
            <div className="text-sm">
              <p className="font-semibold leading-tight">Sam Wheeler</p>
              <p className="text-xs text-white/70">samwheeler@example.com</p>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 overflow-y-auto p-8 min-w-0">
        
        {/* HEADER */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Booking Analytics</h1>
          {loading && <Loader2 className="w-5 h-5 animate-spin text-[#7C5CFC]" />}
        </div>

        {/* GLOBAL TIMEFRAME SELECTOR (ONLY 1 DROPDOWN) */}
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
          
          {/* LEFT COLUMN: 7 STAT SQUARES */}
          <div className="lg:col-span-5 grid grid-cols-2 gap-4">
            
            {/* Card 1 */}
            <div className="bg-[#7C5CFC] text-white p-5 rounded-2xl shadow-sm flex flex-col justify-between h-36">
              <p className="text-xs font-medium text-white/90">Total Booking Requests</p>
              <p className="text-3xl font-bold">{stats.totalBookingRequests}</p>
            </div>

            {/* Card 2 */}
            <div className="bg-[#7C5CFC] text-white p-5 rounded-2xl shadow-sm flex flex-col justify-between h-36">
              <p className="text-xs font-medium text-white/90">Total Confirmed Bookings</p>
              <p className="text-3xl font-bold">{stats.totalConfirmedBookings}</p>
            </div>

            {/* Card 3 */}
            <div className="bg-[#7C5CFC] text-white p-5 rounded-2xl shadow-sm flex flex-col justify-between h-36">
              <p className="text-xs font-medium text-white/90">Total Unconfirmed Bookings</p>
              <p className="text-3xl font-bold">{stats.totalUnconfirmedBookings}</p>
            </div>

            {/* Card 4 */}
            <div className="bg-[#7C5CFC] text-white p-5 rounded-2xl shadow-sm flex flex-col justify-between h-36">
              <p className="text-xs font-medium text-white/90">Bookings Today</p>
              <p className="text-3xl font-bold">{stats.bookingsToday}</p>
            </div>

            {/* Card 5 */}
            <div className="bg-[#7C5CFC] text-white p-5 rounded-2xl shadow-sm flex flex-col justify-between h-36">
              <p className="text-xs font-medium text-white/90">Bookings This Week</p>
              <p className="text-3xl font-bold">{stats.bookingsThisWeek}</p>
            </div>

            {/* Card 6 */}
            <div className="bg-[#7C5CFC] text-white p-5 rounded-2xl shadow-sm flex flex-col justify-between h-36">
              <p className="text-xs font-medium text-white/90">Peak Booking Month</p>
              <p className="text-3xl font-bold">{stats.peakBookingMonth}</p>
            </div>

            {/* Card 7 (Spans full width or single card) */}
            <div className="bg-[#7C5CFC] text-white p-5 rounded-2xl shadow-sm flex flex-col justify-between h-36 col-span-1">
              <p className="text-xs font-medium text-white/90">Most Booked Time Slot</p>
              <p className="text-3xl font-bold">{stats.mostBookedTimeSlot}</p>
            </div>

          </div>

          {/* RIGHT COLUMN: BAR CHART & PIE CHART */}
          <div className="lg:col-span-7 space-y-8 min-w-0">
            
            {/* 1. BOOKINGS BAR CHART (No embedded dropdowns) */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between min-w-0 relative">
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Bookings</h3>

              <div className="h-48 flex items-end justify-between gap-1 pt-10 border-b border-slate-100 pb-2">
                {chartData.length > 0 ? (
                  chartData.map((item, idx) => (
                    <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end min-w-0">
                      <div 
                        style={{ height: `${(item.val / maxChartVal) * 100}%` }}
                        className="w-full max-w-[10px] bg-[#4B70F5] rounded-full transition-all duration-300 hover:bg-[#7C5CFC] relative group cursor-pointer"
                      >
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover:flex bg-slate-800 text-white text-[10px] font-medium py-1 px-2 rounded shadow-md z-30 whitespace-nowrap pointer-events-none">
                          {item.label}: {item.val}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="w-full flex items-center justify-center text-xs text-slate-400">
                    No booking records found for this timeframe.
                  </div>
                )}
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

            {/* 2. PIE CHART CARD: Confirmation Percentages */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="text-sm font-semibold text-slate-700 mb-6">Pie Chart</h3>
              
              <p className="text-xs font-semibold text-slate-600 mb-4">Confirmation Percentages</p>

              <div className="flex flex-col sm:flex-row items-center justify-around gap-6">
                
                {/* Visual Conic Gradient Pie Chart */}
                <div 
                  className="w-48 h-48 rounded-full shadow-inner relative transition-all duration-500 shrink-0"
                  style={{
                    background: `conic-gradient(#65D44B 0deg ${confirmedDegree}deg, #3B82F6 ${confirmedDegree}deg 360deg)`
                  }}
                />

                {/* Pie Chart Legend */}
                <div className="space-y-3 text-xs font-medium">
                  <div className="flex items-center space-x-2">
                    <span className="w-3 h-3 bg-[#65D44B] rounded-sm inline-block"></span>
                    <span className="text-slate-700">
                      Confirmed: <strong className="text-slate-900">{pieData.confirmed} ({pieData.confirmedPct}%)</strong>
                    </span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className="w-3 h-3 bg-[#3B82F6] rounded-sm inline-block"></span>
                    <span className="text-slate-700">
                      Unconfirmed: <strong className="text-slate-900">{pieData.unconfirmed} ({pieData.unconfirmedPct}%)</strong>
                    </span>
                  </div>
                </div>

              </div>
            </div>

          </div>

        </div>

      </main>
    </div>
  );
}