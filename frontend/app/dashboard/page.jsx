'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Home, 
  MessageSquare, 
  Star, 
  Calendar, 
  Download, 
  ChevronDown,
  Headphones,
  Settings,
  Smartphone  
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react'; 
import { useBfcacheGuard } from '@/app/hooks/useBfcacheGuard';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalConversations: 0,
    totalReviews: 0,
    positiveReviews: 0,
    negativeReviews: 0,
    totalBookings: 0,
    alertsToday: 0
  });

  const [timeframe, setTimeframe] = useState('All-time');
  const [chartData, setChartData] = useState([]);
  const [humanInterventions, setHumanInterventions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [user, setUser] = useState({
    name: 'Admin User',
    email: 'admin@example.com'
  });
  const router = useRouter();
  // Load user info from localStorage
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

  // Logout Handler
useBfcacheGuard();
const handleLogout = async () => {
  await fetch('http://localhost:5000/api/auth/logout', {
    method: 'POST',
    credentials: 'include',
  }).catch(() => {});

  localStorage.removeItem('token');
  localStorage.removeItem('email');
  localStorage.removeItem('userEmail');
  localStorage.removeItem('name');
  localStorage.removeItem('userName');

  document.cookie = 'token=; path=/; max-age=0'; // expire it immediately client-side

  router.replace('/');
};
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

  // Fetch dashboard metrics and chart data directly from backend API
  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsLoading(true);
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(
          `${API_BASE}/api/dashboard/stats?timeframe=${encodeURIComponent(timeframe)}`,
          {
            headers: {
              Authorization: `Bearer ${token}`
            },
            cache: 'no-store'
          }
        );

        const result = await response.json();

        if (result.success && result.data) {
          setStats(result.data.overview || {
            totalConversations: 0,
            totalReviews: 0,
            positiveReviews: 0,
            negativeReviews: 0,
            totalBookings: 0,
            alertsToday: 0
          });
          setChartData(result.data.activityData || []);
          setHumanInterventions(result.data.humanInterventions || []);
        }
      } catch (err) {
        console.error('Failed to fetch dashboard metrics:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, [timeframe]);

  const handleCsvDownload = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/dashboard/export-csv`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
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

  // Calculate dynamic maximum value to scale bar heights dynamically
  const maxVal = chartData.length > 0 ? Math.max(...chartData.map((d) => d.val), 1) : 1;

  // Calculate Conversations to Booking Ratio for SVG Donut/Pie Chart
  const convCount = stats.totalConversations || 0;
  const bookCount = stats.totalBookings || 0;
  const pieTotal = convCount + bookCount || 1;
  const convPct = Math.round((convCount / pieTotal) * 100);
  const bookPct = 100 - convPct;
  
  // SVG Stroke Dash Calculations
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const convOffset = 0;
  const bookDash = (bookPct / 100) * circumference;

  return (
    <div className="flex h-screen bg-[#F8F9FD] text-slate-800 font-sans">
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

      {/* 7. Settings */}
      <Link 
        href="/settings-page" 
        className="flex items-center space-x-3 w-full text-left font-medium hover:opacity-80 transition"
      >
        <Settings className="w-5 h-5" />
        <span>Settings</span>
      </Link>

      {/* 8. Download Action */}
      <button 
        onClick={handleCsvDownload}
        className="flex items-center space-x-3 w-full text-left font-medium hover:opacity-80 transition pt-2"
      >
        <Download className="w-5 h-5" />
        <span>Download as CSV</span>
      </button>
    </nav>
  </div>
    <div className="pt-4 border-t border-white/10 mt-auto">
      <p className="text-xs font-bold text-white/80 mb-3 tracking-wide">AssistAI</p>
      <div className="flex items-center justify-between bg-white/10 p-2.5 rounded-xl backdrop-blur-xs">
        <div className="flex items-center space-x-3 min-w-0">
          {/* User Avatar Circle */}
          <div className="w-8 h-8 rounded-full bg-white/20 text-white font-bold flex items-center justify-center shrink-0 text-xs">
            {user.name ? user.name.charAt(0).toUpperCase() : 'A'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-white truncate leading-tight">{user.name}</p>
            <p className="text-[10px] text-white/70 truncate leading-tight mt-0.5">{user.email}</p>
          </div>
        </div>
  
        {/* Log Out Button */}
        <button
          onClick={handleLogout}
          title="Log Out"
          className="p-1.5 hover:bg-white/20 text-white/80 hover:text-white rounded-lg transition shrink-0 ml-1 cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
        </button>
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

        {/* TOP STAT CARDS (3x2 GRID) */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <div className="bg-[#7C5CFC] text-white p-5 rounded-2xl shadow-sm flex flex-col justify-between h-32">
            <p className="text-xs font-medium text-white/80">Total Conversations</p>
            <p className="text-3xl font-bold">{isLoading ? '...' : stats.totalConversations}</p>
          </div>

          <div className="bg-[#7C5CFC] text-white p-5 rounded-2xl shadow-sm flex flex-col justify-between h-32">
            <p className="text-xs font-medium text-white/80">Total Reviews</p>
            <p className="text-3xl font-bold">{isLoading ? '...' : stats.totalReviews}</p>
          </div>

          <div className="bg-[#7C5CFC] text-white p-5 rounded-2xl shadow-sm flex flex-col justify-between h-32">
            <p className="text-xs font-medium text-white/80">Positive Reviews</p>
            <p className="text-3xl font-bold">{isLoading ? '...' : stats.positiveReviews}</p>
          </div>

          <div className="bg-[#7C5CFC] text-white p-5 rounded-2xl shadow-sm flex flex-col justify-between h-32">
            <p className="text-xs font-medium text-white/80">Negative Reviews</p>
            <p className="text-3xl font-bold">{isLoading ? '...' : stats.negativeReviews}</p>
          </div>

          <div className="bg-[#7C5CFC] text-white p-5 rounded-2xl shadow-sm flex flex-col justify-between h-32">
            <p className="text-xs font-medium text-white/80">Total Bookings</p>
            <p className="text-3xl font-bold">{isLoading ? '...' : stats.totalBookings}</p>
          </div>

          <div className="bg-[#7C5CFC] text-white p-5 rounded-2xl shadow-sm flex flex-col justify-between h-32">
            <p className="text-xs font-medium text-white/80">Alerts Today</p>
            <p className="text-3xl font-bold">{isLoading ? '...' : stats.alertsToday}</p>
          </div>
        </div>

        {/* MIDDLE SECTION: CHARTS */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
          
          {/* CONVERSATIONS TO BOOKING RATIO (PIE CHART CARD) */}
          <div className="lg:col-span-5 bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between min-h-[260px]">
            <h3 className="text-sm font-semibold text-slate-700 mb-2">Conversations to Booking Ratio</h3>
            
            <div className="flex items-center justify-around my-auto">
              {/* SVG Donut Chart */}
              <div className="relative w-32 h-32 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  {/* Background Circle (Conversations) */}
                  <circle
                    cx="50"
                    cy="50"
                    r={radius}
                    stroke="#7C5CFC"
                    strokeWidth="12"
                    fill="transparent"
                  />
                  {/* Foreground Circle (Bookings) */}
                  <circle
                    cx="50"
                    cy="50"
                    r={radius}
                    stroke="#22C55E"
                    strokeWidth="12"
                    fill="transparent"
                    strokeDasharray={`${bookDash} ${circumference}`}
                    className="transition-all duration-500"
                  />
                </svg>
                <div className="absolute text-center">
                  <span className="text-xs text-slate-400 block font-medium">Booked</span>
                  <span className="text-lg font-bold text-slate-800">
                    {convCount > 0 ? `${((bookCount / convCount) * 100).toFixed(0)}%` : '0%'}
                  </span>
                </div>
              </div>

              {/* Chart Legend */}
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <span className="w-3 h-3 rounded-full bg-[#7C5CFC] inline-block"></span>
                  <div className="text-xs">
                    <p className="text-slate-500 font-medium">Conversations</p>
                    <p className="font-bold text-slate-800">{convCount} ({convPct}%)</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="w-3 h-3 rounded-full bg-[#22C55E] inline-block"></span>
                  <div className="text-xs">
                    <p className="text-slate-500 font-medium">Bookings</p>
                    <p className="font-bold text-slate-800">{bookCount} ({bookPct}%)</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ACTIVITY BAR CHART CARD */}
          <div className="lg:col-span-7 bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between min-h-[260px]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-semibold text-slate-700">Activity</h3>
            </div>

            {chartData.length > 0 ? (
              <>
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

                <div className="flex justify-between text-[10px] text-slate-400 font-medium mt-2">
                  {chartData.map((item, idx) => (
                    <span key={idx} className="flex-1 text-center truncate px-0.5">{item.label}</span>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-44 flex items-center justify-center text-xs text-slate-400 font-medium">
                {isLoading ? 'Loading activity...' : 'No activity records found for this timeframe'}
              </div>
            )}
          </div>

        </div>

        {/* BOTTOM SECTION: 2 CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* CARD 1: Human Intervention Need */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="text-xs font-semibold text-slate-500 mb-4">Human Intervention Need</h3>
            
            <div className="space-y-3">
              {humanInterventions.length > 0 ? (
                humanInterventions.map((item, idx) => (
                  <div key={item.id || idx} className="bg-[#EAE4FF] text-[#5B3BC4] text-xs font-medium py-3 px-4 rounded-xl flex items-center justify-between">
                    <span>
                      Conversation {item.conversation_id || item.id}: {new Date(item.created_at).toLocaleString()}
                    </span>
                    {item.flag_reason && (
                      <span className="text-[10px] bg-white/70 px-2 py-0.5 rounded font-semibold">
                        {item.flag_reason}
                      </span>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-xs text-slate-400 py-6 text-center font-medium">
                  {isLoading ? 'Loading interventions...' : 'No active human intervention requests'}
                </div>
              )}
            </div>
          </div>

          {/* CARD 2: 24 Hour Answer Deadlines */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="text-xs font-semibold text-slate-500 mb-4">24 Hour Answer Deadlines</h3>

            <div className="space-y-5">
              {humanInterventions.length > 0 ? (
                humanInterventions.slice(0, 3).map((item, idx) => {
                  const createdAt = new Date(item.created_at || Date.now());
                  const now = new Date();
                  const elapsedHours = (now - createdAt) / (1000 * 60 * 60);
                  const hoursLeft = Math.max(0, Math.round(24 - elapsedHours));
                  const pct = Math.max(0, Math.min(100, Math.round((hoursLeft / 24) * 100)));

                  let colorClass = "bg-emerald-500";
                  let bgClass = "bg-emerald-100";
                  if (hoursLeft <= 6) {
                    colorClass = "bg-red-500";
                    bgClass = "bg-red-100";
                  } else if (hoursLeft <= 12) {
                    colorClass = "bg-amber-500";
                    bgClass = "bg-amber-100";
                  }

                  return (
                    <div key={item.id || idx}>
                      <div className="flex justify-between text-xs font-medium mb-1">
                        <span className="text-slate-800">Conversation {item.conversation_id || item.id || idx + 1}</span>
                        <span className="text-slate-400">{hoursLeft} hours left</span>
                      </div>
                      <div className={`w-full h-2.5 ${bgClass} rounded-full overflow-hidden`}>
                        <div className={`h-full ${colorClass} rounded-full transition-all duration-300`} style={{ width: `${pct}%` }}></div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-xs text-slate-400 py-6 text-center font-medium">
                  {isLoading ? 'Loading deadlines...' : 'No active 24-hour response deadlines'}
                </div>
              )}
            </div>
          </div>

        </div>

      </main>
    </div>
  );
}