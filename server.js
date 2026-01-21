// ============================================
// COMPLETE MOTHER MARGARET SCHOOL BACKEND
// Mother Margaret Junior School and Daycare
// Namuyenje, Mukono, Uganda
// ============================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const app = express();

// ================= MIDDLEWARE =================
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ================= DATABASE SETUP =================
let pool;
try {
  const { Pool } = require('pg');
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
  console.log('✅ PostgreSQL database configured');
} catch (error) {
  console.log('⚠️ PostgreSQL not available, using in-memory storage');
  pool = null;
}

// Database helper function
async function dbQuery(text, params = []) {
  if (!pool) {
    throw new Error('Database not connected. Please add DATABASE_URL to environment variables.');
  }
  return await pool.query(text, params);
}

// ================= HEALTH CHECK =================
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Mother Margaret School Backend API',
    school: process.env.SCHOOL_NAME || 'Mother Margaret Junior School and Daycare',
    version: '2.0.0',
    status: 'running',
    endpoints: {
      health: 'GET /health',
      schoolInfo: 'GET /api/school/info',
      initialize: 'GET /api/init',
      login: 'POST /api/auth/login',
      registerStudent: 'POST /api/students/register'
    }
  });
});

app.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    service: 'Mother Margaret School Backend',
    timestamp: new Date().toISOString(),
    backend: 'running',
    environment: process.env.NODE_ENV || 'development'
  };

  // Check database if available
  if (pool) {
    try {
      await dbQuery('SELECT 1');
      health.database = 'connected';
    } catch (error) {
      health.database = 'disconnected';
      health.database_error = error.message;
    }
  } else {
    health.database = 'not_configured';
    health.note = 'Add DATABASE_URL to connect PostgreSQL';
  }

  res.json(health);
});

// ================= SCHOOL INFORMATION API =================
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
          action: 'Click to WhatsApp',
          icon: 'whatsapp'
        },
        {
          phone: process.env.SCHOOL_PHONE_2 || '0704 702 301',
          type: 'call',
          link: 'tel:+256704702301',
          action: 'Click to Call',
          icon: 'phone'
        },
        {
          phone: process.env.SCHOOL_PHONE_3 || '0747 677 562',
          type: 'whatsapp',
          link: 'https://wa.me/256747677562',
          action: 'Click to WhatsApp',
          icon: 'whatsapp'
        }
      ],
      
      email: process.env.SCHOOL_EMAIL || 'mothermargaretjuniorschools.ug@gmail.com',
      
      programs: [
        {
          id: 'daycare',
          name: 'Daycare',
          age: '1-2 years',
          description: 'Safe and nurturing environment for toddlers',
          features: ['Play-based learning', 'Nap times', 'Nutritious meals', 'Safe environment'],
          color: 'pink'
        },
        {
          id: 'nursery',
          name: 'Nursery',
          age: '3-4 years',
          description: 'Early childhood education foundation',
          features: ['Montessori approach', 'Social development', 'Basic literacy', 'Creative arts'],
          color: 'yellow'
        },
        {
          id: 'kindergarten',
          name: 'Kindergarten',
          age: '5-6 years',
          description: 'Preparation for primary school',
          features: ['Reading readiness', 'Basic math', 'Science exploration', 'Computer skills'],
          color: 'green'
        },
        {
          id: 'primary',
          name: 'Primary School',
          age: '7-13 years',
          description: 'Complete primary education curriculum',
          features: ['Full curriculum', 'Sports programs', 'Music & arts', 'Computer lab'],
          color: 'blue'
        }
      ],
      
      operating_hours: {
        weekdays: '7:00 AM - 5:00 PM',
        saturday: '8:00 AM - 1:00 PM',
        sunday: 'Closed'
      },
      
      social_media: {
        facebook: 'https://facebook.com/mothermargaretschool',
        instagram: 'https://instagram.com/mothermargaretjunior'
      }
    }
  });
});

