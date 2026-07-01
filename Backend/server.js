const express = require('express');
const path = require('path');
require('dotenv').config();
require('dotenv').config({ path: __dirname + '/.env' });

const { sequelize } = require('./models/index');

const authRoutes = require('./routes/authRoutes');
const childProfilesRoutes = require('./routes/child-profiles.routes');
const contentSearchRoutes = require('./routes/content-search.routes');
const subscriptionPlansRoutes = require('./routes/subscription-plans.routes');
const subscriptionsRoutes = require('./routes/subscriptions.routes');
const contentManagementRoutes = require('./routes/content-management.routes');
const organizationRoutes = require('./routes/organization.routes');
const adminUsersRoutes = require('./routes/admin-users.routes');

const app = express();

app.disable('x-powered-by');
app.use((req, res, next) => {
  const allowedOrigins = String(process.env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const origin = req.headers.origin;

  if (origin && (allowedOrigins.includes(origin) || (process.env.NODE_ENV !== 'production' && allowedOrigins.length === 0))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,x-setup-token,x-parent-unlock-token');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  if (req.method === 'OPTIONS') return res.sendStatus(204);
  return next();
});

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Uploaded premium media is intentionally NOT exposed with express.static.
// Use protected routes under /api/content/:contentId/playback and /api/content/:contentId/thumbnail.
app.use('/admin', express.static(path.join(__dirname, 'public'), {
  setHeaders: (res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
  },
}));
app.use('/parent', express.static(path.join(__dirname, 'public'), {
  setHeaders: (res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
  },
}));

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'PG Kids Platform API is running',
    adminPanel: '/admin/admin.html',
    parentPanel: '/parent/parent.html',
  });
});

app.get('/api/health', (req, res) => {
  res.json({ success: true, status: 'ok', service: 'PG Kids Platform API' });
});

app.use('/api/auth', authRoutes);
app.use('/api/profiles', childProfilesRoutes);
app.use('/api/child-profiles', childProfilesRoutes);
app.use('/api/content', contentSearchRoutes);
app.use('/api/plans', subscriptionPlansRoutes);
app.use('/api/subscriptions', subscriptionsRoutes);
app.use('/api/admin/content', contentManagementRoutes);
app.use('/api/admin/organization', organizationRoutes);
app.use('/api/admin/users', adminUsersRoutes);

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route was not found', errors: [] });
});

app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err.message);
  res.status(500).json({ success: false, message: 'Internal server error', errors: [] });
});

const PORT = process.env.PORT || 3000;

sequelize.sync({ alter: process.env.DB_SYNC_ALTER === 'true' })
  .then(() => {
    console.log('✅ Database & tables synced successfully');
    app.listen(PORT, () => {
      console.log(`✅ PG Kids Platform API running on http://localhost:${PORT}`);
      console.log(`👉 Admin panel: http://localhost:${PORT}/admin/admin.html`);
      console.log(`👉 Parent panel: http://localhost:${PORT}/parent/parent.html`);
    });
  })
  .catch((err) => {
    console.error('❌ Failed to sync database:', err);
    process.exit(1);
  });
