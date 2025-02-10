const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const rateLimiter = require('express-rate-limit');
const compression = require('compression');

// Middleware for compression
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

// Setting view engine
app.set('view engine', 'ejs');
app.set('trust proxy', 1);

// CORS headers
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    console.log(`[${new Date().toLocaleString()}] ${req.method} ${req.url} - ${res.statusCode}`);
    next();
});

// Body parser middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

// Rate limiting middleware
const limiter = rateLimiter({ 
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    headers: true 
});
app.use(limiter);

// Login dashboard route
app.all('/player/login/dashboard', (req, res) => {
    const tData = {};
    try {
        const uData = JSON.stringify(req.body).split('"')[1].split('\\n');
        const uName = uData[0].split('|');
        const uPass = uData[1].split('|');
        
        for (let i = 0; i < uData.length - 1; i++) {
            const d = uData[i].split('|');
            tData[d[0]] = d[1];
        }

        // Validate username and password
        if (uName[1] && uPass[1]) {
            return res.redirect('/player/growid/login/validate');
        }
    } catch (error) {
        console.error(`Warning: ${error}`);
    }

    res.render(__dirname + '/public/html/dashboard.ejs', { data: tData });
});

// Validate login route
app.all('/player/growid/login/validate', (req, res) => {
    const _token = req.body._token;
    const growId = req.body.growId;
    const password = req.body.password;

    // Validate input
    if (!_token || !growId || !password) {
        return res.status(400).send({ status: "error", message: "Missing required fields." });
    }

    const token = Buffer.from(
        `_token=${_token}&growId=${growId}&password=${password}`
    ).toString('base64');

    res.send(
        JSON.stringify({
            status: "success",
            message: "Account Validated.",
            token: token,
            url: "",
            accountType: "growtopia"
        })
    );
});

// Redirect all other player routes
app.all('/player/*', (req, res) => {
    res.status(301).redirect(`https://api.yoruakio.tech/player/${req.path.slice(8)}`);
});

// Home route
app.get('/', (req, res) => {
    res.send('Hello World!');
});

// Start the server
app.listen(5000, () => {
    console.log('Listening on port 5000');
});
