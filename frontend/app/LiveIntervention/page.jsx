'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function LiveInterventionHub() {
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingLogs, setFetchingLogs] = useState(false);

  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);
  const selectedSessionRef = useRef(selectedSession);
  const activeFetchController = useRef(null);

  // Keep ref updated to avoid stale closures in socket callbacks
  useEffect(() => {
    selectedSessionRef.current = selectedSession;
  }, [selectedSession]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Auto-scroll on new messages
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch logs for a given phone number with race-condition prevention
  const fetchLogs = useCallback(async (phoneNumber) => {
    if (activeFetchController.current) {
      activeFetchController.current.abort();
    }
    const controller = new AbortController();
    activeFetchController.current = controller;

    setFetchingLogs(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/whatsapp/logs/${encodeURIComponent(phoneNumber)}`,
        { signal: controller.signal }
      );
      const data = await res.json();
      if (data.success) {
        setMessages(data.data);
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Error fetching chat logs:', err);
      }
    } finally {
      setFetchingLogs(false);
    }
  }, []);

  // Fetch active sessions list
  const refreshSessions = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/whatsapp/sessions`);
      const data = await res.json();
      if (data.success) {
        setSessions(data.data);
      }
    } catch (err) {
      console.error('Error fetching sessions:', err);
    }
  }, []);

  // 1. Initial Load Effect
  useEffect(() => {
    const initData = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/whatsapp/sessions`);
        const data = await res.json();
        if (data.success && data.data.length > 0) {
          setSessions(data.data);
          const firstSession = data.data[0];
          setSelectedSession(firstSession);
          fetchLogs(firstSession.PhoneNumber);
        }
      } catch (err) {
        console.error('Error initializing hub:', err);
      }
    };

    initData();
  }, [fetchLogs]);

  // 2. Persistent Single Socket Connection
  useEffect(() => {
    const socket = io(API_BASE, {
      transports: ['websocket']
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('✅ Connected LiveIntervention socket:', socket.id);
    });

    socket.on('whatsapp:new_message', (newMsg) => {
      // Compare with current active session via ref
      if (newMsg.PhoneNumber === selectedSessionRef.current?.PhoneNumber) {
        setMessages((prev) => {
          if (newMsg.ChatID && prev.some((m) => m.ChatID === newMsg.ChatID)) return prev;
          return [...prev, newMsg];
        });
      }
      refreshSessions();
    });

    const handleHandoverEvent = (data) => {
      const targetPhone = data.phoneNumber || data.PhoneNumber;
      if (!targetPhone) return;

      if (targetPhone === selectedSessionRef.current?.PhoneNumber) {
        setSelectedSession((prev) => (prev ? { ...prev, Handover: true } : prev));
      }
      setSessions((prev) =>
        prev.map((s) => (s.PhoneNumber === targetPhone ? { ...s, Handover: true } : s))
      );
      refreshSessions();
    };

    socket.on('whatsapp:handover_alert', handleHandoverEvent);
    socket.on('bot:handover_triggered', handleHandoverEvent);

    socket.on('whatsapp:session_updated', (data) => {
      if (!data.PhoneNumber) return;
      if (data.PhoneNumber === selectedSessionRef.current?.PhoneNumber) {
        setSelectedSession((prev) => (prev ? { ...prev, Handover: data.Handover } : prev));
      }
      setSessions((prev) =>
        prev.map((s) => (s.PhoneNumber === data.PhoneNumber ? { ...s, Handover: data.Handover } : s))
      );
      refreshSessions();
    });

    return () => {
      socket.disconnect();
    };
  }, [refreshSessions]);

  // Handle switching active sessions
  const handleSelectSession = (session) => {
    if (selectedSession?.PhoneNumber === session.PhoneNumber) return;
    setSelectedSession(session);
    fetchLogs(session.PhoneNumber);
  };

  // Toggle Handover state (Resume AI or Hand over to Human)
  const handleToggleHandover = async (handoverState) => {
    if (!selectedSession) return;

    try {
      const res = await fetch(`${API_BASE}/api/whatsapp/toggle-handover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: selectedSession.PhoneNumber,
          handover: handoverState
        })
      });

      const data = await res.json();
      if (data.success || res.ok) {
        // Sync local selected session and array simultaneously
        setSelectedSession((prev) => ({ ...prev, Handover: handoverState }));
        setSessions((prev) =>
          prev.map((s) =>
            s.PhoneNumber === selectedSession.PhoneNumber
              ? { ...s, Handover: handoverState }
              : s
          )
        );
        refreshSessions();
      }
    } catch (err) {
      console.error('Failed to toggle handover:', err);
    }
  };

  // Send human agent reply
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || !selectedSession || loading) return;

    const textToSend = inputMessage;
    setInputMessage('');
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/whatsapp/send-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: selectedSession.PhoneNumber,
          message: textToSend
        })
      });

      const data = await res.json();
      if (data.success) {
        setMessages((prev) => [...prev, data.data]);
        // Auto-enable handover mode when human replies
        setSelectedSession((prev) => ({ ...prev, Handover: true }));
        setSessions((prev) =>
          prev.map((s) =>
            s.PhoneNumber === selectedSession.PhoneNumber
              ? { ...s, Handover: true }
              : s
          )
        );
        refreshSessions();
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-[750px] w-full max-w-6xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
      
      {/* SIDEBAR: Active Sessions / Chats */}
      <div className="w-1/3 border-r border-gray-200 bg-gray-50 flex flex-col">
        <div className="p-4 border-b border-gray-200 bg-white flex justify-between items-center">
          <h2 className="font-bold text-gray-800">Live Chats</h2>
          <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full">
            {sessions.length} Active
          </span>
        </div>

        <div className="overflow-y-auto flex-1">
          {sessions.map((session) => {
            const isSelected = selectedSession?.PhoneNumber === session.PhoneNumber;
            return (
              <div
                key={session.PhoneNumber}
                onClick={() => handleSelectSession(session)}
                className={`p-4 border-b border-gray-100 cursor-pointer transition-colors ${
                  isSelected ? 'bg-emerald-50 border-l-4 border-l-emerald-600' : 'hover:bg-gray-100'
                }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="font-semibold text-gray-900 text-sm">
                    {session.CustomerName || session.PhoneNumber}
                  </span>
                  {session.Handover && (
                    <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded">
                      Human Active
                    </span>
                  )}
                </div>
                <div className="flex justify-between items-center text-xs text-gray-500">
                  <span>{session.PhoneNumber}</span>
                  <span
                    className={`capitalize ${
                      session.Sentiment === 'Negative' ? 'text-red-500 font-semibold' : ''
                    }`}
                  >
                    {session.Sentiment || 'Neutral'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* MAIN CHAT AREA */}
      <div className="w-2/3 flex flex-col bg-white">
        {selectedSession ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <div>
                <h3 className="font-bold text-gray-800">
                  {selectedSession.CustomerName || 'Unknown Customer'}
                </h3>
                <p className="text-xs text-gray-500">{selectedSession.PhoneNumber}</p>
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-400">Mode:</span>
                <span
                  className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                    selectedSession.Handover
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-indigo-100 text-indigo-800'
                  }`}
                >
                  {selectedSession.Handover ? '🤖 AI Paused (Human Takeover)' : '🤖 AI Responding'}
                </span>

                {selectedSession.Handover ? (
                  <button
                    onClick={() => handleToggleHandover(false)}
                    className="text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold px-2.5 py-1 rounded-md transition-colors"
                  >
                    Resume AI Bot
                  </button>
                ) : (
                  <button
                    onClick={() => handleToggleHandover(true)}
                    className="text-xs bg-amber-50 hover:bg-amber-100 text-amber-700 font-semibold px-2.5 py-1 rounded-md transition-colors"
                  >
                    Pause AI Bot
                  </button>
                )}
              </div>
            </div>

            {/* Message Thread */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50">
              {fetchingLogs && messages.length === 0 ? (
                <div className="flex h-full items-center justify-center text-xs text-gray-400">
                  Loading conversation history...
                </div>
              ) : (
                messages.map((msg, idx) => {
                  const isCustomer = msg.sender_type === 'customer';
                  const isHuman = msg.sender_type === 'human_agent';

                  return (
                    <div
                      key={msg.ChatID || `${msg.PhoneNumber}-${idx}`}
                      className={`flex flex-col ${isCustomer ? 'items-start' : 'items-end'}`}
                    >
                      <span className="text-[10px] text-gray-400 mb-1 px-1">
                        {isCustomer ? 'Customer' : isHuman ? 'Human Support' : 'AI Assistant'}
                      </span>
                      <div
                        className={`max-w-[70%] p-3 rounded-2xl text-sm ${
                          isCustomer
                            ? 'bg-white text-gray-800 rounded-tl-none border border-gray-200 shadow-sm'
                            : isHuman
                            ? 'bg-emerald-600 text-white rounded-tr-none shadow-sm'
                            : 'bg-indigo-600 text-white rounded-tr-none shadow-sm'
                        }`}
                      >
                        {msg.message}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Reply Input Box */}
            <form onSubmit={handleSendMessage} className="p-3 border-t border-gray-200 flex gap-2 bg-white">
              <input
                type="text"
                placeholder="Type a response... (Sending automatically pauses AI)"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-emerald-600"
              />
              <button
                type="submit"
                disabled={loading || !inputMessage.trim()}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-5 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                {loading ? 'Sending...' : 'Send Reply'}
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
            Select a session from the list to intervene.
          </div>
        )}
      </div>
    </div>
  );
}