/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,ts,tsx,md,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        serif: ['"Cormorant Garamond"', 'Georgia', 'Cambria', 'serif'],
        sans: ['Manrope', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        spa: {
          bg: '#F8F6F0',
          card: '#FFFFFF',
          sand: '#EFECE4',
          cream: '#F4F1EA',
          taupe: '#8C7A6B',
          'taupe-dark': '#675647',
          charcoal: '#2C2724',
        },
      },
    },
  },
  plugins: [],
};
