'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion, AnimatePresence } from 'framer-motion'
import Button from '@/components/ui/Button'

// ---- Schema ----

const step1Schema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Valid email required'),
  phone: z.string().min(7, 'Valid phone number required'),
})

const step2Schema = z.object({
  goals: z.string().min(10, 'Tell us a bit more about your goals'),
  equipment: z.array(z.string()).min(1, 'Select at least one'),
  healthLimitations: z.string().optional(),
})

const step3Schema = z.object({
  availability: z.string().min(5, 'Share your availability'),
  tier: z.enum(['blueprint', 'accelerator', 'full-experience'], {
    required_error: 'Select a tier',
  }),
  billingCycle: z.enum(['monthly', 'weekly']),
  referral: z.string().optional(),
})

const fullSchema = step1Schema.merge(step2Schema).merge(step3Schema)
type FormData = z.infer<typeof fullSchema>

const schemas = [step1Schema, step2Schema, step3Schema] as const

// ---- Constants ----

const equipmentOptions = [
  { value: 'gym', label: 'Gym' },
  { value: 'dumbbells', label: 'Dumbbells' },
]

const tierOptions = [
  {
    value: 'blueprint',
    label: 'The Blueprint',
    monthlyPrice: 19.97,
    monthlyOnly: true,
    tagline: 'Self-guided. Full app access.',
    features: [
      'Full studio app, workouts, nutrition, programs library',
      'Photo food recognition + macro tracking',
      'Workout logging + PR tracking',
      'Chea AI assistant',
      'Community access',
      'M-F messaging access',
    ],
  },
  {
    value: 'accelerator',
    label: 'The Accelerator',
    monthlyPrice: 397,
    tagline: 'For those ready to level up.',
    featured: true,
    features: [
      'Everything in The Blueprint',
      'Custom 3-4 day/week workout plan',
      'New plan every 30 days (3 phases)',
      'Weekly 30-45 min video check-in',
      'Form feedback via video review',
      'Priority response M-F',
    ],
  },
  {
    value: 'full-experience',
    label: 'The Full Experience',
    monthlyPrice: 697,
    tagline: 'Maximum output. Zero guesswork.',
    features: [
      'Everything in The Accelerator',
      '2x live 45-min virtual training sessions/week',
      'Real-time coaching & intensity',
      'Live form correction every session',
    ],
  },
]


// ---- Styles ----

const inputBase =
  'w-full px-5 py-4 bg-brand-offwhite border border-brand-navy/10 rounded-sm text-brand-navy font-body text-sm placeholder:text-brand-slate/50 focus:border-brand-blue/50 focus:outline-none transition-colors duration-200'
const labelBase = 'block font-display font-semibold text-xs uppercase tracking-[0.15em] text-brand-navy/70 mb-2'
const errorBase = 'text-red-600 text-xs font-body mt-1'

// ---- Component ----

