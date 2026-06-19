/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        // Serif = the human/teaching voice. Mono = the instrument readout.
        display: ['Fraunces', 'ui-serif', 'Georgia', 'serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        // Deep "ink" ground — cool near-black with a faint blue-green.
        // 950–600 are surfaces/borders; 500–300 are readable text grays.
        ink: {
          950: '#070a0e',
          900: '#0a0e13',
          850: '#0d1219',
          800: '#111824',
          700: '#19222f',
          600: '#26313f',
          500: '#6b7686',
          400: '#9aa6b4',
          300: '#c2cad6',
        },
        // Warm off-white — "map ink on paper", inverted onto the dark ground.
        paper: '#e9e3d3',
        // The single signal accent: brass / survey-marker amber.
        brass: {
          DEFAULT: '#d9a441',
          bright: '#f2c266',
          deep: '#a87a26',
          dim: '#2a2316',
        },
      },
      letterSpacing: {
        readout: '0.18em',
      },
      boxShadow: {
        plate: '0 1px 0 0 rgba(233,227,211,0.04) inset, 0 24px 60px -30px rgba(0,0,0,0.9)',
        sheet: '0 -24px 60px -30px rgba(0,0,0,0.95)',
      },
      keyframes: {
        'plate-in': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        sweep: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'plate-in': 'plate-in 0.7s cubic-bezier(0.16,1,0.3,1) both',
        'fade-in': 'fade-in 0.9s ease both',
        sweep: 'sweep 1.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
