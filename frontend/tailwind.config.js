/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx,js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "rgb(var(--color-bg-rgb) / <alpha-value>)",
        surface: {
          DEFAULT: "rgb(var(--color-surface-rgb) / <alpha-value>)",
          raised: "rgb(var(--color-surface-raised-rgb) / <alpha-value>)",
          hover: "rgb(var(--color-surface-hover-rgb) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "rgb(var(--color-accent-rgb) / <alpha-value>)",
          muted: "rgb(var(--color-accent-muted-rgb) / <alpha-value>)",
          soft: "var(--color-accent-soft)",
        },
        text: {
          primary: "rgb(var(--color-text-primary-rgb) / <alpha-value>)",
          secondary: "rgb(var(--color-text-secondary-rgb) / <alpha-value>)",
          muted: "rgb(var(--color-text-muted-rgb) / <alpha-value>)",
          inverse: "rgb(var(--color-text-inverse-rgb) / <alpha-value>)",
        },
        border: {
          DEFAULT: "rgb(var(--color-border-rgb) / <alpha-value>)",
          strong: "rgb(var(--color-border-strong-rgb) / <alpha-value>)",
        },
        semantic: {
          success: "rgb(var(--color-success-rgb) / <alpha-value>)",
          warning: "rgb(var(--color-warning-rgb) / <alpha-value>)",
          danger: "rgb(var(--color-danger-rgb) / <alpha-value>)",
          info: "rgb(var(--color-info-rgb) / <alpha-value>)",
        },
      },
      borderRadius: {
        sm: "8px",
        md: "12px",
        lg: "16px",
        xl: "24px",
        pill: "999px",
      },
      fontFamily: {
        display: [
          "'Bricolage Grotesque'",
          "Inter",
          "-apple-system",
          "sans-serif",
        ],
        body: [
          "'Atkinson Hyperlegible'",
          "Inter",
          "-apple-system",
          "sans-serif",
        ],
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        mono: [
          "JetBrains Mono",
          "SF Mono",
          "Fira Code",
          "monospace",
        ],
      },
      boxShadow: {
        glow: "0 0 24px rgba(198, 243, 106, 0.15)",
        "glow-sm": "0 0 12px rgba(198, 243, 106, 0.10)",
        card: "0 1px 3px rgba(0, 0, 0, 0.4), 0 1px 2px rgba(0, 0, 0, 0.3)",
      },
      transitionDuration: {
        fast: "160ms",
        normal: "260ms",
        slow: "420ms",
      },
      transitionTimingFunction: {
        standard: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
    },
  },
  plugins: [],
}
