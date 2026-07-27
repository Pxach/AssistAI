'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Home,
  MessageSquare, 
  Star, 
  Calendar, 
  Download, 
  ChevronDown 
} from 'lucide-react';

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalConversations: 350,
    totalReviews: 200,
    totalBookings: 54,
    alertsToday: 3
  });

  const [timeframe, setTimeframe] = useState('All-time');
  
  // State for chart data (dynamically adjusted based on timeframe)
  const [chartData, setChartData] = useState([
    { label: '2023', val: 150 },
    { label: '2024', val: 280 },
    { label: '2025', val: 310 },
    { label: '2026', val: 380 },
  ]);

  const [user, setUser] = useState({
    name: 'Admin User',
    email: 'admin@example.com'
  });

  useEffect(() => {
    const storedEmail = localStorage.getItem('email') || localStorage.getItem('userEmail');
    const storedName = localStorage.getItem('name') || localStorage.getItem('userName');

    if (storedEmail) {
      setTimeout(() => {
        setUser({
          name: storedName || storedEmail.split('@')[0].toUpperCase(),
          email: storedEmail
        });
      }, 0);
    }
  }, []);

  // Dynamically update stats and chart data when timeframe changes
  useEffect(() => {
    setTimeout(() => {
      switch (timeframe) {
        case 'Today':
          setStats({ totalConversations: 14, totalReviews: 6, totalBookings: 2, alertsToday: 3 });
          setChartData([
            { label: '8 AM', val: 2 },
            { label: '10 AM', val: 5 },
            { label: '12 PM', val: 12 },
            { label: '2 PM', val: 8 },
            { label: '4 PM', val: 15 },
            { label: '6 PM', val: 9 },
            { label: '8 PM', val: 4 },
          ]);
          break;

        case 'This Week':
          setStats({ totalConversations: 88, totalReviews: 45, totalBookings: 12, alertsToday: 3 });
          setChartData([
            { label: 'MON', val: 12 },
            { label: 'TUE', val: 19 },
            { label: 'WED', val: 15 },
            { label: 'THU', val: 22 },
            { label: 'FRI', val: 28 },
            { label: 'SAT', val: 10 },
            { label: 'SUN', val: 5 },
          ]);
          break;

        case 'This Month':
          setStats({ totalConversations: 240, totalReviews: 130, totalBookings: 35, alertsToday: 3 });
          setChartData([
            { label: 'Week 1', val: 50 },
            { label: 'Week 2', val: 65 },
            { label: 'Week 3', val: 80 },
            { label: 'Week 4', val: 45 },
          ]);
          break;

        case 'This Year':
          setStats({ totalConversations: 320, totalReviews: 185, totalBookings: 49, alertsToday: 3 });
          setChartData([
            { label: 'JAN', val: 100 },
            { label: 'FEB', val: 140 },
            { label: 'MAR', val: 140 },
            { label: 'APR', val: 240 },
            { label: 'MAY', val: 270 },
            { label: 'JUN', val: 200 },
            { label: 'JUL', val: 240 },
            { label: 'AUG', val: 100 },
            { label: 'SEP', val: 270 },
            { label: 'OCT', val: 340 },
            { label: 'NOV', val: 360 },
            { label: 'DEC', val: 380 },
          ]);
          break;

        case 'All-time':
        default:
          setStats({ totalConversations: 350, totalReviews: 200, totalBookings: 54, alertsToday: 3 });
          setChartData([
            { label: '2023', val: 150 },
            { label: '2024', val: 280 },
            { label: '2025', val: 310 },
            { label: '2026', val: 380 },
          ]);
          break;
      }
    }, 0);
  }, [timeframe]);

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
      a.download = 'appointments_export.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      console.error('CSV Export Failed:', err);
    }
  };

  // Calculate dynamic maximum value to relative scale bar heights correctly
  const maxVal = Math.max(...chartData.map((d) => d.val), 1);

  return (
    <div className="flex h-screen bg-[#F8F9FD] text-slate-800 font-sans">
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
      <main className="flex-1 overflow-y-auto p-8">
        <h1 className="text-2xl font-bold mb-6 text-slate-900">Home Page</h1>

        {/* SINGLE GLOBAL TIMEFRAME DROPDOWN */}
        <div className="mb-6 inline-block">
          <div className="relative inline-flex items-center">
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              className="appearance-none bg-white border border-slate-200 rounded-full pl-4 pr-9 py-2 text-sm text-slate-600 shadow-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#7C5CFC]/30 font-medium"
            >
              <option value="All-time">Timeframe: All-time</option>
              <option value="This Year">Timeframe: This Year</option>
              <option value="This Month">Timeframe: This Month</option>
              <option value="This Week">Timeframe: This Week</option>
              <option value="Today">Timeframe: Today</option>
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 pointer-events-none" />
          </div>
        </div>

        {/* TOP SECTION: GRID + CHART */}
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

          {/* ACTIVITY BAR CHART CARD */}
          <div className="lg:col-span-7 bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-semibold text-slate-700">Activity</h3>
            </div>

            {/* Dynamic Custom Bar Chart */}
            <div className="h-44 flex items-end justify-between gap-2 pt-4 border-b border-slate-100 pb-2">
              {chartData.map((item, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group">
                  <div 
                    style={{ height: `${(item.val / maxVal) * 100}%` }}
                    className="w-2.5 bg-[#4B70F5] rounded-full transition-all duration-300 group-hover:bg-[#7C5CFC]"
                    title={`${item.label}: ${item.val}`}
                  ></div>
                </div>
              ))}
            </div>

            {/* Dynamic X-Axis Labels */}
            <div className="flex justify-between text-[10px] text-slate-400 font-medium mt-2">
              {chartData.map((item, idx) => (
                <span key={idx} className="flex-1 text-center truncate px-0.5">{item.label}</span>
              ))}
            </div>
          </div>

        </div>

        {/* BOTTOM SECTION: 2 CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* CARD 1: Human Intervention Need */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="text-xs font-semibold text-slate-500 mb-4">Human Intervention Need</h3>
            
            <div className="space-y-3">
              <div className="bg-[#EAE4FF] text-[#5B3BC4] text-xs font-medium py-3 px-4 rounded-xl">
                Conversation 1: 7/13/2026, 11:44pm
              </div>
              <div className="bg-[#EAE4FF] text-[#5B3BC4] text-xs font-medium py-3 px-4 rounded-xl">
                Conversation 2: 7/14/2026, 6:00am
              </div>
              <div className="bg-[#EAE4FF] text-[#5B3BC4] text-xs font-medium py-3 px-4 rounded-xl">
                Conversation 3: 7/14/2026, 2:30pm
              </div>
            </div>
          </div>

          {/* CARD 2: 24 Hour Answer Deadlines */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="text-xs font-semibold text-slate-500 mb-4">24 Hour Answer Deadlines</h3>

            <div className="space-y-5">
              
              {/* Conversation 1 */}
              <div>
                <div className="flex justify-between text-xs font-medium mb-1">
                  <span className="text-slate-800">Conversation 1</span>
                  <span className="text-slate-400">5 hours left</span>
                </div>
                <div className="w-full h-2.5 bg-red-100 rounded-full overflow-hidden">
                  <div className="h-full bg-red-500 rounded-full w-[20%]"></div>
                </div>
              </div>

              {/* Conversation 2 */}
              <div>
                <div className="flex justify-between text-xs font-medium mb-1">
                  <span className="text-slate-800">Conversation 2</span>
                  <span className="text-slate-400">12 hours left</span>
                </div>
                <div className="w-full h-2.5 bg-orange-100 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full w-[50%]"></div>
                </div>
              </div>

              {/* Conversation 3 */}
              <div>
                <div className="flex justify-between text-xs font-medium mb-1">
                  <span className="text-slate-800">Conversation 3</span>
                  <span className="text-slate-400">23 hours left</span>
                </div>
                <div className="w-full h-2.5 bg-emerald-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full w-[95%]"></div>
                </div>
              </div>

            </div>
          </div>

        </div>

      </main>
    </div>
  );
}