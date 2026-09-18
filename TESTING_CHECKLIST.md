# AJM Fit Testing Checklist - Sprint Complete

## Overview
This checklist covers all features deployed in this sprint. Each section includes the expected behavior and how to verify it works.

---

## 🟢 Feature 1: 5-Day Split Choice

**What Changed:** Users selecting 5 days/week now see TWO split options instead of being forced into one.

### Test Steps:
1. Navigate to `/studio/programs` as Blueprint user with no assigned program
2. Click through picker: Goal → Location → Days
3. Select "5" days
4. **VERIFY:** See step "Choose Split" with two options:
   - Upper/Lower/PPL (balanced)
   - Bodybuilding Split (higher volume)
5. Select "Bodybuilding Split"
6. Continue through emphasis picker
7. **VERIFY:** Program loads (should be 5day_bro based program)

### Evidence:
- `components/studio/BlueprintPicker.tsx`: Lines 27-28 show `splitChoice` state
- `app/api/studio/blueprint/assign/route.ts`: Lines 31-40 handle split choice resolution
- `lib/blueprint.ts`: Lines 33-38 show `SPLIT_CHOICE_TO_KEY` mapping

---

## 🟢 Feature 2: Body-Part Emphasis

**What Changed:** After picking a program, users see optional emphasis selection (legs, glutes, chest, back, shoulders, arms, upper/lower, balanced).

### Test Steps:
1. Complete program picker (any goal/location/days)
2. **VERIFY:** See EmphasisPicker component with 9 options
3. Select "Glutes" emphasis
4. **VERIFY:** See confirmation showing "Glutes" emphasis selected
5. Click "Continue"
6. **VERIFY:** Preference is saved (check browser dev tools Network tab for POST to `/api/studio/blueprint/set-emphasis`)
7. **VERIFY:** Can skip and use no emphasis (default)

### Evidence:
- `components/studio/EmphasisPicker.tsx`: Defines all 9 emphasis options
- `app/api/studio/blueprint/set-emphasis/route.ts`: Saves emphasis to database
- `supabase/migrations/20260917_add_body_part_emphasis.sql`: Database schema

---

## 🟢 Feature 3: 2-Day Program Support

**What Changed:** Blueprint picker now shows 2 days as an option (previously only 3-6).

### Test Steps:
1. Navigate to `/studio/programs` as Blueprint user
2. Go through picker and reach "How many days?" step
3. **VERIFY:** See 5 buttons: 2, 3, 4, 5, 6
4. Select "2" days
5. **VERIFY:** See split recommendation: "Full Body (2-day)"
6. Continue and complete setup
7. **VERIFY:** Program loads with 2-day structure

### Evidence:
- `components/studio/BlueprintPicker.tsx`: Line 34 shows `dayChoices = [2, 3, 4, 5, 6]`
- `lib/blueprint.ts`: Lines 31-36 include 2-day mapping
- Grid changed from `grid-cols-4` to `grid-cols-5` to fit 5 buttons

---

## 🟢 Feature 4: Height Input - Feet + Inches

**What Changed:** Height input now shows separate feet and inches fields instead of single inches field.

### Test Steps:
1. Navigate to `/studio/setup-nutrition` (or start fresh nutrition setup)
2. **VERIFY:** Height field shows two inputs labeled "Feet" and "Inches"
3. Enter 6 feet, 2 inches
4. **VERIFY:** Review screen shows correct total (74 inches used for calculation)
5. Check calculated calories - should use 74" in BMR calculation
6. Complete setup
7. **VERIFY:** Dashboard shows nutrition targets calculated correctly

### Evidence:
- `app/studio/setup-nutrition/page.tsx`: Lines 34-35 show `heightFeet` and `heightInches` state
- Form rendering: Lines 149-175 show split input fields
- Calculation: Line 141 shows `feet * 12 + heightInches` conversion

---

## 🟢 Feature 5: Nutrition Editing

**What Changed:** Users can now edit their nutrition setup without re-entering from scratch.

