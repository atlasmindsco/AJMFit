-- Add exercise video demonstrations table
CREATE TABLE IF NOT EXISTS public.exercise_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_name VARCHAR(255) NOT NULL UNIQUE,
  video_url TEXT,
  video_source VARCHAR(50), -- 'exercisedb', 'youtube', 'custom'
  thumbnail_url TEXT,
  instructions TEXT[], -- array of form cues
  difficulty VARCHAR(20), -- 'beginner', 'intermediate', 'advanced'
  primary_muscle VARCHAR(100),
  secondary_muscles TEXT[],
  equipment VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast exercise lookups
CREATE INDEX IF NOT EXISTS idx_exercise_videos_name ON public.exercise_videos(exercise_name);

-- Update existing exercises with video references (can be done separately)
ALTER TABLE public.workouts ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE public.workouts ADD COLUMN IF NOT EXISTS demo_source VARCHAR(50);
