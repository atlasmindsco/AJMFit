# AJM Fit Nutrition Goals System

Complete nutrition goal calculation and macro targeting system using the Mifflin-St Jeor equation.

## System Overview

The nutrition system automatically calculates personalized calorie and macro targets based on each user's:
- Current weight
- Goal weight
- Height, age, sex
- Activity level
- Fitness goal (lose fat, build muscle, body recomposition, maintain)

## Key Features

### 1. Automatic Setup Flow
- Triggered when user accesses nutrition dashboard without completing setup
- Collects all necessary biometric data
- Calculates targets using Mifflin-St Jeor equation
- Shows calculated targets for user confirmation
- Stores setup data for future reference

### 2. Smart Macro Calculations

#### Mifflin-St Jeor BMR Calculation
```
Men: (10 × weight_kg) + (6.25 × height_cm) − (5 × age) + 5
Women: (10 × weight_kg) + (6.25 × height_cm) − (5 × age) − 161
Other: Average of male and female
```

#### Maintenance Calories (TDEE)
BMR × Activity Level Multiplier
- Sedentary: 1.2
- Light (1-3 days/week): 1.375
- Moderate (3-5 days/week): 1.55
- Very Active (6-7 days/week): 1.725
- Extremely Active (2x/day): 1.9

#### Daily Calorie Target by Goal
- **Lose Fat**: Maintenance - 20% deficit
- **Build Muscle**: Maintenance + 10% surplus
- **Body Recomposition**: Maintenance (0% change)
- **Maintain**: Maintenance

#### Protein Target (based on GOAL weight)
- Lose Fat: 1.0g per pound
- Build Muscle: 0.9-1.0g per pound
- Body Recomposition: 1.0g per pound
- Maintain: 0.8g per pound

#### Fat Target
27.5% of total daily calories (middle of 25-30% range)
- Fat = 9 calories/gram

#### Carb Target
Remaining calories after protein and fat
- Carbs = 4 calories/gram
- Carbs = (Total Calories - (Protein × 4) - (Fat × 9)) / 4

### 3. User Settings
Users can update their goals at any time via `/studio/nutrition/settings`:
- Current weight
- Goal weight
- Height
- Age
- Sex
- Activity level
- Fitness goal

When any value changes, targets automatically recalculate.
Custom coach overrides are cleared when user updates settings.

### 4. Coach Overrides
Trainers can manually set custom calorie and macro targets:
- Access via `CoachNutritionOverride` component
- Override individual targets (calories, protein, carbs, fats)
- Clear overrides to revert to calculated values
- User updates settings clears all overrides

## Database Schema

Added to `users` table:
```sql
-- Setup tracking
nutrition_goal_setup_complete BOOLEAN
current_weight DECIMAL(6,2)
goal_weight DECIMAL(6,2)
height DECIMAL(5,2)
age INTEGER
sex VARCHAR(10)
activity_level VARCHAR(20)
nutrition_goal VARCHAR(30)
last_weight_update TIMESTAMP

-- Coach overrides (NULL = use calculated values)
custom_cal_target DECIMAL(6,2)
custom_protein_target DECIMAL(6,2)
custom_carb_target DECIMAL(6,2)
custom_fat_target DECIMAL(6,2)
```

## File Structure

### Calculation Engine
- `lib/nutrition-goals.ts` - All calculations and validation
  - `calculateBMR()` - Mifflin-St Jeor equation
  - `calculateMaintenanceCalories()` - TDEE with activity multiplier
  - `calculateDailyCalories()` - Goal-based calorie adjustment
  - `calculateProteinTarget()` - Goal weight based protein
  - `calculateFatTarget()` - 27.5% of calories
  - `calculateCarbTarget()` - Remaining calories
  - `calculateNutritionTargets()` - All calculations together
  - `validateSetup()` - Input validation
  - Helper functions for display labels

### API Endpoints
- `app/api/nutrition/setup/route.ts` - Save initial nutrition setup
- `app/api/nutrition/update/route.ts` - Update user settings (recalculates, clears overrides)
- `app/api/nutrition/override/route.ts` - Coach set/clear custom targets

