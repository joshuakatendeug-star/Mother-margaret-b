// COMPLETE MOTHER MARGARET SCHOOL BACKEND (improved)
// Replaces and extends the provided server.js with:
// - secure middleware (helmet, compression, rate-limit)
// - CORS and env config
// - PostgreSQL (pg Pool) connection
// - /api/init to create tables + 7 admin accounts
// - auth: register, login, profile (JWT + bcrypt)
// - health, school info, swagger docs
// - static uploads, websockets (socket.io)
// - centralized error handling and 404
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

// ---------- Config / Middleware ----------
const PORT = parseInt(process.env.PORT, 10) || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'please_change_this_secret_in_production';
const NODE_ENV = process.env.NODE_ENV || 'development';

// Rate limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 200,
  message: 'Too many requests from this IP, please try again later.'
});

app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(limiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Static uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ---------- Database ----------
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || undefined,
  // in production with DATABASE_URL, allow self-signed certs (e.g. Heroku)
  ssl: process.env.DATABASE_URL && NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  // optional pool settings
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
});

// Helper to query and bubble a clear error
async function dbQuery(text, params = []) {
  return pool.query(text, params);
}

// ---------- Swagger (API docs) ----------
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Mother Margaret School API',
      version: '1.0.0',
      description: 'API for Mother Margaret Junior School & Daycare Management System',
      contact: { name: 'School Admin', email: process.env.SCHOOL_EMAIL || 'mothermargaretjuniorschools.ug@gmail.com' }
    },
    servers: [
      { url: process.env.BACKEND_URL || `http://localhost:${PORT}`, description: 'Local/Default' }
    ]
  },
  apis: ['./server.js'] // minimal; expand as you add route files
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ---------- Utility: auth middleware ----------
function authMiddleware(requiredRoles = []) {
  return (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Missing or invalid authorization header' });
    }
    const token = authHeader.split(' ')[1];
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      req.user = payload;
      if (requiredRoles.length && !requiredRoles.includes(payload.role)) {
        return res.status(403).json({ success: false, message: 'Forbidden: insufficient privileges' });
      }
      next();
    } catch (err) {
      return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }
  };
}

// ---------- Routes ----------

/**
 * @openapi
 * /:
 *   get:
 *     summary: Root info
 *     responses:
 *       200:
 *         description: Basic backend info
 */
app.get('/', (req, res) => {
  res.json({
    message: 'Mother Margaret School Backend',
    school: process.env.SCHOOL_NAME || 'Mother Margaret Junior School and Daycare',
    status: 'running',
    version: '1.0.0'
  });
});

/**
 * Healthcheck - verifies DB connectivity
 */
