// Vercel serverless function entry point
// This wraps the Express app for Vercel serverless functions

const express = require('express');
const cors = require('cors');
const path = require('path');

const offersRouter = require('../backend/routes/offers');
const authRouter = require('../backend/routes/auth');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/offers', offersRouter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Server is running', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// Export the Express app for Vercel serverless functions
module.exports = app;