export default function IntakeForm() {
  const [step, setStep] = useState(0)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [hoveredTier, setHoveredTier] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    trigger,
    formState: { errors },
    watch,
    setValue,
  } = useForm<FormData>({
    resolver: zodResolver(fullSchema),
    mode: 'onTouched',
    defaultValues: {
      equipment: [],
      billingCycle: 'monthly',
    },
  })

  const currentEquipment = watch('equipment') || []

  const handleNext = async () => {
    const currentSchema = schemas[step]
    const fields = Object.keys(currentSchema.shape) as (keyof FormData)[]
    const valid = await trigger(fields)
    if (valid) setStep((s) => s + 1)
  }

  const handleBack = () => setStep((s) => s - 1)

  const onSubmit = async (data: FormData) => {
    setSubmitting(true)
    setSubmitError(null)
    try {
      // Blueprint is self-serve: no application, no approval. Straight to
      // Stripe Checkout; the webhook creates their account after payment.
      if (data.tier === 'blueprint') {
        window.location.href = '/api/stripe/checkout-blueprint'
        return
      }
      // Submit to the server route, which writes with the service-role key.
      // No studio access is granted here, the client is invited by email once
      // Anthony approves the application.
      const payload = {
        ...data,
        billingCycle: data.billingCycle,
      }
      const res = await fetch('/api/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error ?? 'Something went wrong. Please try again.')
      }

      setSubmitted(true)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      setSubmitError(message)
    } finally {
      setSubmitting(false)
    }
  }

  const toggleEquipment = (value: string) => {
    const current = currentEquipment || []
    if (current.includes(value)) {
      setValue(
        'equipment',
        current.filter((v: string) => v !== value),
        { shouldValidate: true }
      )
    } else {
      setValue('equipment', [...current, value], { shouldValidate: true })
    }
  }

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="max-w-xl mx-auto text-center py-20"
      >
        <span className="block text-brand-blue text-6xl mb-6">✓</span>
        <h2 className="font-display font-extrabold text-3xl md:text-4xl uppercase tracking-tight text-brand-navy">
          Application Received
        </h2>
        <p className="mt-6 text-brand-slate font-body leading-relaxed">
          We&rsquo;ll be in touch within 24 hours to book your welcome call.
        </p>
      </motion.div>
    )
  }

  return (
    <div className="max-w-xl mx-auto">
      {/* Progress indicator */}
      <div className="flex items-center gap-2 mb-12">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex-1 flex items-center gap-2">
            <div
              className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                i <= step ? 'bg-brand-orange' : 'bg-brand-navy/10'
              }`}
            />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between mb-8">
        <span className="font-display font-semibold text-xs uppercase tracking-[0.2em] text-brand-slate">
          Step {step + 1} of 3
        </span>
        <span className="font-display font-semibold text-xs uppercase tracking-[0.2em] text-brand-blue">
          {step === 0 && 'Your Info'}
          {step === 1 && 'Your Goals'}
          {step === 2 && 'Final Details'}
        </span>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <AnimatePresence mode="wait">
          {/* Step 1 */}
          {step === 0 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col gap-6"
            >
              <div>
                <label className={labelBase}>Full Name</label>
                <input {...register('name')} placeholder="John Doe" className={inputBase} />
                {errors.name && <p className={errorBase}>{errors.name.message}</p>}
              </div>
              <div>
                <label className={labelBase}>Email</label>
                <input {...register('email')} type="email" placeholder="you@email.com" className={inputBase} />
                {errors.email && <p className={errorBase}>{errors.email.message}</p>}
              </div>
              <div>
                <label className={labelBase}>Phone</label>
                <input {...register('phone')} type="tel" placeholder="(555) 000-0000" className={inputBase} />
                {errors.phone && <p className={errorBase}>{errors.phone.message}</p>}
              </div>
            </motion.div>
          )}

          {/* Step 2 */}
          {step === 1 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col gap-6"
            >
              <div>
                <label className={labelBase}>What are your fitness goals?</label>
                <textarea
                  {...register('goals')}
                  rows={3}
                  placeholder="Lose weight, build muscle, improve endurance..."
                  className={inputBase + ' resize-none'}
                />
                {errors.goals && <p className={errorBase}>{errors.goals.message}</p>}
              </div>

              <div>
                <label className={labelBase}>Equipment Available</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {equipmentOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => toggleEquipment(opt.value)}
                      className={`px-4 py-3 rounded-sm text-sm font-display font-semibold uppercase tracking-wide border transition-colors duration-200 text-center ${
                        currentEquipment.includes(opt.value)
                          ? 'bg-brand-orange border-brand-orange text-white'
                          : 'bg-transparent border-brand-navy/15 text-brand-slate hover:border-brand-navy/30'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {errors.equipment && <p className={errorBase}>{errors.equipment.message}</p>}
              </div>

              <div>
                <label className={labelBase}>Health Limitations (optional)</label>
                <textarea
                  {...register('healthLimitations')}
                  rows={2}
                  placeholder="Injuries, conditions, or anything we should know..."
                  className={inputBase + ' resize-none'}
                />
              </div>
            </motion.div>
          )}

          {/* Step 3 */}
          {step === 2 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col gap-6"
            >
              <div>
                <label className={labelBase}>Schedule / Availability</label>
                <textarea
                  {...register('availability')}
                  rows={2}
                  placeholder="Mornings, evenings, weekdays only..."
                  className={inputBase + ' resize-none'}
                />
                {errors.availability && <p className={errorBase}>{errors.availability.message}</p>}
              </div>

              <div>
                <label className={labelBase}>Which tier interests you?</label>

                {/* Billing cycle toggle */}
                <div className="flex items-center justify-center gap-1 mb-4">
                  <div className="relative inline-flex items-center bg-brand-offwhite rounded-sm border border-brand-navy/[0.08] p-0.5">
                    <div
                      className="absolute top-0.5 bottom-0.5 rounded-sm bg-brand-navy transition-all duration-200"
                      style={{
                        left: watch('billingCycle') === 'monthly' ? 2 : '50%',
                        width: 'calc(50% - 2px)',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setValue('billingCycle', 'monthly')}
                      className={`relative z-10 px-5 py-2 font-display font-bold text-xs uppercase tracking-[0.12em] transition-colors duration-200 ${
                        watch('billingCycle') === 'monthly' ? 'text-white' : 'text-brand-navy'
                      }`}
                    >
                      Monthly
                    </button>
                    <button
                      type="button"
                      onClick={() => setValue('billingCycle', 'weekly')}
                      className={`relative z-10 px-5 py-2 font-display font-bold text-xs uppercase tracking-[0.12em] transition-colors duration-200 ${
                        watch('billingCycle') === 'weekly' ? 'text-white' : 'text-brand-navy'
                      }`}
                    >
                      Weekly
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  {tierOptions.map((opt) => {
                    const isSelected = watch('tier') === opt.value
                    const isExpanded = hoveredTier === opt.value
                    const monthlyOnly = (opt as { monthlyOnly?: boolean }).monthlyOnly
                    const isWeekly = !monthlyOnly && watch('billingCycle') === 'weekly'
                    const displayPrice = isWeekly
                      ? Math.ceil(opt.monthlyPrice / 4)
                      : opt.monthlyPrice
                    const priceLabel = isWeekly ? '/wk' : '/mo'
                    return (
                      <div
                        key={opt.value}
                        onMouseEnter={() => setHoveredTier(opt.value)}
                        onMouseLeave={() => setHoveredTier(null)}
                        onTouchStart={() => setHoveredTier(isExpanded ? null : opt.value)}
                        className={`relative rounded-sm border overflow-hidden transition-all duration-200 ${
                          isSelected
                            ? 'border-brand-orange bg-brand-orange/5 shadow-[0_2px_16px_rgba(240,139,30,0.1)]'
                            : 'border-brand-navy/10 bg-brand-offwhite hover:border-brand-navy/20'
                        }`}
                      >
                        {opt.featured && (
                          <div className="bg-brand-orange text-white text-center py-1.5 font-display font-bold text-[10px] uppercase tracking-[0.2em]">
                            Most Popular
                          </div>
                        )}
                        <label className="flex items-center gap-3 px-5 py-4 cursor-pointer">
                          <input
                            type="radio"
                            value={opt.value}
                            {...register('tier')}
                            className="sr-only"
                          />
                          <span
                            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                              isSelected
                                ? 'border-brand-orange'
                                : 'border-brand-navy/30'
                            }`}
                          >
                            {isSelected && (
                              <span className="w-2 h-2 rounded-full bg-brand-orange" />
                            )}
                          </span>
                          <div className="flex-1 flex items-baseline justify-between gap-2">
                            <span className="font-display font-bold text-sm uppercase tracking-wide text-brand-navy">
                              {opt.label}
                            </span>
                            <span className="font-display font-extrabold text-lg text-brand-navy shrink-0">
                              ${displayPrice}<span className="text-xs font-semibold text-brand-slate">{priceLabel}</span>
                            </span>
                          </div>
                        </label>
                        <AnimatePresence initial={false}>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                              className="overflow-hidden"
                            >
                              <div className="px-5 pb-4 border-t border-brand-navy/[0.06]">
                                <p className="mt-3 text-xs font-body text-brand-slate italic">
                                  {opt.tagline}
                                </p>
                                <ul className="mt-3 flex flex-col gap-1.5">
                                  {opt.features.map((feature, i) => (
                                    <li key={i} className="flex items-start gap-2">
                                      <span className="mt-0.5 shrink-0 text-[10px] text-brand-orange">◆</span>
                                      <span className="text-xs font-body text-brand-slate leading-relaxed">
                                        {feature}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )
                  })}
                </div>
                {errors.tier && <p className={errorBase}>{errors.tier.message}</p>}
              </div>

              <div>
                <label className={labelBase}>How did you hear about AJMFit? (optional)</label>
                <input
                  {...register('referral')}
                  placeholder="Instagram, a friend, Google..."
                  className={inputBase}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Submission error */}
        {submitError && (
          <div className="mt-6 rounded-sm bg-red-50 border border-red-200 px-4 py-3">
            <p className="text-red-700 text-sm font-body">{submitError}</p>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="mt-10 flex gap-4">
          {step > 0 && (
            <Button type="button" variant="secondary" onClick={handleBack} disabled={submitting}>
              Back
            </Button>
          )}
          <div className="flex-1">
            {step < 2 ? (
              <Button type="button" variant="primary" onClick={handleNext} fullWidth>
                Continue
              </Button>
            ) : (
              <Button type="submit" variant="primary" fullWidth disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit Application'}
              </Button>
            )}
          </div>
        </div>
      </form>
    </div>
  )
}