### Test Steps:
1. Complete nutrition setup with values: weight 180, goal weight 170, height 6'0"
2. Navigate to nutrition page
3. **VERIFY:** See "Edit" button next to "Today's Nutrition" title
4. Click Edit button
5. **VERIFY:** Redirected to `/studio/setup-nutrition?edit=true`
6. **VERIFY:** Form pre-fills with current values (180, 170, 6'0")
7. Change weight to 175
8. Click "Update & Continue"
9. **VERIFY:** Returns to nutrition page
10. **VERIFY:** Targets updated based on new weight

### Evidence:
- `app/api/nutrition/get-setup/route.ts`: New endpoint that fetches current setup
- `app/studio/nutrition/page.tsx`: Lines 354-363 show Edit button
- `app/studio/setup-nutrition/page.tsx`: Lines 1-36 handle edit mode with loading and pre-filling

---

## 🟢 Feature 6: Nutrition Persistence Safeguards

**What Changed:** Nutrition goals now have localStorage backup and smart fallback if database save fails.

### Test Steps:
1. Open browser DevTools → Application → LocalStorage
2. Set up nutrition goals (e.g., 2200 calories)
3. **VERIFY:** `ajmfit_nutrition_setup` entry appears in localStorage with:
   - `setup` object with your values
   - `calculated` object with targets
   - `savedAt` timestamp
4. Navigate to different pages
5. Return to nutrition page
6. **VERIFY:** Targets still show 2200 (not default 2000)
7. Check Network tab for any errors in nutrition/setup API call
8. **VERIFY:** Even if save fails, localStorage fallback loads within 24 hours

### Evidence:
- `app/studio/setup-nutrition/page.tsx`: Lines 61-68 save to localStorage
- `lib/nutrition.ts`: Lines 80-104 show fetchTargets with localStorage fallback logic
- `app/api/nutrition/setup/route.ts`: Lines 1-100 show detailed logging for diagnostics

---

## 🟢 Feature 7: Training Experience Routing (Beginner Simplification)

**What Changed:** New users (0 years experience) see a simplified 2-step picker instead of 4-step full picker.

### Test Steps:
1. Create new user who indicates "New to training" in onboarding
2. Navigate to `/studio/programs` without assigned program
3. **VERIFY:** See "BeginnerPicker" (green/emerald theme, says "Welcome to training")
4. **VERIFY:** Only 2 steps:
   - Step 1: Where to train? (gym/home only)
   - Step 2: How often? (3 or 4 days only)
5. **VERIFY:** No goal selection (defaults to muscle building)
6. Complete and verify program loads

### Alternative Test (Experienced User):
1. Create user with 5+ years experience
2. Navigate to `/studio/programs`
3. **VERIFY:** See "BlueprintPicker" (blue theme, full 4-step flow with goal selection)

### Evidence:
- `components/studio/BeginnerPicker.tsx`: Simplified picker component
- `app/studio/programs/page.tsx`: Lines 391-398 detect experience level and show appropriate picker
- `lib/onboarding.ts`: Experience data pulled from onboarding answers

---

## 🟠 Feature 8: Nutrition Persistence - Diagnostics

**What Changed:** Detailed logging added to help diagnose why nutrition saves fail (if they do).

### Test Steps - For Diagnostics Only:
1. Check server logs when nutrition setup is saved
2. **VERIFY:** See logs like:
   ```
   [nutrition/setup] auth user: <UUID>
   [nutrition/setup] setup: { height: 72, weight: 180, goal: "maintain" }
   [nutrition/setup] calculated: { calories: 2168, protein: 180 }
   [nutrition/setup] found user row: <user-id>
   [nutrition/setup] update successful: { daily_cal_target: 2168 }
   ```
3. If save fails, logs will show:
   ```
   [nutrition/setup] select error: <error details>
   [nutrition/setup] no user row found for auth_id: <auth-id>
   ```

### Evidence:
- `app/api/nutrition/setup/route.ts`: Lines 26-86 show extensive logging at each step

---

## 📋 Complete Test Scenario (Happy Path)

### Scenario: New User Complete Flow

```
1. Sign up
   └─ Navigate to programs
   
2. See BeginnerPicker (because experience: 'new')
   └─ Select: Gym, 3 days
   
3. See EmphasisPicker
   └─ Select: Legs emphasis
   
4. Program loads (3-day full body)
   
5. Click "Edit" on nutrition
   └─ See setup form with pre-filled values from onboarding
   
6. Adjust height to 5'11" (5 feet, 11 inches)
   └─ See calculated targets update
   
7. Save nutrition
   └─ See confirmation and return to nutrition page
   
8. Targets show correctly (e.g., 2150 cal, 175g protein)
   └─ localStorage backup verified in DevTools
```

---

## ✅ Quick Verification Checklist

Use this to quickly verify all features work:

- [ ] 5-day picker shows split choice (ULPPL vs Bodybuilding)
- [ ] Body-part emphasis shows 9 options
- [ ] 2-day option appears in days picker (grid shows 5 buttons)
- [ ] Height input has separate feet and inches fields
- [ ] Edit button appears on nutrition page
- [ ] Edit mode pre-fills current values
- [ ] Beginner users (0 years experience) see BeginnerPicker (2 steps)
- [ ] Experienced users see BlueprintPicker (4 steps)
- [ ] localStorage has nutrition backup with `ajmfit_nutrition_setup`
- [ ] Review screen shows "Update & Continue" when editing (not "Confirm & Continue")

---

## 🔍 Code Inspection for Verification

If UI testing isn't possible, verify by code:

```bash
# Verify 5-day split choice
grep -n "splitChoice" components/studio/BlueprintPicker.tsx

# Verify emphasis feature
grep -n "body_part_emphasis" supabase/migrations/20260917_*.sql

# Verify 2-day support
grep -n "dayChoices = \[2" components/studio/BlueprintPicker.tsx

# Verify height split
grep -n "heightFeet\|heightInches" app/studio/setup-nutrition/page.tsx

# Verify edit nutrition
grep -n "edit=true" app/studio/setup-nutrition/page.tsx

# Verify beginner routing
grep -n "BeginnerPicker" app/studio/programs/page.tsx

# Verify localStorage backup
grep -n "ajmfit_nutrition_setup" app/studio/setup-nutrition/page.tsx
```

---

## 📊 Data to Verify in Database

After testing, check these tables:

```sql
-- Check emphasis was saved
SELECT body_part_emphasis FROM users WHERE id = '<user-id>';

-- Check nutrition setup was saved
SELECT nutrition_goal_setup_complete, custom_cal_target, height FROM users WHERE id = '<user-id>';

-- Check program assignment was created
SELECT program_id, notes FROM program_assignments WHERE user_id = '<user-id>' ORDER BY created_at DESC LIMIT 1;
```

---

## 🎯 Success Criteria

All features are working if:

1. ✅ Blueprint users can pick 5-day split (ULPPL or Bodybuilding)
2. ✅ All users can set body-part emphasis (9 options)
3. ✅ 2-day and 3-6 day options all appear in picker
4. ✅ Height input accepts feet and inches
5. ✅ Users can edit nutrition setup anytime
6. ✅ Nutrition goals persist across page refreshes
7. ✅ Beginner users see simplified flow (2 steps)
8. ✅ Experienced users see full picker (4 steps)
9. ✅ localStorage backup exists for nutrition
10. ✅ No console errors during normal flows

---

## 🚨 Known Limitations / Deferred Work

- Volume adjustment by emphasis: Not yet implemented (users can manually swap exercises)
- Dedicated 2-day programs: Currently uses 3-day structure (works, but not optimized)
- Periodization blocks: Not yet implemented (full-time feature, complex)
- Emphasis visual effect on program: Shows emphasis is saved, but doesn't modify exercises yet

---

**Last Updated:** 2026-09-17
**Status:** Ready for Testing
**All 7 Features Deployed and Ready**
