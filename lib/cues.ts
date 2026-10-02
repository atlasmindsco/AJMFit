/**
 * What to get right, and what people get wrong.
 *
 * The exercise screen shows the USDA-style instruction list unedited — eight
 * numbered steps, written to describe a movement rather than to coach one.
 * Nobody holding a dumbbell reads that. What they want is the two or three
 * things that decide whether the set is any good, and the one mistake they are
 * probably about to make.
 *
 * Matched by movement pattern rather than by exact name, so a swapped-in
 * alternative still gets guidance: the swap engine preserves the pattern, so
 * cues written for the pattern remain true for the substitute. Specific
 * entries come first for movements whose coaching genuinely differs from their
 * family.
 */

export interface Cues {
  /** Two or three things, in the order they matter. */
  cues: string[]
  /** The mistake this movement invites. */
  mistake: string
}

interface Rule extends Cues {
  re: RegExp
}

/**
 * Most specific first. Every term carries word boundaries — the serving-unit
 * work in this codebase was a lesson in what bare substring matching does
 * ("chocolate" contains "cola"), and the same trap is here: "row" sits inside
 * "Crossover", "curl" inside "Leg Curl", "press" inside "Leg Press".
 */
const RULES: Rule[] = [
  // --- Sprints, jumps, throws: quality is the whole point -------------------
  {
    re: /\bsprint|\bacceleration|\bwall drill\b/i,
    cues: ['Walk back to the start — full recovery between efforts.', 'Tall posture, drive the ground away behind you.'],
    mistake: 'Running them tired. Once you slow down you are training something else; that is the session finished.',
  },
  {
    re: /\bbox jump|\bbound|\bhop\b|\bplyo|\bbroad jump|\bdepth jump/i,
    cues: ['Land soft, knees tracking over your toes.', 'Step down off the box. Never jump down.'],
    mistake: 'Chasing height before you can land it quietly. Noise on landing means the height is too much.',
  },
  {
    re: /\bmultiple response\b|\bchest push\b|\bmed(icine)? ball\b|\bthrow/i,
    cues: ['Every throw as hard as the first.', 'Reset fully between reps — this is a power drill, not conditioning.'],
    mistake: 'Rushing the reps together. The rest between is what keeps them explosive.',
  },
  {
    re: /\bcarioca|\bagility|\bquick step\b/i,
    cues: ['Stay on the balls of your feet.', 'Hips facing forward, feet doing the work.'],
    mistake: 'Turning the hips to keep up. Slow it down until the hips stay square.',
  },

  // --- Hinge ---------------------------------------------------------------
  {
    re: /\bromanian deadlift\b|\bstiff.?legged\b|\brdl\b/i,
    cues: ['Push your hips back, not down.', 'Soft knees, bar close to your legs the whole way.', 'Stop when your hamstrings run out, not when the bar reaches the floor.'],
    mistake: 'Turning it into a squat. If your knees are bending much, your hips are not going back enough.',
  },
  {
    re: /\bdeadlift\b/i,
    cues: ['Take the slack out of the bar before you pull.', 'Chest up, back flat, push the floor away.', 'Hips and shoulders rise together.'],
    mistake: 'Hips shooting up first, which turns it into a back lift. If that happens, the weight is too heavy.',
  },
  {
    re: /\bglute.?ham\b|\bgood morning\b/i,
    cues: ['Hinge at the hip, spine stays long.', 'Squeeze your glutes to come back up.'],
    mistake: 'Rounding the lower back to get further. Range you cannot control is not range.',
  },
  {
    re: /\bhip thrust\b|\bbutt lift\b|\bbridge\b/i,
    cues: ['Tuck your chin and ribs down before you drive.', 'Finish by squeezing the glutes, not by arching your back.', 'Shins vertical at the top.'],
    mistake: 'Hyperextending the lower back at the top. The lockout should be felt in the glutes, nowhere else.',
  },

  // --- Squat and single leg ------------------------------------------------
  {
    re: /\bsplit squat\b|\bbulgarian\b|\brear lunge\b|\blunge/i,
    cues: ['Most of the weight through the front heel.', 'Back knee down towards the floor, not forward.', 'Torso tall throughout.'],
    mistake: 'Pushing off the back foot. The front leg should do the work.',
  },
  {
    re: /\bstep.?ups?\b/i,
    cues: ['Drive through the heel of the top foot.', 'Lower under control — do not drop off the step.'],
    mistake: 'Pushing off the trailing foot to get up. If you need it, the box is too high.',
  },
  {
    re: /\bleg press\b/i,
    cues: ['Feet flat, knees tracking over your toes.', 'Stop before your lower back lifts off the pad.'],
    mistake: 'Going so deep the pelvis tucks under. That is where backs get hurt on this machine.',
  },
  {
    re: /\bsquat\b/i,
    cues: ['Brace your stomach before you come down.', 'Knees track over your toes, heels stay planted.', 'Depth you can control with a flat back.'],
    mistake: 'Knees caving in on the way up. Think about pushing the floor apart with your feet.',
  },

  // --- Horizontal press ----------------------------------------------------
  {
    re: /\bincline\b.*\b(press|bench)\b|\b(press|bench)\b.*\bincline\b/i,
    cues: ['Shoulder blades pinned back and down.', 'Lower to the upper chest, just below the collarbone.', 'Elbows about 45 degrees from your body.'],
    mistake: 'Setting the bench too steep, which turns it into a shoulder press.',
  },
  {
    re: /\bbench press\b|\bdumbbell bench\b|\bpush.?up\b/i,
    cues: ['Shoulder blades pinned back and down.', 'Elbows about 45 degrees from your body, not flared wide.', 'Touch the chest under control, then drive.'],
    mistake: 'Flaring the elbows straight out. It feels stronger and it is how shoulders get wrecked.',
  },
  {
    re: /\b(dumbbell )?fly(e)?s?\b|\bcrossover\b|\bpullover\b/i,
    cues: ['Soft bend in the elbows, held throughout.', 'Wide arc, stretch across the chest.', 'Light weight — this is not a press.'],
    mistake: 'Bending the arms to lift more, which makes it a press with a worse leverage.',
  },

  // --- Vertical press ------------------------------------------------------
  {
    re: /\bmilitary press\b|\bshoulder press\b|\boverhead press\b|\barnold\b/i,
    cues: ['Squeeze your glutes and brace — no leaning back.', 'Press up and slightly back, finishing over your ears.', 'Full lockout at the top.'],
    mistake: 'Arching the lower back to get the weight up. If it happens, the weight is too heavy.',
  },

  // --- Pull ----------------------------------------------------------------
  {
    re: /\bpull.?up|\bchin.?up|\blat pulldown\b|\bpulldown\b/i,
    cues: ['Start from a full hang, shoulders active.', 'Pull your elbows down towards your ribs.', 'Chest to the bar, not chin over it.'],
    mistake: 'Kicking and swinging to finish reps. Stop the set when the swinging starts.',
  },
  {
    re: /\binverted row\b/i,
    cues: ['Body in one straight line, heels to shoulders.', 'Pull your chest to the bar, squeeze at the top.'],
    mistake: 'Letting the hips sag. Squeeze your glutes to keep the line.',
  },
  {
    re: /\brows?\b/i,
    cues: ['Flat back, hinged forward, braced.', 'Pull to the bottom of your ribs, elbows back.', 'Squeeze the shoulder blade at the top.'],
    mistake: 'Standing up as you pull, which hands the work to your lower back.',
  },
  {
    re: /\bface pull\b|\brear delt\b/i,
    cues: ['Pull towards your forehead, elbows high.', 'Finish with your hands wide and thumbs back.', 'Light weight, slow and deliberate.'],
    mistake: 'Going too heavy and turning it into a row. This one is for the small muscles.',
  },
  {
    re: /\bshrug\b/i,
    cues: ['Straight up and down, no rolling.', 'Pause for a second at the top.'],
    mistake: 'Rolling the shoulders backwards, which does nothing useful and irritates the joint.',
  },

  // --- Arms ----------------------------------------------------------------
  // Leg curls before arm curls. A negative lookahead was tried first and is
  // the wrong tool: in "Seated Leg Curl" the word "leg" sits BEFORE "curl",
  // so a lookahead placed after "curl" sees nothing and the arm rule wins.
  // Ordering says what is meant without the cleverness.
  {
    re: /\bleg curls?\b/i,
    cues: ['Hips stay down on the pad.', 'Squeeze at the top, lower slowly.'],
    mistake: 'Lifting the hips to finish the rep, which takes the hamstrings out of it.',
  },
  {
    re: /\bcurls?\b/i,
    cues: ['Elbows pinned to your sides.', 'Control the way down — that is where the growth is.'],
    mistake: 'Swinging the hips to start the rep. If you need the swing, drop the weight.',
  },
  {
    re: /\btricep|\bpushdown\b|\bdips?\b|\bskull/i,
    cues: ['Upper arms still, only the forearms move.', 'Full lockout, then a controlled stretch.'],
    mistake: 'Letting the elbows drift forward, which lets the shoulders take over.',
  },

  // --- Legs, isolation -----------------------------------------------------
  {
    re: /\bcalf raises?\b|\bcalf\b/i,
    cues: ['Full stretch at the bottom, full squeeze at the top.', 'Pause for a second at each end.'],
    mistake: 'Bouncing. The tendon does the work and the muscle gets nothing.',
  },
  {
    re: /\blateral raise\b|\bside lateral\b/i,
    cues: ['Lead with the elbows, not the hands.', 'Stop at shoulder height.', 'Lighter than you think.'],
    mistake: 'Heaving the weight up with the body. Shoulders respond to control, not load.',
  },

  // --- Core ----------------------------------------------------------------
  {
    re: /\bplank\b/i,
    cues: ['Straight line from heels to head.', 'Squeeze your glutes and tuck your ribs down.'],
    mistake: 'Letting the hips sag or pike up. When the line goes, the set is over.',
  },
  {
    re: /\bdead bug\b/i,
    cues: ['Lower back stays flat on the floor.', 'Move slowly, breathe out as you extend.'],
    mistake: 'Arching the lower back as the leg lowers. Shorten the range until it stays flat.',
  },
  {
    re: /\brussian twist\b|\bwood chop\b/i,
    cues: ['Rotate from the ribs, not the arms.', 'Hips stay facing forward.'],
    mistake: 'Swinging the weight side to side with straight arms, which trains nothing.',
  },

  // --- Steady state --------------------------------------------------------
  {
    re: /\browing\b|\bstationary\b/i,
    cues: ['Legs, then back, then arms. Reverse on the way in.', 'Drive with the legs — they do most of the work.'],
    mistake: 'Pulling with the arms first. The handle should move because your legs pushed.',
  },
  {
    re: /\bwalking\b|\btreadmill\b|\brun\b|\bjog\b/i,
    cues: ['Easy enough to hold a conversation.', 'Land under your hips, short quick steps.'],
    mistake: 'Going too hard on an easy day, which costs you the session that was meant to be hard.',
  },
]

/** The cues for a movement, or null when nothing sensible applies. */
export function cuesFor(exerciseName: string): Cues | null {
  const name = String(exerciseName ?? '')
  for (const rule of RULES) {
    if (rule.re.test(name)) return { cues: rule.cues, mistake: rule.mistake }
  }
  return null
}
