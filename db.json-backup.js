const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.join(__dirname, 'data.json');

// Helper to generate slug from name
function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

// Default Data Schema
const DEFAULT_DATA = {
  projects: [
    {
      id: "sample-nova",
      name: "PROJECT NOVA",
      slug: "project-nova",
      tagline: "Something new is coming.",
      launch_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5).toISOString().slice(0, 16), // 5 days from now
      timezone: "Asia/Kolkata",
      project_url: "https://example.com/project-nova-obvious-placeholder",
      accent_color: "#00f3ff",
      reveal_text: "THE WAIT IS OVER.",
      cta_text: "ENTER PROJECT →",
      status: "Coming Soon",
      logo: "",
      hero_image: "",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ],
  site_settings: {
    site_name: "NOVA // DROP",
    hero_text: "SOMETHING BIG IS COMING.",
    hero_subtitle: "You weren't supposed to find this yet.",
    archive_enabled: true,
    cursor_enabled: true,
    particles_enabled: true,
    easter_eggs_enabled: true
  }
};

function readDB() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      writeDB(DEFAULT_DATA);
      return DEFAULT_DATA;
    }
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error("Error reading JSON database, falling back to defaults", err);
    return DEFAULT_DATA;
  }
}

function writeDB(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error("Error writing to JSON database", err);
  }
}

module.exports = {
  // Projects Operations
  getProjects() {
    const db = readDB();
    return db.projects || [];
  },

  getProjectById(id) {
    const db = readDB();
    return db.projects.find(p => p.id === id);
  },

  getProjectBySlug(slug) {
    const db = readDB();
    return db.projects.find(p => p.slug === slug);
  },

  getActiveProject() {
    const db = readDB();
    // Return first project with status 'Coming Soon' or 'Live'
    // Coming Soon takes priority for upcoming drop display
    const comingSoon = db.projects.find(p => p.status === 'Coming Soon');
    if (comingSoon) return comingSoon;
    return db.projects.find(p => p.status === 'Live');
  },

  createProject(proj) {
    const db = readDB();
    const newProj = {
      id: uuidv4(),
      name: proj.name,
      slug: generateSlug(proj.name),
      tagline: proj.tagline || "",
      launch_at: proj.launch_at,
      timezone: proj.timezone || "UTC",
      project_url: proj.project_url || "",
      accent_color: proj.accent_color || "#00f3ff",
      reveal_text: proj.reveal_text || "THE WAIT IS OVER.",
      cta_text: proj.cta_text || "ENTER PROJECT →",
      status: proj.status || "Coming Soon",
      logo: proj.logo || "",
      hero_image: proj.hero_image || "",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    db.projects.push(newProj);
    writeDB(db);
    return newProj;
  },

  updateProject(id, updates) {
    const db = readDB();
    const index = db.projects.findIndex(p => p.id === id);
    if (index === -1) return null;

    db.projects[index] = {
      ...db.projects[index],
      name: updates.name,
      slug: generateSlug(updates.name),
      tagline: updates.tagline || "",
      launch_at: updates.launch_at,
      timezone: updates.timezone || "UTC",
      project_url: updates.project_url || "",
      accent_color: updates.accent_color || "#00f3ff",
      reveal_text: updates.reveal_text || "THE WAIT IS OVER.",
      cta_text: updates.cta_text || "ENTER PROJECT →",
      status: updates.status || "Coming Soon",
      logo: updates.logo || "",
      hero_image: updates.hero_image || "",
      updated_at: new Date().toISOString()
    };

    writeDB(db);
    return db.projects[index];
  },

  deleteProject(id) {
    const db = readDB();
    const filtered = db.projects.filter(p => p.id !== id);
    const affected = db.projects.length !== filtered.length;
    db.projects = filtered;
    writeDB(db);
    return affected;
  },

  setActiveProject(id) {
    const db = readDB();
    db.projects.forEach(p => {
      if (p.id === id) {
        p.status = 'Coming Soon';
      } else if (p.status === 'Coming Soon') {
        p.status = 'Draft';
      }
    });
    writeDB(db);
  },

  reorderProjects(orderedIds) {
    const db = readDB();
    const newOrder = [];
    orderedIds.forEach(id => {
      const p = db.projects.find(proj => proj.id === id);
      if (p) newOrder.push(p);
    });
    // Add any missing ones at the end
    db.projects.forEach(p => {
      if (!newOrder.some(o => o.id === p.id)) newOrder.push(p);
    });
    db.projects = newOrder;
    writeDB(db);
  },

  // Site Settings Operations
  getSettings() {
    const db = readDB();
    return db.site_settings || DEFAULT_DATA.site_settings;
  },

  updateSettings(settings) {
    const db = readDB();
    db.site_settings = {
      ...db.site_settings,
      site_name: settings.site_name,
      hero_text: settings.hero_text,
      hero_subtitle: settings.hero_subtitle,
      archive_enabled: settings.archive_enabled === 'true' || settings.archive_enabled === true,
      cursor_enabled: settings.cursor_enabled === 'true' || settings.cursor_enabled === true,
      particles_enabled: settings.particles_enabled === 'true' || settings.particles_enabled === true,
      easter_eggs_enabled: settings.easter_eggs_enabled === 'true' || settings.easter_eggs_enabled === true
    };
    writeDB(db);
    return db.site_settings;
  }
};
