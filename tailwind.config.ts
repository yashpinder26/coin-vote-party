import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        coin: {
          bronze: "#b87333",
          gold: "#d4a853",
          dark: "#8b5e1a",
          shine: "#f0c060",
        },
      },
      keyframes: {
        coinFlip: {
          "0%": { transform: "rotateY(0deg)" },
          "100%": { transform: "rotateY(720deg)" },
        },
        handkerchiefDrop: {
          "0%": { transform: "translateY(-120%) rotate(-8deg) scaleX(0.9)", opacity: "0" },
          "50%": { transform: "translateY(8%) rotate(4deg) scaleX(1.05)", opacity: "1" },
          "100%": { transform: "translateY(0%) rotate(0deg) scaleX(1)", opacity: "1" },
        },
        handkerchiefLift: {
          "0%": { transform: "translateY(0%) rotate(0deg)", opacity: "1" },
          "30%": { transform: "translateY(-15%) rotate(-6deg)", opacity: "1" },
          "100%": { transform: "translateY(-130%) rotate(12deg)", opacity: "0" },
        },
        fadeInScale: {
          "0%": { transform: "scale(0.5)", opacity: "0" },
          "60%": { transform: "scale(1.1)", opacity: "1" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        pulse: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
        countdownPop: {
          "0%": { transform: "scale(2)", opacity: "0" },
          "30%": { transform: "scale(1)", opacity: "1" },
          "70%": { transform: "scale(1)", opacity: "1" },
          "100%": { transform: "scale(0)", opacity: "0" },
        },
      },
      animation: {
        "coin-flip": "coinFlip 0.6s ease-in-out",
        "hk-drop": "handkerchiefDrop 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        "hk-lift": "handkerchiefLift 0.6s ease-in forwards",
        "fade-in-scale": "fadeInScale 0.4s ease-out forwards",
        "pulse-slow": "pulse 2s ease-in-out infinite",
        "countdown-pop": "countdownPop 0.8s ease-in-out forwards",
      },
    },
  },
  plugins: [],
};

export default config;
