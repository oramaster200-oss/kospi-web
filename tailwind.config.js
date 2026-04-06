/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0F172A", // Deep Navy Dark
        card: "#1E293B",
        accent: "#38BDF8", // Electric Blue
        bullish: "#10B981", // Emerald Green
        bearish: "#F43F5E", // Rose Pink
      },
    },
  },
  plugins: [],
}
