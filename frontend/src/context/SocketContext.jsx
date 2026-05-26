// SocketContext.jsx — single Socket.IO connection shared across the whole app

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext(null);

// ── PRODUCTION FIX: read backend URL from env ──────────────────────────────
// Local dev: falls back to localhost:3001 automatically.
// Production: set VITE_BACKEND_URL in Vercel's environment variable dashboard
//   to your Render/Railway backend URL, e.g. https://nibbli-backend.onrender.com
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

export function SocketProvider({ children }) {
  const socketRef = useRef(null);

  // ── PRODUCTION FIX: use state so children always get the live socket object,
  // not the null that socketRef.current holds on first render before useEffect.
  const [socket,    setSocket]    = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const newSocket = io(BACKEND_URL, {
      // ── PRODUCTION FIX: transport configuration ────────────────────────────
      // 'websocket' first avoids the HTTP long-polling handshake that times out
      // on serverless / edge platforms. 'polling' remains as a fallback for
      // environments that block raw WebSocket (corporate proxies, etc.).
      transports: ['websocket', 'polling'],

      // ── PRODUCTION FIX: reconnection configuration ─────────────────────────
      // The defaults work locally but cloud services (Render free tier) can go
      // to sleep. These settings ensure the client retries aggressively and
      // waits long enough for a cold-start wake-up.
      reconnection:        true,
      reconnectionAttempts: 10,
      reconnectionDelay:    1000,  // 1s initial delay
      reconnectionDelayMax: 10000, // cap at 10s between attempts
      randomizationFactor:  0.3,

      // ── PRODUCTION FIX: timeout tuning ─────────────────────────────────────
      // Default 20s timeout is too long for detecting broken connections in prod.
      timeout: 10000,

      // Required for CORS with credentials
      withCredentials: true,
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('[socket] connected:', newSocket.id);
      setConnected(true);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('[socket] disconnected:', reason);
      setConnected(false);
    });

    newSocket.on('connect_error', (err) => {
      console.warn('[socket] connection error:', err.message);
    });

    return () => {
      newSocket.disconnect();
    };
  }, []); // empty dep array — one connection for the lifetime of the app

  return (
    <SocketContext.Provider value={{ socket, connected }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
