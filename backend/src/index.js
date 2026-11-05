import './env.js';
import express from 'express';
import cors from 'cors';
import connectDB from './db.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests (mobile apps, curl, etc.) or local dev origins
    if (!origin || process.env.NODE_ENV !== 'production' || origin.includes('localhost') || origin.includes('render.com')) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  credentials: true
}));

app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    environment: process.env.WORLDID_ENV || 'staging',
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Backend running on port ${PORT} (WorldID env: ${process.env.WORLDID_ENV || 'staging'})`);
});
