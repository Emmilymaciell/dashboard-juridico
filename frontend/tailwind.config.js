/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Tokens semânticos. Nenhum componente usa cor literal.
        canvas: 'hsl(var(--canvas))',
        surface: 'hsl(var(--surface))',
        elevated: 'hsl(var(--elevated))',
        subtle: 'hsl(var(--subtle))',
        line: 'hsl(var(--line))',
        'line-strong': 'hsl(var(--line-strong))',
        ink: {
          DEFAULT: 'hsl(var(--ink))',
          muted: 'hsl(var(--ink-muted))',
          faint: 'hsl(var(--ink-faint))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          soft: 'hsl(var(--accent-soft))',
          ink: 'hsl(var(--accent-ink))',
          contrast: 'hsl(var(--accent-contrast))',
        },
        brand: {
          DEFAULT: 'hsl(var(--brand))',
          deep: 'hsl(var(--brand-deep))',
        },
        cyan: 'hsl(var(--cyan))',
        positive: 'hsl(var(--positive))',
        warning: 'hsl(var(--warning))',
        danger: 'hsl(var(--danger))',
        info: 'hsl(var(--info))',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Consolas', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.02em' }],
        xs: ['0.75rem', { lineHeight: '1.125rem' }],
        sm: ['0.8125rem', { lineHeight: '1.25rem' }],
        base: ['0.875rem', { lineHeight: '1.375rem' }],
        lg: ['1rem', { lineHeight: '1.5rem' }],
        xl: ['1.25rem', { lineHeight: '1.6rem', letterSpacing: '-0.011em' }],
        '2xl': ['1.5rem', { lineHeight: '1.85rem', letterSpacing: '-0.014em' }],
        '3xl': ['2rem', { lineHeight: '2.3rem', letterSpacing: '-0.02em' }],
        '4xl': ['2.5rem', { lineHeight: '2.75rem', letterSpacing: '-0.024em' }],
        '5xl': ['3.25rem', { lineHeight: '3.4rem', letterSpacing: '-0.028em' }],
        /* Escala executiva: legivel a distancia em 1920x1080. */
        kpi: ['3rem', { lineHeight: '3.1rem', letterSpacing: '-0.028em' }],
        'kpi-lg': ['4rem', { lineHeight: '4rem', letterSpacing: '-0.032em' }],
        'kpi-sm': ['2rem', { lineHeight: '2.2rem', letterSpacing: '-0.022em' }],
        display: ['4.5rem', { lineHeight: '4.6rem', letterSpacing: '-0.035em' }],
      },
      borderRadius: { sm: '4px', DEFAULT: '6px', md: '8px', lg: '10px', xl: '14px' },
      boxShadow: {
        card: '0 1px 2px 0 hsl(var(--shadow) / 0.05), 0 1px 3px -1px hsl(var(--shadow) / 0.04)',
        raised: '0 2px 4px -1px hsl(var(--shadow) / 0.06), 0 6px 16px -6px hsl(var(--shadow) / 0.10)',
        overlay: '0 10px 34px -12px hsl(var(--shadow) / 0.22)',
      },
      transitionTimingFunction: { swift: 'cubic-bezier(0.16, 1, 0.3, 1)' },
      maxWidth: { content: '1680px' },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          from: { transform: 'translateX(100%)' },
          to: { transform: 'translateX(0)' },
        },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        'fade-in': 'fade-in 160ms ease-out',
        'slide-up': 'slide-up 200ms cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-in-right': 'slide-in-right 220ms cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
