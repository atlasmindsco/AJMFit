'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function MembersLogin() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showForgot, setShowForgot] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotSent, setForgotSent] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!username || !password) {
      setError('Please enter your username and password.')
      return
    }

    // TODO: Replace with real authentication
    router.push('/studio')
  }

  const handleForgotPassword = (e: React.FormEvent) => {
    e.preventDefault()
    if (!forgotEmail) return
    // TODO: Replace with real password reset logic
    setForgotSent(true)
  }

  return (
    <div className="min-h-screen bg-brand-offwhite flex flex-col items-center justify-center px-6 py-20">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="flex justify-center mb-10">
          <Link href="/">
            <Image
              src="/AJMfit.png"
              alt="AJMFit"
              width={80}
              height={80}
              className="w-20 h-20 object-contain"
            />
          </Link>
        </div>

        <div className="bg-white rounded-sm border border-brand-navy/[0.08] shadow-[0_4px_40px_rgba(27,45,80,0.06)] p-8 md:p-10">
          {!showForgot ? (
            <>
              <h1 className="font-display font-extrabold text-2xl uppercase tracking-[0.05em] text-brand-navy text-center">
                Members Login
              </h1>
              <p className="text-center text-sm font-body text-brand-slate mt-2">
                Access your training studio
              </p>

              <form onSubmit={handleLogin} className="mt-8 space-y-5">
                <div>
                  <label
                    htmlFor="username"
                    className="block font-display font-semibold text-xs uppercase tracking-[0.15em] text-brand-navy/60 mb-2"
                  >
                    Username
                  </label>
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-4 py-3 bg-brand-offwhite border border-brand-navy/[0.08] rounded-sm font-body text-sm text-brand-navy placeholder:text-brand-navy/30 focus:outline-none focus:border-brand-blue/40 focus:ring-1 focus:ring-brand-blue/20 transition-colors duration-200"
                    placeholder="Enter your username"
                    autoComplete="username"
                  />
                </div>

                <div>
                  <label
                    htmlFor="password"
                    className="block font-display font-semibold text-xs uppercase tracking-[0.15em] text-brand-navy/60 mb-2"
                  >
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-brand-offwhite border border-brand-navy/[0.08] rounded-sm font-body text-sm text-brand-navy placeholder:text-brand-navy/30 focus:outline-none focus:border-brand-blue/40 focus:ring-1 focus:ring-brand-blue/20 transition-colors duration-200"
                    placeholder="Enter your password"
                    autoComplete="current-password"
                  />
                </div>

                {error && (
                  <p className="text-sm font-body text-red-500">{error}</p>
                )}

                <button
                  type="submit"
                  className="w-full py-3.5 bg-brand-navy text-white font-display font-bold text-sm uppercase tracking-[0.12em] rounded-sm hover:bg-brand-navy/90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/50 focus-visible:ring-offset-2 transition-all duration-200"
                >
                  Log In
                </button>
              </form>

              <div className="mt-6 text-center">
                <button
                  onClick={() => setShowForgot(true)}
                  className="font-body text-sm text-brand-blue hover:text-brand-blue/80 focus-visible:outline-none focus-visible:underline transition-colors duration-200"
                >
                  Forgot Password?
                </button>
              </div>
            </>
          ) : (
            <>
              <h1 className="font-display font-extrabold text-2xl uppercase tracking-[0.05em] text-brand-navy text-center">
                Reset Password
              </h1>
              <p className="text-center text-sm font-body text-brand-slate mt-2">
                Enter your email and we&apos;ll send you a reset link
              </p>

              {!forgotSent ? (
                <form onSubmit={handleForgotPassword} className="mt-8 space-y-5">
                  <div>
                    <label
                      htmlFor="forgot-email"
                      className="block font-display font-semibold text-xs uppercase tracking-[0.15em] text-brand-navy/60 mb-2"
                    >
                      Email Address
                    </label>
                    <input
                      id="forgot-email"
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      className="w-full px-4 py-3 bg-brand-offwhite border border-brand-navy/[0.08] rounded-sm font-body text-sm text-brand-navy placeholder:text-brand-navy/30 focus:outline-none focus:border-brand-blue/40 focus:ring-1 focus:ring-brand-blue/20 transition-colors duration-200"
                      placeholder="your@email.com"
                      autoComplete="email"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3.5 bg-brand-navy text-white font-display font-bold text-sm uppercase tracking-[0.12em] rounded-sm hover:bg-brand-navy/90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/50 focus-visible:ring-offset-2 transition-all duration-200"
                  >
                    Send Reset Link
                  </button>
                </form>
              ) : (
                <div className="mt-8 text-center">
                  <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-brand-blue/10 flex items-center justify-center">
                    <svg className="w-7 h-7 text-brand-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                    </svg>
                  </div>
                  <p className="font-body text-sm text-brand-slate">
                    If an account exists for <strong className="text-brand-navy">{forgotEmail}</strong>, you&apos;ll receive a password reset link shortly.
                  </p>
                </div>
              )}

              <div className="mt-6 text-center">
                <button
                  onClick={() => {
                    setShowForgot(false)
                    setForgotSent(false)
                    setForgotEmail('')
                  }}
                  className="font-body text-sm text-brand-blue hover:text-brand-blue/80 focus-visible:outline-none focus-visible:underline transition-colors duration-200"
                >
                  Back to Login
                </button>
              </div>
            </>
          )}
        </div>

        <p className="text-center text-xs font-body text-brand-slate mt-6">
          Not a member?{' '}
          <Link href="/apply" className="text-brand-orange hover:text-brand-orange/80 font-semibold transition-colors duration-200">
            Apply here
          </Link>
        </p>
      </motion.div>
    </div>
  )
}
