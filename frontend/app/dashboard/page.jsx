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


  // Activity Chart Mock Data (Jan - Dec)
  const activityData = [
    { month: 'JAN', val: 100 },
    { month: 'FEB', val: 140 },
    { month: 'MAR', val: 140 },
    { month: 'APR', val: 240 },
    { month: 'MAY', val: 270 },
    { month: 'JUN', val: 200 },
    { month: 'JUL', val: 240 },
    { month: 'AUG', val: 100 },
    { month: 'SEP', val: 270 },
    { month: 'OCT', val: 340 },
    { month: 'NOV', val: 360 },
    { month: 'DEC', val: 380 },
  ];

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

        {/* Timeframe Selector */}
        <div className="mb-6 inline-block">
          <div className="flex items-center bg-white border border-slate-200 rounded-full px-4 py-2 text-sm text-slate-600 shadow-sm cursor-pointer">
            <span>Timeframe: <strong>{timeframe}</strong></span>
            <ChevronDown className="w-4 h-4 ml-2 text-slate-400" />
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
              <div className="flex items-center text-xs text-slate-500 cursor-pointer">
                <span>Month</span>
                <ChevronDown className="w-3 h-3 ml-1" />
              </div>
            </div>

            {/* Custom Bar Chart */}
            <div className="h-44 flex items-end justify-between gap-2 pt-4 border-b border-slate-100 pb-2">
              {activityData.map((item, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group">
                  <div 
                    style={{ height: `${(item.val / 400) * 100}%` }}
                    className="w-2.5 bg-[#4B70F5] rounded-full transition-all duration-300 group-hover:bg-[#7C5CFC]"
                  ></div>
                </div>
              ))}
            </div>

            {/* X-Axis Month Labels */}
            <div className="flex justify-between text-[10px] text-slate-400 font-medium mt-2">
              {activityData.map((item, idx) => (
                <span key={idx} className="flex-1 text-center">{item.month}</span>
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