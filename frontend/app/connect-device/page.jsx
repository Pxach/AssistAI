'use client';

import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import {
  QrCode,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  LogOut,
  Smartphone,
  Wifi,
  ShieldCheck,
  Zap
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const SESSION_KEY = 'default';

export default function ConnectDevicePage() {
  const [status, setStatus] = useState('DISCONNECTED'); // DISCONNECTED | PAIRING | CONNECTED
  const [phoneNumber, setPhoneNumber] = useState(null);
  const [qrCode, setQrCode] = useState(null);
  const [connectedAt, setConnectedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const socketRef = useRef(null);

  // Helper for manual refresh & socket updates
  const refreshStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/whatsapp/status?sessionKey=${SESSION_KEY}`);
      const result = await res.json();

      if (result.success) {
        const { status, phoneNumber, qrCode, connectedAt } = result.data;
        setStatus(status || 'DISCONNECTED');
        setPhoneNumber(phoneNumber || null);
        setQrCode(qrCode || null);
        setConnectedAt(connectedAt || null);
      }
    } catch (err) {
      console.error('Failed to fetch connection status:', err);
    } finally {
      setLoading(false);
    }
  };

  // 1. Initial Mount Effect (Inlined fetch prevents React Compiler warnings)
  useEffect(() => {
    let isMounted = true;

    async function loadInitialStatus() {
      try {
        const res = await fetch(`${API_BASE}/api/whatsapp/status?sessionKey=${SESSION_KEY}`);
        const result = await res.json();

        if (isMounted && result.success) {
          const { status, phoneNumber, qrCode, connectedAt } = result.data;
          setStatus(status || 'DISCONNECTED');
          setPhoneNumber(phoneNumber || null);
          setQrCode(qrCode || null);
          setConnectedAt(connectedAt || null);
        }
      } catch (err) {
        console.error('Failed to fetch connection status:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadInitialStatus();

    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Real-time Socket Connection
useEffect(() => {
  const socket = io(API_BASE, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5
  });

  socketRef.current = socket;

  socket.on('connect', () => {
    console.log('✅ Connected to backend WebSocket:', socket.id);
    // Emits join_session to match backend
    socket.emit('join_session', SESSION_KEY);
  });

  socket.on('whatsapp:status_change', (data) => {
    console.log('Received status_change event:', data);
    if (data.status) setStatus(data.status);
    if (data.phoneNumber) setPhoneNumber(data.phoneNumber);
    if (data.connectedAt) setConnectedAt(data.connectedAt);

    if (data.status === 'CONNECTED') {
      setQrCode(null);
    }
    refreshStatus();
  });

  socket.on('whatsapp:qr', (data) => {
    console.log('Received QR Code event!');
    if (data.qrCode) {
      setQrCode(data.qrCode);
      setStatus('PAIRING');
    }
  });

  socket.on('connect_error', (err) => {
    console.error('Socket connection error:', err.message);
  });

  return () => {
    socket.disconnect();
  };
}, []);

  // Manual Refresh Handler
  const handleManualRefresh = () => {
    setLoading(true);
    refreshStatus();
  };

  // Trigger pairing / initialization
  const handleStartPairing = async () => {
    try {
      setActionLoading(true);
      const res = await fetch(`${API_BASE}/api/whatsapp/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionKey: SESSION_KEY })
      });

      const data = await res.json();
      if (data.success) {
        setStatus('PAIRING');
      }
    } catch (err) {
      console.error('Failed to initiate pairing:', err);
    } finally {
      setActionLoading(false);
    }
  };

  // Trigger disconnect / logout
  const handleDisconnect = async () => {
    try {
      setActionLoading(true);
      const res = await fetch(`${API_BASE}/api/whatsapp/disconnect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionKey: SESSION_KEY })
      });

      const data = await res.json();
      if (data.success) {
        setStatus('DISCONNECTED');
        setPhoneNumber(null);
        setQrCode(null);
        setConnectedAt(null);
      }
    } catch (err) {
      console.error('Failed to disconnect WhatsApp:', err);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Smartphone className="w-6 h-6 text-[#7C5CFC]" />
            WhatsApp Device Connection
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Pair your WhatsApp account to enable automated bot replies and human interventions.
          </p>
        </div>

        <button
          onClick={handleManualRefresh}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Status
        </button>
      </div>

      {/* Main Connection Status Card */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        {/* Status Bar */}
        <div
          className={`p-4 border-b flex justify-between items-center ${
            status === 'CONNECTED'
              ? 'bg-emerald-50 border-emerald-200'
              : status === 'PAIRING'
              ? 'bg-amber-50 border-amber-200'
              : 'bg-rose-50 border-rose-200'
          }`}
        >
          <div className="flex items-center space-x-3">
            {status === 'CONNECTED' && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
            {status === 'PAIRING' && <RefreshCw className="w-5 h-5 text-amber-600 animate-spin" />}
            {status === 'DISCONNECTED' && <AlertCircle className="w-5 h-5 text-rose-600" />}

            <div>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">
                Current Status
              </span>
              <span
                className={`font-bold text-sm ${
                  status === 'CONNECTED'
                    ? 'text-emerald-700'
                    : status === 'PAIRING'
                    ? 'text-amber-700'
                    : 'text-rose-700'
                }`}
              >
                {status === 'CONNECTED' && 'Connected & Operational'}
                {status === 'PAIRING' && 'Waiting for QR Code Scan...'}
                {status === 'DISCONNECTED' && 'Disconnected'}
              </span>
            </div>
          </div>

          {phoneNumber && (
            <div className="text-right">
              <span className="text-xs font-semibold text-gray-500 block">Linked Number</span>
              <span className="text-sm font-bold text-gray-800">{phoneNumber}</span>
            </div>
          )}
        </div>

        {/* Body Content */}
        <div className="p-8">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-gray-400">
              <RefreshCw className="w-8 h-8 animate-spin text-[#7C5CFC] mb-2" />
              <p className="text-sm">Checking connection status...</p>
            </div>
          ) : status === 'CONNECTED' ? (
            /* STATE 1: CONNECTED */
            <div className="text-center py-6 space-y-6">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <Wifi className="w-8 h-8" />
              </div>

              <div>
                <h3 className="text-xl font-bold text-gray-900">WhatsApp is Active</h3>
                <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
                  Your WhatsApp Baileys engine is connected. Incoming customer messages will show up in Live Intervention.
                </p>
                {connectedAt && (
                  <p className="text-xs text-gray-400 mt-2">
                    Connected since: {new Date(connectedAt).toLocaleString()}
                  </p>
                )}
              </div>

              <div className="pt-4 border-t border-gray-100">
                <button
                  onClick={handleDisconnect}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold px-5 py-2.5 rounded-lg text-sm transition-colors border border-rose-200 disabled:opacity-50"
                >
                  <LogOut className="w-4 h-4" />
                  {actionLoading ? 'Disconnecting...' : 'Disconnect Session'}
                </button>
              </div>
            </div>
          ) : status === 'PAIRING' ? (
            /* STATE 2: PAIRING / SCANNING QR */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div className="flex flex-col items-center justify-center p-6 bg-slate-50 border border-gray-200 rounded-xl">
                {qrCode ? (
                  <div className="bg-white p-4 rounded-lg shadow-md border border-gray-200">
                    <img
                      src={
                        qrCode.startsWith('data:image')
                          ? qrCode
                          : `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
                              qrCode
                            )}`
                      }
                      alt="WhatsApp QR Code"
                      className="w-56 h-56 object-contain"
                    />
                  </div>
                ) : (
                  <div className="w-56 h-56 flex flex-col items-center justify-center text-amber-600 space-y-2">
                    <RefreshCw className="w-8 h-8 animate-spin" />
                    <span className="text-xs font-semibold text-center">
                      Generating QR Code from engine...
                    </span>
                  </div>
                )}
                <p className="text-xs text-gray-400 mt-3 flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-amber-500" /> Auto-refreshes on socket updates
                </p>
              </div>

              <div className="space-y-4">
                <h3 className="font-bold text-gray-900 text-lg">How to connect:</h3>
                <ol className="space-y-3 text-sm text-gray-600 list-decimal list-inside">
                  <li className="leading-relaxed">
                    Open <span className="font-semibold text-gray-900">WhatsApp</span> on your phone.
                  </li>
                  <li className="leading-relaxed">
                    Tap <span className="font-semibold text-gray-900">Menu (⋮)</span> or{' '}
                    <span className="font-semibold text-gray-900">Settings</span> and select{' '}
                    <span className="font-semibold text-gray-900">Linked Devices</span>.
                  </li>
                  <li className="leading-relaxed">
                    Tap <span className="font-semibold text-gray-900">Link a Device</span>.
                  </li>
                  <li className="leading-relaxed">
                    Point your phone at this screen to scan the QR code.
                  </li>
                </ol>

                <div className="pt-2">
                  <button
                    onClick={handleDisconnect}
                    disabled={actionLoading}
                    className="text-xs text-gray-500 hover:text-gray-700 underline"
                  >
                    Cancel Pairing Process
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* STATE 3: DISCONNECTED */
            <div className="text-center py-6 space-y-6">
              <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
                <QrCode className="w-8 h-8" />
              </div>

              <div>
                <h3 className="text-xl font-bold text-gray-900">No Device Connected</h3>
                <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
                  Initialize a new pairing session to link your WhatsApp account with the platform.
                </p>
              </div>

              <div>
                <button
                  onClick={handleStartPairing}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-2 bg-[#7C5CFC] hover:bg-[#6847EC] text-white font-medium px-6 py-3 rounded-xl text-sm transition-colors shadow-md disabled:opacity-50"
                >
                  <Zap className="w-4 h-4" />
                  {actionLoading ? 'Initializing Engine...' : 'Connect WhatsApp Device'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-8 py-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" /> End-to-end multi-device pairing powered by Baileys engine
          </span>
          <span>
            Session Key: <code className="bg-gray-200 px-1.5 py-0.5 rounded font-mono text-[11px]">{SESSION_KEY}</code>
          </span>
        </div>
      </div>
    </div>
  );
}