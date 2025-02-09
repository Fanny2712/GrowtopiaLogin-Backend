const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const rateLimiter = require('express-rate-limit');
const compression = require('compression');

// Basic security headers
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
});

// Compression settings
app.use(compression({
    level: 5,
    threshold: 0,
    filter: (req, res) => {
        if (req.headers['x-no-compression']) {
            return false;
        }
        return compression.filter(req, res);
    }
}));

// Rate limiter configuration
const loginLimiter = rateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 100,
    handler: function (req, res) {
        res.status(429).json({
            status: 'error',
            message: 'Too many requests, please try again later.'
        });
    },
    headers: true
});

// Basic configurations
app.set('view engine', 'ejs');
app.set('trust proxy', 1);

// Middleware
app.use(bodyParser.urlencoded({ extended: true, limit: '1mb' }));
app.use(express.json({ limit: '1mb' }));
app.use(loginLimiter);

// CORS and logging middleware
app.use(function (req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    
    // Request logging
    const timestamp = new Date().toISOString();
    const method = req.method;
    const url = req.url;
    const ip = req.ip || req.connection.remoteAddress;
    console.log(`[${timestamp}] ${method} ${url} - IP: ${ip}`);
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    next();
});

// Dashboard route
app.all('/player/login/dashboard', function (req, res) {
    try {
        const tData = {};
        
        if (req.body && typeof req.body === 'string') {
            const uData = req.body.split('\n');
            
            for (const data of uData) {
                if (data) {
                    const [key, value] = data.split('|');
                    if (key && value) {
                        tData[key.trim()] = value.trim();
                    }
                }
            }
        }

        // Validate credentials
        if (tData.username && tData.password) {
            return res.redirect('/player/growid/login/validate');
        }

        return res.render(__dirname + '/public/html/dashboard.ejs', { data: tData });
    } catch (error) {
        console.error(`Dashboard Error: ${error.message}`);
        return res.status(400).json({
            status: 'error',
            message: 'Invalid request format'
        });
    }
});

// Login validation route with timeout handling
app.post('/player/growid/login/validate', function (req, res) {
    // Set response timeout
    res.setTimeout(10000, function() {
        return res.status(408).json({
            status: 'error',
            message: 'Request timeout'
        });
    });

    try {
        const { _token, growId, password } = req.body;

        // Validate required fields
        if (!growId || !password) {
            return res.status(400).json({
                status: 'error',
                message: 'Username and password are required'
            });
        }

        // Validate field lengths
        if (growId.length < 2 || password.length < 7) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid username or password length'
            });
        }

        // Create token
        const token = Buffer.from(
            `_token=${_token || ''}&growId=${growId}&password=${password}`
        ).toString('base64');

        // Success response
        return res.json({
            status: 'success',
            message: 'Account Validated.',
            token: token,
            url: '',
            accountType: 'growtopia'
        });
    } catch (error) {
        console.error(`Validation Error: ${error.message}`);
        return res.status(500).json({
            status: 'error',
            message: 'An error occurred during validation'
        });
    }
});

// Redirect route
app.all('/player/*', function (req, res) {
    return res.status(301).redirect('https://api.yoruakio.tech/player/' + req.path.slice(8));
});

// Home route
app.get('/', function (req, res) {
    return res.json({
        status: 'success',
        message: 'Server is running'
    });
});

// 404 handler
app.use(function (req, res) {
    return res.status(404).json({
        status: 'error',
        message: 'Route not found'
    });
});

// Error handling middleware
app.use(function (err, req, res, next) {
    console.error(`Server Error: ${err.message}`);
    return res.status(500).json({
        status: 'error',
        message: 'Internal server error'
    });
});

// Start server
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, function () {
    console.log(`Server running on port ${PORT}`);
});

// Handle server errors
server.on('error', function (error) {
    console.error(`Server Error: ${error.message}`);
    if (error.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use`);
    }
});

// Handle uncaught exceptions
process.on('uncaughtException', function (error) {
    console.error('Uncaught Exception:', error);
    // Attempt graceful shutdown
    server.close(() => {
        process.exit(1);
    });
});
