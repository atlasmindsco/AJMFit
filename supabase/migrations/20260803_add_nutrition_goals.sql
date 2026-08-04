-- Add nutrition goal tracking fields to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS nutrition_goal_setup_complete BOOLEAN DEFAULT FALSE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS current_weight DECIMAL(6, 2); -- in pounds
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS goal_weight DECIMAL(6, 2); -- in pounds
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS height DECIMAL(5, 2); -- in inches
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS age INTEGER;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS sex VARCHAR(10); -- 'male', 'female', 'other'
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS activity_level VARCHAR(20); -- 'sedentary', 'light', 'moderate', 'very_active', 'extremely_active'
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS nutrition_goal VARCHAR(30); -- 'lose_fat', 'build_muscle', 'body_recomposition', 'maintain'
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_weight_update TIMESTAMP WITH TIME ZONE;

-- Coach override fields (NULL = use calculated values)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS custom_cal_target DECIMAL(6, 2);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS custom_protein_target DECIMAL(6, 2);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS custom_carb_target DECIMAL(6, 2);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS custom_fat_target DECIMAL(6, 2);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_users_nutrition_setup ON public.users(nutrition_goal_setup_complete);
