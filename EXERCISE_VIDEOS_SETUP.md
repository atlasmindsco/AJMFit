# 🎬 Exercise Video Demonstrations Setup

Complete system for adding workout demonstration videos without recording them yourself.

## What's Included

### ✅ Automatic Video Fetching
- **ExerciseDB Integration**: Automatically fetches exercise videos via API
- **YouTube Support**: Manually add YouTube links for any exercise
- **Smart Caching**: Videos cached in database to avoid repeated API calls
- **Fallback System**: Shows instructions when video unavailable

### ✅ Database Schema
- `exercise_videos` table stores video URLs, instructions, muscle groups
- Caches videos to speed up subsequent loads
- Tracks video source (ExerciseDB, YouTube, Custom)

### ✅ Components Built
- `ExerciseVideoDemo.tsx` - Video player component
- `exercise-videos.ts` - Service for fetching/managing videos
- `/api/exercises/videos` - Endpoints for CRUD operations

---

## How It Works

### 1. Automatic (ExerciseDB)
User views an exercise → System checks database cache → If not cached, fetches from ExerciseDB API → Shows video with form instructions

### 2. Manual (YouTube)
Coach adds YouTube link for exercise → Saved to database → Next time exercise viewed, shows YouTube video instead

### 3. User Experience
```
Exercise: "Barbell Bench Press"
     ↓
Video Component Loads
     ↓
Check: Is it in our database cache?
     ├─ YES → Show cached video
     └─ NO → Fetch from ExerciseDB → Show → Cache it
```

---

## Quick Start - Add to Programs Page

### Step 1: Import the Component
```typescript
import ExerciseVideoDemo from '@/components/exercises/ExerciseVideoDemo'
```

### Step 2: Add to Exercise Display
```typescript
// In your exercise display (around line 500+ in programs/page.tsx)
<ExerciseVideoDemo 
  exerciseName={exercise.name}
  compact={false}
  showInstructions={true}
/>
```

### Step 3: Apply Migration
```bash
npm run db:migrate
# Or manually run: supabase/migrations/20260804_add_exercise_videos.sql
```

Done! Videos will load automatically.

---

## Usage Examples

### Full Video Demo (with instructions)
```tsx
<ExerciseVideoDemo 
  exerciseName="Barbell Bench Press"
  compact={false}
  showInstructions={true}
/>
```

### Compact Preview (minimal space)
```tsx
<ExerciseVideoDemo 
  exerciseName="Squat"
  compact={true}
/>
```

### Without Instructions
```tsx
<ExerciseVideoDemo 
  exerciseName="Deadlift"
  showInstructions={false}
/>
```

---

## Adding YouTube Links (Coach Only)

### Via API (Programmatically)
```typescript
// In coach management panel
await fetch('/api/exercises/videos', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    exerciseName: "Barbell Squat",
    youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    // Optional custom thumbnail
    thumbnail: "https://..."
  })
})
```

### Direct Database
```sql
-- Add YouTube video for exercise
INSERT INTO exercise_videos (exercise_name, video_url, video_source, thumbnail_url)
VALUES (
  'Barbell Squat',
  'https://www.youtube.com/embed/dQw4w9WgXcQ',
  'youtube',
  'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg'
)
ON CONFLICT (exercise_name) DO UPDATE SET
  video_url = EXCLUDED.video_url,
  video_source = EXCLUDED.video_source,
  updated_at = NOW();
```

---

## Video Sources (Priority Order)

### 1. YouTube (Manual Coach Upload)
✅ High quality  
✅ Full control  
❌ Requires manual setup  

### 2. ExerciseDB (Automatic)
✅ Automatic for 1000+ exercises  
✅ Zero setup  
⚠️ Varies in quality  

### 3. Custom (Future)
For proprietary exercises or special content

---

## Available Endpoints

### GET: Fetch Exercise Video
```
GET /api/exercises/videos?name=Barbell Squat
Response: { video: ExerciseVideo }
```

### POST: Save YouTube Link (Trainer Only)
```
POST /api/exercises/videos
Body: {
  exerciseName: "Barbell Squat",
  youtubeUrl: "https://youtube.com/watch?v=...",
  thumbnail: "https://..." (optional)
}
```

