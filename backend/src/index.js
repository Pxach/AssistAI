import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';

// Import route routers
import routes from './routes/index.js';
import whatsappRoutes from './routes/whatsappRoutes.js';
import businessRoutes from './routes/businessRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Allowed frontend origins
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001'
];

// Express CORS
app.use(
  cors({
    origin: ALLOWED_ORIGINS,
    credentials: true
  })
);

app.use(express.json());
import settingsRoutes from './routes/settings.js';
app.use('/api/settings', settingsRoutes);

// 1. Create HTTP server & attach Socket.io with strict CORS configuration
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  // Support both WebSocket and Polling fallback for local dev stability
  transports: ['websocket', 'polling']
});

// Store io instance on app so route controllers can emit events
app.set('io', io);

// 2. Socket.io Connection Handler
io.on('connection', (socket) => {
  // Handler function for joining session rooms
  const handleJoin = (sessionKey) => {
    const room = sessionKey || 'default';
    socket.join(room);
  };

  // Support BOTH event names so frontend never fails to join
  socket.on('join', handleJoin);
  socket.on('join_session', handleJoin);

  socket.on('disconnect', (reason) => {
  });
});

// 3. Health check endpoint
app.get('/', (req, res) => {
  res.json({ message: 'AssistAI Backend API is running' });
});

// 4. REST API Routes
app.use('/api', routes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/business', businessRoutes);

// Export io for external modules/workers
export { io };

// 5. Start Server
httpServer.listen(PORT, () => {
  console.log(`🚀 Backend API listening on port ${PORT}`);
});