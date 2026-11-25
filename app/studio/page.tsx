'use client'

/**
 * Home answers one question: what am I doing today?
 *
 * It used to answer eight. At its fullest it carried a greeting, three
 * attention cards, a five-item setup checklist, today's session, four stat
 * tiles, a weekly calorie chart, a list of personal records, upcoming calls
 * and a macro breakdown — eleven things competing for the first five seconds,
 * with the one people opened the app for sitting fourth.
 *
 * Nothing was deleted in the clear-out. Every card that came off exists on
 * the screen it belongs to: calories and macros on Food, calls on Schedule,
 * personal records on Train beside the workout history. What is left here is
 * the session, how the week is going, and at most one thing that genuinely
 * needs attention.
 */
import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import OnboardingChecklist from '@/components/studio/OnboardingChecklist'
import PlanPanel from '@/components/studio/PlanPanel'
import BillingPanel from '@/components/studio/BillingPanel'
import { isCoached, TIER_EXPERIENCE } from '@/lib/tiers'
import AttentionStack from '@/components/studio/AttentionStack'
import InstallHint from '@/components/studio/InstallHint'
import { topAttention } from '@/lib/attention'
import { fetchMyBlock, blockProgressDaysLeft } from '@/lib/programs'
import { fetchCheckInForWeek, replyOverdueHours, weekOf } from '@/lib/check-ins'
import type { Tier } from '@/lib/stripe/catalog'
import { fadeIn } from '@/lib/animations'
import { getCurrentUserId } from '@/lib/current-user'
import { createClient } from '@/lib/supabase/client'
import { todayShape, weeklyTarget, weekLine } from '@/lib/today'
import { bestLift, liftLine } from '@/lib/progress-lines'
import { fetchPRs, fetchWorkoutsThisWeek, fetchWorkoutHistory, fetchWeekStreak, fetchTrainedDays, fetchLiftHistory, type PRRow } from '@/lib/workout'
import { loadAssignedProgram, type PlanDay } from '@/lib/blueprint'
import { rotationState } from '@/lib/rotation'
import { fetchMyProgram, type Program } from '@/lib/programs'
import { fetchMyTier } from '@/lib/scheduling'
import { fetchMyOnboarding } from '@/lib/onboarding'
import { fetchBodyMetrics, daysSinceLastPhoto } from '@/lib/body-metrics'
import { fetchNutritionSetup } from '@/lib/nutrition'
import { hasBookedOnboarding } from '@/lib/scheduling'

