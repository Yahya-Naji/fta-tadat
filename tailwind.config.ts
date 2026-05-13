import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // ── New FTA-grade design system tokens (CSS-var-backed) ──────────
        // Surfaces
        base: "var(--bg-base)",
        "elev-1": "var(--bg-elev-1)",
        "elev-2": "var(--bg-elev-2)",
        // Borders
        "border-subtle": "var(--border-subtle)",
        "border-strong": "var(--border-strong)",
        // Text
        "text-primary": "var(--text-primary)",
        "text-secondary": "var(--text-secondary)",
        "text-muted": "var(--text-muted)",
        // Brand accent — FTA gold
        "accent-gold": "var(--accent-gold)",
        "accent-gold-soft": "var(--accent-gold-soft)",
        // TADAT score chips
        "score-A": "var(--score-A)",
        "score-B": "var(--score-B)",
        "score-C": "var(--score-C)",
        "score-D": "var(--score-D)",
        // Risk register source
        "risk-data": "var(--risk-data-derived)",
        "risk-illust": "var(--risk-tadat-illust)",
        "risk-fta": "var(--risk-fta-internal)",

        // ── Legacy keys (kept so existing UIs + KarimView don't break) ───
        surface: {
          DEFAULT: "#282C34",
          elevated: "#2F343D",
          accent: "#3A3F4B",
        },
        fta: {
          DEFAULT: "#00A89D",
          dark: "#007A72",
          light: "#33BFB5",
        },
        score: {
          a: "#10B981",
          b: "#3B82F6",
          c: "#F59E0B",
          d: "#EF4444",
        },
      },
      backgroundImage: {
        "quanterra-gradient":
          "linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)",
        "fta-accent": "linear-gradient(90deg, #00A89D 0%, #6366F1 100%)",
        "gold-line":
          "linear-gradient(90deg, transparent 0%, var(--accent-gold) 50%, transparent 100%)",
      },
      fontFamily: {
        // New keys — referenced by the redesigned surfaces
        display: ["var(--font-display)", "ui-sans-serif", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "ui-sans-serif", "system-ui", "sans-serif"],
        // Legacy keys retained
        sans: ["var(--font-body)", "ui-sans-serif", "system-ui", "Inter", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      letterSpacing: {
        // Display tracking — Inter Tight wants tight on big headings
        "display-tight": "-0.02em",
        "display-tighter": "-0.03em",
      },
      borderRadius: {
        card: "12px",
      },
      keyframes: {
        "shimmer-x": {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "draw-path": {
          "0%": { strokeDashoffset: "100" },
          "100%": { strokeDashoffset: "0" },
        },
      },
      animation: {
        "shimmer-x": "shimmer-x 2.6s linear infinite",
        "draw-path": "draw-path 600ms ease-out forwards",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
