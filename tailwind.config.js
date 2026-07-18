const { fontFamily } = require('tailwindcss/defaultTheme')

module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './lib/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '1rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      colors: {
        // EQrel Official Palette (from EQ Master Reference Pack v1.0)
        'eq-green': '#00B894',
        'eq-yellow': '#FFB703',
        'eq-coral': '#FF5D6E',
        'eq-blue': '#2D9CDB',
        'eq-orange': '#FF8A00',
        'eq-fresh': '#4CAF50',
        'eq-ink': '#0F2E25',
        'eq-cream': '#FFF8E7',
        'eq-sky-start': '#B8E7F5',
        'eq-sky-end': '#FFF8E7',
        // shadcn tokens (mapped to brand)
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: '#00B894',
          foreground: '#FFFFFF',
        },
        secondary: {
          DEFAULT: '#FFB703',
          foreground: '#0F2E25',
        },
        destructive: {
          DEFAULT: '#FF5D6E',
          foreground: '#FFFFFF',
        },
        muted: {
          DEFAULT: '#F5F0E0',
          foreground: '#6B7A70',
        },
        accent: {
          DEFAULT: '#FFB703',
          foreground: '#0F2E25',
        },
        card: {
          DEFAULT: '#FFFFFF',
          foreground: '#0F2E25',
        },
      },
      fontFamily: {
        sans: ['Manrope', ...fontFamily.sans],
        display: ['Manrope', ...fontFamily.sans],
        arabic: ['Amiri', 'Noto Naskh Arabic', 'serif'],
      },
      borderRadius: {
        lg: '1rem',
        md: '0.75rem',
        sm: '0.5rem',
        '3xl': '2rem',
        '4xl': '2.5rem',
      },
      boxShadow: {
        'eq-card': '0 4px 20px -2px rgba(15, 46, 37, 0.08)',
        'eq-soft': '0 2px 12px -2px rgba(15, 46, 37, 0.06)',
        'eq-glow': '0 0 30px -5px rgba(255, 183, 3, 0.4)',
      },
      keyframes: {
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        'gentle-pulse': {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.7 },
        },
      },
      animation: {
        'float': 'float 3s ease-in-out infinite',
        'gentle-pulse': 'gentle-pulse 2s ease-in-out infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
