// server.js — Nibbli backend entry point
const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const cors    = require('cors');
const registerHandlers = require('./socketHandlers');

const app    = express();
const server = http.createServer(app);

// ── PRODUCTION FIX: dynamic CORS origins ──────────────────────────────────
// In production, set the FRONTEND_URL environment variable to your Vercel
// deployment URL (e.g. https://nibbli.vercel.app).
// Multiple origins can be comma-separated: "https://a.vercel.app,https://b.vercel.app"
const RAW_ORIGINS = process.env.FRONTEND_URL || 'http://localhost:5173';
const ALLOWED_ORIGINS = RAW_ORIGINS.split(',').map(o => o.trim()).filter(Boolean);

// Always include local dev origins so development is never broken
const DEV_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'];
const ALL_ORIGINS  = [...new Set([...ALLOWED_ORIGINS, ...DEV_ORIGINS])];

console.log('Allowed CORS origins:', ALL_ORIGINS);

const io = new Server(server, {
  cors: {
    origin: ALL_ORIGINS,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  // ── PRODUCTION FIX: explicit transport configuration ─────────────────────
  // Vercel serverless functions cannot maintain long-lived HTTP polling.
  // Forcing 'websocket' skips the polling upgrade handshake entirely and
  // connects directly. The fallback ['polling', 'websocket'] is the default
  // and causes failures on serverless platforms.
  transports: ['websocket', 'polling'],

  // ── PRODUCTION FIX: ping tuning for cloud environments ───────────────────
  // Render/Railway free tier sleeps after inactivity. Shorter pingTimeout
  // means broken connections are detected and cleaned up faster instead of
  // leaving ghost users in rooms.
  pingTimeout:  20000,
  pingInterval: 25000,

  // ── PRODUCTION FIX: allow upgrade from polling for environments that
  // block raw WebSocket (some corporate proxies, certain CDN configs).
  allowUpgrades: true,
});

// ── Express middleware ─────────────────────────────────────────────────────
app.use(cors({
  origin: ALL_ORIGINS,
  credentials: true,
}));
app.use(express.json());

// Health check — deployment platforms use this to verify the service is up
app.get('/health', (_req, res) => res.json({ status: 'ok', app: 'Nibbli' }));

// ── Socket.IO ────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  registerHandlers(io, socket);
});

// ── Start ────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`✨ Nibbli backend running → http://localhost:${PORT}`);
});
