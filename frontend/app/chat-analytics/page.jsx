'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Star, 
  Calendar, 
  Download, 
  Loader2,
  MessageSquare, 
  Home,
  Headphones,
  Settings,
  Smartphone
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react'; 

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function ChatAnalyticsPage() {
  const [stats, setStats] = useState({
    usefulnessPct: 0,
    humanInterventionPct: 0,
    totalFlaggedCustomer: 0,
    totalFlaggedBot: 0
  });

  const [flaggedCustomerResponses, setFlaggedCustomerResponses] = useState([]);
  const [flaggedBotResponses, setFlaggedBotResponses] = useState([]);

  // Active expanded item IDs
  const [expandedCustomerMsgId, setExpandedCustomerMsgId] = useState(null);
  const [expandedBotMsgId, setExpandedBotMsgId] = useState(null);

  const [pieData, setPieData] = useState({
    chatbot: 0,
    chatbotPct: 0,
    human: 0,
    humanPct: 0,
    unanswered: 0,
    unansweredPct: 0
  });

  const [chartData, setChartData] = useState([]);
  const [timeframe, setTimeframe] = useState('All-time');
  const [loading, setLoading] = useState(true);
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
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('email');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('name');
    localStorage.removeItem('userName');
    router.push('/');
  };
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

  // Fetch Chat Analytics Data
  useEffect(() => {
    let isMounted = true;

    async function loadChatData() {
      try {
        setLoading(true);
        const response = await fetch(
          `${API_BASE}/api/dashboard/chat-stats?timeframe=${encodeURIComponent(timeframe)}`,
          {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            cache: 'no-store'
          }
        );
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        if (result.success && isMounted) {
          setStats(result.data.overview || {});
          setFlaggedCustomerResponses(result.data.flaggedCustomerResponses || []);
          setFlaggedBotResponses(result.data.flaggedBotResponses || []);
          setPieData(result.data.pieChart || {});
          setChartData(result.data.chartData || []);
        }
      } catch (err) {
        console.error('Failed to load chat analytics:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadChatData();

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
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chat_analytics_${timeframe.toLowerCase().replace(/\s+/g, '_')}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      console.error('CSV Export Failed:', err);
    }
  };

  // Stacked Bar Scaling - Dynamically calculates maximum height from DB results
  const maxValInChart = chartData.reduce(
    (max, d) => Math.max(max, (d.chatbot || 0) + (d.human || 0)), 
    0
  );
  const maxBarVal = maxValInChart > 0 ? maxValInChart : 100;
  
  // Dynamic Y-Axis steps
  const yAxisSteps = [
    Math.round(maxBarVal),
    Math.round(maxBarVal * 0.75),
    Math.round(maxBarVal * 0.5),
    Math.round(maxBarVal * 0.25),
    0
  ];

  // Pie Chart Conic Styling
  const totalPie = (pieData.chatbot || 0) + (pieData.human || 0) + (pieData.unanswered || 0);
  const botDeg = ((pieData.chatbotPct || 0) / 100) * 360;
  const humanDeg = botDeg + ((pieData.humanPct || 0) / 100) * 360;

  const pieConicStyle = totalPie > 0 
    ? `conic-gradient(
        #7C5CFC 0deg ${botDeg}deg,
        #FF8A3D ${botDeg}deg ${humanDeg}deg,
        #EAB308 ${humanDeg}deg 360deg
      )`
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
    {/* SIDEBAR FOOTER  */}
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
      <main className="flex-1 overflow-y-auto p-8 min-w-0">
        
        {/* HEADER */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Chat Analytics</h1>
          {loading && <Loader2 className="w-5 h-5 animate-spin text-[#7C5CFC]" />}
        </div>

        {/* SINGLE GLOBAL TIMEFRAME DROPDOWN */}
        <div className="mb-8 inline-block relative">
          <div className="flex items-center bg-white border border-slate-200 rounded-full px-5 py-2 text-sm text-slate-600 shadow-sm">
            <span className="mr-2 text-slate-500 font-medium">Timeframe:</span>
            <select 
              value={timeframe} 
              onChange={handleTimeframeChange}
              className="font-bold text-slate-900 bg-transparent outline-none cursor-pointer pr-1"
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
          
          {/* LEFT COLUMN */}
          <div className="lg:col-span-6 space-y-6">
            
            {/* Stat Cards */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#7C5CFC] text-white p-5 rounded-2xl shadow-sm flex flex-col justify-between h-36">
                <p className="text-xs font-semibold text-white/90">AI Chatbot Usefulness</p>
                <p className="text-3xl font-extrabold">{stats.usefulnessPct}%</p>
              </div>

              <div className="bg-[#7C5CFC] text-white p-5 rounded-2xl shadow-sm flex flex-col justify-between h-36">
                <p className="text-xs font-semibold text-white/90">Need for Human Intervention</p>
                <p className="text-3xl font-extrabold">{stats.humanInterventionPct}%</p>
              </div>

              <div className="bg-[#7C5CFC] text-white p-5 rounded-2xl shadow-sm flex flex-col justify-between h-36">
                <p className="text-xs font-semibold text-white/90">Total Flagged Customer Responses</p>
                <p className="text-3xl font-extrabold">{stats.totalFlaggedCustomer}</p>
              </div>

              <div className="bg-[#7C5CFC] text-white p-5 rounded-2xl shadow-sm flex flex-col justify-between h-36">
                <p className="text-xs font-semibold text-white/90">Total Flagged Chatbot Responses</p>
                <p className="text-3xl font-extrabold">{stats.totalFlaggedBot}</p>
              </div>
            </div>

            {/* Flagged Customer Responses Card */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="text-xs font-bold text-slate-500 mb-4">Flagged Customer Responses</h3>

              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {flaggedCustomerResponses.length > 0 ? (
                  flaggedCustomerResponses.map((item, idx) => {
                    const itemId = item.id || idx;
                    const isExpanded = expandedCustomerMsgId === itemId;
                    const rawDate = item.created_at || item.CreatedAt;
                    const formattedDate = rawDate 
                      ? new Date(rawDate).toLocaleString('en-US', {
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
                        key={itemId}
                        onClick={() => setExpandedCustomerMsgId(isExpanded ? null : itemId)}
                        className="w-full bg-[#F7E5D1] text-[#6E4218] rounded-xl transition-all duration-200 cursor-pointer overflow-hidden border border-[#eed7c0]"
                      >
                        <div className="py-3 px-4 flex items-center justify-between text-xs font-bold">
                          <span>Conversation {item.conversation_id || idx + 1}: {formattedDate}</span>
                          <span className="text-[10px] bg-white/60 px-2 py-0.5 rounded-full text-[#6E4218]">
                            {isExpanded ? 'Hide Details' : 'View Content'}
                          </span>
                        </div>

                        {isExpanded && (
                          <div className="px-4 pb-3.5 pt-2 border-t border-[#eed7c0] bg-[#f2ddc6] text-xs">
                            {item.flag_reason && (
                              <p className="font-bold text-[10px] text-amber-900 uppercase tracking-wider mb-1">
                                Flag Reason: {item.flag_reason}
                              </p>
                            )}
                            <p className="italic text-slate-800 leading-relaxed">
                              {item.message_text || item.content || 'Customer flag content logged in system.'}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <p className="text-xs text-slate-400">No flagged customer responses found for this timeframe.</p>
                )}
              </div>
            </div>

            {/* Flagged Chatbot Responses Card */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="text-xs font-bold text-slate-500 mb-4">Flagged Chatbot Responses</h3>

              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {flaggedBotResponses.length > 0 ? (
                  flaggedBotResponses.map((item, idx) => {
                    const itemId = item.id || idx;
                    const isExpanded = expandedBotMsgId === itemId;
                    const rawDate = item.created_at || item.CreatedAt;
                    const formattedDate = rawDate 
                      ? new Date(rawDate).toLocaleString('en-US', {
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
                        key={itemId}
                        onClick={() => setExpandedBotMsgId(isExpanded ? null : itemId)}
                        className="w-full bg-[#EBBFB8] text-[#692A23] rounded-xl transition-all duration-200 cursor-pointer overflow-hidden border border-[#dfada5]"
                      >
                        <div className="py-3 px-4 flex items-center justify-between text-xs font-bold">
                          <span>Conversation {item.conversation_id || idx + 1}: {formattedDate}</span>
                          <span className="text-[10px] bg-white/60 px-2 py-0.5 rounded-full text-[#692A23]">
                            {isExpanded ? 'Hide Details' : 'View Content'}
                          </span>
                        </div>

                        {isExpanded && (
                          <div className="px-4 pb-3.5 pt-2 border-t border-[#dfada5] bg-[#e2b0a9] text-xs">
                            {item.flag_reason && (
                              <p className="font-bold text-[10px] text-rose-950 uppercase tracking-wider mb-1">
                                Flag Reason: {item.flag_reason}
                              </p>
                            )}
                            <p className="italic text-slate-900 leading-relaxed">
                              {item.message_text || item.content || 'Chatbot automated reply flagged for review.'}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <p className="text-xs text-slate-400">No flagged chatbot responses found for this timeframe.</p>
                )}
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN */}
          <div className="lg:col-span-6 space-y-6">
            
            {/* Stacked Bar Chart Card */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold text-slate-700">Conversations Overview</h3>
              </div>

              {/* Chart Grid */}
              <div className="h-64 flex items-end justify-between gap-1 pt-6 border-b border-slate-100 pb-2 relative">
                {/* Y-axis guide lines */}
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none text-[10px] text-slate-300">
                  {yAxisSteps.map((val, idx) => (
                    <span key={idx} className="border-b border-slate-100 w-full">{val}</span>
                  ))}
                </div>

                {chartData.length > 0 ? (
                  chartData.map((item, idx) => {
                    const botHeightPct = ((item.chatbot || 0) / maxBarVal) * 100;
                    const humanHeightPct = ((item.human || 0) / maxBarVal) * 100;

                    return (
                      <div key={idx} className="flex-1 flex flex-col justify-end items-center h-full z-10 group relative">
                        {/* Hover Tooltip */}
                        <div className="absolute -top-9 left-1/2 -translate-x-1/2 hidden group-hover:flex bg-slate-800 text-white text-[10px] py-1 px-2 rounded shadow-md whitespace-nowrap z-30 pointer-events-none">
                          {item.label}: Bot ({item.chatbot}) | Human ({item.human})
                        </div>

                        {/* Stacked Bar Pillar */}
                        <div className="w-2.5 rounded-full overflow-hidden flex flex-col justify-end bg-slate-100 h-full">
                          {/* Chatbot Portion (Blue) */}
                          <div 
                            style={{ height: `${botHeightPct}%` }} 
                            className="bg-[#3B82F6] w-full transition-all duration-300"
                          />
                          {/* Human Portion (Purple) */}
                          <div 
                            style={{ height: `${humanHeightPct}%` }} 
                            className="bg-[#9333EA] w-full transition-all duration-300"
                          />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="w-full flex items-center justify-center text-xs text-slate-400 font-medium z-10">
                    {loading ? 'Loading conversations...' : 'No conversation records found for this timeframe'}
                  </div>
                )}
              </div>

              {/* X-Axis Labels */}
              <div className="flex justify-between text-[10px] text-slate-400 font-semibold mt-2">
                {chartData.map((item, idx) => (
                  <span key={idx} className="flex-1 text-center">{item.label}</span>
                ))}
              </div>

              {/* Chart Legend */}
              <div className="flex justify-center space-x-6 text-xs text-slate-600 mt-4 font-semibold">
                <div className="flex items-center space-x-2">
                  <span className="w-6 h-2.5 bg-[#3B82F6] rounded-full inline-block"></span>
                  <span>Chatbot</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="w-6 h-2.5 bg-[#9333EA] rounded-full inline-block"></span>
                  <span>Human</span>
                </div>
              </div>
            </div>

            {/* Pie Chart Card */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <p className="text-xs font-bold text-slate-400 mb-4">Pie Chart</p>
              <h3 className="text-sm font-bold text-slate-800 mb-6">Chats Handled Breakdown</h3>

              <div className="flex flex-col sm:flex-row items-center justify-around gap-6">
                {/* Conic Pie Chart Visual */}
                <div 
                  className="w-48 h-48 rounded-full shadow-inner shrink-0 transition-all duration-500"
                  style={{ background: pieConicStyle }}
                />

                {/* Pie Chart Legend */}
                <div className="space-y-3 text-xs font-bold">
                  <div className="flex items-center space-x-2">
                    <span className="w-3 h-3 bg-[#7C5CFC] rounded-sm inline-block"></span>
                    <span className="text-slate-700">
                      Chatbot: <strong className="text-slate-900">{pieData.chatbot || 0} ({pieData.chatbotPct || 0}%)</strong>
                    </span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className="w-3 h-3 bg-[#FF8A3D] rounded-sm inline-block"></span>
                    <span className="text-slate-700">
                      Human: <strong className="text-slate-900">{pieData.human || 0} ({pieData.humanPct || 0}%)</strong>
                    </span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className="w-3 h-3 bg-[#EAB308] rounded-sm inline-block"></span>
                    <span className="text-slate-700">
                      Unanswered: <strong className="text-slate-900">{pieData.unanswered || 0} ({pieData.unansweredPct || 0}%)</strong>
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