require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// ─── Hex to RGB helper ───────────────────────────────────────────────────────
function hexToRgb(hex) {
  if (!hex) return '0, 243, 255';
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  return isNaN(r) || isNaN(g) || isNaN(b) ? '0, 243, 255' : r + ', ' + g + ', ' + b;
}

// ─── Sanitise/validate project URL ──────────────────────────────────────────
function isValidPublicUrl(url) {
  if (!url) return false;
  if (url.includes('localhost')) return false;
  if (url.includes('/admin')) return false;
  try { new URL(url); return true; } catch { return false; }
}

// ─── Config ──────────────────────────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(express.json({ limit: '10mb' }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'nova_drop_secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 }
}));

// ─── Middleware ───────────────────────────────────────────────────────────────
function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  res.redirect('/admin');
}

// Inject settings + helpers into all templates
app.use(async (req, res, next) => {
  try {
    res.locals.settings = await db.getSettings();
  } catch (e) {
    console.error('[server] Failed to load settings:', e.message);
    res.locals.settings = {
      site_name: 'NOVA // DROP', hero_text: 'SOMETHING BIG IS COMING.',
      hero_subtitle: "You weren't supposed to find this yet.",
      archive_enabled: true, cursor_enabled: true,
      particles_enabled: true, easter_eggs_enabled: true
    };
  }
  res.locals.hexToRgb = hexToRgb;
  res.locals.isValidPublicUrl = isValidPublicUrl;
  next();
});

// ─── PUBLIC ROUTES ────────────────────────────────────────────────────────────

app.get('/', async (req, res) => {
  try {
    const activeProj = await db.getActiveProject();
    const settings = res.locals.settings;
    const preview = req.query.preview || null;
    res.render('index', {
      active_project: activeProj,
      site_title: activeProj ? (activeProj.name + ' // Teaser') : settings.site_name,
      meta_desc: activeProj ? activeProj.tagline : 'Something big is coming.',
      preview,
      is_teaser: true
    });
  } catch (e) {
    console.error('[GET /]', e);
    res.status(500).send('Internal error');
  }
});

app.get('/projects', async (req, res) => {
  try {
    const settings = res.locals.settings;
    if (!settings.archive_enabled) return res.redirect('/');
    const allProjects = (await db.getProjects()).filter(p => p.status === 'Live' || p.status === 'Archived');
    res.render('archive', {
      projects: allProjects,
      active_project: null,
      site_title: 'PROJECT ARCHIVE // ' + settings.site_name,
      meta_desc: 'Complete deployment history.'
    });
  } catch (e) {
    console.error('[GET /projects]', e);
    res.redirect('/');
  }
});

app.get('/project/:slug', async (req, res) => {
  try {
    const proj = await db.getProjectBySlug(req.params.slug);
    if (!proj) return res.redirect('/');
    res.render('project', {
      current_project: proj,
      active_project: proj,
      site_title: proj.name + ' // Teaser',
      meta_desc: proj.tagline,
      preview: req.query.preview || null,
      is_teaser: true
    });
  } catch (e) {
    console.error('[GET /project/:slug]', e);
    res.redirect('/');
  }
});

// ─── ADMIN IMAGE UPLOAD ───────────────────────────────────────────────────────

app.post('/admin/upload', requireAdmin, async (req, res) => {
  try {
    const { fileData, fileName, projectId, mediaType } = req.body;
    if (!fileData || !fileName) {
      return res.status(400).json({ error: 'Missing file data or name' });
    }

    const matches = fileData.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ error: 'Invalid file data format' });
    }

    const mimeType = matches[1];
    const buffer = Buffer.from(matches[2], 'base64');
    const extension = fileName.split('.').pop().toLowerCase();
    const allowed = ['png', 'jpg', 'jpeg', 'webp', 'svg'];

    if (!allowed.includes(extension)) {
      return res.status(400).json({ error: 'Unsupported file type. Allowed: PNG, JPG, WEBP, SVG' });
    }

    // 5 MB size limit
    if (buffer.length > 5 * 1024 * 1024) {
      return res.status(400).json({ error: 'File too large. Maximum 5 MB.' });
    }

    const pid = projectId || 'general';
    const mtype = mediaType || 'logo';
    const url = await db.uploadMedia(buffer, mimeType, pid, mtype, extension);
    res.json({ url });
  } catch (e) {
    console.error('[POST /admin/upload]', e);
    res.status(500).json({ error: 'Upload failed: ' + e.message });
  }
});

