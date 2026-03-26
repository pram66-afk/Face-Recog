/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./index.tsx",
    "./App.tsx",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#4361ee',
        'primary-light': '#4895ef',
        'primary-dark': '#3f37c9',
      },
      animation: {
        'fade-in': 'fadeIn 0.6s ease-out forwards',
        'slide-up': 'slideUp 0.8s ease-out forwards',
        'scale-in': 'scaleIn 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'slide-right': 'slideRight 0.5s ease-out forwards',
        'bop': 'bop 4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