export default function ClientDashboard() {
  const [firstName, setFirstName] = useState('')
  const [loading, setLoading] = useState(true)
  const [workoutsThisWeek, setWorkoutsThisWeek] = useState(0)
  /**
   * Kept only to decide whether a record is worth mentioning in the attention
   * card. The list of records itself lives on Train now, beside the workout
   * history, which is where somebody goes when they wonder what they have
   * lifted — a different question from "what am I doing today".
   */
  const [prs, setPrs] = useState<PRRow[]>([])
  /**
   * One sentence about a lift that really moved, or null.
   *
   * Null for most clients most of the time and that is correct: it needs a
   * loaded movement with four sessions behind it that actually went up. Two
   * of the six clients on the platform qualify today. An empty slot is better
   * than a padded one.
   */
  /**
   * Sent here by the checkout link because they already subscribe.
   *
   * /api/stripe/checkout-blueprint used to create a second Stripe customer
   * and a second live subscription for anybody who clicked it twice. It now
   * declines and lands them here, and this says why — a silent redirect to a
   * screen they did not ask for reads as the payment failing, which is the
   * thing that made people pay again in the first place.
   */
  const alreadySubscribed = useSearchParams().get('already') === '1'

  const [lift, setLift] = useState<string | null>(null)
  const [myProgram, setMyProgram] = useState<Program | null>(null)
  /** The session to offer, and where it sits in the program. */
  const [today, setToday] = useState<{ index: number; day: PlanDay } | null>(null)
  const [needsOnboarding, setNeedsOnboarding] = useState(false)
  const [tier, setTier] = useState<string | null>(null)
  // Whether this client has ever logged a workout. Defaults to true so the
  // first-run nudge never flashes at an established client while data loads.
  const [hasEverTrained, setHasEverTrained] = useState(true)
  const [weekStreak, setWeekStreak] = useState(0)
  const [checkInDone, setCheckInDone] = useState(false)
  // The block, for 'your block ends in N days' and for whether they have ever
  // said which days they train. The only input the homepage did not already
  // have — everything else the stack needs was being fetched already.
  const [blockDaysLeft, setBlockDaysLeft] = useState<number | null>(null)
  /**
   * Which weekdays they train, 0 = Sunday, or null if never answered.
   *
   * Newly useful: it is what lets the screen say "rest day" instead of
   * offering the next session every day of the week, which quietly implies
   * you are behind whenever you are not training.
   */
  const [trainingDays, setTrainingDays] = useState<number[] | null>(null)
  // Hours past the reply this client's tier promised, so the app can say so
  // before they work it out from the silence.
  const [replyLateHours, setReplyLateHours] = useState<number | null>(null)
  // undefined means "not looked up yet", which keeps the photo card silent
  // rather than offering it on a guess.
  const [photoAgeDays, setPhotoAgeDays] = useState<number | null | undefined>(undefined)
  const [lastWorkoutDate, setLastWorkoutDate] = useState<string | null>(null)
  const [myUserId, setMyUserId] = useState<string | null>(null)
  const [setupState, setSetupState] = useState({ intakeDone: false, startingStatsDone: false, nutritionDone: false, welcomeCallBooked: false, programAssigned: false })

  useEffect(() => {
    let active = true
    ;(async () => {
      const id = await getCurrentUserId()
      setMyUserId(id)
      if (!id) {
        if (active) setLoading(false)
        return
      }
      try {
        // Booked calls are no longer read here — they live on Schedule, which
        // is also where you book them. One fewer query on the screen clients
        // open most often.
        const [workouts, prRows, program, onboarding, myTier, history, streak, metrics, nutri, welcomeBooked, thisWeekCheckIn, myBlock, photoAge] =
          await Promise.all([
            fetchWorkoutsThisWeek(id),
            fetchPRs(id),
            fetchMyProgram(id),
            fetchMyOnboarding(id),
            fetchMyTier(id),
            fetchWorkoutHistory(id, 1),
            fetchWeekStreak(id),
            fetchBodyMetrics(id, 5).catch(() => []),
            fetchNutritionSetup(id).catch(() => null),
            hasBookedOnboarding(id).catch(() => false),
            fetchCheckInForWeek(id, weekOf()).catch(() => null),
            fetchMyBlock(id).catch(() => null),
            daysSinceLastPhoto(id).catch(() => undefined),
          ])
        if (!active) return
        setPhotoAgeDays(photoAge)
        // Deliberately outside the batch above. It reads every set this
        // client has ever logged, and nothing on this screen should wait on
        // a progress sentence — the session card is what they opened the app
        // for. It arrives when it arrives.
        void (async () => {
          const history = await fetchLiftHistory(id).catch(() => ({}))
          if (active) setLift(liftLine(bestLift(history)))
        })()
        // Needs the tier, which only resolves inside this call, so it runs
        // after the batch rather than inside it.
        void (async () => {
          const hrs = TIER_EXPERIENCE[myTier as Tier]?.responseHours ?? null
          const over = await replyOverdueHours(id, hrs).catch(() => null)
          if (active) setReplyLateHours(over)
        })()
        setWorkoutsThisWeek(workouts)
        setPrs(prRows)
        setMyProgram(program)
        setNeedsOnboarding(!onboarding)
        setTier(myTier)
        setHasEverTrained(history.length > 0)
        setWeekStreak(streak)
        setCheckInDone(!!thisWeekCheckIn)
        setBlockDaysLeft(blockProgressDaysLeft(myBlock))
        setTrainingDays(myBlock?.training_days ?? null)
        setLastWorkoutDate(history[0]?.date ?? null)
        setSetupState({
          intakeDone: !!onboarding,
          startingStatsDone: (metrics ?? []).some((m) => m.weight_lb != null),
          nutritionDone: !!nutri?.nutrition_goal_setup_complete,
          welcomeCallBooked: !!welcomeBooked,
          programAssigned: !!program,
        })

        // Which session is actually next.
        //
        // The card used to show the PROGRAM name and a generic "Start
        // Training" link into the program browser — so the one question a
        // client opens the app to ask, "what am I doing today", was the one
        // thing the home screen would not answer.
        if (program) {
          try {
            const [loaded, trained] = await Promise.all([
              loadAssignedProgram(program.id),
              fetchTrainedDays(id),
            ])
            if (!active || !loaded) return
            const state = rotationState(
              loaded.weeklyPlan.map((d) => d.name),
              loaded.weeklyPlan.map((d) => d.exercises.length > 0),
              trained
            )
            const day = state.todayIndex >= 0 ? loaded.weeklyPlan[state.todayIndex] : null
            if (day) setToday({ index: state.todayIndex, day })
          } catch (err) {
            console.error('[Dashboard] Could not work out today’s session:', err)
          }
        }
      } catch (err) {
        console.error('[Dashboard] Failed to load:', err)
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user || !active) return
      const { data: u } = await supabase
        .from('users')
        .select('name')
        .eq('auth_id', data.user.id)
        .maybeSingle<{ name: string | null }>()
      if (active && u?.name) setFirstName(u.name.trim().split(/\s+/)[0])
    })
    return () => {
      active = false
    }
  }, [])

  const recentPRs = [...prs].sort((a, b) => +new Date(b.set_at) - +new Date(a.set_at)).slice(0, 5)
  const shape = todayShape(trainingDays)
  const week = weekLine(workoutsThisWeek, weeklyTarget(trainingDays, myProgram?.days_per_week ?? null))

  return (
    <div className="max-w-2xl mx-auto">
      {/* Greeting. The streak sits here rather than in a stat row because it
          is status, not a metric — and it carries the marketing hero's outline
          numerals into the studio, which is the one piece of the brand that
          previously stopped at the login screen. */}
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-white tracking-tight">
            {firstName ? `Hey, ${firstName}` : 'Hey'}
          </h1>
          {!loading && week && <p className="text-ink-3 text-sm font-body mt-1">{week}</p>}
        </div>
        {!loading && weekStreak > 0 && (
          <div className="shrink-0 text-right">
            <span className="font-display font-extrabold text-4xl sm:text-5xl leading-none text-outline-light tabular-nums">
              {weekStreak}
            </span>
            <p className="text-brand-orange text-2xs font-display font-bold uppercase tracking-[0.18em] mt-1">
              {weekStreak === 1 ? 'Week streak' : 'Weeks straight'}
            </p>
          </div>
        )}
      </div>

      {/* Why the rest timer cannot reach a locked iPhone, and the one thing
          that fixes it. Renders nothing for anyone already installed, anyone
          who has dismissed it, and every desktop — which is almost everyone,
          almost always. Above the attention stack because it is about the
          device rather than about them, and it goes away for good on a tap. */}
      <InstallHint />

      {/* Anything worth knowing before they start.
          Above Today's Training because it is context for the session, and
          never about the session itself — that card is directly below and is
          better than anything this could say about it. Renders nothing at all
          when there is nothing to say, which for half the active clients is
          the honest answer, and then the start button moves back up.

          One card, not three. Three things that all need attention is a list
          of chores above the thing they came to do, and the stack is already
          ranked — so the second and third were, by its own reckoning, less
          important than the session underneath them. */}
      {!loading && (
        <AttentionStack
          cards={topAttention(
            {
            coached: isCoached(tier as Tier),
            // Not loaded on this screen yet, so the card simply never fires.
            // Better an absent card than one driven by a guess.
            unreadFromCoach: 0,
            checkInDoneThisWeek: isCoached(tier as Tier) ? checkInDone : null,
            hasProgram: !!myProgram,
            blockDaysLeft,
            daysSinceLastWorkout: lastWorkoutDate
              ? Math.floor((Date.now() - new Date(`${lastWorkoutDate}T00:00:00`).getTime()) / 86400000)
              : null,
            trainingDaysSet: trainingDays != null,
            lastPr: recentPRs[0]
              ? {
                  exercise: recentPRs[0].exercise_name,
                  weight: Number(recentPRs[0].weight),
                  reps: Number(recentPRs[0].reps),
                  daysAgo: Math.floor((Date.now() - new Date(recentPRs[0].set_at).getTime()) / 86400000),
                }
              : null,
            // A week of logged food is needed and this screen holds one day.
            replyOverdueHours: replyLateHours,
            daysSinceLastPhoto: photoAgeDays,
            proteinRatio: null,
            recommendation: null,
            },
            1
          )}
        />
      )}

      {/* The session. This is the screen.
          It used to sit fourth, below calories, records and calls, and name
          the program rather than the day. It is now the only thing competing
          for attention, which is the whole point of the page. */}
      <motion.div custom={0} variants={fadeIn} initial="hidden" animate="visible" className="mb-5 bg-surface-raised rounded-card border border-white/[0.10] p-6">
        {loading ? (
          <p className="text-ink-4 text-sm font-body py-6 text-center">Loading…</p>
        ) : today && shape.rest ? (
          /* A rest day is a planned part of the week, not an absence.
             Offering the next session every single day quietly implies you
             are behind whenever you are not training — so when they have told
             us which days they train, the screen says so plainly and gets out
             of the way. Training anyway stays one tap away and is phrased as
             a choice, never as catching up. */
          <>
            <p className="text-ink-3 text-2xs font-display font-bold uppercase tracking-[0.18em]">
              Rest day
            </p>
            <p className="font-display font-extrabold text-2xl text-white mt-2 leading-tight">
              Nothing scheduled
            </p>
            <p className="text-ink-2 text-sm font-body mt-2 leading-relaxed">
              {shape.nextLabel
                ? `Next session ${shape.nextLabel} — ${today.day.name}.`
                : `Next session is ${today.day.name}.`}
            </p>
            <Link
              href={`/studio/programs?day=${today.index}`}
              className="inline-block mt-5 text-ink-3 hover:text-white text-sm font-body transition-colors duration-200"
            >
              Train anyway →
            </Link>
          </>
        ) : today ? (
          <>
            <p className="text-ink-3 text-2xs font-display font-bold uppercase tracking-[0.18em]">
              Today
            </p>
            <p className="font-display font-extrabold text-3xl text-white mt-1.5 leading-tight">
              {today.day.name}
            </p>
            <p className="text-ink-2 text-sm font-body mt-1.5">
              {today.day.muscles}
              {today.day.exercises.length > 0 && (
                <span className="text-ink-3">
                  {' · '}
                  {today.day.exercises.length} exercises
                  {today.day.duration ? ` · ${today.day.duration}` : ''}
                </span>
              )}
            </p>

            {/* The first few lifts. Enough to know whether to bring chalk,
                read without opening anything. */}
            <div className="space-y-1.5 mt-5 mb-6">
              {today.day.exercises.slice(0, 3).map((ex) => (
                <div key={ex.name} className="flex items-baseline gap-2 text-sm font-body">
                  <span className="text-ink-2 truncate">{ex.name}</span>
                  <span className="text-ink-4 text-xs ml-auto shrink-0 tabular-nums">
                    {ex.sets} × {ex.reps}
                  </span>
                </div>
              ))}
              {today.day.exercises.length > 3 && (
                <p className="text-ink-4 text-xs font-body">
                  + {today.day.exercises.length - 3} more
                </p>
              )}
            </div>

            <Link
              href={`/studio/programs?day=${today.index}`}
              className="block w-full text-center py-4 bg-brand-blue text-white text-base font-display font-bold uppercase tracking-[0.1em] rounded-control hover:bg-brand-bluedark active:scale-[0.98] transition-transform duration-200"
            >
              Start Workout
            </Link>
          </>
        ) : myProgram ? (
          <>
            <p className="font-display font-extrabold text-lg text-white mt-2 leading-tight">{myProgram.name}</p>
            <Link
              href="/studio/programs"
              className="block w-full text-center mt-4 py-3 bg-brand-blue text-white text-sm font-display font-bold uppercase tracking-[0.1em] rounded-control hover:bg-brand-bluedark active:scale-[0.98] transition-transform duration-200"
            >
              Start Training
            </Link>
          </>
        ) : tier === 'blueprint' ? (
          <>
            <p className="text-ink-2 text-sm font-body mt-1 mb-4">
              Pick your program: goal, days per week, gym or home. Ready in seconds.
            </p>
            <Link
              href="/studio/programs"
              className="block w-full text-center py-3 bg-brand-blue text-white text-sm font-display font-bold uppercase tracking-[0.1em] rounded-control hover:bg-brand-bluedark active:scale-[0.98] transition-transform duration-200"
            >
              Pick Your Program
            </Link>
          </>
        ) : (
          <>
            <p className="text-ink-2 text-sm font-body mt-1 mb-4">
              Coach Anthony hasn&rsquo;t assigned your program yet. Browse the exercise library in the meantime.
            </p>
            <Link
              href="/studio/programs"
              className="block w-full text-center py-3 bg-white/[0.06] text-white text-sm font-display font-bold uppercase tracking-[0.1em] rounded-control hover:bg-white/[0.10] active:scale-[0.98] transition-transform duration-200"
            >
              Browse Exercises
            </Link>
          </>
        )}
      </motion.div>

      {alreadySubscribed && (
        <div className="mb-5 px-5 py-4 rounded-card bg-state-success/[0.08] border border-state-success/25">
          <p className="font-display font-bold text-sm text-white">You&rsquo;re already subscribed</p>
          <p className="text-ink-2 text-xs font-body mt-1 leading-relaxed">
            No need to pay again &mdash; your membership is active and everything below is yours. If something
            looks wrong, message Anthony on the Coach tab rather than signing up a second time.
          </p>
        </div>
      )}

      {/* One line about a lift that moved.
          Not a chart and not a Progress tab. A chart invites study; this is
          read on the way past. It needs a LOADED movement with four sessions
          behind it that genuinely went up, which is why it is usually absent
          — the unfiltered version of this feature wanted to congratulate a
          client on gaining 145 lbs at the Inverted Row, which is a row you do
          hanging under a bar. See lib/progress-lines.ts.
          The week streak is not repeated here: it is already in the greeting
          at the top of this screen. */}
      {!loading && lift && (
        <p className="mb-5 px-5 py-3.5 rounded-card bg-white/[0.03] border border-white/[0.08] text-ink-2 text-sm font-body">
          {lift}
        </p>
      )}

      {/* My Plan. The third question this screen answers.
          Today says what to do now and the card above says what is next; this
          is "where is my training plan", and until the Train tab came off the
          bar it was the only one of the three with a destination of its own.
          It goes to exactly where that tab went — /studio/programs, same six
          views, same back behaviour — so nothing was moved, only renamed to
          what a client would call it.
          Only shown once there IS a plan. Without one the card above is
          already a Pick Your Program button, and two of those is a choice
          about nothing. */}
      {!loading && myProgram && (
        <Link
          href="/studio/programs"
          className="group flex items-center justify-between gap-4 mb-5 px-5 py-4 rounded-card bg-surface-raised border border-white/[0.10] hover:border-white/[0.18] transition-colors duration-200"
        >
          <div className="min-w-0">
            <p className="font-display font-bold text-sm text-white">My Plan</p>
            <p className="text-ink-3 text-xs font-body mt-0.5 truncate">{myProgram.name}</p>
          </div>
          <span className="shrink-0 text-ink-3 group-hover:text-white text-lg leading-none transition-colors duration-200" aria-hidden="true">
            &rsaquo;
          </span>
        </Link>
      )}

      {!loading && myUserId && <BillingPanel userId={myUserId} />}

      {!loading && isCoached(tier as Tier) && (
        <PlanPanel tier={tier as Tier} checkInDone={checkInDone} />
      )}

      {/* Coached tiers get a setup checklist. One of its steps is the coach
          assigning a program, which the client cannot do — without saying so,
          someone who has finished their half is left on an empty dashboard. */}
      {!loading && tier !== null && tier !== 'blueprint' && (
        <OnboardingChecklist state={setupState} />
      )}

      {/* Blueprint is self-serve: no onboarding form, no call. Point them
          straight at the program picker until they've chosen one. */}
      {!loading && tier === 'blueprint' && !myProgram && (
        <Link
          href="/studio/programs"
          className="group flex items-center justify-between gap-4 mb-6 px-5 py-4 rounded-card bg-brand-blue/10 border border-brand-blue/25 hover:bg-brand-blue/15 transition-colors duration-200"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-control bg-brand-blue/15 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-brand-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="font-display font-bold text-sm text-white">Pick your training program</p>
              <p className="text-ink-3 text-xs font-body mt-0.5">Choose your goal, days per week, and gym or home. Your program is ready in seconds.</p>
            </div>
          </div>
          <span className="shrink-0 text-brand-blue font-display font-bold text-xs uppercase tracking-[0.12em] group-hover:translate-x-0.5 transition-transform">
            Choose →
          </span>
        </Link>
      )}

      {/* First-run nudge. A client who has a program but has never logged a
          session lands on a dashboard of zeros with nothing telling them what
          to do — which is where most of the ones who never started got stuck. */}
      {!loading && myProgram && !hasEverTrained && (
        <Link
          href="/studio/programs"
          className="group flex items-center justify-between gap-4 mb-6 px-5 py-4 rounded-card bg-brand-orange/10 border border-brand-orange/30 hover:bg-brand-orange/15 transition-colors duration-200"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-control bg-brand-orange/15 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-brand-orange" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12h12M6 9v6m12-6v6M3.75 10.5v3m16.5-3v3" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="font-display font-bold text-sm text-white">Start your first workout</p>
              <p className="text-ink-3 text-xs font-body mt-0.5">
                Your program is ready. Open it, pick today&rsquo;s session, and log your first set — that&rsquo;s the whole thing.
              </p>
            </div>
          </div>
          <span className="shrink-0 text-brand-orange font-display font-bold text-xs uppercase tracking-[0.12em] group-hover:translate-x-0.5 transition-transform">
            Start →
          </span>
        </Link>
      )}

      {/* Onboarding nudge (coaching tiers only): shown until the pre-call form
          is filled. Blueprint skips onboarding entirely. */}
      {!loading && needsOnboarding && tier !== 'blueprint' && (
        <Link
          href="/studio/onboarding"
          className="group flex items-center justify-between gap-4 mb-6 px-5 py-4 rounded-card bg-brand-orange/10 border border-brand-orange/25 hover:bg-brand-orange/15 transition-colors duration-200"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-control bg-brand-orange/15 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-brand-orange" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 12 3 3m0 0 3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="font-display font-bold text-sm text-white">Fill out your onboarding form</p>
              <p className="text-ink-3 text-xs font-body mt-0.5">Coach Anthony uses it to build your plan and prep your onboarding call. About 3 minutes.</p>
            </div>
          </div>
          <span className="shrink-0 text-brand-orange font-display font-bold text-xs uppercase tracking-[0.12em] group-hover:translate-x-0.5 transition-transform">
            Start →
          </span>
        </Link>
      )}

    </div>
  )
}
