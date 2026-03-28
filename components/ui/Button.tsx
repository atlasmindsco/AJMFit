'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'

type ButtonVariant = 'primary' | 'secondary' | 'blue'

interface ButtonProps {
  children: React.ReactNode
  variant?: ButtonVariant
  href?: string
  type?: 'button' | 'submit'
  onClick?: () => void
  className?: string
  fullWidth?: boolean
  disabled?: boolean
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-orange text-white hover:bg-orange-600 active:bg-orange-700 shadow-[0_4px_24px_rgba(240,139,30,0.3)] hover:shadow-[0_6px_32px_rgba(240,139,30,0.45)]',
  secondary:
    'bg-transparent text-brand-navy border-2 border-brand-navy/30 hover:border-brand-navy hover:bg-brand-navy/5 active:bg-brand-navy/10',
  blue: 'bg-brand-blue text-white hover:bg-blue-700 active:bg-blue-800 shadow-[0_4px_24px_rgba(46,106,176,0.3)] hover:shadow-[0_6px_32px_rgba(46,106,176,0.45)]',
}

export default function Button({
  children,
  variant = 'primary',
  href,
  type = 'button',
  onClick,
  className = '',
  fullWidth = false,
  disabled = false,
}: ButtonProps) {
  const base = `inline-flex items-center justify-center gap-2 px-8 py-4 font-display font-bold text-sm uppercase tracking-[0.15em] rounded-sm transition-shadow duration-200 ${
    fullWidth ? 'w-full' : ''
  } ${disabled ? 'opacity-60 cursor-not-allowed' : ''} ${variantStyles[variant]} ${className}`

  if (href) {
    return (
      <motion.div
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 400, damping: 17 }}
      >
        <Link href={href} className={base}>
          {children}
        </Link>
      </motion.div>
    )
  }

  return (
    <motion.button
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={base}
    >
      {children}
    </motion.button>
  )
}