### Pages
- `app/studio/setup-nutrition/page.tsx` - Initial setup flow (form + review)
- `app/studio/nutrition/page.tsx` - Main nutrition dashboard (checks setup complete)

### Components
- `components/studio/NutritionSettings.tsx` - User settings modal
- `components/studio/CoachNutritionOverride.tsx` - Coach override controls

### Database
- `supabase/migrations/20260803_add_nutrition_goals.sql` - Schema migration

### Updated Libraries
- `lib/nutrition.ts` - Added `fetchNutritionSetup()`, updated `fetchTargets()` to consider overrides

## Flow Diagrams

### User First Login
```
1. Select Workout Program
2. Redirect to /studio/setup-nutrition
3. Fill form (weight, height, age, sex, activity, goal)
4. Review calculated targets
5. Save → Updates users table, redirects to /studio/nutrition
6. Nutrition page loads with user's personalized targets
```

### Update Settings
```
1. User clicks "Settings" on nutrition page
2. NutritionSettings modal opens
3. Edit any field → shows recalculated targets
4. Save → /api/nutrition/update
5. Clears all coach overrides
6. Returns to dashboard with new targets
```

### Coach Override
```
1. View client details (trainer only)
2. Click "Set Custom Targets" on nutrition section
3. CoachNutritionOverride component opens
4. Set custom calories, protein, carbs, fats
5. POST /api/nutrition/override with userId and targets
6. Targets saved with indicator showing override active
7. User sees custom targets instead of calculated ones
8. Clear button reverts to calculated values
```

## Extensibility

The system is designed to be modular. To add new features:

### Add a New Fitness Goal
1. Add to `FitnessGoal` type in `nutrition-goals.ts`
2. Add calorie adjustment logic in `calculateDailyCalories()`
3. Add macro strategy in `calculateProteinTarget()`
4. Add label in `getGoalLabel()`
5. Update setup form options

### Add a New Activity Level
1. Add to `ActivityLevel` type
2. Add multiplier to `ACTIVITY_MULTIPLIERS`
3. Add label in `getActivityLevelLabel()`
4. Update form options

### Change Macro Percentages
All macro calculations are in `nutrition-goals.ts`:
- Fat percentage: Adjust multiplier in `calculateFatTarget()` (currently 0.275)
- Protein: Adjust grams per pound in `calculateProteinTarget()`
- Carbs: Automatically fills remaining calories

## Testing Checklist

- [ ] Run migration to add columns to users table
- [ ] New user without setup: redirects to /studio/setup-nutrition
- [ ] Fill setup form → shows correct calculated targets
- [ ] Save setup → redirects to /studio/nutrition with targets loaded
- [ ] Update settings → targets recalculate
- [ ] Coach override works (trainer role required)
- [ ] Clear override → reverts to calculated values
- [ ] User settings update → clears all overrides
- [ ] Macro totals equal daily calories (with ~10 cal rounding tolerance)
- [ ] Food logging updates remaining macros correctly

## Example Calculation

User: Male, 210 lbs → 185 lbs, 72", 28yo, Very Active, Lose Fat

```
BMR = (10 × 95.3kg) + (6.25 × 182.9cm) - (5 × 28) + 5
    = 953 + 1143 - 140 + 5
    = 1961 cal

Maintenance = 1961 × 1.725 = 3383 cal

Daily Target = 3383 - (3383 × 0.20) = 2706 cal

Protein = 185 lbs × 1.0 = 185g
Fat = 2706 × 0.275 / 9 = 82.5g ≈ 83g
Carbs = (2706 - 740 - 747) / 4 = 305g

Verification: (185×4) + (305×4) + (83×9) = 740 + 1220 + 747 = 2707 ✓
```

## Notes

- All calculations use pounds for weight (matches US UI)
- Height in inches (US standard)
- All weights rounded to nearest gram/calorie for display
- Macros verified to equal daily calories within rounding tolerance
- System automatically handles leap years for age calculation if needed
- Progress tracking: `last_weight_update` timestamp for 2-week prompts
