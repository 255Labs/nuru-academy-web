import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        nuru: {
          // Semantic tokens — values flip between :root and .dark in globals.css
          bg: "rgb(var(--c-bg) / <alpha-value>)",
          card: "rgb(var(--c-card) / <alpha-value>)",
          ink: "rgb(var(--c-ink) / <alpha-value>)",
          ink2: "rgb(var(--c-ink2) / <alpha-value>)",
          muted: "rgb(var(--c-muted) / <alpha-value>)",
          line: "rgb(var(--c-line) / <alpha-value>)",
          lav: "rgb(var(--c-lav) / <alpha-value>)",
          // Brand accents — constant across themes (this is the identity, not the surface)
          purple: "#7C5CFF",
          purpleDeep: "#6040F0",
          purpleDark: "#3E2A9E",
          violet: "#9B7CFF",
          gold: "#FFBE30",
          goldDeep: "#E8A010",
          green: "#1DD65E",
          greenDeep: "#14B84A",
          blue: "#2F7FFF",
          orange: "#FF7A1A",
          rose: "#FF3D3D",
          teal: "#0DCFBE",
        },
      },
      fontFamily: {
        display: ["var(--font-baloo, 'Baloo 2')", "ui-rounded", "system-ui", "sans-serif"],
        body: ["var(--font-inter, 'Inter')", "system-ui", "-apple-system", "sans-serif"],
      },
      borderRadius: {
        xl2: "0.875rem",
        "2xl2": "1.125rem",
      },
      boxShadow: {
        card: "0 1px 2px rgba(16, 15, 30, 0.04), 0 1px 3px rgba(16, 15, 30, 0.06)",
        pop: "0 4px 14px -4px rgba(16, 15, 30, 0.12), 0 2px 4px -2px rgba(16, 15, 30, 0.08)",
        gold: "0 4px 14px -4px rgba(16, 15, 30, 0.12)",
      },
      keyframes: {
        floaty: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-8px)" } },
        pop: { "0%": { transform: "scale(.5)", opacity: "0" }, "100%": { transform: "scale(1)", opacity: "1" } },
        blink: { "0%,93%,100%": { transform: "scaleY(1)" }, "96%": { transform: "scaleY(.1)" } },
        confetti: { to: { transform: "translate(var(--dx), var(--dy)) rotate(var(--rot))", opacity: "0" } },
      },
      animation: {
        floaty: "floaty 3.2s ease-in-out infinite",
        pop: "pop .35s cubic-bezier(.2,1.4,.4,1) both",
        blink: "blink 4.5s infinite",
      },
    },
  },
  plugins: [],
};
export default config;
