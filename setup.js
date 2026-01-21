// setup.js - Initialize the complete system
require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function setupCompleteSystem() {
  console.log('🚀 Setting up Mother Margaret School Complete System...\n');
  
  try {
    // 1. Create all tables (simplified version)
    console.log('1. Creating database tables...');
    
    await pool.query(`
      -- Users table
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE,
        phone VARCHAR(20),
        password VARCHAR(255) NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'teacher', 'parent', 'student')),
        profile_image VARCHAR(500),
        is_active BOOLEAN DEFAULT true,
        is_initial_admin BOOLEAN DEFAULT false,
        requires_password_change BOOLEAN DEFAULT false,
        two_factor_enabled BOOLEAN DEFAULT false,
        permissions JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP
      )
    `);

    await pool.query(`
      -- Students table
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

    await pool.query(`
      -- Payments table
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

    await pool.query(`
      -- Assignments table
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

    await pool.query(`
      -- Announcements table
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

    await pool.query(`
      -- Virtual classes table
      CREATE TABLE IF NOT EXISTS virtual_classes (
        id SERIAL PRIMARY KEY,
        meeting_id VARCHAR(100) UNIQUE NOT NULL,
        title VARCHAR(200) NOT NULL,
        description TEXT,
        class_level VARCHAR(20),
        subject VARCHAR(100),
        teacher_id INTEGER REFERENCES users(id),
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP NOT NULL,
        zoom_link VARCHAR(500),
        google_meet_link VARCHAR(500),
        recording_url VARCHAR(500),
        status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'ongoing', 'completed', 'cancelled')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      -- Progress reports table
      CREATE TABLE IF NOT EXISTS progress_reports (
        id SERIAL PRIMARY KEY,
        student_id INTEGER REFERENCES students(id),
        term VARCHAR(20),
        academic_year VARCHAR(20),
        subject_scores JSONB,
        attendance_summary JSONB,
        teacher_comments TEXT,
        headteacher_comments TEXT,
        overall_grade VARCHAR(10),
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      -- Notifications table
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        title VARCHAR(200) NOT NULL,
        message TEXT NOT NULL,
        type VARCHAR(50),
        is_read BOOLEAN DEFAULT false,
        data JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      -- Website content table
      CREATE TABLE IF NOT EXISTS website_content (
        id SERIAL PRIMARY KEY,
        page_id VARCHAR(100) NOT NULL,
        section_id VARCHAR(100) NOT NULL,
        content_type VARCHAR(50) NOT NULL,
        content_data JSONB NOT NULL,
        section_order INTEGER DEFAULT 0,
        created_by INTEGER REFERENCES users(id),
        updated_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(page_id, section_id)
      )
    `);

    console.log('   ✅ All database tables created');

    // 2. Create initial admin accounts
    console.log('2. Creating initial admin accounts...');
    
    const initialAdmins = [
      { username: 'Admin1', password: '****$****#+1' },
      { username: 'Admin2', password: '****$****#+2' },
      { username: 'Admin3', password: '****$****#+3' },
      { username: 'Admin4', password: '****$****#+4' },
      { username: 'Admin5', password: '****$****#+5' },
      { username: 'Admin6', password: '****$****#+6' },
      { username: 'Admin7', password: '****$****#+7' }
    ];

    for (const admin of initialAdmins) {
      const hashedPassword = await bcrypt.hash(admin.password, 10);
      
      await pool.query(
        `INSERT INTO users (user_id, email, password, first_name, last_name, role, is_initial_admin, requires_password_change)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (user_id) DO NOTHING`,
        [
          `MMJS-${admin.username}`,
          `${admin.username.toLowerCase()}@mothermargaret.ac.ug`,
          hashedPassword,
          'Admin',
          admin.username,
          'admin',
          true,
          true
        ]
      );
    }
    console.log('   ✅ 7 admin accounts created');

    // 3. Create default website content
    console.log('3. Creating default website content...');
    
    const defaultContent = [
      {
        page_id: 'home',
        section_id: 'hero',
        content_type: 'hero',
        content_data: JSON.stringify({
          title: 'Welcome to Mother Margaret Junior School & Daycare',
          subtitle: 'Quality Education in Namuyenje, Mukono, Uganda',
          backgroundImage: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1',
          ctaText: 'Enroll Today',
          ctaLink: '/admissions'
        }),
        section_order: 1
      },
      {
        page_id: 'home',
        section_id: 'features',
        content_type: 'features',
        content_data: JSON.stringify({
          title: 'Why Choose Our School?',
          features: [
            {
              icon: 'shield',
              title: 'Safe Environment',
              description: 'Secure campus with CCTV surveillance'
            },
            {
              icon: 'graduation',
              title: 'Qualified Teachers',
              description: 'Certified and experienced educators'
            },
            {
              icon: 'heart',
              title: 'Nurturing Care',
              description: 'Individual attention for every child'
            }
          ]
        }),
        section_order: 2
      }
    ];

    for (const content of defaultContent) {
      await pool.query(
        `INSERT INTO website_content (page_id, section_id, content_type, content_data, section_order)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (page_id, section_id) DO NOTHING`,
        [content.page_id, content.section_id, content.content_type, content.content_data, content.section_order]
      );
    }
    console.log('   ✅ Default website content created');

    // 4. Create default classes
    console.log('4. Creating default classes...');
    
    const classes = [
      { code: 'DAYCARE', name: 'Daycare', level: 'daycare', capacity: 20 },
      { code: 'NURSERY', name: 'Nursery', level: 'nursery', capacity: 25 },
      { code: 'KG', name: 'Kindergarten', level: 'kindergarten', capacity: 30 },
      { code: 'P1', name: 'Primary 1', level: 'primary1', capacity: 35 },
      { code: 'P2', name: 'Primary 2', level: 'primary2', capacity: 35 },
      { code: 'P3', name: 'Primary 3', level: 'primary3', capacity: 35 },
      { code: 'P4', name: 'Primary 4', level: 'primary4', capacity: 35 },
      { code: 'P5', name: 'Primary 5', level: 'primary5', capacity: 35 },
      { code: 'P6', name: 'Primary 6', level: 'primary6', capacity: 35 },
      { code: 'P7', name: 'Primary 7', level: 'primary7', capacity: 35 }
    ];

    for (const cls of classes) {
      await pool.query(
        `INSERT INTO classes (class_code, class_name, level, capacity)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (class_code) DO NOTHING`,
        [cls.code, cls.name, cls.level, cls.capacity]
      );
    }
    console.log('   ✅ Default classes created');

    console.log('\n🎉 MOTHER MARGARET SCHOOL SYSTEM SETUP COMPLETE!');
    console.log('==============================================\n');
    
    console.log('📋 INITIAL ADMIN CREDENTIALS:');
    console.log('=============================');
    initialAdmins.forEach(admin => {
      console.log(`👑 ${admin.username}`);
      console.log(`   Email: ${admin.username.toLowerCase()}@mothermargaret.ac.ug`);
      console.log(`   Password: ${admin.password}`);
      console.log('');
    });
    
    console.log('⚠️  IMPORTANT INSTRUCTIONS:');
    console.log('==========================');
    console.log('1. Admins MUST change password on first login');
    console.log('2. Access the admin portal at: YOUR_BACKEND_URL/admin');
    console.log('3. Configure payment methods in admin panel');
    console.log('4. Add teachers and students through admin panel');
    console.log('5. Customize website content through visual editor');
    
    console.log('\n🌐 Your system is ready!');
    console.log('Backend URL: https://your-render-url.onrender.com');
    console.log('Health Check: /health');
    console.log('School Info: /api/school/info');
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  }
}

setupCompleteSystem();