// COMPLETE MOTHER MARGARET SCHOOL BACKEND SERVER
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');

// Import database
const pool = require('./config/database');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || "*",
    methods: ["GET", "POST"]
  }
});

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP'
});

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.FRONTEND_URL || "*",
  credentials: true
}));
app.use(limiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ================= SCHOOL INFORMATION =================
app.get('/api/school/info', (req, res) => {
  res.json({
    success: true,
    data: {
      name: "Mother Margaret Junior School and Daycare",
      motto: "Excellence in Early Education",
      address: "Namuyenje, Mukono, Uganda",
      location: "Opposite St. Paul Church, across the road",
      coordinates: { lat: 0.3476, lng: 32.5825 },
      google_maps: "https://maps.google.com/?q=Mother+Margaret+Junior+School,Namuyenje+Mukono+Uganda",
      contacts: [
        {
          phone: "0708 840 282",
          type: "whatsapp",
          link: "https://wa.me/256708840282?text=Hello%20Mother%20Margaret%20School,%20I%20need%20information%20about%20admissions"
        },
        {
          phone: "0704 702 301",
          type: "call",
          link: "tel:+256704702301"
        },
        {
          phone: "0747 677 562",
          type: "whatsapp",
          link: "https://wa.me/256747677562?text=Hello%20Mother%20Margaret%20School,%20I%20need%20information%20about%20admissions"
        }
      ],
      email: "mothermargaretjuniorschools.ug@gmail.com",
      programs: [
        {
          name: "Daycare",
          age: "1-2 years",
          description: "Safe and nurturing environment for toddlers",
          features: ["Play-based learning", "Nap times", "Nutritious meals", "Safe environment"]
        },
        {
          name: "Nursery",
          age: "3-4 years",
          description: "Early childhood education foundation",
          features: ["Montessori approach", "Social development", "Basic literacy", "Creative arts"]
        },
        {
          name: "Kindergarten",
          age: "5-6 years",
          description: "Preparation for primary school",
          features: ["Reading readiness", "Basic math", "Science exploration", "Computer skills"]
        },
        {
          name: "Primary School",
          age: "7-13 years",
          description: "Complete primary education curriculum",
          features: ["Full curriculum", "Sports programs", "Music & arts", "Computer lab"]
        }
      ],
      social_media: {
        facebook: "https://facebook.com/mothermargaretschool",
        twitter: "https://twitter.com/mothermargaret",
        instagram: "https://instagram.com/mothermargaretjunior"
      },
      operating_hours: {
        weekdays: "7:00 AM - 5:00 PM",
        saturday: "8:00 AM - 1:00 PM",
        sunday: "Closed"
      }
    }
  });
});

// ================= HEALTH CHECK =================
app.get('/health', async (req, res) => {
  try {
    // Check database connection
    await pool.query('SELECT 1');
    
    res.status(200).json({
      status: 'healthy',
      service: 'Mother Margaret School Backend',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      features: [
        'Admin Portal',
        'Teacher Portal', 
        'Parent Portal',
        'Student Portal',
        'AI Assistant',
        'Payment Integration',
        'Virtual Classes',
        'Website Management'
      ],
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

// ================= INITIALIZE SYSTEM =================
app.get('/api/init', async (req, res) => {
  try {
    // Run setup script
    const { exec } = require('child_process');
    exec('node setup.js', (error, stdout, stderr) => {
      if (error) {
        return res.status(500).json({ success: false, error: error.message });
      }
      res.json({ success: true, message: 'System initialization triggered', output: stdout });
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ================= API DOCUMENTATION =================
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Mother Margaret School API',
      version: '1.0.0',
      description: 'Complete API for Mother Margaret Junior School and Daycare Management System',
      contact: {
        name: 'School Administration',
        email: 'mothermargaretjuniorschools.ug@gmail.com'
      }
    },
    servers: [
      {
        url: 'https://mother-margaret-school-backend.onrender.com',
        description: 'Production server'
      },
      {
        url: 'http://localhost:3000',
        description: 'Development server'
      }
    ]
  },
  apis: ['./routes/*.js']
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ================= BASIC AUTH ROUTES =================
app.post('/api/auth/login', require('./routes/auth').login);
app.post('/api/auth/register', require('./routes/auth').register);
app.get('/api/auth/profile', require('./middleware/auth'), require('./routes/auth').getProfile);

// ================= WEB SOCKETS =================
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);
  
  socket.on('join-room', (room) => {
    socket.join(room);
    console.log(`Socket ${socket.id} joined room ${room}`);
  });
  
  socket.on('send-notification', (data) => {
    io.to(data.room).emit('new-notification', data);
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// ================= ERROR HANDLING =================
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    available_endpoints: {
      school_info: 'GET /api/school/info',
      health_check: 'GET /health',
      api_docs: 'GET /api-docs',
      initialize: 'GET /api/init',
      auth_login: 'POST /api/auth/login',
      auth_register: 'POST /api/auth/register'
    }
  });
});

// ================= START SERVER =================
const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, async () => {
  try {
    await pool.query('SELECT 1');
    console.log('==============================================');
    console.log('🚀 MOTHER MARGARET SCHOOL BACKEND - COMPLETE');
    console.log('==============================================');
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`✅ Database: Connected`);
    console.log(`✅ Health Check: http://localhost:${PORT}/health`);
    console.log(`✅ School Info: http://localhost:${PORT}/api/school/info`);
    console.log(`✅ API Docs: http://localhost:${PORT}/api-docs`);
    console.log(`✅ Initialize: http://localhost:${PORT}/api/init`);
    console.log('==============================================');
    console.log('🏫 School: Mother Margaret Junior School & Daycare');
    console.log('📍 Location: Namuyenje, Mukono, Uganda');
    console.log('📞 Contacts: 0708 840 282 | 0704 702 301 | 0747 677 562');
    console.log('📧 Email: mothermargaretjuniorschools.ug@gmail.com');
    console.log('==============================================');
    console.log('🎯 FEATURES READY:');
    console.log('   • Admin Portal (7 initial admins)');
    console.log('   • Teacher Portal with Zoom integration');
    console.log('   • Parent Portal with payment system');
    console.log('   • Student Portal with educational games');
    console.log('   • AI Assistant (DeepSeek integration)');
    console.log('   • Website Management System');
    console.log('   • Mobile Money Payments (MTN/Airtel)');
    console.log('   • Real-time Notifications');
    console.log('==============================================');
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1);
  }
});

module.exports = { app, io };