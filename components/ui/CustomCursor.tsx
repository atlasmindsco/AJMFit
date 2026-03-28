'use client'

import { useEffect, useState } from 'react'
import { motion, useSpring } from 'framer-motion'

export default function CustomCursor() {
  const [visible, setVisible] = useState(false)
  const [supported, setSupported] = useState(false)
  const [hoveringInteractive, setHoveringInteractive] = useState(false)

  const cursorX = useSpring(0, { stiffness: 800, damping: 45 })
  const cursorY = useSpring(0, { stiffness: 800, damping: 45 })

  useEffect(() => {
    const mediaQuery = window.matchMedia('(pointer: fine)')
    if (!mediaQuery.matches) return

    setSupported(true)

    // Hide native cursor via CSS when custom cursor is supported
    document.documentElement.style.cursor = 'none'
    const style = document.createElement('style')
    style.id = 'custom-cursor-hide'
    style.textContent = '*, *::before, *::after { cursor: none !important; }'
    document.head.appendChild(style)

    const move = (e: MouseEvent) => {
      cursorX.set(e.clientX)
      cursorY.set(e.clientY)
      if (!visible) setVisible(true)
    }

    const handleOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (
        target.closest('a') ||
        target.closest('button') ||
        target.closest('input') ||
        target.closest('textarea') ||
        target.closest('select') ||
        target.closest('[role="button"]')
      ) {
        setHoveringInteractive(true)
      }
    }

    const handleOut = () => {
      setHoveringInteractive(false)
    }

    const handleLeave = () => setVisible(false)
    const handleEnter = () => setVisible(true)

    window.addEventListener('mousemove', move)
    document.addEventListener('mouseover', handleOver)
    document.addEventListener('mouseout', handleOut)
    document.addEventListener('mouseleave', handleLeave)
    document.addEventListener('mouseenter', handleEnter)

    return () => {
      window.removeEventListener('mousemove', move)
      document.removeEventListener('mouseover', handleOver)
      document.removeEventListener('mouseout', handleOut)
      document.removeEventListener('mouseleave', handleLeave)
      document.removeEventListener('mouseenter', handleEnter)
      document.documentElement.style.cursor = ''
      const el = document.getElementById('custom-cursor-hide')
      if (el) el.remove()
    }
  }, [cursorX, cursorY, visible])

  if (!supported || !visible) return null

  return (
    <motion.div
      className="fixed top-0 left-0 z-[9999] pointer-events-none"
      style={{
        x: cursorX,
        y: cursorY,
        translateX: '-50%',
        translateY: '-50%',
      }}
      animate={{
        scale: hoveringInteractive ? 1.3 : 1,
        rotate: hoveringInteractive ? 20 : 0,
      }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    >
      {/* Dumbbell SVG */}
      <svg
        width="28"
        height="28"
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="drop-shadow-[0_1px_3px_rgba(27,45,80,0.3)]"
      >
        {/* Left weight plate (outer) */}
        <rect x="3" y="8" width="4" height="16" rx="1.5" fill="#1B2D50" />
        {/* Left weight plate (inner) */}
        <rect x="7" y="10" width="3" height="12" rx="1" fill="#1B2D50" />
        {/* Bar */}
        <rect x="10" y="14" width="12" height="4" rx="1" fill="#F08B1E" />
        {/* Right weight plate (inner) */}
        <rect x="22" y="10" width="3" height="12" rx="1" fill="#1B2D50" />
        {/* Right weight plate (outer) */}
        <rect x="25" y="8" width="4" height="16" rx="1.5" fill="#1B2D50" />
      </svg>
    </motion.div>
  )
}
