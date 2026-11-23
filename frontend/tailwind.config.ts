import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        background: 'var(--color-background)',
        sidebar: 'var(--color-sidebar)',
        surface: 'var(--color-surface)',
        'surface-secondary': 'var(--color-surface-secondary)',
        'app-frame': 'var(--color-app-frame)',
        'text-primary': 'var(--color-text-primary)',
        'text-secondary': 'var(--color-text-secondary)',
        'text-tertiary': 'var(--color-text-tertiary)',
        border: 'var(--color-border)',
        accent: 'var(--color-accent)',
        'accent-hover': 'var(--color-accent-hover)',
        'accent-subtle': 'var(--color-accent-subtle)',
        success: 'var(--color-success)',
        danger: 'var(--color-danger)',
        warning: 'var(--color-warning)',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Text"',
          '"SF Pro Display"',
          'Inter',
          '"Segoe UI"',
          'Roboto',
          'sans-serif',
        ],
        mono: ['"SF Mono"', '"DM Mono"', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      fontSize: {
        xs: ['11px', '14px'],
        sm: ['12px', '16px'],
        base: ['13px', '18px'],
        md: ['15px', '20px'],
        lg: ['17px', '22px'],
        xl: ['22px', '28px'],
        '2xl': ['28px', '34px'],
      },
      letterSpacing: {
        heading: '-0.01em',
        section: '0.04em',
      },
      borderRadius: {
        sm: '6px',
        DEFAULT: '8px',
        md: '10px',
        lg: '14px',
        full: '9999px',
      },
      boxShadow: {
        subtle: 'var(--shadow-subtle)',
        card: 'var(--shadow-card)',
        modal: 'var(--shadow-modal)',
      },
      transitionTimingFunction: {
        standard: 'var(--ease-standard)',
        spring: 'var(--ease-spring)',
      },
      transitionDuration: {
        fast: 'var(--dur-fast)',
        base: 'var(--dur-base)',
        slow: 'var(--dur-slow)',
      },
    },
  },
  plugins: [],
};

export default config;
