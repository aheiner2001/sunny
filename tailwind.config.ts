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
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'sky-surge': { 50: '#e6fafe', 100: '#cdf4fe', 200: '#9be9fd', 300: '#69dffc', 400: '#37d4fb', 500: '#05c9fa', 600: '#04a1c8', 700: '#037996', 800: '#025064', 900: '#012832', 950: '#011c23' },
        'ivory-mist': { 50: '#faf7eb', 100: '#f5efd6', 200: '#ebdfad', 300: '#e0d085', 400: '#d6c05c', 500: '#ccb033', 600: '#a38d29', 700: '#7a6a1f', 800: '#524614', 900: '#29230a', 950: '#1d1907' },
        'prussian-blue': { 50: '#edf1f7', 100: '#dbe3f0', 200: '#b7c8e1', 300: '#93acd2', 400: '#6f91c3', 500: '#4b75b4', 600: '#3c5e90', 700: '#2d466c', 800: '#1e2f48', 900: '#0f1724', 950: '#0b1019' },
        'charcoal-blue': { 50: '#eef3f6', 100: '#dee6ed', 200: '#bccddc', 300: '#9bb4ca', 400: '#799bb9', 500: '#5882a7', 600: '#466886', 700: '#354e64', 800: '#233443', 900: '#121a21', 950: '#0c1217' },
        'light-coral': { 50: '#fee7e9', 100: '#fccfd3', 200: '#f99fa6', 300: '#f76e7a', 400: '#f43e4d', 500: '#f10e21', 600: '#c10b1a', 700: '#910814', 800: '#60060d', 900: '#300307', 950: '#220205' },
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
