import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        panel: {
          bg: "#07090f",
          surface: "#111522",
          surface2: "#171c2b",
          border: "#2a3042",
          text: "#f5f7fb",
          muted: "#9aa4b8",
          blue: "#3b82f6",
          violet: "#8b5cf6",
          green: "#22c55e",
          red: "#ef4444",
          yellow: "#f59e0b"
        }
      },
      boxShadow: {
        soft: "0 18px 60px rgba(0, 0, 0, 0.28)"
      }
    }
  },
  plugins: []
};

export default config;
