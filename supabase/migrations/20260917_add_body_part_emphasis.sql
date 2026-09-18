-- Add body-part emphasis to users for customization
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS body_part_emphasis VARCHAR(20);

-- Valid emphasis options stored as reference
-- Options: none, legs, glutes, chest, back, shoulders, arms, upper_body, lower_body

-- Create check constraint to ensure valid values
ALTER TABLE public.users ADD CONSTRAINT valid_emphasis CHECK (
  body_part_emphasis IS NULL OR
  body_part_emphasis IN (
    'none',
    'legs',
    'glutes',
    'chest',
    'back',
    'shoulders',
    'arms',
    'upper_body',
    'lower_body'
  )
);

-- Index for queries filtering by emphasis
CREATE INDEX IF NOT EXISTS idx_users_emphasis ON public.users(body_part_emphasis);
