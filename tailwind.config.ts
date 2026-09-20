import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          white: '#FFFFFF',
          offwhite: '#F4F6F9',
          navy: '#1B2D50',
          blue: '#1A7BFF',
          // Pressed/hover states for the brand colours. Previously the button
          // hovered to Tailwind's stock orange-600/blue-700, which are a
          // different hue family than the brand and made the primary CTA drift
          // off-palette on the most-clicked element in the product.
          bluedark: '#0F5FE0',
          orange: '#F76B16',
          orangedark: '#D8590C',
          slate: '#64748B',
        },
        // Dark surfaces for the client studio and trainer portal. These were
        // previously hand-written per component as six different near-blacks
        // (#0A0A0A, #111, #111111, #1A1A1A, #1C1C1C, #0F1923) with no scale.
        surface: {
          base: '#111111',
          raised: '#1C1C1C',
          overlay: '#1A1A1A',
        },
        state: {
          success: '#22C55E',
          warning: '#F59E0B',
          danger: '#EF4444',
        },
      },
      // Three radii, one per role. The codebase had six in active use, which is
      // why marketing (rounded-sm) and the studio (rounded-2xl) read as
      // different products.
      borderRadius: {
        control: '0.5rem',
        card: '0.875rem',
      },
      fontFamily: {
        display: ['var(--font-barlow-condensed)', 'sans-serif'],
        body: ['var(--font-barlow)', 'sans-serif'],
      },
      animation: {
        marquee: 'marquee 30s linear infinite',
        'marquee-reverse': 'marquee-reverse 30s linear infinite',
      },
      keyframes: {
        marquee: {
          '0%': { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        'marquee-reverse': {
          '0%': { transform: 'translateX(-50%)' },
          '100%': { transform: 'translateX(0%)' },
        },
      },
    },
  },
  plugins: [],
}
export default config
