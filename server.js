const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const sqlite3 = require('sqlite3').verbose();

const PORT = 3001;
const DB_PATH = path.join(__dirname, 'agamaku.db');

// Initialize SQLite database
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ Failed to connect to SQLite database:', err);
  } else {
    console.log('🗄️  Connected to SQLite database: agamaku.db');
    initDatabase();
  }
});

// Helper for SQL execution in Promises
function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

// Password hashing utility
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Database schema initialization
async function initDatabase() {
  try {
    // 1. Create Users table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        fullname TEXT NOT NULL,
        role TEXT NOT NULL,
        gender TEXT NOT NULL,
        balance REAL DEFAULT 150.0,
        teacher_id TEXT
      )
    `);

    // 2. Create Teachers table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS teachers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        gender TEXT NOT NULL,
        specialties TEXT NOT NULL,
        rating REAL NOT NULL,
        reviewsCount INTEGER DEFAULT 0,
        hourlyRate REAL NOT NULL,
        avatar TEXT NOT NULL,
        bio TEXT NOT NULL,
        verified INTEGER DEFAULT 0,
        badges TEXT NOT NULL,
        phone TEXT NOT NULL,
        coordinates TEXT NOT NULL
      )
    `);

    // 3. Create Reviews table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS reviews (
        id TEXT PRIMARY KEY,
        teacherId TEXT NOT NULL,
        userName TEXT NOT NULL,
        rating INTEGER NOT NULL,
        date TEXT NOT NULL,
        comment TEXT NOT NULL
      )
    `);

    // 4. Create Bookings table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS bookings (
        id TEXT PRIMARY KEY,
        userId INTEGER NOT NULL,
        teacherId TEXT NOT NULL,
        serviceId TEXT NOT NULL,
        date TEXT NOT NULL,
        time TEXT NOT NULL,
        duration INTEGER NOT NULL,
        totalPrice REAL NOT NULL,
        status TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        chatHistory TEXT
      )
    `);

    // Ensure 'online' column exists in teachers table
    try {
      await dbRun('ALTER TABLE teachers ADD COLUMN online INTEGER DEFAULT 0');
      console.log('🩹 Added missing "online" column to teachers table.');
    } catch (alterErr) {
      // Column already exists, safe to ignore
    }

    // Ensure 'chatHistory' column exists in bookings table
    try {
      await dbRun('ALTER TABLE bookings ADD COLUMN chatHistory TEXT');
      console.log('🩹 Added missing "chatHistory" column to bookings table.');
    } catch (alterErr) {
      // Column already exists, safe to ignore
    }

    console.log('✅ SQLite Tables Initialized Successfully!');
    await seedDatabase();
  } catch (error) {
    console.error('❌ Error initializing SQLite tables:', error);
  }
}

// Seeding standard mock records
// Seeding standard mock records skipped in real user mode
async function seedDatabase() {
  console.log('🌱 Real user mode enabled: Skipping default demo/mock data seeding.');
}

// MIME mapping for static files
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// JSON Body Parser helper
function readJsonBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        resolve(null);
      }
    });
  });
}

