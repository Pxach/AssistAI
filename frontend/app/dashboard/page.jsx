'use client';

import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, 
  Star, 
  Calendar, 
  Download, 
  ExternalLink,
  Loader2
} from 'lucide-react';

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalConversations: 0,
    totalReviews: 0,
    totalBookings: 0,
    alertsToday: 0
  });

  const [activityData, setActivityData] = useState([]);
  const [interventions, setInterventions] = useState([]);
  const [timeframe, setTimeframe] = useState('All-time');
  const [loading, setLoading] = useState(true);

  // Helper: Map top timeframe selection to chart view format
  const getChartViewFromTimeframe = (tf) => {
    switch (tf?.toLowerCase()) {
      case 'per day':
      case 'per week':
      case 'per month':
        return 'day';
      case 'per year':
      case 'all-time':
      default:
        return 'month';
    }
  };

  // Asynchronous Effect: Syncs dashboard data safely
  useEffect(() => {
    let isMounted = true;
    const chartView = getChartViewFromTimeframe(timeframe);

    async function loadDashboardData() {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        
        const response = await fetch(
          `http://localhost:5000/api/dashboard/stats?timeframe=${encodeURIComponent(timeframe)}&chartView=${chartView}`,
          {
            headers: {
              'Authorization': `Bearer ${token || ''}`
            }
          }
        );

        // Prevent HTML error response from throwing JSON syntax error
        if (!response.ok) {
          const errText = await response.text();
          console.error(`Dashboard API returned status ${response.status}:`, errText);
          return;
        }

        const result = await response.json();

        if (result?.success && isMounted) {
          setStats({
            totalConversations: result.data?.overview?.totalConversations ?? 0,
            totalReviews: result.data?.overview?.totalReviews ?? 0,
            totalBookings: result.data?.overview?.totalBookings ?? 0,
            alertsToday: result.data?.overview?.alertsToday ?? 0
          });
          
          setActivityData(Array.isArray(result.data?.activityData) ? result.data.activityData : []);
          setInterventions(Array.isArray(result.data?.humanInterventions) ? result.data.humanInterventions : []);
        }
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadDashboardData();

    return () => {
      isMounted = false;
    };
  }, [timeframe]);

  // Handler for global timeframe selector
  const handleTimeframeChange = (e) => {
    setLoading(true);
    setTimeframe(e.target.value);
  };

  // Handle CSV Download safely
  const handleCsvDownload = async () => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      
      const response = await fetch('http://localhost:5000/api/dashboard/export-csv', {
        headers: {
          'Authorization': `Bearer ${token || ''}`
        }
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error(`CSV Export API returned status ${response.status}:`, errText);
        return;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'appointments_export.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('CSV Export Failed:', err);
    }
  };

  // Redirect to WhatsApp chat directly
  const handleOpenWhatsApp = (phoneNumber) => {
    if (!phoneNumber) return;
    const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
    window.open(`https://wa.me/${cleanPhone}`, '_blank');
  };

  // Helper logic for 24-Hour Deadlines and Progress Bar Colors
  const calculateDeadline = (createdAt) => {
    const createdTime = new Date(createdAt).getTime();
    const currentTime = new Date().getTime();
    const elapsedHours = (currentTime - createdTime) / (1000 * 60 * 60);
    const hoursLeft = Math.max(0, Math.floor(24 - elapsedHours));

    let barColor = 'bg-emerald-500';
    let trackBg = 'bg-emerald-100';

    if (hoursLeft < 3) {
      barColor = 'bg-red-500';
      trackBg = 'bg-red-100';
    } else if (hoursLeft <= 10) {
      barColor = 'bg-amber-500';
      trackBg = 'bg-orange-100';
    }

    const percentage = Math.min(100, Math.max(0, (hoursLeft / 24) * 100));

    return { hoursLeft, barColor, trackBg, percentage };
  };

  // Safe chart math calculations
  const safeActivityData = Array.isArray(activityData) ? activityData : [];
  const maxChartVal = Math.max(...safeActivityData.map((d) => d?.val || 0), 1);
  const labelStep = Math.max(1, Math.ceil(safeActivityData.length / 10));

  return (
    <div className="flex h-screen bg-[#F8F9FD] text-slate-800 font-sans overflow-hidden">
      
      {/* SIDEBAR */}
      <aside className="w-64 bg-[#7C5CFC] text-white flex flex-col justify-between p-6 shadow-lg shrink-0">
        <div>
          <nav className="space-y-6 mt-6">
            <button className="flex items-center space-x-3 w-full text-left font-medium hover:opacity-80 transition">
              <MessageSquare className="w-5 h-5" />
              <span>Chat Analytics</span>
            </button>
            <button className="flex items-center space-x-3 w-full text-left font-medium hover:opacity-80 transition">
              <Star className="w-5 h-5" />
              <span>Review Analytics</span>
            </button>
            <button className="flex items-center space-x-3 w-full text-left font-medium hover:opacity-80 transition">
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
          <h2 className="font-bold text-lg mb-4">AssistAI</h2>
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
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Home Page</h1>
          {loading && <Loader2 className="w-5 h-5 animate-spin text-[#7C5CFC]" />}
        </div>

        {/* Global Timeframe Selector */}
        <div className="mb-6 inline-block relative">
          <div className="flex items-center bg-white border border-slate-200 rounded-full px-4 py-2 text-sm text-slate-600 shadow-sm">
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

        {/* TOP SECTION: 4 STAT CARDS & ACTIVITY GRAPH */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
          
          {/* 4 STAT CARDS (2x2) */}
          <div className="lg:col-span-5 grid grid-cols-2 gap-4">
            <div className="bg-[#7C5CFC] text-white p-5 rounded-2xl shadow-sm flex flex-col justify-between h-32">
              <p className="text-xs font-medium text-white/80">Total Conversations</p>
              <p className="text-3xl font-bold">{stats.totalConversations}</p>
            </div>

            <div className="bg-[#7C5CFC] text-white p-5 rounded-2xl shadow-sm flex flex-col justify-between h-32">
              <p className="text-xs font-medium text-white/80">Total Reviews</p>
              <p className="text-3xl font-bold">{stats.totalReviews}</p>
            </div>

            <div className="bg-[#7C5CFC] text-white p-5 rounded-2xl shadow-sm flex flex-col justify-between h-32">
              <p className="text-xs font-medium text-white/80">Total Bookings</p>
              <p className="text-3xl font-bold">{stats.totalBookings}</p>
            </div>

            <div className="bg-[#7C5CFC] text-white p-5 rounded-2xl shadow-sm flex flex-col justify-between h-32">
              <p className="text-xs font-medium text-white/80">Number of Alerts Today</p>
              <p className="text-3xl font-bold">{stats.alertsToday}</p>
            </div>
          </div>

          {/* DYNAMIC ACTIVITY BAR CHART CARD */}
          <div className="lg:col-span-7 bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between min-w-0 relative">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-semibold text-slate-700">Activity</h3>
            </div>

            {/* Custom Interactive Bar Chart Container */}
            <div className="h-48 flex items-end justify-between gap-1 pt-10 border-b border-slate-100 pb-2">
              {safeActivityData.length > 0 ? (
                safeActivityData.map((item, idx) => (
                  <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end min-w-0">
                    {/* Bar Element with anchored Tooltip */}
                    <div 
                      style={{ height: `${((item?.val || 0) / maxChartVal) * 100}%` }}
                      className="w-full max-w-[10px] bg-[#4B70F5] rounded-full transition-all duration-300 hover:bg-[#7C5CFC] relative group cursor-pointer"
                    >
                      {/* Tooltip positioned directly above bar */}
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover:flex bg-slate-800 text-white text-[10px] font-medium py-1 px-2 rounded shadow-md z-30 whitespace-nowrap pointer-events-none">
                        {item?.label || 'Period'}: {item?.val || 0}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="w-full flex items-center justify-center text-xs text-slate-400">
                  No activity logs found for this period.
                </div>
              )}
            </div>

            {/* X-Axis Sampled Labels */}
            <div className="flex justify-between text-[10px] text-slate-400 font-medium mt-2">
              {safeActivityData.map((item, idx) => (
                <span key={idx} className="flex-1 text-center truncate px-0.5">
                  {idx % labelStep === 0 ? item?.label : ''}
                </span>
              ))}
            </div>
          </div>

        </div>

        {/* BOTTOM SECTION: HUMAN INTERVENTION & DEADLINES */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* CARD 1: Human Intervention Need */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="text-xs font-semibold text-slate-500 mb-4">Human Intervention Need</h3>
            
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {interventions.length > 0 ? (
                interventions.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleOpenWhatsApp(item?.PhoneNumber)}
                    className="w-full flex items-center justify-between bg-[#EAE4FF] hover:bg-[#DDD4FF] text-[#5B3BC4] text-xs font-medium py-3 px-4 rounded-xl transition group"
                  >
                    <span>
                      {item?.CustomerName ? `${item.CustomerName} (${item.PhoneNumber})` : `Conversation ${idx + 1}: ${item?.PhoneNumber || 'Unknown'}`} 
                      {' - '} 
                      {item?.CreatedAt ? new Date(item.CreatedAt).toLocaleString() : 'N/A'}
                    </span>
                    <ExternalLink className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 transition shrink-0 ml-2" />
                  </button>
                ))
              ) : (
                <p className="text-xs text-slate-400">No pending human interventions.</p>
              )}
            </div>
          </div>

          {/* CARD 2: 24 Hour Answer Deadlines */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="text-xs font-semibold text-slate-500 mb-4">24 Hour Answer Deadlines</h3>

            <div className="space-y-5 max-h-64 overflow-y-auto">
              {interventions.length > 0 ? (
                interventions.map((item, idx) => {
                  const { hoursLeft, barColor, trackBg, percentage } = calculateDeadline(item?.CreatedAt || new Date());
                  return (
                    <div key={idx}>
                      <div className="flex justify-between text-xs font-medium mb-1">
                        <span className="text-slate-800">
                          {item?.CustomerName || `Conversation ${idx + 1}`}
                        </span>
                        <span className="text-slate-400">{hoursLeft} hours left</span>
                      </div>
                      <div className={`w-full h-2.5 ${trackBg} rounded-full overflow-hidden`}>
                        <div 
                          style={{ width: `${percentage}%` }}
                          className={`h-full ${barColor} rounded-full transition-all duration-500`}
                        ></div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-slate-400">No active conversation deadlines.</p>
              )}
            </div>
          </div>

        </div>

      </main>
    </div>
  );
}