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
  fitnessLevel: z.enum(['beginner', 'intermediate', 'advanced'], {
    required_error: 'Select your fitness level',
  }),
  equipment: z.array(z.string()).min(1, 'Select at least one'),
  healthLimitations: z.string().optional(),
})

const step3Schema = z.object({
  availability: z.string().min(5, 'Share your availability'),
  tier: z.enum(['blueprint', 'accelerator', 'full-experience'], {
    required_error: 'Select a tier',
  }),
  referral: z.string().optional(),
})

const fullSchema = step1Schema.merge(step2Schema).merge(step3Schema)
type FormData = z.infer<typeof fullSchema>

const schemas = [step1Schema, step2Schema, step3Schema] as const

// ---- Constants ----

const equipmentOptions = [
  { value: 'dumbbells', label: 'Dumbbells' },
  { value: 'resistance-bands', label: 'Resistance Bands' },
  { value: 'full-home-gym', label: 'Full Home Gym' },
]

const tierOptions = [
  { value: 'blueprint', label: 'The Blueprint — $297/mo' },
  { value: 'accelerator', label: 'The Accelerator — $497/mo' },
  { value: 'full-experience', label: 'The Full Experience — $697/mo' },
]

const fitnessLevels = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
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

  const onSubmit = (data: FormData) => {
    // [PLACEHOLDER] — wire up to API route or external service
    console.log('Intake form submitted:', data)
    setSubmitted(true)
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
                <label className={labelBase}>Current Fitness Level</label>
                <select {...register('fitnessLevel')} className={inputBase + ' appearance-none'}>
                  <option value="">Select level...</option>
                  {fitnessLevels.map((lvl) => (
                    <option key={lvl.value} value={lvl.value}>
                      {lvl.label}
                    </option>
                  ))}
                </select>
                {errors.fitnessLevel && <p className={errorBase}>{errors.fitnessLevel.message}</p>}
              </div>

              <div>
                <label className={labelBase}>Equipment Available</label>
                <div className="flex flex-wrap gap-3">
                  {equipmentOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => toggleEquipment(opt.value)}
                      className={`px-5 py-3 rounded-sm text-sm font-display font-semibold uppercase tracking-wide border transition-colors duration-200 ${
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
                <div className="flex flex-col gap-3">
                  {tierOptions.map((opt) => (
                    <label
                      key={opt.value}
                      className={`flex items-center gap-4 px-5 py-4 rounded-sm border transition-colors duration-200 cursor-pointer ${
                        watch('tier') === opt.value
                          ? 'border-brand-orange bg-brand-orange/10'
                          : 'border-brand-navy/10 bg-brand-offwhite hover:border-brand-navy/20'
                      }`}
                    >
                      <input
                        type="radio"
                        value={opt.value}
                        {...register('tier')}
                        className="sr-only"
                      />
                      <span
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          watch('tier') === opt.value
                            ? 'border-brand-orange'
                            : 'border-brand-navy/30'
                        }`}
                      >
                        {watch('tier') === opt.value && (
                          <span className="w-2 h-2 rounded-full bg-brand-orange" />
                        )}
                      </span>
                      <span className="font-display font-semibold text-sm uppercase tracking-wide text-brand-navy">
                        {opt.label}
                      </span>
                    </label>
                  ))}
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

        {/* Navigation buttons */}
        <div className="mt-10 flex gap-4">
          {step > 0 && (
            <Button type="button" variant="secondary" onClick={handleBack}>
              Back
            </Button>
          )}
          <div className="flex-1">
            {step < 2 ? (
              <Button type="button" variant="primary" onClick={handleNext} fullWidth>
                Continue
              </Button>
            ) : (
              <Button type="submit" variant="primary" fullWidth>
                Submit Application
              </Button>
            )}
          </div>
        </div>
      </form>
    </div>
  )
}
