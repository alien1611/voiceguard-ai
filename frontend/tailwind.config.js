/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          main: '#F6F0E7',        // Main warm cream background
          secondary: '#EDE3D6',   // Secondary warm sand background
          surface: '#FFFDF9',     // Main surface (pure ivory card)
          sidebar: '#EDE4D7',     // Refined dark cream for left tab navigation
        },
        espresso: {
          DEFAULT: '#34261F',     // Espresso primary text
          text: '#34261F',
          secondary: '#817166',  // Warm taupe secondary text
          muted: '#A99B90',      // Muted technical text
        },
        brand: {
          primary: '#75513D',     // Primary chestnut brown
          deep: '#4B3328',        // Deep roasted coffee
          caramel: '#BD9068',     // Caramel accent
          terracotta: '#C87555',  // Terracotta primary accent
          'terracotta-hover': '#B66547',
          'terracotta-subtle': '#FAF0EB',
          'caramel-subtle': '#F8F2EB',
          'primary-subtle': '#F2ECE6',
        },
        border: {
          subtle: '#E6D9CA',     // Subtle warm border
          focus: '#C87555',
        },
        bonafide: {
          DEFAULT: '#397A5B',     // Deep heritage green
          bg: '#EDF5F1',
          border: '#C3DFD1',
        },
        spoof: {
          DEFAULT: '#B84E48',     // Deep terracotta crimson
          bg: '#FAF0EF',
          border: '#EFCBC8',
        },
        warning: {
          DEFAULT: '#A77836',     // Amber gold
          bg: '#FAF4EB',
          border: '#EEDCBE',
        },
      },
      fontFamily: {
        serif: ['Newsreader', 'Playfair Display', 'DM Serif Display', 'Georgia', 'serif'],
        sans: ['Inter', 'DM Sans', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      boxShadow: {
        soft: '0 2px 8px -2px rgba(52, 38, 31, 0.04), 0 1px 4px -1px rgba(52, 38, 31, 0.03)',
        card: '0 3px 12px -2px rgba(52, 38, 31, 0.05), 0 1px 3px 0 rgba(52, 38, 31, 0.02)',
        elevated: '0 10px 28px -4px rgba(52, 38, 31, 0.08), 0 2px 6px -1px rgba(52, 38, 31, 0.04)',
      },
    },
  },
  plugins: [],
};
