/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // ── Backgrounds ────────────────────────────────────
        ink: "#0a0a0a",          // page background
        panel: "#111111",        // card / surface L1
        "panel-raised": "#161616", // surface L2 (nested cards)

        // ── Borders ────────────────────────────────────────
        line: "#1f1f1f",         // default border
        "line-strong": "#2a2a2a", // stronger border

        // ── Text ───────────────────────────────────────────
        soft: "#b8b0a4",         // secondary text
        muted: "#6b6560",        // tertiary / placeholder

        // ── Primary accent — Warm Amber / Gold ─────────────
        glow: "#e2c98f",         // amber light (hover highlight)
        glowStrong: "#c8a96e",   // amber (primary accent)
        "amber-dim": "#3d2e1a",  // amber tinted surface (15%)

        // ── Status: Hot / Urgent ───────────────────────────
        hot: "#e85d4a",
        "hot-dim": "#2d1510",

        // ── Status: Success ────────────────────────────────
        success: "#4ade80",
        "success-dim": "#0f2d1a",

        // ── Code / Mono surface ────────────────────────────
        code: "#0d0d0d",

        // ── Legacy alias (kept for backward-compat) ────────
        accent: "#1a1a1a"
      },

      boxShadow: {
        soft: "0 4px 24px rgba(0,0,0,0.4)",
        modal: "0 24px 64px rgba(0,0,0,0.6)",
        glow: "0 0 24px rgba(200,169,110,0.15)"
      },

      fontFamily: {
        display: ["\"Cormorant Garamond\"", "Georgia", "serif"],
        sans: ["\"DM Sans\"", "ui-sans-serif", "system-ui"],
        mono: ["\"JetBrains Mono\"", "\"Courier New\"", "monospace"]
      },

      fontSize: {
        "2xs": ["0.65rem", { lineHeight: "1rem" }]
      },

      borderRadius: {
        card: "24px",
        modal: "32px",
        section: "28px"
      },

      animation: {
        "fade-in": "fadeIn 200ms ease-out both",
        "fade-up": "fadeUp 250ms ease-out both",
        "dot-pulse": "dotPulse 1.4s ease-in-out infinite",
        shimmer: "shimmer 1.8s linear infinite"
      },

      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" }
        },
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        dotPulse: {
          "0%, 80%, 100%": { transform: "scale(0.6)", opacity: "0.4" },
          "40%": { transform: "scale(1)", opacity: "1" }
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" }
        }
      }
    }
  },
  plugins: []
};
