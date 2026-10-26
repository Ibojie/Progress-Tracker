import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

// Every colour is a CSS variable (src/styles/index.css) so both themes come from tokens.
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: { center: true, padding: '1rem', screens: { '2xl': '75rem' } },
    extend: {
      colors: {
        background: token('bg'),
        foreground: token('fg'),
        surface: { DEFAULT: token('surface'), foreground: token('fg') },
        muted: { DEFAULT: token('muted'), foreground: token('muted-fg') },
        border: token('border'),
        input: token('border'),
        ring: token('ring'),
        primary: { DEFAULT: token('primary'), foreground: token('primary-fg') },
        accent: { DEFAULT: token('accent'), foreground: token('accent-fg') },
        destructive: { DEFAULT: token('danger'), foreground: token('danger-fg') },
        done: token('done'),
      },
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', 'system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
      fontSize: {
        // Readable Content Standard tiers (desktop values; the phone block in index.css enlarges them)
        label: ['0.875rem', { lineHeight: '1.4' }], // 14px desktop, 16px phone
        secondary: ['1.0625rem', { lineHeight: '1.6' }], // 17px desktop, 18px phone
        body: ['1.1875rem', { lineHeight: '1.72' }], // 19px
        lead: ['clamp(1.25rem, 2.4vw, 1.375rem)', { lineHeight: '1.6' }],
        h3: ['clamp(1.25rem, 2.2vw, 1.75rem)', { lineHeight: '1.3' }],
        h2: ['clamp(1.5rem, 3.9vw, 2.5rem)', { lineHeight: '1.2' }],
        h1: ['clamp(2rem, 6.2vw, 3.5625rem)', { lineHeight: '1.15' }],
      },
      borderRadius: { lg: '1rem', md: '0.75rem', sm: '0.5rem' },
      minHeight: { tap: '44px' },
      minWidth: { tap: '44px' },
    },
  },
  plugins: [animate],
} satisfies Config;
