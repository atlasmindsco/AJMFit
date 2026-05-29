/**
 * Shared framer-motion variants.
 *
 * Two flavors to match the two surface personalities:
 *  - fadeIn       — snappier, used across the dark studio (client-facing).
 *  - fadeInAdmin  — slightly larger drop & slower stagger, used in the luffy admin.
 */

export const fadeIn = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] as const },
  }),
}

export const fadeInAdmin = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] as const },
  }),
}
