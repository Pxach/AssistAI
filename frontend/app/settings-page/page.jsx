'use client';

import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

// Point to your Express Backend URL
const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function WhatsAppConnect({ sessionKey = 'default' }) {
  const [status, setStatus] = useState('DISCONNECTED'); // 'DISCONNECTED' | 'PAIRING' | 'CONNECTED'
  const [phoneNumber, setPhoneNumber] = useState(null);
  const [qrCode, setQrCode] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // 1. Fetch initial status from DB via REST API
    const fetchInitialStatus = async () => {
      try {
        const res = await fetch(`${SOCKET_URL}/api/whatsapp/status?sessionKey=${sessionKey}`);
        const result = await res.json();
        if (result.success) {
          setStatus(result.data.status);
          setPhoneNumber(result.data.phoneNumber);
          if (result.data.qrCode) setQrCode(result.data.qrCode);
        }
      } catch (err) {
        console.error('Failed to fetch WhatsApp status:', err);
      }
    };

    fetchInitialStatus();

    // 2. Setup Socket.io Connection
    const socket = io(SOCKET_URL);

    socket.on('connect', () => {
      // Join room for this specific session
      socket.emit('join_session', sessionKey);
    });

    // Listen for raw QR string or Base64 QR from Baileys Engine
    socket.on('whatsapp:qr', (data) => {
      setStatus('PAIRING');
      setQrCode(data.qrCode);
      setLoading(false);
    });

    // Listen for Status Changes
    socket.on('whatsapp:status_change', (data) => {
      setStatus(data.status);
      if (data.phoneNumber) setPhoneNumber(data.phoneNumber);
      if (data.status === 'CONNECTED' || data.status === 'DISCONNECTED') {
        setQrCode(null);
        setLoading(false);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [sessionKey]);

  // Handler: Start Pairing Process
  const handleConnect = async () => {
    setLoading(true);
    try {
      await fetch(`${SOCKET_URL}/api/whatsapp/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionKey }),
      });
    } catch (err) {
      console.error('Failed to initiate pairing:', err);
      setLoading(false);
    }
  };

  // Handler: Disconnect / Log Out
  const handleDisconnect = async () => {
    setLoading(true);
    try {
      await fetch(`${SOCKET_URL}/api/whatsapp/disconnect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionKey }),
      });
    } catch (err) {
      console.error('Failed to disconnect:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-md mx-auto bg-white rounded-xl shadow-md border border-gray-100 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800">WhatsApp Service</h2>
        {/* Status Badge */}
        <span
          className={`px-3 py-1 rounded-full text-xs font-semibold ${
            status === 'CONNECTED'
              ? 'bg-green-100 text-green-700'
              : status === 'PAIRING'
              ? 'bg-yellow-100 text-yellow-700'
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          {status}
        </span>
      </div>

      {/* DISCONNECTED STATE */}
      {status === 'DISCONNECTED' && (
        <div className="text-center py-4 space-y-4">
          <p className="text-sm text-gray-500">
            Connect your phone to enable automated AI responses and handle agent interventions.
          </p>
          <button
            onClick={handleConnect}
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? 'Initializing...' : 'Connect WhatsApp Phone'}
          </button>
        </div>
      )}

      {/* PAIRING STATE - SHOW QR CODE */}
      {status === 'PAIRING' && (
        <div className="text-center py-4 space-y-3">
          <p className="text-sm text-gray-600">
            Scan this QR code using WhatsApp on your phone:
          </p>
          <div className="flex justify-center p-2 bg-gray-50 rounded-lg">
            {qrCode ? (
              <img src={qrCode} alt="WhatsApp QR Code" className="w-64 h-64 object-contain" />
            ) : (
              <div className="w-64 h-64 flex items-center justify-center text-gray-400 text-sm">
                Generating QR code...
              </div>
            )}
          </div>
          <p className="text-xs text-gray-400">
            Settings &gt; Linked Devices &gt; Link a Device
          </p>
        </div>
      )}

      {/* CONNECTED STATE */}
      {status === 'CONNECTED' && (
        <div className="text-center py-4 space-y-4">
          <div className="p-3 bg-emerald-50 text-emerald-800 rounded-lg text-sm">
            <p className="font-semibold">Device Linked & Ready</p>
            {phoneNumber && <p className="text-xs mt-1">Phone: {phoneNumber}</p>}
          </div>
          <button
            onClick={handleDisconnect}
            disabled={loading}
            className="w-full bg-red-50 hover:bg-red-100 text-red-600 font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? 'Disconnecting...' : 'Disconnect Phone'}
          </button>
        </div>
      )}
    </div>
  );
}