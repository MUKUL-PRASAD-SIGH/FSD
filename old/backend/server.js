const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const connectDB = require('./config/db');
const { requestLogger, logFilePath } = require('./middleware/loggerMiddleware');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');

// Route imports
const authRoutes = require('./routes/authRoutes');
const opportunityRoutes = require('./routes/opportunityRoutes');
const applicationRoutes = require('./routes/applicationRoutes');
const teamRoutes = require('./routes/teamRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const aiRoutes = require('./routes/aiRoutes');

// Connect to MongoDB
connectDB();

const app = express();

// Body Parser Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Enable CORS for Frontend communication
app.use(
  cors({
    origin: '*', // Allow all during development or configure specific Vite origins
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Serve uploaded resumes and attachments statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 🌟 Robust Request-Response Logging Middleware (Course: 24CIE554)
app.use(requestLogger);

// Health check & root API info
app.get('/', (req, res) => {
  res.json({
    status: 'ONLINE',
    project: 'HackElite AI Platform API',
    course: '24CIE554 - Full Stack Development',
    timestamp: new Date().toISOString(),
    documentation: '/api/docs',
    endpoints: {
      auth: '/api/auth',
      opportunities: '/api/opportunities',
      applications: '/api/applications',
      teams: '/api/teams',
      analytics: '/api/analytics',
      aiAssistant: '/api/ai',
    },
  });
});

// Endpoint to view server audit logs directly (convenient for professor viva demo!)
app.get('/api/logs/view', (req, res) => {
  const fs = require('fs');
  if (fs.existsSync(logFilePath)) {
    const raw = fs.readFileSync(logFilePath, 'utf8');
    const lines = raw.trim().split('\n').filter(Boolean).map((line) => {
      try {
        return JSON.parse(line);
      } catch (e) {
        return { raw: line };
      }
    });
    res.json({
      success: true,
      count: lines.length,
      recentLogs: lines.slice(-50).reverse(),
    });
  } else {
    res.json({ success: true, count: 0, recentLogs: [] });
  }
});

// API Routes Mounting
app.use('/api/auth', authRoutes);
app.use('/api/opportunities', opportunityRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/ai', aiRoutes);

// Error Handling Middlewares
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`\n\x1b[35m====================================================================\x1b[0m`);
  console.log(`\x1b[1m\x1b[36m🚀 HACKELITE AI BACKEND SERVER RUNNING ON PORT ${PORT}\x1b[0m`);
  console.log(`\x1b[32m✔ Environment: ${process.env.NODE_ENV || 'development'}\x1b[0m`);
  console.log(`\x1b[34mℹ API Base URL: http://localhost:${PORT}\x1b[0m`);
  console.log(`\x1b[33m📋 Audit Logs: ${logFilePath}\x1b[0m`);
  console.log(`\x1b[35m====================================================================\x1b[0m\n`);
});

module.exports = app;
