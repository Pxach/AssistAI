require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./database/db');
const apiRoutes = require('./routes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json()); 

// API Routes
app.use('/api', apiRoutes);

// Root Route
app.get('/', (req, res) => {
    res.send('Assist AI Backend API is live!');
});

// Health Check Route (Database ping)
app.get('/health', async (req, res) => {
    try {
        await db.raw('SELECT 1');
        res.status(200).json({ 
            status: 'OK', 
            message: 'Assist AI Backend and Database connected successfully' 
        });
    } catch (error) {
        res.status(500).json({ 
            status: 'ERROR', 
            message: 'Backend running, but Database connection failed', 
            error: error.message 
        });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server is running in ${process.env.NODE_ENV} mode on http://localhost:${PORT}`);
});