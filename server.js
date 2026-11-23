const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(PUBLIC_DIR, 'data');
const MESSAGES_FILE = path.join(DATA_DIR, 'contact-messages.json');
const BOOKINGS_FILE = path.join(DATA_DIR, 'bookings.json');
const CONFIG_FILE = path.join(DATA_DIR, 'site-config.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Seed initial bookings if not present
if (!fs.existsSync(BOOKINGS_FILE)) {
  const initialBookings = [
    {
      reference: 'CLN-84920',
      serviceId: 'deep',
      serviceName: 'Deep Cleaning',
      propertyType: 'Penthouse Apartment',
      bedrooms: 3,
      bathrooms: 2,
      sqft: 165,
      address: 'Pařížská 18, 110 00 Praha 1',
      date: '2026-11-18',
      time: '09:00 AM',
      addons: ['Oven Cleaning', 'Window Cleaning'],
      totalPrice: 204,
      customerName: 'Klára Horáková',
      customerEmail: 'customer@cleanora.cz',
      assignedStaff: 'Markéta Svobodová',
      status: 'Confirmed',
      createdAt: new Date().toISOString()
    },
    {
      reference: 'CLN-84875',
      serviceId: 'home',
      serviceName: 'Home Cleaning',
      propertyType: 'Family Residence',
      bedrooms: 4,
      bathrooms: 3,
      sqft: 210,
      address: 'Vinohradská 112, 120 00 Praha 2',
      date: '2026-11-21',
      time: '11:00 AM',
      addons: ['Fridge Cleaning'],
      totalPrice: 109,
      customerName: 'Klára Horáková',
      customerEmail: 'customer@cleanora.cz',
      assignedStaff: 'Petr Dvořák',
      status: 'Scheduled',
      createdAt: new Date().toISOString()
    }
  ];
  fs.writeFileSync(BOOKINGS_FILE, JSON.stringify(initialBookings, null, 2), 'utf8');
}

// Seed initial contact messages if not present
if (!fs.existsSync(MESSAGES_FILE)) {
  const initialMessages = [
    {
      name: 'Elena Rostova',
      email: 'elena.rostova@prague-estates.cz',
      phone: '+420 608 441 209',
      service: 'Deep Cleaning',
      message: 'We would love a full pre-holiday marble and chandelier detailing for our Malá Strana residence next Thursday.',
      createdAt: new Date().toISOString()
    },
    {
      name: 'Jakub Marek',
      email: 'j.marek@karlinventures.cz',
      phone: '+420 775 910 332',
      service: 'Commercial Cleaning',
      message: 'Looking for daily evening eco-cleaning for our 450 m² architectural studio in Karlín.',
      createdAt: new Date().toISOString()
    }
  ];
  fs.writeFileSync(MESSAGES_FILE, JSON.stringify(initialMessages, null, 2), 'utf8');
}

// In-memory store for users and single-use password reset tokens
const USERS = [
  { name: 'Klára Horáková', email: 'customer@cleanora.cz', password: 'Password@123', role: 'customer', phone: '+420 602 118 900' },
  { name: 'Markéta Svobodová', email: 'staff@cleanora.cz', password: 'Password@123', role: 'staff', phone: '+420 603 554 112' },
  { name: 'Lucie Nováková', email: 'admin@cleanora.cz', password: 'Password@123', role: 'admin', phone: '+420 600 123 456' }
];
const RESET_TOKENS = new Map();

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const ROUTE_MAP = {
  '/': 'index.html',
  '/index.html': 'index.html',
  '/services': 'services.html',
  '/services/': 'services.html',
  '/pricing': 'pricing.html',
  '/pricing/': 'pricing.html',
  '/about': 'about.html',
  '/about/': 'about.html',
  '/gallery': 'gallery.html',
  '/gallery/': 'gallery.html',
  '/reviews': 'reviews.html',
  '/reviews/': 'reviews.html',
  '/contact': 'contact.html',
  '/contact/': 'contact.html',
  '/book': 'book.html',
  '/book/': 'book.html',
  '/login': 'login.html',
  '/login/': 'login.html',
  '/register': 'login.html',
  '/register/': 'login.html',
  '/forgot-password': 'forgot-password.html',
  '/forgot-password/': 'forgot-password.html',
  '/reset-password': 'forgot-password.html',
  '/reset-password/': 'forgot-password.html',
  '/customer': 'customer-portal.html',
  '/customer/': 'customer-portal.html',
  '/staff': 'staff-portal.html',
  '/staff/': 'staff-portal.html',
  '/admin': 'admin-panel.html',
  '/admin/': 'admin-panel.html',
  '/privacy': 'privacy.html',
  '/privacy/': 'privacy.html',
  '/terms': 'terms.html',
  '/terms/': 'terms.html',
  '/cookies': 'cookies.html',
  '/cookies/': 'cookies.html',
  '/404': '404.html',
};

function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); }
      catch (e) { resolve({}); }
    });
  });
}

