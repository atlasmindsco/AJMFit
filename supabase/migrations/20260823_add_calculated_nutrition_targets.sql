-- Add calculated nutrition target columns to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS daily_cal_target DECIMAL(6, 2);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS protein_target DECIMAL(6, 2);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS carb_target DECIMAL(6, 2);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS fat_target DECIMAL(6, 2);

-- Create index for nutrition queries
CREATE INDEX IF NOT EXISTS idx_users_nutrition_targets ON public.users(daily_cal_target);
