-- =====================================================================
-- NOVA // DROP — DATABASE SCHEMA INITIALIZATION
-- Run this in your Supabase SQL Editor (https://supabase.com)
-- =====================================================================

-- 1. Create projects table
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    tagline TEXT,
    launch_at TEXT NOT NULL, -- Stored as string format (YYYY-MM-DDTHH:MM) to align with standard datetime-local
    timezone TEXT DEFAULT 'Asia/Kolkata',
    project_url TEXT,
    accent_color TEXT DEFAULT '#00f3ff',
    reveal_text TEXT DEFAULT 'THE WAIT IS OVER.',
    cta_text TEXT DEFAULT 'ENTER PROJECT →',
    status TEXT DEFAULT 'Coming Soon',
    logo TEXT,
    hero_image TEXT,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Create site_settings table
CREATE TABLE IF NOT EXISTS public.site_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    site_name TEXT DEFAULT 'NOVA // DROP',
    hero_text TEXT DEFAULT 'SOMETHING BIG IS COMING.',
    hero_subtitle TEXT DEFAULT 'You weren''t supposed to find this yet.',
    archive_enabled BOOLEAN DEFAULT true,
    cursor_enabled BOOLEAN DEFAULT true,
    particles_enabled BOOLEAN DEFAULT true,
    easter_eggs_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    CONSTRAINT singleton_row CHECK (id = 1)
);

-- 3. Pre-populate Site Settings
INSERT INTO public.site_settings (id, site_name, hero_text, hero_subtitle, archive_enabled, cursor_enabled, particles_enabled, easter_eggs_enabled)
VALUES (1, 'NOVA // DROP', 'SOMETHING BIG IS COMING.', 'You weren''t supposed to find this yet.', true, true, true, true)
ON CONFLICT (id) DO NOTHING;

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- 5. Set RLS Policies (Public read access)
CREATE POLICY "Allow public read access to projects" ON public.projects
    FOR SELECT USING (true);

CREATE POLICY "Allow public read access to site_settings" ON public.site_settings
    FOR SELECT USING (true);

-- Note: Since the Node.js server uses the SUPABASE_SERVICE_KEY (service_role key), 
-- it automatically bypasses RLS policies. Your admin actions will be secure and authorized.