// Write standard JSON response
function jsonResponse(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// Core server router handler
const server = http.createServer(async (req, res) => {
  const parsedUrl = req.url.split('?')[0];
  
  // -------------------------------------------------------------
  // API ROUTING SECTION
  // -------------------------------------------------------------
  if (parsedUrl.startsWith('/api/')) {
    try {
      // 1. REGISTER USER & PARTNER
      if (parsedUrl === '/api/auth/register' && req.method === 'POST') {
        const body = await readJsonBody(req);
        if (!body || !body.username || !body.password || !body.fullname || !body.role || !body.gender) {
          return jsonResponse(res, 400, { success: false, message: 'Maklumat pendaftaran tidak lengkap.' });
        }

        const existingUser = await dbGet('SELECT * FROM users WHERE username = ?', [body.username.toLowerCase()]);
        if (existingUser) {
          return jsonResponse(res, 400, { success: false, message: 'Nama pengguna (username) telah didaftarkan.' });
        }

        const hashedPassword = hashPassword(body.password);
        let teacherId = null;

        // If registering as a teacher/partner, populate the teachers table first
        if (body.role === 'partner') {
          teacherId = 'ustaz_' + body.username.toLowerCase();
          const specialties = body.specialties || 'mengaji';
          const hourlyRate = parseFloat(body.hourlyRate) || 35.0;
          const avatar = body.gender === 'P' ? '🧕' : '👳‍♂️';
          const bio = body.bio || 'Qualified religious teacher available for classes.';
          const badges = JSON.stringify(['Bertauliah', 'Guru Baru']);
          const phone = body.phone || '+60 12-345 6789';
          
          // Generate semi-random map coordinates within the standard area
          const coordinates = JSON.stringify({
            x: 0.2 + Math.random() * 0.6,
            y: 0.2 + Math.random() * 0.6
          });

          await dbRun(`
            INSERT INTO teachers (id, name, gender, specialties, rating, reviewsCount, hourlyRate, avatar, bio, verified, badges, phone, coordinates)
            VALUES (?, ?, ?, ?, 5.0, 0, ?, ?, ?, 1, ?, ?, ?)
          `, [teacherId, body.fullname, body.gender === 'P' ? 'ustazah' : 'ustaz', specialties, hourlyRate, avatar, bio, badges, phone, coordinates]);
        }

        // Insert into Users table
        await dbRun(`
          INSERT INTO users (username, password, fullname, role, gender, balance, teacher_id)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [body.username.toLowerCase(), hashedPassword, body.fullname, body.role, body.gender, body.role === 'user' ? 150.0 : 0.0, teacherId]);

        const newUser = await dbGet('SELECT id, username, fullname, role, gender, balance, teacher_id FROM users WHERE username = ?', [body.username.toLowerCase()]);
        return jsonResponse(res, 201, { success: true, user: newUser });
      }

      // 2. LOGIN USER & PARTNER
      if (parsedUrl === '/api/auth/login' && req.method === 'POST') {
        const body = await readJsonBody(req);
        if (!body || !body.username || !body.password) {
          return jsonResponse(res, 400, { success: false, message: 'Sila masukkan nama pengguna dan kata laluan.' });
        }

        const user = await dbGet('SELECT * FROM users WHERE username = ?', [body.username.toLowerCase()]);
        if (!user) {
          return jsonResponse(res, 401, { success: false, message: 'Nama pengguna tidak wujud.' });
        }

        const hashedPassword = hashPassword(body.password);
        if (user.password !== hashedPassword) {
          return jsonResponse(res, 401, { success: false, message: 'Kata laluan salah.' });
        }

        // Return user profile safely without sending the hashed password
        const safeUser = {
          id: user.id,
          username: user.username,
          fullname: user.fullname,
          role: user.role,
          gender: user.gender,
          balance: user.balance,
          teacher_id: user.teacher_id
        };

        return jsonResponse(res, 200, { success: true, user: safeUser });
      }

      // 3. GET TEACHERS
      if (parsedUrl === '/api/teachers' && req.method === 'GET') {
        const teachers = await dbAll('SELECT * FROM teachers');
        // Parse JSON fields
        const formattedTeachers = teachers.map(t => ({
          ...t,
          verified: t.verified === 1,
          specialties: t.specialties.split(','),
          badges: JSON.parse(t.badges),
          coordinates: JSON.parse(t.coordinates),
          online: t.online === 1
        }));
        return jsonResponse(res, 200, formattedTeachers);
      }

      // 3b. UPDATE TEACHER ONLINE STATUS
      if (parsedUrl === '/api/teachers/status' && req.method === 'POST') {
        const body = await readJsonBody(req);
        if (!body || !body.teacherId || body.online === undefined) {
          return jsonResponse(res, 400, { success: false, message: 'Maklumat tidak lengkap.' });
        }
        await dbRun('UPDATE teachers SET online = ? WHERE id = ?', [body.online ? 1 : 0, body.teacherId]);
        return jsonResponse(res, 200, { success: true });
      }

      // 4. GET REVIEWS
      if (parsedUrl === '/api/reviews' && req.method === 'GET') {
        const reviews = await dbAll('SELECT * FROM reviews');
        return jsonResponse(res, 200, reviews);
      }

      // 4b. POST REVIEWS
      if (parsedUrl === '/api/reviews' && req.method === 'POST') {
        const body = await readJsonBody(req);
        if (!body || !body.teacherId || !body.userName || !body.rating || !body.comment) {
          return jsonResponse(res, 400, { success: false, message: 'Maklumat ulasan tidak lengkap.' });
        }

        const reviewId = 'rev_' + Date.now();
        const currentDate = new Date().toISOString().split('T')[0];

        await dbRun(`
          INSERT INTO reviews (id, teacherId, userName, rating, date, comment)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [reviewId, body.teacherId, body.userName, body.rating, currentDate, body.comment]);

        // Update teacher ratings & reviewsCount
        await dbRun(`
          UPDATE teachers 
          SET reviewsCount = reviewsCount + 1,
              rating = ROUND(((rating * reviewsCount) + ?) / (reviewsCount + 1), 1)
          WHERE id = ?
        `, [body.rating, body.teacherId]);

        return jsonResponse(res, 200, { success: true });
      }

      // 5. POST CLASS BOOKINGS
      if (parsedUrl === '/api/bookings' && req.method === 'POST') {
        const body = await readJsonBody(req);
        if (!body || !body.userId || !body.teacherId || !body.serviceId || !body.date || !body.time || !body.duration || !body.totalPrice) {
          return jsonResponse(res, 400, { success: false, message: 'Maklumat tempahan tidak lengkap.' });
        }

        // Check user balance first
        const user = await dbGet('SELECT balance FROM users WHERE id = ?', [body.userId]);
        if (!user || user.balance < body.totalPrice) {
          return jsonResponse(res, 400, { success: false, message: 'Baki wallet pembelajaran tidak mencukupi untuk membuat tempahan ini.' });
        }

        const bookingId = 'book_' + Date.now();
        const createdAt = new Date().toISOString();

        await dbRun(`
          INSERT INTO bookings (id, userId, teacherId, serviceId, date, time, duration, totalPrice, status, createdAt, chatHistory)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]')
        `, [bookingId, body.userId, body.teacherId, body.serviceId, body.date, body.time, body.duration, body.totalPrice, 'searching', createdAt]);

        const newBooking = await dbGet('SELECT b.*, u.fullname as clientName FROM bookings b JOIN users u ON b.userId = u.id WHERE b.id = ?', [bookingId]);
        return jsonResponse(res, 201, { success: true, booking: newBooking });
      }

      // 6. GET ACTIVE/PENDING BOOKINGS
      if (parsedUrl === '/api/bookings' && req.method === 'GET') {
        // Parse search params manually
        const urlParams = new URLSearchParams(req.url.split('?')[1] || '');
        const userId = urlParams.get('userId');
        const teacherId = urlParams.get('teacherId');

        let bookings = [];
        if (userId) {
          bookings = await dbAll('SELECT b.*, u.fullname as clientName FROM bookings b JOIN users u ON b.userId = u.id WHERE b.userId = ? ORDER BY b.createdAt DESC', [userId]);
        } else if (teacherId) {
          bookings = await dbAll('SELECT b.*, u.fullname as clientName FROM bookings b JOIN users u ON b.userId = u.id WHERE b.teacherId = ? ORDER BY b.createdAt DESC', [teacherId]);
        } else {
          bookings = await dbAll('SELECT b.*, u.fullname as clientName FROM bookings b JOIN users u ON b.userId = u.id ORDER BY b.createdAt DESC');
        }

        return jsonResponse(res, 200, bookings);
      }

      // 6b. UPDATE BOOKING CHAT HISTORY
      if (parsedUrl === '/api/bookings/chat' && req.method === 'POST') {
        const body = await readJsonBody(req);
        if (!body || !body.bookingId || !body.chatHistory) {
          return jsonResponse(res, 400, { success: false, message: 'Maklumat tidak lengkap.' });
        }
        await dbRun('UPDATE bookings SET chatHistory = ? WHERE id = ?', [JSON.stringify(body.chatHistory), body.bookingId]);
        return jsonResponse(res, 200, { success: true });
      }

      // 7. ACCEPT, COMPLETE, OR CANCEL BOOKINGS
      if (parsedUrl === '/api/bookings/update-status' && req.method === 'POST') {
        const body = await readJsonBody(req);
        if (!body || !body.bookingId || !body.status) {
          return jsonResponse(res, 400, { success: false, message: 'Sila sertakan bookingId dan status.' });
        }

        const booking = await dbGet('SELECT * FROM bookings WHERE id = ?', [body.bookingId]);
        if (!booking) {
          return jsonResponse(res, 404, { success: false, message: 'Rekod tempahan tidak dijumpai.' });
        }

        // Handle class completion: execute balance transfer!
        if (body.status === 'completed' && booking.status !== 'completed') {
          const student = await dbGet('SELECT id, balance, fullname FROM users WHERE id = ?', [booking.userId]);
          if (!student || student.balance < booking.totalPrice) {
            return jsonResponse(res, 400, { success: false, message: 'Baki wallet pelajar tidak mencukupi untuk bayaran.' });
          }

          // Fetch teacher user account to deposit balance
          const teacherProfile = await dbGet('SELECT name FROM teachers WHERE id = ?', [booking.teacherId]);
          const teacherUser = await dbGet('SELECT id, balance FROM users WHERE teacher_id = ?', [booking.teacherId]);

          // Deduct from student
          await dbRun('UPDATE users SET balance = balance - ? WHERE id = ?', [booking.totalPrice, booking.userId]);
          
          // Deposit to teacher if exists
          if (teacherUser) {
            await dbRun('UPDATE users SET balance = balance + ? WHERE id = ?', [booking.totalPrice, teacherUser.id]);
          }

        }

        // Update booking status
        await dbRun('UPDATE bookings SET status = ? WHERE id = ?', [body.status, body.bookingId]);
        
        // Fetch updated booking and user info
        const updatedBooking = await dbGet('SELECT b.*, u.fullname as clientName FROM bookings b JOIN users u ON b.userId = u.id WHERE b.id = ?', [body.bookingId]);
        const updatedStudent = await dbGet('SELECT id, username, fullname, role, gender, balance, teacher_id FROM users WHERE id = ?', [booking.userId]);

        return jsonResponse(res, 200, { 
          success: true, 
          booking: updatedBooking, 
          user: updatedStudent 
        });
      }

      // 8. RELOAD OR UPDATE WALLET CREDITS
      if (parsedUrl === '/api/users/update-balance' && req.method === 'POST') {
        const body = await readJsonBody(req);
        if (!body || !body.userId || body.amount === undefined) {
          return jsonResponse(res, 400, { success: false, message: 'Sila sertakan userId dan amount.' });
        }

        await dbRun('UPDATE users SET balance = balance + ? WHERE id = ?', [parseFloat(body.amount), body.userId]);
        const updatedUser = await dbGet('SELECT id, username, fullname, role, gender, balance, teacher_id FROM users WHERE id = ?', [body.userId]);

        return jsonResponse(res, 200, { success: true, user: updatedUser });
      }

      // 9. DELETE USER ACCOUNT
      if (parsedUrl.startsWith('/api/users/') && req.method === 'DELETE') {
        const userIdStr = parsedUrl.split('/').pop();
        const userId = parseInt(userIdStr);
        if (isNaN(userId)) {
          return jsonResponse(res, 400, { success: false, message: 'ID tidak sah.' });
        }

        // Fetch user to check if they are a teacher
        const user = await dbGet('SELECT teacher_id FROM users WHERE id = ?', [userId]);
        if (!user) {
          return jsonResponse(res, 404, { success: false, message: 'Pengguna tidak dijumpai.' });
        }

        // Delete associated teacher profile if exists
        if (user.teacher_id) {
          await dbRun('DELETE FROM teachers WHERE id = ?', [user.teacher_id]);
        }

        // Delete the user
        await dbRun('DELETE FROM users WHERE id = ?', [userId]);

        return jsonResponse(res, 200, { success: true, message: 'Akaun berjaya dipadam.' });
      }

      // 10. NOT FOUND
      return jsonResponse(res, 404, { success: false, message: 'API Route Not Found' });

    } catch (apiError) {
      console.error('❌ Server API Error:', apiError);
      return jsonResponse(res, 500, { success: false, message: 'Ralat dalaman server API.', error: apiError.message });
    }
  }

  // -------------------------------------------------------------
  // STATIC FILES SERVING SECTION
  // -------------------------------------------------------------
  // Normalize URL to prevent directory traversal
  let safeUrl = req.url.split('?')[0];
  let filePath = path.join(__dirname, safeUrl === '/' ? 'index.html' : safeUrl);
  
  // Security check: ensure path is within current directory
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403, { 'Content-Type': 'text/html' });
    res.end('<h1>403 Forbidden</h1>', 'utf-8');
    return;
  }

  const extname = String(path.extname(filePath)).toLowerCase();
  const contentType = MIME_TYPES[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>404 Not Found</h1>', 'utf-8');
      } else {
        res.writeHead(500);
        res.end(`Server Error: ${error.code} ..\n`);
      }
    } else {
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Surrogate-Control': 'no-store'
      });
      res.end(content, 'utf-8');
    }
  });
});