app.get('/health', async (req, res) => {
  try {
    await dbQuery('SELECT 1');
    res.json({
      status: 'healthy',
      service: 'Mother Margaret School Backend',
      timestamp: new Date().toISOString(),
      database: 'connected',
      uptime: process.uptime()
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * School information
 */
app.get('/api/school/info', (req, res) => {
  res.json({
    success: true,
    data: {
      name: process.env.SCHOOL_NAME || 'Mother Margaret Junior School and Daycare',
      motto: process.env.SCHOOL_MOTTO || 'Excellence in Early Education',
      address: process.env.SCHOOL_ADDRESS || 'Namuyenje, Mukono, Uganda',
      location: 'Opposite St. Paul Church, across the road',
      coordinates: { lat: parseFloat(process.env.SCHOOL_LAT) || 0.3476, lng: parseFloat(process.env.SCHOOL_LNG) || 32.5825 },
      google_maps: process.env.SCHOOL_MAP_URL || 'https://maps.google.com/?q=Mother+Margaret+Junior+School,Namuyenje+Mukono+Uganda',
      contacts: [
        { phone: process.env.SCHOOL_PHONE_1 || '0708 840 282', type: 'whatsapp', link: `https://wa.me/256708840282` },
        { phone: process.env.SCHOOL_PHONE_2 || '0704 702 301', type: 'call', link: `tel:+256704702301` },
        { phone: process.env.SCHOOL_PHONE_3 || '0747 677 562', type: 'whatsapp', link: `https://wa.me/256747677562` }
      ],
      email: process.env.SCHOOL_EMAIL || 'mothermargaretjuniorschools.ug@gmail.com',
      programs: [
        { name: 'Daycare', age: '1-2 years' },
        { name: 'Nursery', age: '3-4 years' },
        { name: 'Kindergarten', age: '5-6 years' },
        { name: 'Primary School', age: '7-13 years' }
      ],
      social_media: {
        facebook: process.env.SCHOOL_FACEBOOK || 'https://facebook.com/mothermargaretschool',
        instagram: process.env.SCHOOL_INSTAGRAM || 'https://instagram.com/mothermargaretjunior'
      },
      operating_hours: {
        weekdays: '7:00 AM - 5:00 PM',
        saturday: '8:00 AM - 1:00 PM',
        sunday: 'Closed'
      }
    }
  });
});

/**
 * Initialize system: create tables and seed 7 admin accounts
 *
 * Note: This endpoint should be protected or removed after first-run in real deployments.
 */
app.get('/api/init', async (req, res) => {
  try {
    // Users table
    await dbQuery(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE,
        password VARCHAR(255) NOT NULL,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        role VARCHAR(20) DEFAULT 'parent',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Students table
    await dbQuery(`
      CREATE TABLE IF NOT EXISTS students (
        id SERIAL PRIMARY KEY,
        student_id VARCHAR(50) UNIQUE NOT NULL,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        class_level VARCHAR(20),
        parent_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        enrollment_date DATE DEFAULT CURRENT_DATE,
        status VARCHAR(20) DEFAULT 'active'
      );
    `);

    // Example notifications table for real-time features
    await dbQuery(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        notification_id VARCHAR(50) UNIQUE NOT NULL,
        title TEXT,
        message TEXT,
        room VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Seed 7 admins with generated passwords (change after first login)
    const admins = ['Admin1','Admin2','Admin3','Admin4','Admin5','Admin6','Admin7'];
    const created = [];

    for (const admin of admins) {
      const userId = `MMJS-${admin.toUpperCase()}`;
      // generate a secure-ish password and hash it
      const rawPassword = process.env.ADMIN_DEFAULT_PASSWORD || `${admin}@${Math.random().toString(36).slice(2,8)}!`;
      const hashed = await bcrypt.hash(rawPassword, 12);

      await dbQuery(`
        INSERT INTO users (user_id, email, password, first_name, last_name, role)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (user_id) DO NOTHING
      `, [userId, `${admin.toLowerCase()}@mothermargaret.ac.ug`, hashed, 'Admin', admin, 'admin']);

      created.push({ userId, email: `${admin.toLowerCase()}@mothermargaret.ac.ug`, password: rawPassword });
    }

    // IMPORTANT: In production do NOT return passwords. Here we return them for first-run convenience;
    // ensure you rotate/change them immediately or remove this endpoint.
    res.json({
      success: true,
      message: 'System initialized. Tables created and admin accounts seeded.',
      admins: created
    });
  } catch (error) {
    console.error('Init error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ---------- Auth Routes: register, login, profile ----------

/**
 * Register a new user
 * POST /api/auth/register
 * body: { email, password, firstName, lastName, role }
 */
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName, role } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password required' });

    // Check if exists
    const existing = await dbQuery('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length) return res.status(409).json({ success: false, message: 'Email already registered' });

    const userId = `MMJS-${uuidv4().split('-')[0].toUpperCase()}`;
    const hashed = await bcrypt.hash(password, 12);

    await dbQuery(`
      INSERT INTO users (user_id, email, password, first_name, last_name, role)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [userId, email, hashed, firstName || null, lastName || null, role || 'parent']);

    const token = jwt.sign({ userId, role: role || 'parent' }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ success: true, token, user: { userId, email, firstName, lastName, role: role || 'parent' } });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Login
 * POST /api/auth/login
 * body: { email, password }
 */
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password required' });

    const result = await dbQuery('SELECT * FROM users WHERE email = $1', [email]);
    if (!result.rows.length) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const token = jwt.sign({ userId: user.user_id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({
      success: true,
      token,
      user: {
        userId: user.user_id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get profile (protected)
 * GET /api/auth/profile
 */
app.get('/api/auth/profile', authMiddleware(), async (req, res) => {
  try {
    const q = await dbQuery('SELECT user_id, email, first_name, last_name, role, created_at FROM users WHERE user_id = $1', [req.user.userId]);
    if (!q.rows.length) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user: q.rows[0] });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ---------- Websockets ----------
io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

  socket.on('join-room', (room) => {
    socket.join(room);
    console.log(`Socket ${socket.id} joined ${room}`);
  });

  socket.on('send-notification', async (data) => {
    try {
      // optionally persist notifications
      if (data && data.title) {
        await dbQuery(
          `INSERT INTO notifications (notification_id, title, message, room)
           VALUES ($1, $2, $3, $4)`,
          [`NOTIF-${uuidv4().split('-')[0].toUpperCase()}`, data.title, data.message || null, data.room || null]
        );
      }
    } catch (e) {
      console.error('Failed to persist notification', e);
    }

    io.to(data.room).emit('new-notification', data);
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected:', socket.id);
  });
});

// ---------- Error handling & 404 ----------
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    timestamp: new Date().toISOString()
  });
});

app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    available_endpoints: {
      root: 'GET /',
      health: 'GET /health',
      school_info: 'GET /api/school/info',
      api_docs: 'GET /api-docs',
      initialize: 'GET /api/init',
      auth_login: 'POST /api/auth/login',
      auth_register: 'POST /api/auth/register',
      auth_profile: 'GET /api/auth/profile (Bearer token required)'
    }
  });
});

// ---------- Start server ----------
httpServer.listen(PORT, async () => {
  try {
    await dbQuery('SELECT 1'); // quick check
    console.log('==============================================');
    console.log('🚀 MOTHER MARGARET SCHOOL BACKEND - COMPLETE');
    console.log('==============================================');
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`✅ Database: Connected`);
    console.log(`✅ Health Check: http://localhost:${PORT}/health`);
    console.log(`✅ School Info: http://localhost:${PORT}/api/school/info`);
    console.log(`✅ API Docs: http://localhost:${PORT}/api-docs`);
    console.log('==============================================');
  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
    process.exit(1);
  }
});

module.exports = { app, io, pool };
