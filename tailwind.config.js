/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",   // 🔥 THIS LINE FIXES EVERYTHING
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          blue: "#2563eb",
          indigo: "#4f46e5",
          sky: "#0ea5e9",
          light: "#eff6ff",
        },
      },
      fontFamily: {
        display: ["'Space Grotesk'", "'Segoe UI'", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 10px 30px -8px rgba(37, 99, 235, 0.35)",
        "glow-violet": "0 16px 40px -10px rgba(79, 70, 229, 0.4)",
        "glow-soft": "0 8px 30px rgba(37, 99, 235, 0.12)",
        neon: "0 1px 3px rgba(15,23,42,0.06), 0 12px 34px -14px rgba(37,99,235,0.35)",
      },
      backgroundImage: {
        "grid-faint":
          "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
      },
      keyframes: {
        floatBlob: {
          "0%, 100%": { transform: "translate(0px, 0px) scale(1)" },
          "33%": { transform: "translate(30px, -40px) scale(1.1)" },
          "66%": { transform: "translate(-20px, 20px) scale(0.95)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        fadeIn: {
          "0%": { opacity: 0, transform: "translateY(8px)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        },
        glowPulse: {
          "0%, 100%": { opacity: 0.6 },
          "50%": { opacity: 1 },
        },
      },
      animation: {
        floatBlob: "floatBlob 14s ease-in-out infinite",
        shimmer: "shimmer 2.5s linear infinite",
        fadeIn: "fadeIn 0.4s ease-out",
        glowPulse: "glowPulse 3s ease-in-out infinite",
      },
    },
  },
  plugins: [],
}
