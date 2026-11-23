const crypto = require('crypto');

const INITIAL_BOOKINGS = [
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

const INITIAL_MESSAGES = [
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

const USERS = [
  { name: 'Klára Horáková', email: 'customer@cleanora.cz', password: 'Password@123', role: 'customer', phone: '+420 602 118 900' },
  { name: 'Markéta Svobodová', email: 'staff@cleanora.cz', password: 'Password@123', role: 'staff', phone: '+420 603 554 112' },
  { name: 'Lucie Nováková', email: 'admin@cleanora.cz', password: 'Password@123', role: 'admin', phone: '+420 600 123 456' }
];

module.exports = async (req, res) => {
  const safeUrl = (req.url || '').split('?')[0];
  const body = typeof req.body === 'object' && req.body !== null ? req.body : {};

  if (safeUrl === '/api/contact') {
    if (req.method === 'GET') {
      return res.status(200).json({ ok: true, messages: INITIAL_MESSAGES });
    }
    if (req.method === 'POST') {
      const entry = { ...body, createdAt: new Date().toISOString() };
      INITIAL_MESSAGES.unshift(entry);
      return res.status(200).json({ ok: true });
    }
  }

  if (safeUrl === '/api/bookings') {
    if (req.method === 'GET') {
      return res.status(200).json({ ok: true, bookings: INITIAL_BOOKINGS });
    }
    if (req.method === 'POST') {
      const reference = body.ref || ('CLN-' + Math.floor(10000 + Math.random() * 90000));
      const newBooking = {
        reference,
        serviceId: body.serviceId || 'home',
        serviceName: body.serviceName || body.service || 'Home Cleaning',
        propertyType: body.propertyType || 'Apartment',
        address: body.address || 'Prague 1',
        date: body.date || '2026-11-20',
        time: body.time || '09:00 AM',
        addons: body.addons || [],
        totalPrice: body.totalPrice || 89,
        customerName: body.customerName || 'Klára Horáková',
        customerEmail: body.customerEmail || 'customer@cleanora.cz',
        assignedStaff: body.assignedStaff || 'Markéta Svobodová',
        status: 'Confirmed',
        createdAt: new Date().toISOString()
      };
      INITIAL_BOOKINGS.unshift(newBooking);
      return res.status(200).json({ ok: true, booking: newBooking });
    }
  }

  if (req.method === 'POST' && safeUrl === '/api/auth/login') {
    const selectedRole = (body.role || 'customer').toLowerCase();
    const user = USERS.find(u => u.email.toLowerCase() === (body.email || '').toLowerCase());
    if (user && user.role !== selectedRole) {
      return res.status(403).json({
        ok: false,
        error: `This account is registered under the ${user.role.toUpperCase()} role. Please select the matching role card.`
      });
    }
    const redirectMap = { customer: '/customer', staff: '/staff', admin: '/admin' };
    return res.status(200).json({
      ok: true,
      user: {
        name: user ? user.name : (selectedRole === 'admin' ? 'Lucie Nováková' : selectedRole === 'staff' ? 'Markéta Svobodová' : 'Klára Horáková'),
        email: body.email || `${selectedRole}@cleanora.cz`,
        role: selectedRole
      },
      redirectUrl: redirectMap[selectedRole] || '/customer'
    });
  }

  if (req.method === 'POST' && safeUrl === '/api/auth/register') {
    const selectedRole = (body.role || 'customer').toLowerCase();
    if (selectedRole === 'admin') {
      return res.status(403).json({
        ok: false,
        error: 'Administrator accounts cannot be registered publicly. They must be provisioned from the Admin Panel.'
      });
    }
    if (selectedRole === 'staff' && body.inviteCode !== 'STAFF-2026') {
      return res.status(403).json({
        ok: false,
        error: 'Valid Staff Invitation Code (STAFF-2026) is required to register a Staff account.'
      });
    }
    const redirectMap = { customer: '/customer', staff: '/staff' };
    return res.status(200).json({
      ok: true,
      user: { name: body.name || 'New Client', email: body.email, role: selectedRole },
      redirectUrl: redirectMap[selectedRole] || '/customer'
    });
  }

  if (req.method === 'POST' && safeUrl === '/api/auth/forgot-password') {
    const token = 'RST-' + crypto.randomBytes(6).toString('hex').toUpperCase();
    return res.status(200).json({
      ok: true,
      message: 'If an account exists for this email address, a secure time-limited reset link has been sent.',
      demoResetToken: token
    });
  }

  if (req.method === 'POST' && safeUrl === '/api/auth/reset-password') {
    return res.status(200).json({ ok: true, redirectUrl: '/login' });
  }

  if (req.method === 'POST' && safeUrl === '/api/config') {
    return res.status(200).json({ ok: true });
  }

  return res.status(200).json({ ok: true, service: 'CLEANORA Luxury API' });
};