### DELETE: Clear Cache (Trainer Only)
```
DELETE /api/exercises/videos?name=Barbell Squat
```

---

## Video Component Props

```typescript
interface ExerciseVideoDemoProps {
  exerciseName: string       // Required: exercise name to lookup
  compact?: boolean          // Optional: show compact version (no instructions)
  showInstructions?: boolean // Optional: show form tips
}
```

---

## Video Display Examples

### Full Version (Default)
```
┌─────────────────────────────┐
│  [Video Player/GIF]         │  Video: 264px height
├─────────────────────────────┤
│ Target: Chest               │
│ Equipment: Barbell          │ Info section
│ Difficulty: Intermediate    │
├─────────────────────────────┤
│ Form Tips:                  │
│ • Keep elbows tucked        │ Instructions
│ • Pause at bottom           │
│ • Full range of motion      │
├─────────────────────────────┤
│ 📺 ExerciseDB      [Open ↗] │ Source badge
└─────────────────────────────┘
```

### Compact Version
```
┌──────────────────┐
│  [Video]         │  Video: 128px height
└──────────────────┘
```

---

## How ExerciseDB Integration Works

### Automatic Lookup
When user views exercise, the system:

1. **Checks database cache** for exercise video
2. **If found**: Shows cached video immediately
3. **If not found**: 
   - Calls ExerciseDB API with exercise name
   - Receives video URL + instructions
   - Caches result in database
   - Shows video to user

### Next Load
Same exercise loads from cache (instant)

### API Key
Uses existing `RAPIDAPI_KEY` from `.env.local`

---

## Common Exercises (Auto-Supported)

ExerciseDB supports 1000+ exercises including:
- ✅ All major compound lifts (Bench, Squat, Deadlift, etc.)
- ✅ All dumbbell exercises
- ✅ All machine exercises
- ✅ Bodyweight exercises
- ✅ Cardio exercises
- ✅ Stretches and mobility

---

## Troubleshooting

### Video Not Loading
1. Check exercise name spelling (case-insensitive, but exact name)
2. Verify RAPIDAPI_KEY in `.env.local`
3. Check database migration applied
4. Try adding YouTube link manually as fallback

### Poor Quality from ExerciseDB
- Add YouTube link via coach panel (override with higher quality)
- YouTube videos are always higher quality

### Slow Loading
- First load may be slow (API call + cache)
- Subsequent loads instant (cached)
- If slow consistently, check API rate limits

---

## Next Steps

1. ✅ Apply migration: `supabase/migrations/20260804_add_exercise_videos.sql`
2. ✅ Import component into programs page
3. ✅ Add `<ExerciseVideoDemo exerciseName={exercise.name} />` where exercises display
4. ✅ Test with a sample exercise
5. ✅ Add YouTube links for your favorite exercises (optional)

---

## File Structure

```
lib/exercise-videos.ts           → Video service (fetch/cache)
components/exercises/
  └─ ExerciseVideoDemo.tsx       → Video player component
app/api/exercises/videos/
  └─ route.ts                    → API endpoints
supabase/migrations/
  └─ 20260804_add_exercise_videos.sql → Database schema
```

---

## Example Integration (In Programs Page)

Around line 500 in `app/studio/programs/page.tsx`, in the exercise detail view:

```typescript
// Add this import at top
import ExerciseVideoDemo from '@/components/exercises/ExerciseVideoDemo'

// Add this in the exercise detail modal/view:
<div className="space-y-4">
  <h3 className="text-lg font-semibold">{selectedExercise.name}</h3>
  
  {/* ADD THIS: Video Demo */}
  <ExerciseVideoDemo 
    exerciseName={selectedExercise.name}
    showInstructions={true}
  />
  
  {/* Rest of exercise details */}
  <div>
    {selectedExercise.sets} x {selectedExercise.reps}
  </div>
</div>
```

---

**Status**: Ready to deploy  
**Setup Time**: 5 minutes  
**Effort**: Minimal - mostly automatic  

🎬 Your workout demo system is ready!