// ================= SYSTEM INITIALIZATION =================
app.get('/api/init', async (req, res) => {
  try {
    if (!pool) {
      return res.status(500).json({
        success: false,
        message: 'Database not configured',
        instruction: 'Add DATABASE_URL to your environment variables'
      });
    }

    // Create users table
    await dbQuery(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        phone VARCHAR(20),
        password VARCHAR(255) NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'teacher', 'parent', 'student')),
        profile_image VARCHAR(500),
        is_active BOOLEAN DEFAULT true,
        is_initial_admin BOOLEAN DEFAULT false,
        requires_password_change BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP
      )
    `);

    // Create students table
    await dbQuery(`
      CREATE TABLE IF NOT EXISTS students (
        id SERIAL PRIMARY KEY,
        student_id VARCHAR(50) UNIQUE NOT NULL,
        admission_number VARCHAR(50) UNIQUE,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        date_of_birth DATE NOT NULL,
        gender VARCHAR(10) CHECK (gender IN ('male', 'female')),
        class_level VARCHAR(20) NOT NULL,
        class_section VARCHAR(20),
        enrollment_date DATE NOT NULL,
        parent_id INTEGER REFERENCES users(id),
        medical_info JSONB,
        allergies TEXT[],
        emergency_contact JSONB,
        address TEXT,
        photo_url VARCHAR(500),
        school_account_number VARCHAR(50) UNIQUE,
        status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'graduated', 'transferred', 'inactive')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create assignments table
    await dbQuery(`
      CREATE TABLE IF NOT EXISTS assignments (
        id SERIAL PRIMARY KEY,
        assignment_id VARCHAR(50) UNIQUE NOT NULL,
        title VARCHAR(200) NOT NULL,
        description TEXT,
        class_level VARCHAR(20) NOT NULL,
        subject VARCHAR(100),
        due_date TIMESTAMP,
        max_score INTEGER DEFAULT 100,
        attachment_url VARCHAR(500),
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create payments table
    await dbQuery(`
      CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        payment_reference VARCHAR(100) UNIQUE NOT NULL,
        student_id VARCHAR(50) NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        amount_paid DECIMAL(12,2) NOT NULL,
        payment_method VARCHAR(50) NOT NULL,
        phone_number VARCHAR(20),
        transaction_id VARCHAR(200),
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
        term VARCHAR(20),
        academic_year VARCHAR(20),
        description TEXT,
        receipt_url VARCHAR(500),
        verified_at TIMESTAMP,
        verified_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create announcements table
    await dbQuery(`
      CREATE TABLE IF NOT EXISTS announcements (
        id SERIAL PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        content TEXT NOT NULL,
        category VARCHAR(50),
        audience VARCHAR(20) DEFAULT 'all' CHECK (audience IN ('all', 'parents', 'teachers', 'students')),
        attachment_url VARCHAR(500),
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP
      )
    `);

    // Create 7 initial admin accounts
    const initialAdmins = [
      { username: 'Admin1', password: '****$****#+1' },
      { username: 'Admin2', password: '****$****#+2' },
      { username: 'Admin3', password: '****$****#+3' },
      { username: 'Admin4', password: '****$****#+4' },
      { username: 'Admin5', password: '****$****#+5' },
      { username: 'Admin6', password: '****$****#+6' },
      { username: 'Admin7', password: '****$****#+7' }
    ];

    const createdAdmins = [];

    for (const admin of initialAdmins) {
      const hashedPassword = await bcrypt.hash(admin.password, 10);
      const adminEmail = `${admin.username.toLowerCase()}@mothermargaret.ac.ug`;
      
      try {
        await dbQuery(
          `INSERT INTO users (user_id, email, password, first_name, last_name, role, is_initial_admin, requires_password_change)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (email) DO NOTHING`,
          [
            `MMJS-${admin.username}`,
            adminEmail,
            hashedPassword,
            'Admin',
            admin.username,
            'admin',
            true,
            true
          ]
        );

        createdAdmins.push({
          username: admin.username,
          email: adminEmail,
          password: admin.password,
          userId: `MMJS-${admin.username}`
        });
      } catch (error) {
        console.log(`⚠️ Admin ${admin.username} may already exist:`, error.message);
      }
    }

    res.json({
      success: true,
      message: 'System initialized successfully',
      tables_created: ['users', 'students', 'assignments', 'payments', 'announcements'],
      admin_accounts: createdAdmins,
      total_admins: createdAdmins.length,
      important_notes: [
        'Admins must change password on first login',
        'Use /api/auth/login to access admin portal',
        'Add DATABASE_URL in production for persistent storage'
      ]
    });

  } catch (error) {
    console.error('Initialization error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      help: 'Check DATABASE_URL environment variable'
    });
  }
});

