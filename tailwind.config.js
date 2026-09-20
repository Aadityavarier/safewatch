/** @type {import('tailwindcss').Config} */
const v = (n) => `rgb(var(--${n}) / <alpha-value>)`
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: v('bg'), surface: v('surface'), sunken: v('sunken'), ink: v('ink'), muted: v('muted'), line: v('line'),
        brand: v('brand'), brandink: v('brandink'), signal: v('signal'),
        ok: v('ok'), warn: v('warn'), risk: v('risk'), info: v('info'),
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['"IBM Plex Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: { card: '0 1px 2px rgb(15 30 35 / .05), 0 4px 16px -6px rgb(15 30 35 / .08)', pop: '0 12px 40px -12px rgb(10 25 30 / .35)' },
      keyframes: {
        fadeUp: { from: { opacity: '0.4', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'none' } },
        ping2: { '0%': { transform: 'scale(1)', opacity: '.55' }, '100%': { transform: 'scale(2.6)', opacity: '0' } },
      },
      animation: { fadeUp: 'fadeUp .35s ease-out both', ping2: 'ping2 1.8s ease-out infinite' },
    },
  },
  plugins: [],
}
