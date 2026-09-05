'use strict';
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// ================================================
// Storage backend selection
// Set SUPABASE_URL + SUPABASE_SERVICE_KEY in .env
// to activate Supabase mode.
// Otherwise, falls back to data.json (local mode).
// ================================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const USE_SUPABASE = !!(SUPABASE_URL && SUPABASE_SERVICE_KEY);

let supabase = null;
if (USE_SUPABASE) {
  const { createClient } = require('@supabase/supabase-js');
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false }
  });
  console.log('[db] Supabase mode ACTIVE');
} else {
  console.log('[db] Local JSON mode — add SUPABASE_URL + SUPABASE_SERVICE_KEY to .env to activate Supabase');
}

// ------------------------------------------------
// Local JSON helpers (fallback)
// ------------------------------------------------
const DB_PATH = path.join(__dirname, 'data.json');

function generateSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
}

const DEFAULT_DATA = {
  projects: [],
  site_settings: {
    site_name: 'NOVA // DROP',
    hero_text: 'SOMETHING BIG IS COMING.',
    hero_subtitle: "You weren't supposed to find this yet.",
    archive_enabled: true,
    cursor_enabled: true,
    particles_enabled: true,
    easter_eggs_enabled: true
  }
};

function readDB() {
  try {
    if (!fs.existsSync(DB_PATH)) { writeDB(DEFAULT_DATA); return DEFAULT_DATA; }
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch (e) { return DEFAULT_DATA; }
}

function writeDB(data) {
  try { fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8'); }
  catch (e) { console.error('[db] Failed to write data.json', e); }
}

// ------------------------------------------------
// Supabase query helper
// ------------------------------------------------
async function sbQuery(fn) {
  const { data, error } = await fn();
  if (error) throw error;
  return data;
}

// ================================================
// PUBLIC API — All methods are async
// ================================================

module.exports = {

  // --- Projects ---

  async getProjects() {
    if (USE_SUPABASE) {
      return await sbQuery(() =>
        supabase.from('projects').select('*').order('created_at', { ascending: false })
      );
    }
    return readDB().projects || [];
  },

  async getProjectById(id) {
    if (USE_SUPABASE) {
      const rows = await sbQuery(() =>
        supabase.from('projects').select('*').eq('id', id).limit(1)
      );
      return rows[0] || null;
    }
    return readDB().projects.find(p => p.id === id) || null;
  },

  async getProjectBySlug(slug) {
    if (USE_SUPABASE) {
      const rows = await sbQuery(() =>
        supabase.from('projects').select('*').eq('slug', slug).limit(1)
      );
      return rows[0] || null;
    }
    return readDB().projects.find(p => p.slug === slug) || null;
  },

  async getActiveProject() {
    if (USE_SUPABASE) {
      const rows = await sbQuery(() =>
        supabase.from('projects').select('*').eq('is_active', true).limit(1)
      );
      if (rows && rows.length > 0) return rows[0];
      const cs = await sbQuery(() =>
        supabase.from('projects').select('*').eq('status', 'Coming Soon').order('created_at').limit(1)
      );
      return cs[0] || null;
    }
    const db = readDB();
    const active = db.projects.find(p => p.is_active === true);
    if (active) return active;
    const comingSoon = db.projects.find(p => p.status === 'Coming Soon');
    if (comingSoon) return comingSoon;
    return db.projects.find(p => p.status === 'Live') || null;
  },

  async createProject(proj) {
    const id = uuidv4();
    const slug = generateSlug(proj.name);
    const now = new Date().toISOString();
    const record = {
      id,
      name: proj.name,
      slug,
      tagline: proj.tagline || '',
      launch_at: proj.launch_at,
      timezone: proj.timezone || 'Asia/Kolkata',
      project_url: proj.project_url || '',
      accent_color: proj.accent_color || '#00f3ff',
      reveal_text: proj.reveal_text || 'THE WAIT IS OVER.',
      cta_text: proj.cta_text || 'ENTER PROJECT →',
      status: proj.status || 'Coming Soon',
      logo: proj.logo || '',
      hero_image: proj.hero_image || '',
      is_active: false,
      created_at: now,
      updated_at: now
    };
    if (USE_SUPABASE) {
      const rows = await sbQuery(() => supabase.from('projects').insert(record).select());
      return rows[0];
    }
    const db = readDB();
    db.projects.push(record);
    writeDB(db);
    return record;
  },

  async updateProject(id, updates) {
    const slug = generateSlug(updates.name);
    const record = {
      name: updates.name,
      slug,
      tagline: updates.tagline || '',
      launch_at: updates.launch_at,
      timezone: updates.timezone || 'Asia/Kolkata',
      project_url: updates.project_url || '',
      accent_color: updates.accent_color || '#00f3ff',
      reveal_text: updates.reveal_text || 'THE WAIT IS OVER.',
      cta_text: updates.cta_text || 'ENTER PROJECT →',
      status: updates.status || 'Coming Soon',
      logo: updates.logo !== undefined ? updates.logo : '',
      hero_image: updates.hero_image !== undefined ? updates.hero_image : '',
      updated_at: new Date().toISOString()
    };
    if (USE_SUPABASE) {
      const rows = await sbQuery(() =>
        supabase.from('projects').update(record).eq('id', id).select()
      );
      return rows[0];
    }
    const db = readDB();
    const idx = db.projects.findIndex(p => p.id === id);
    if (idx === -1) return null;
    db.projects[idx] = { ...db.projects[idx], ...record };
    writeDB(db);
    return db.projects[idx];
  },

  async deleteProject(id) {
    if (USE_SUPABASE) {
      await sbQuery(() => supabase.from('projects').delete().eq('id', id));
      return true;
    }
    const db = readDB();
    const before = db.projects.length;
    db.projects = db.projects.filter(p => p.id !== id);
    writeDB(db);
    return db.projects.length !== before;
  },

  async setActiveProject(id) {
    if (USE_SUPABASE) {
      // First deactivate all projects
      await sbQuery(() => supabase.from('projects').update({ is_active: false }).neq('id', '__none__'));
      // Then activate the chosen one
      await sbQuery(() =>
        supabase.from('projects').update({ is_active: true, status: 'Coming Soon' }).eq('id', id)
      );
      return;
    }
    const db = readDB();
    db.projects.forEach(p => {
      if (p.id === id) {
        p.status = 'Coming Soon';
        p.is_active = true;
      } else {
        if (p.status === 'Coming Soon') p.status = 'Draft';
        p.is_active = false;
      }
    });
    writeDB(db);
  },

  // --- Site Settings ---

  async getSettings() {
    if (USE_SUPABASE) {
      try {
        const rows = await sbQuery(() =>
          supabase.from('site_settings').select('*').limit(1)
        );
        if (rows && rows.length > 0) return rows[0];
      } catch (e) { /* fall through to default */ }
    }
    return readDB().site_settings || DEFAULT_DATA.site_settings;
  },

  async updateSettings(settings) {
    const record = {
      site_name: settings.site_name,
      hero_text: settings.hero_text,
      hero_subtitle: settings.hero_subtitle,
      archive_enabled: settings.archive_enabled === 'true' || settings.archive_enabled === true,
      cursor_enabled: settings.cursor_enabled === 'true' || settings.cursor_enabled === true,
      particles_enabled: settings.particles_enabled === 'true' || settings.particles_enabled === true,
      easter_eggs_enabled: settings.easter_eggs_enabled === 'true' || settings.easter_eggs_enabled === true
    };
    if (USE_SUPABASE) {
      await sbQuery(() => supabase.from('site_settings').upsert({ id: 1, ...record }));
      return record;
    }
    const db = readDB();
    db.site_settings = { ...db.site_settings, ...record };
    writeDB(db);
    return db.site_settings;
  },

  // --- Media Storage ---

  async uploadMedia(buffer, mimeType, projectId, mediaType, extension) {
    if (USE_SUPABASE) {
      const filePath = projectId + '/' + mediaType + '/' + uuidv4() + '.' + extension;
      const { data, error } = await supabase.storage
        .from('project-media')
        .upload(filePath, buffer, { contentType: mimeType, upsert: false });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('project-media').getPublicUrl(filePath);
      return urlData.publicUrl;
    }
    // Local fallback
    const safeName = uuidv4() + '.' + extension;
    const uploadDir = path.join(__dirname, 'public', 'uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    fs.writeFileSync(path.join(uploadDir, safeName), buffer);
    return '/uploads/' + safeName;
  },

  async removeMedia(urlOrPath) {
    if (USE_SUPABASE && urlOrPath && urlOrPath.includes('supabase')) {
      try {
        const match = urlOrPath.match(/project-media\/(.+)$/);
        if (match) await supabase.storage.from('project-media').remove([match[1]]);
      } catch (e) { console.error('[db] Failed to remove Supabase media', e); }
      return;
    }
    if (urlOrPath && urlOrPath.startsWith('/uploads/')) {
      const filePath = path.join(__dirname, 'public', urlOrPath);
      try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); }
      catch (e) { console.error('[db] Failed to remove local file', e); }
    }
  },

  get isSupabaseMode() { return USE_SUPABASE; }
};