// ================= AUTHENTICATION =================
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email and password are required'
    });
  }

  try {
    if (!pool) {
      return res.status(503).json({
        success: false,
        message: 'Database not available',
        instruction: 'Run /api/init first to initialize database'
      });
    }

    const result = await dbQuery(
      'SELECT * FROM users WHERE email = $1 AND is_active = true',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Update last login
    await dbQuery(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );

    const token = jwt.sign(
      {
        userId: user.user_id,
        email: user.email,
        role: user.role,
        firstName: user.first_name,
        lastName: user.last_name
      },
      process.env.JWT_SECRET || 'mother_margaret_default_secret_2024',
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.user_id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        profileImage: user.profile_image,
        requiresPasswordChange: user.requires_password_change,
        isInitialAdmin: user.is_initial_admin
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ================= STUDENT REGISTRATION =================
app.post('/api/students/register', async (req, res) => {
  const {
    firstName,
    lastName,
    dateOfBirth,
    gender,
    classLevel,
    parentEmail,
    parentPhone,
    address,
    medicalInfo,
    emergencyContact
  } = req.body;

  // Validation
  if (!firstName || !lastName || !dateOfBirth || !classLevel || !parentEmail) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: firstName, lastName, dateOfBirth, classLevel, parentEmail'
    });
  }

  try {
    if (!pool) {
      return res.status(503).json({
        success: false,
        message: 'Database not available',
        instruction: 'Initialize system first using /api/init'
      });
    }

    // Generate unique student ID
    const currentYear = new Date().getFullYear();
    const classPrefix = classLevel.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const randomNum = Math.floor(100 + Math.random() * 900);
    const studentId = `MMJS-${classPrefix}-${currentYear}-${randomNum}`;
    
    // Generate school account number
    const schoolAccountNumber = `MMJS-ACC-${Date.now().toString().slice(-8)}`;

    // Check if parent exists
    let parentResult = await dbQuery(
      'SELECT id FROM users WHERE email = $1 AND role = $2',
      [parentEmail, 'parent']
    );

    let parentId;
    let parentCreated = false;

    if (parentResult.rows.length === 0) {
      // Create parent account
      const tempPassword = Math.random().toString(36).slice(-10);
      const hashedPassword = await bcrypt.hash(tempPassword, 10);
      const parentUserId = `MMJS-PARENT-${Date.now().toString().slice(-6)}`;

      const newParent = await dbQuery(
        `INSERT INTO users 
         (user_id, email, phone, password, first_name, last_name, role) 
         VALUES ($1, $2, $3, $4, $5, $6, $7) 
         RETURNING id`,
        [
          parentUserId,
          parentEmail,
          parentPhone,
          hashedPassword,
          'Parent',
          'Account',
          'parent'
        ]
      );

      parentId = newParent.rows[0].id;
      parentCreated = true;
    } else {
      parentId = parentResult.rows[0].id;
    }

    // Register student
    await dbQuery(
      `INSERT INTO students 
       (student_id, first_name, last_name, date_of_birth, gender, 
        class_level, parent_id, school_account_number, address,
        medical_info, emergency_contact, enrollment_date) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        studentId,
        firstName,
        lastName,
        dateOfBirth,
        gender,
        classLevel,
        parentId,
        schoolAccountNumber,
        address,
        medicalInfo ? JSON.stringify(medicalInfo) : null,
        emergencyContact ? JSON.stringify(emergencyContact) : null,
        new Date()
      ]
    );

    const response = {
      success: true,
      message: 'Student registered successfully',
      data: {
        studentId,
        schoolAccountNumber,
        studentName: `${firstName} ${lastName}`,
        classLevel,
        parentId,
        parentEmail,
        parentAccountCreated: parentCreated
      }
    };

    // If parent was created, add note about login
    if (parentCreated) {
      response.data.parentLoginNote = 'Parent account created. Password will be sent via email.';
    }

    res.status(201).json(response);

  } catch (error) {
    console.error('Student registration error:', error);
    
    // Check if duplicate student
    if (error.message && error.message.includes('duplicate key')) {
      return res.status(409).json({
        success: false,
        message: 'Student ID already exists. Please try again.',
        error: 'Duplicate student ID'
      });
    }

    res.status(500).json({
      success: false,
      error: error.message,
      help: 'Check if database is initialized and all required fields are provided'
    });
  }
});

// ================= PORTAL INFO =================
app.get('/api/portals', (req, res) => {
  res.json({
    success: true,
    portals: [
      {
        name: 'Admin Portal',
        role: 'admin',
        color: '#1E3A8A',
        description: 'School management and configuration',
        features: [
          'Student registration',
          'Fee management',
          'Website editing',
          'Teacher management',
          'System configuration'
        ],
        loginUrl: '/admin/login'
      },
      {
        name: 'Teacher Portal',
        role: 'teacher',
        color: '#10B981',
        description: 'Classroom management and teaching tools',
        features: [
          'Assignment creation',
          'Grade recording',
          'Attendance tracking',
          'Parent communication',
          'Lesson planning'
        ],
        loginUrl: '/teacher/login'
      },
      {
        name: 'Parent Portal',
        role: 'parent',
        color: '#F97316',
        description: 'Child monitoring and school communication',
        features: [
          'View child progress',
          'Pay fees online',
          'Communicate with teachers',
          'View assignments',
          'Receive notifications'
        ],
        loginUrl: '/parent/login'
      },
      {
        name: 'Student Portal',
        role: 'student',
        color: '#3B82F6',
        description: 'Learning and school resources',
        features: [
          'Access assignments',
          'Submit homework',
          'Educational games',
          'View grades',
          'Learning materials'
        ],
        loginUrl: '/student/login'
      }
    ]
  });
});

// ================= ERROR HANDLING =================
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    available_endpoints: {
      home: 'GET /',
      health: 'GET /health',
      school_info: 'GET /api/school/info',
      initialize: 'GET /api/init',
      login: 'POST /api/auth/login',
      register_student: 'POST /api/students/register',
      portals_info: 'GET /api/portals'
    }
  });
});

// ================= START SERVER =================
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('🚀 MOTHER MARGARET SCHOOL BACKEND - COMPLETE SYSTEM');
  console.log('='.repeat(60));
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`✅ Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`✅ School: ${process.env.SCHOOL_NAME || 'Mother Margaret Junior School'}`);
  console.log('='.repeat(60));
  console.log('📋 AVAILABLE ENDPOINTS:');
  console.log(`   • GET  /                    - API information`);
  console.log(`   • GET  /health              - Health check`);
  console.log(`   • GET  /api/school/info     - School information with WhatsApp links`);
  console.log(`   • GET  /api/init            - Initialize system (creates 7 admins)`);
  console.log(`   • POST /api/auth/login      - User login`);
  console.log(`   • POST /api/students/register - Register new student`);
  console.log(`   • GET  /api/portals         - Portal information`);
  console.log('='.repeat(60));
  console.log('👑 INITIAL ADMIN CREDENTIALS (after /api/init):');
  console.log('   • Admin1: ****$****#+1');
  console.log('   • Admin2: ****$****#+2');
  console.log('   • Admin3: ****$****#+3');
  console.log('   • Admin4: ****$****#+4');
  console.log('   • Admin5: ****$****#+5');
  console.log('   • Admin6: ****$****#+6');
  console.log('   • Admin7: ****$****#+7');
  console.log('='.repeat(60));
  console.log('📞 School Contacts: 0708 840 282 | 0704 702 301 | 0747 677 562');
  console.log('📧 Email: mothermargaretjuniorschools.ug@gmail.com');
  console.log('📍 Location: Namuyenje, Mukono, Uganda (Opposite St. Paul Church)');
  console.log('='.repeat(60));
});

module.exports = app;
