require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Database = require('./database');

const app = express();
const sessions = new Map();

console.log('DEBUG: app-clean.js - Script started.');

// Initialize database connection
Database.initialize().catch(error => {
    console.warn('⚠️ Database connection failed, running in degraded mode:', error.message);
});

// Basic middleware
app.use(cors());
app.use(express.json());

// Debug middleware to log all requests
console.log('🚀 MIDDLEWARE REGISTERED - Debug middleware is being added');
app.use((req, res, next) => {
    console.log('🔥 MIDDLEWARE HIT!');
    console.log('🔥 METHOD:', req.method);
    console.log('🔥 URL:', req.originalUrl);
    next();
});

// Import and register chat routes
const chatRoutes = require('./routes/chat');
console.log('🚀 REAL: About to register chat routes...');
app.use('/chat', chatRoutes);
console.log('🚀 REAL: Chat routes registered successfully');

// Health check endpoint
app.get('/health', (req, res) => {
    console.log('DEBUG: app-clean.js - /health endpoint hit');
    res.status(200).json({
        status: 'OK',
        message: 'Server is healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime() + 's'
    });
});

// Status endpoint
app.get('/status', (req, res) => {
    console.log('DEBUG: app-clean.js - /status endpoint hit');
    res.json({
        language: 'es',
        llmProvider: process.env.LLM_PROVIDER || 'groq',
        llmModel: process.env.LLM_MODEL || 'llama3-70b-8192',
        apiMode: 'MOCK',
        agents: []
    });
});

// Root endpoint
app.get('/', (req, res) => {
    console.log('DEBUG: app-clean.js - / endpoint hit');
    res.send('Kargho Chatbot Backend is running! (Clean version)');
});

// Export the app and sessions
module.exports = { app, sessions };