// Remove media file endpoint
app.post('/admin/media/remove', requireAdmin, async (req, res) => {
  try {
    const { url } = req.body;
    await db.removeMedia(url);
    res.json({ ok: true });
  } catch (e) {
    console.error('[POST /admin/media/remove]', e);
    res.status(500).json({ error: 'Remove failed' });
  }
});

// ─── ADMIN AUTH ───────────────────────────────────────────────────────────────

app.get('/admin', (req, res) => {
  if (req.session && req.session.isAdmin) return res.redirect('/admin/dashboard');
  res.render('login', {
    active_project: null,
    site_title: 'NOVA // DROP — CONTROL ACCESS',
    meta_desc: 'Authorization required',
    error: null
  });
});

app.post('/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    res.redirect('/admin/dashboard');
  } else {
    res.render('login', {
      active_project: null,
      site_title: 'NOVA // DROP — CONTROL ACCESS',
      meta_desc: 'Authorization required',
      error: 'ACCESS DENIED. INVALID KEY.'
    });
  }
});

app.get('/admin/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

// ─── ADMIN DASHBOARD & CRUD ───────────────────────────────────────────────────

app.get('/admin/dashboard', requireAdmin, async (req, res) => {
  try {
    const [projects, activeProj] = await Promise.all([db.getProjects(), db.getActiveProject()]);
    res.render('admin/dashboard', {
      projects,
      active_project: activeProj,
      active_project_override: activeProj,
      site_title: 'NOVA // DROP — PROJECT CONTROL',
      meta_desc: 'Dashboard'
    });
  } catch (e) {
    console.error('[GET /admin/dashboard]', e);
    res.status(500).send('Dashboard error: ' + e.message);
  }
});

app.post('/admin/settings', requireAdmin, async (req, res) => {
  try {
    await db.updateSettings(req.body);
    res.redirect('/admin/dashboard');
  } catch (e) {
    console.error('[POST /admin/settings]', e);
    res.redirect('/admin/dashboard');
  }
});

// Create project
app.get('/admin/projects/new', requireAdmin, (req, res) => {
  res.render('admin/project-form', {
    project: null,
    active_project: null,
    site_title: 'NOVA // DROP — NEW PROJECT',
    meta_desc: 'Create project'
  });
});

app.post('/admin/projects/new', requireAdmin, async (req, res) => {
  try {
    await db.createProject(req.body);
    res.redirect('/admin/dashboard');
  } catch (e) {
    console.error('[POST /admin/projects/new]', e);
    res.redirect('/admin/dashboard');
  }
});

// Edit project
app.get('/admin/projects/:id', requireAdmin, async (req, res) => {
  try {
    const proj = await db.getProjectById(req.params.id);
    if (!proj) return res.redirect('/admin/dashboard');
    res.render('admin/project-form', {
      project: proj,
      active_project: proj,
      site_title: 'NOVA // DROP — EDIT: ' + proj.name,
      meta_desc: 'Edit project'
    });
  } catch (e) {
    console.error('[GET /admin/projects/:id]', e);
    res.redirect('/admin/dashboard');
  }
});

app.post('/admin/projects/:id/edit', requireAdmin, async (req, res) => {
  try {
    await db.updateProject(req.params.id, req.body);
    res.redirect('/admin/dashboard');
  } catch (e) {
    console.error('[POST /admin/projects/:id/edit]', e);
    res.redirect('/admin/dashboard');
  }
});

// Delete project
app.post('/admin/projects/:id/delete', requireAdmin, async (req, res) => {
  try {
    await db.deleteProject(req.params.id);
    res.sendStatus(200);
  } catch (e) {
    console.error('[POST /admin/projects/:id/delete]', e);
    res.status(500).send('Delete failed');
  }
});

// Set active (NEXT DROP)
app.post('/admin/projects/:id/set-active', requireAdmin, async (req, res) => {
  try {
    await db.setActiveProject(req.params.id);
    res.sendStatus(200);
  } catch (e) {
    console.error('[POST /admin/projects/:id/set-active]', e);
    res.status(500).send('Set active failed');
  }
});

// ─── START ────────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log('\n========================================');
    console.log('NOVA // DROP ONLINE: http://localhost:' + PORT);
    console.log('ADMIN CONSOLE: http://localhost:' + PORT + '/admin');
    console.log('ADMIN PASSWORD: ' + ADMIN_PASSWORD);
    console.log('BACKEND: ' + (db.isSupabaseMode ? 'Supabase' : 'Local JSON'));
    console.log('========================================\n');
  });
}

module.exports = app;
