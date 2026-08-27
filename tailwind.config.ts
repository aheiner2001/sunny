import type { Config } from 'tailwindcss';

/**
 * Values mirror the tokens in src/app/globals.css. They are literal hex here
 * rather than var(--token) so Tailwind's opacity modifiers (bg-ink/60) keep
 * working — if you change a color, change it in both places.
 *
 * House rule: `hivis` is reserved for "needs a human" (flagged, overdue, out
 * of stock). Primary actions are `ink`.
 */
const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Brand: the wordmark is charcoal with one amber dot.
        sunny: {
          DEFAULT: '#22262b',
          accent: '#ffa524',
        },

        ink: {
          DEFAULT: '#22262b',
          hover: '#32383f',
          muted: '#59616d',
          faint: '#8a929e',
          inverse: '#ffffff',
        },

        hivis: {
          DEFAULT: '#ffa524',
          strong: '#e5860a',
          text: '#94550a',
          wash: '#fff5e3',
        },

        ok: { DEFAULT: '#0f7a4b', wash: '#e8f5ee' },
        critical: { DEFAULT: '#c1272d', wash: '#fdeced' },
        info: { DEFAULT: '#22262b', wash: '#e7ebf0' },
        idle: { DEFAULT: '#6b7480', wash: '#f0f2f5' },

        concrete: '#f4f6f8',
        surface: {
          DEFAULT: '#ffffff',
          alt: '#f8fafb',
          sunk: '#eaeef2',
        },
        line: {
          DEFAULT: '#e3e7ec',
          strong: '#ccd3db',
        },
      },

      // Added alongside Tailwind's own scale, not replacing it.
      fontSize: {
        '2xs': 'var(--text-2xs)',
      },

      fontFamily: {
        display: ['Figtree', 'Segoe UI', 'system-ui', '-apple-system', 'sans-serif'],
        sans: ['IBM Plex Sans', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['IBM Plex Mono', 'ui-monospace', 'SF Mono', 'Menlo', 'monospace'],
      },

      borderRadius: {
        card: '14px',
      },

      boxShadow: {
        card: '0 1px 2px rgba(34, 38, 43, 0.06)',
        lift: '0 1px 2px rgba(34, 38, 43, 0.05), 0 4px 12px -4px rgba(34, 38, 43, 0.1)',
        panel: '0 2px 4px rgba(34, 38, 43, 0.05), 0 16px 32px -12px rgba(34, 38, 43, 0.18)',
      },

      minHeight: {
        tap: '44px',
      },
    },
  },
  plugins: [],
};
export default config;