function sendJson(res, status, payload, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
  res.end(JSON.stringify(payload));
}

const server = http.createServer(async (req, res) => {
  const safeUrl = decodeURIComponent(req.url.split('?')[0]);

  // 1. Contact API (GET & POST)
  if (safeUrl === '/api/contact') {
    if (req.method === 'GET') {
      const messages = fs.existsSync(MESSAGES_FILE)
        ? JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf8') || '[]')
        : [];
      return sendJson(res, 200, { ok: true, messages });
    }
    if (req.method === 'POST') {
      const entry = await parseBody(req);
      const list = fs.existsSync(MESSAGES_FILE)
        ? JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf8') || '[]')
        : [];
      entry.createdAt = entry.createdAt || new Date().toISOString();
      list.unshift(entry);
      fs.writeFileSync(MESSAGES_FILE, JSON.stringify(list, null, 2), 'utf8');
      return sendJson(res, 200, { ok: true });
    }
  }

  // 2. Bookings API (GET & POST)
  if (safeUrl === '/api/bookings') {
    if (req.method === 'GET') {
      const bookings = fs.existsSync(BOOKINGS_FILE)
        ? JSON.parse(fs.readFileSync(BOOKINGS_FILE, 'utf8') || '[]')
        : [];
      return sendJson(res, 200, { ok: true, bookings });
    }
    if (req.method === 'POST') {
      const payload = await parseBody(req);
      const bookings = fs.existsSync(BOOKINGS_FILE)
        ? JSON.parse(fs.readFileSync(BOOKINGS_FILE, 'utf8') || '[]')
        : [];
      const reference = 'CLN-' + Math.floor(10000 + Math.random() * 90000);
      const newBooking = {
        reference,
        serviceId: payload.serviceId || 'home',
        serviceName: payload.serviceName || 'Home Cleaning',
        propertyType: payload.propertyType || 'Apartment',
        bedrooms: payload.bedrooms || 2,
        bathrooms: payload.bathrooms || 1,
        sqft: payload.sqft || 95,
        address: payload.address || 'Prague 1',
        date: payload.date || '2026-11-20',
        time: payload.time || '09:00 AM',
        addons: payload.addons || [],
        totalPrice: payload.totalPrice || 89,
        customerName: payload.customerName || 'Klára Horáková',
        customerEmail: payload.customerEmail || 'customer@cleanora.cz',
        assignedStaff: 'Markéta Svobodová',
        status: 'Confirmed',
        createdAt: new Date().toISOString()
      };
      bookings.unshift(newBooking);
      fs.writeFileSync(BOOKINGS_FILE, JSON.stringify(bookings, null, 2), 'utf8');
      return sendJson(res, 200, { ok: true, booking: newBooking });
    }
  }

  // 3. Role-Based Login API
  if (req.method === 'POST' && safeUrl === '/api/auth/login') {
    const { email, password, role } = await parseBody(req);
    const selectedRole = (role || 'customer').toLowerCase();
    const user = USERS.find(u => u.email.toLowerCase() === (email || '').toLowerCase());

    if (user && user.role !== selectedRole) {
      return sendJson(res, 403, {
        ok: false,
        error: `This account is registered under the ${user.role.toUpperCase()} role. Please select the matching role card.`
      });
    }

    const redirectMap = { customer: '/customer', staff: '/staff', admin: '/admin' };
    const sessionToken = crypto.randomBytes(24).toString('hex');
    return sendJson(
      res,
      200,
      {
        ok: true,
        user: {
          name: user ? user.name : (selectedRole === 'admin' ? 'Lucie Nováková' : selectedRole === 'staff' ? 'Markéta Svobodová' : 'Klára Horáková'),
          email: email || `${selectedRole}@cleanora.cz`,
          role: selectedRole
        },
        redirectUrl: redirectMap[selectedRole] || '/customer'
      },
      { 'Set-Cookie': `cleanora_session=${sessionToken}; HttpOnly; Path=/; SameSite=Lax` }
    );
  }

  // 4. Role-Based Registration API (Customer public, Staff invite-only, Admin blocked)
  if (req.method === 'POST' && safeUrl === '/api/auth/register') {
    const { name, email, phone, password, role, inviteCode } = await parseBody(req);
    const selectedRole = (role || 'customer').toLowerCase();

    if (selectedRole === 'admin') {
      return sendJson(res, 403, {
        ok: false,
        error: 'Administrator accounts cannot be registered publicly. They must be provisioned from the Admin Panel.'
      });
    }

    if (selectedRole === 'staff' && inviteCode !== 'STAFF-2026') {
      return sendJson(res, 403, {
        ok: false,
        error: 'Valid Staff Invitation Code (e.g. STAFF-2026) is required to register a Staff account.'
      });
    }

    const newUser = { name, email, phone, password, role: selectedRole };
    USERS.push(newUser);
    const redirectMap = { customer: '/customer', staff: '/staff' };
    return sendJson(res, 200, {
      ok: true,
      user: { name, email, role: selectedRole },
      redirectUrl: redirectMap[selectedRole] || '/customer'
    });
  }

  // 5. Forgot Password & Single-Use Reset Token API
  if (req.method === 'POST' && safeUrl === '/api/auth/forgot-password') {
    const { email } = await parseBody(req);
    const token = 'RST-' + crypto.randomBytes(6).toString('hex').toUpperCase();
    RESET_TOKENS.set(token, {
      email: email || 'customer@cleanora.cz',
      expiresAt: Date.now() + 15 * 60 * 1000,
      used: false
    });
    return sendJson(res, 200, {
      ok: true,
      message: 'If an account exists for this email address, a secure time-limited reset link has been sent.',
      demoResetToken: token
    });
  }

  if (req.method === 'POST' && safeUrl === '/api/auth/reset-password') {
    const { token, newPassword } = await parseBody(req);
    const hasLength = (newPassword || '').length >= 8;
    const hasUpper = /[A-Z]/.test(newPassword || '');
    const hasNumber = /[0-9]/.test(newPassword || '');
    const hasSpecial = /[^A-Za-z0-9]/.test(newPassword || '');

    if (!hasLength || !hasUpper || !hasNumber || !hasSpecial) {
      return sendJson(res, 400, {
        ok: false,
        error: 'Password does not meet all security requirements.'
      });
    }

    if (token && RESET_TOKENS.has(token)) {
      const record = RESET_TOKENS.get(token);
      if (record.used || Date.now() > record.expiresAt) {
        return sendJson(res, 400, { ok: false, error: 'This reset token has expired or has already been used.' });
      }
      record.used = true;
    }

    return sendJson(res, 200, { ok: true, redirectUrl: '/login' });
  }

  // 6. Live Site Pricing Config API (Admin Panel -> Services & Pricing)
  if (req.method === 'POST' && safeUrl === '/api/config') {
    const { basic, standard, deep } = await parseBody(req);
    if (fs.existsSync(CONFIG_FILE)) {
      const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      if (Array.isArray(cfg.packages)) {
        cfg.packages.forEach(p => {
          if (p.id === 'basic' && basic) p.price = Number(basic);
          if (p.id === 'standard' && standard) p.price = Number(standard);
          if (p.id === 'deep' && deep) p.price = Number(deep);
        });
      }
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8');
    }
    return sendJson(res, 200, { ok: true });
  }

  // Static & Page Routing
  const mappedFile = ROUTE_MAP[safeUrl] || safeUrl;
  let filePath = path.join(PUBLIC_DIR, mappedFile);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      const notFoundPath = path.join(PUBLIC_DIR, '404.html');
      return fs.readFile(notFoundPath, (nfErr, nfContent) => {
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(nfErr ? '404 Not Found' : nfContent);
      });
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500);
        return res.end('Server Error');
      }
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      });
      res.end(content);
    });
  });
});

server.listen(PORT, () => {
  console.log(`CLEANORA Luxury Full-Stack Server running at http://localhost:${PORT}`);
});
