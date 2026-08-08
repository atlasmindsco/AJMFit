# 🚀 EXECUTE MIGRATION NOW

## Copy This SQL Exactly

```sql
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS nutrition_goal_setup_complete BOOLEAN DEFAULT FALSE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS current_weight DECIMAL(6, 2);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS goal_weight DECIMAL(6, 2);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS height DECIMAL(5, 2);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS age INTEGER;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS sex VARCHAR(10);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS activity_level VARCHAR(20);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS nutrition_goal VARCHAR(30);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_weight_update TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS custom_cal_target DECIMAL(6, 2);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS custom_protein_target DECIMAL(6, 2);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS custom_carb_target DECIMAL(6, 2);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS custom_fat_target DECIMAL(6, 2);
CREATE INDEX IF NOT EXISTS idx_users_nutrition_setup ON public.users(nutrition_goal_setup_complete);
```

---

## Steps to Execute

### Option 1: Supabase Dashboard (Easiest)

1. **Open Supabase**
   - Go to: https://app.supabase.com
   - Select: AJM Fit project

2. **Go to SQL Editor**
   - Click: **SQL Editor** (left sidebar)
   - Click: **New Query**

3. **Paste the SQL above**
   - Clear any existing text
   - Paste ALL the SQL from above
   - (It's 14 lines of ALTER TABLE and CREATE INDEX)

4. **Run the Migration**
   - Click: **Run** button (or press Cmd+Enter / Ctrl+Enter)
   - Wait for response

5. **Verify Success**
   - Should see: "No errors" or similar success message
   - Number of rows affected: 0 (columns already there or just added)

### Option 2: Supabase CLI (If Docker Running)

```bash
cd path/to/AJMFit
supabase migration up
```

### Option 3: Direct psql (If You Have DB Access)

```bash
psql -U postgres -h your-host -d your-db < supabase/migrations/20260803_add_nutrition_goals.sql
```

---

## ✅ Verify It Worked

After running the SQL:

### In Supabase Dashboard:
1. Go to: **Database** (left sidebar)
2. Click: **Tables** 
3. Select: **users**
4. Scroll RIGHT to see new columns
5. Look for:
   - ✅ nutrition_goal_setup_complete
   - ✅ current_weight
   - ✅ goal_weight
   - ✅ height
   - ✅ age
   - ✅ sex
   - ✅ activity_level
   - ✅ nutrition_goal
   - ✅ last_weight_update
   - ✅ custom_cal_target
   - ✅ custom_protein_target
   - ✅ custom_carb_target
   - ✅ custom_fat_target

If you see all 13 new columns: ✅ **MIGRATION SUCCESSFUL**

---

## 🎉 Then You're Done!

Once migration is applied:

1. **Production is fully live**
2. **Test at**: https://ajmfit.com/studio/nutrition
3. **Users can immediately**:
   - Access setup page
   - Complete nutrition setup
   - Calculate personalized targets
   - Start logging food

---

## Quick Reference

| What | Where |
|------|-------|
| Supabase Dashboard | https://app.supabase.com |
| SQL Editor | Dashboard → SQL Editor (left sidebar) |
| Tables View | Dashboard → Database → Tables → users |
| Migration File | `supabase/migrations/20260803_add_nutrition_goals.sql` |
| Production Site | https://ajmfit.com |

---

## If You're Stuck

**Migration failed?**
- Copy the SQL exactly (no extra spaces)
- Make sure you're in the right project
- Check error message - usually it's a syntax issue
- Can safely re-run (uses `IF NOT EXISTS`)

**Can't find SQL Editor?**
- Log in to Supabase first
- Click your project name
- Look for "SQL Editor" in left sidebar

**Not sure if it worked?**
- Go to Database → Tables → users
- Scroll right
- Look for the new columns
- If you see them: ✅ Success!

---

## Status: READY TO EXECUTE

**SQL**: Ready to copy/paste ✅  
**Production Code**: Deployed ✅  
**What's blocking**: Just need to run the SQL ⏳  
**Time needed**: 2 minutes  

**Go do it!** 🚀
