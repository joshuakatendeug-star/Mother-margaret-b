// COMPLETE MOTHER MARGARET SCHOOL BACKEND
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(cors());
app.use(express.json());

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ================= HEALTH CHECK =================
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Mother Margaret School Backend API',
    school: process.env.SCHOOL_NAME || 'Mother Margaret Junior School',
    version: '1.0.0'
  });
});

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({
      status: 'healthy',
      service: 'Mother Margaret School Backend',
      timestamp: new Date().toISOString(),
      database: 'connected'
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

// ================= SCHOOL INFORMATION =================
app.get('/api/school/info', (req, res) => {
  res.json({
    success: true,
    data: {
      name: process.env.SCHOOL_NAME || 'Mother Margaret Junior School and Daycare',
      motto: 'Dream Big, Act Big',
      address: process.env.SCHOOL_ADDRESS || 'Namuyenje, Mukono, Uganda',
      location: 'Opposite St. Paul Church, across the road',
      coordinates: { lat: 0.3476, lng: 32.5825 },
      google_maps: 'https://maps.google.com/?q=Mother+Margaret+Junior+School,Namuyenje+Mukono+Uganda',
      contacts: [
        {
          phone: process.env.SCHOOL_PHONE_1 || '0708 840 282',
          type: 'whatsapp',
          link: 'https://wa.me/256708840282',
          action: 'click to WhatsApp'
        },
        {
          phone: process.env.SCHOOL_PHONE_2 || '0704 702 301',
          type: 'call',
          link: 'tel:+256704702301',
          action: 'click to call'
        },
        {
          phone: process.env.SCHOOL_PHONE_3 || '0747 677 562',
          type: 'whatsapp',
          link: 'https://wa.me/256747677562',
          action: 'click to WhatsApp'
        }
      ],
      email: process.env.SCHOOL_EMAIL || 'mothermargaretjuniorschools.ug@gmail.com',
      programs: [
        {
          name: 'Daycare',
          age: '1-2 years',
          description: 'Safe and nurturing environment for toddlers',
          features: ['Play-based learning', 'Nap times', 'Nutritious meals', 'Safe environment']
        },
        {
          name: 'Nursery',
          age: '3-4 years',
          description: 'Early childhood education foundation',
          features: ['Montessori approach', 'Social development', 'Basic literacy', 'Creative arts']
        },
        {
          name: 'Kindergarten',
          age: '5-6 years',
          description: 'Preparation for primary school',
          features: ['Reading readiness', 'Basic math', 'Science exploration', 'Computer skills']
        },
        {
          name: 'Primary School',
          age: '7-13 years',
          description: 'Complete primary education curriculum',
          features: ['Full curriculum', 'Sports programs', 'Music & arts', 'Computer lab']
        }
      ]
    }
  });
});

// ================= INITIALIZE SYSTEM =================
app.get('/api/init', async (req, res) => {
  try {
    // Create users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE,
        password VARCHAR(255) NOT NULL,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        role VARCHAR(20) DEFAULT 'parent',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create students table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS students (
        id SERIAL PRIMARY KEY,
        student_id VARCHAR(50) UNIQUE NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        date_of_birth DATE,
        gender VARCHAR(10),
        class_level VARCHAR(20) NOT NULL,
        parent_id INTEGER REFERENCES users(id),
        enrollment_date DATE DEFAULT CURRENT_DATE,
        school_account_number VARCHAR(50) UNIQUE,
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create 7 admin accounts
    const admins = [
      { username: 'Admin1', password: '****$****#+1' },
      { username: 'Admin2', password: '****$****#+2' },
      { username: 'Admin3', password: '****$****#+3' },
      { username: 'Admin4', password: '****$****#+4' },
      { username: 'Admin5', password: '****$****#+5' },
      { username: 'Admin6', password: '****$****#+6' },
      { username: 'Admin7', password: '****$****#+7' }
    ];

    for (const admin of admins) {
      const hashedPassword = await bcrypt.hash(admin.password, 10);
      await pool.query(
        `INSERT INTO users (user_id, email, password, first_name, last_name, role) 
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (user_id) DO NOTHING`,
        [
          `MMJS-${admin.username}`,
          `${admin.username.toLowerCase()}@mothermargaret.ac.ug`,
          hashedPassword,
          'Admin',
          admin.username,
          'admin'
        ]
      );
    }

    res.json({
      success: true,
      message: 'System initialized with 7 admin accounts',
      admins: admins.map(a => ({
        username: a.username,
        email: `${a.username.toLowerCase()}@mothermargaret.ac.ug`,
        password: a.password,
        note: 'Change password on first login'
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ================= AUTHENTICATION =================
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  
  try {
    const user = await pool.query(
      'SELECT * FROM users WHERE email = $1 AND is_active = true',
      [email]
    );

    if (user.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.rows[0].password);
    if (!validPassword) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user.rows[0].user_id, role: user.rows[0].role },
      process.env.JWT_SECRET || 'mother_margaret_secret_2024',
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.rows[0].user_id,
        email: user.rows[0].email,
        firstName: user.rows[0].first_name,
        lastName: user.rows[0].last_name,
        role: user.rows[0].role
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ================= STUDENT REGISTRATION =================
app.post('/api/students/register', async (req, res) => {
  const { firstName, lastName, dateOfBirth, gender, classLevel, parentEmail, parentPhone } = req.body;
  
  try {
    // Generate student ID
    const studentId = `MMJS-${classLevel}-${Date.now().toString().slice(-6)}`;
    
    // Check if parent exists
    let parent = await pool.query('SELECT id FROM users WHERE email = $1', [parentEmail]);
    let parentId;
    
    if (parent.rows.length === 0) {
      // Create parent account
      const tempPassword = Math.random().toString(36).slice(-8);
      const hashedPassword = await bcrypt.hash(tempPassword, 10);
      const parentUserId = `MMJS-PARENT-${Date.now().toString().slice(-6)}`;
      
      const newParent = await pool.query(
        `INSERT INTO users (user_id, email, password, first_name, last_name, role) 
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [parentUserId, parentEmail, hashedPassword, 'Parent', 'Account', 'parent']
      );
      parentId = newParent.rows[0].id;
    } else {
      parentId = parent.rows[0].id;
    }

    // Register student
    await pool.query(
      `INSERT INTO students (student_id, first_name, last_name, date_of_birth, gender, class_level, parent_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [studentId, firstName, lastName, dateOfBirth, gender, classLevel, parentId]
    );

    res.status(201).json({
      success: true,
      message: 'Student registered successfully',
      data: {
        studentId,
        name: `${firstName} ${lastName}`,
        classLevel,
        parentId
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ================= START SERVER =================
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log('==============================================');
  console.log('🚀 MOTHER MARGARET SCHOOL BACKEND');
  console.log('==============================================');
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`✅ Health Check: /health`);
  console.log(`✅ School Info: /api/school/info`);
  console.log(`✅ Initialize: /api/init`);
  console.log(`✅ Login: POST /api/auth/login`);
  console.log(`✅ Register Student: POST /api/students/register`);
  console.log('==============================================');
  console.log('🏫 School: Mother Margaret Junior School & Daycare');
  console.log('📍 Location: Namuyenje, Mukono, Uganda');
  console.log('📞 Contacts: 0708 840 282 | 0704 702 301 | 0747 677 562');
  console.log('📧 Email: mothermargaretjuniorschools.ug@gmail.com');
  console.log('==============================================');
});