// Query system network interfaces for local IPv4 addresses
function getLocalIPs() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (let k in interfaces) {
    for (let k2 in interfaces[k]) {
      let address = interfaces[k][k2];
      if (address.family === 'IPv4' && !address.internal) {
        addresses.push(address.address);
      }
    }
  }
  return addresses;
}

let currentPort = PORT;

function startServer(port) {
  server.listen(port, '0.0.0.0', () => {
    console.log('\n=============================================================');
    console.log('🕌  AgamaKu Real Database Server Active! 🕌');
    console.log('=============================================================');
    console.log(`\n💻 Local Address (Desktop): http://localhost:${port}`);
    
    const ips = getLocalIPs();
    if (ips.length > 0) {
      console.log('\n📱 Open this URL on your PHONE (must be on the same Wi-Fi):');
      ips.forEach(ip => {
        console.log(`👉 http://${ip}:${port}`);
      });
    } else {
      console.log('\n⚠️ No external network interface found. Ensure Wi-Fi is connected.');
    }
    console.log('\n=============================================================');
    console.log('Press Ctrl+C in this terminal window to stop the server.\n');
  });
}

server.on('error', (err) => {
  if (err.code === 'EACCES' || err.code === 'EADDRINUSE') {
    console.log(`\n⚠️ Port ${currentPort} is restricted or in use. Trying port ${currentPort + 1}...`);
    currentPort++;
    startServer(currentPort);
  } else {
    console.error('\n❌ Server error:', err);
  }
});

startServer(currentPort);
