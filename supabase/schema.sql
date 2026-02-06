-- Supabase SQL Schema for AiM Documentary Studio
-- Run this in Supabase SQL Editor to create the projects table

CREATE TABLE IF NOT EXISTS projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  series_name TEXT,
  episode_number INTEGER,
  target_duration_minutes INTEGER DEFAULT 30,
  target_format TEXT DEFAULT 'documentary',
  current_phase TEXT DEFAULT 'research',
  progress INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  template_id TEXT,
  locked_by UUID,
  locked_by_avatar TEXT,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view own projects or projects in their team
CREATE POLICY "Users can view own projects" ON projects
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create projects" ON projects
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own projects" ON projects
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own projects" ON projects
  FOR DELETE USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_series_name ON projects(series_name);
CREATE INDEX IF NOT EXISTS idx_projects_locked_by ON projects(locked_by);
