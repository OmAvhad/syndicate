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
        bg: "#0B0D0F",
        surface: {
          DEFAULT: "#141719",
          raised: "#1A1E21",
          hover: "#202629",
        },
        accent: {
          DEFAULT: "#C6F36A",
          muted: "#9FCA4F",
          soft: "rgba(198, 243, 106, 0.12)",
        },
        text: {
          primary: "#F4F5F2",
          secondary: "#A0A6A8",
          muted: "#737B7E",
          inverse: "#0B0D0F",
        },
        border: {
          DEFAULT: "#252A2D",
          strong: "#343B3F",
        },
        semantic: {
          success: "#79D99A",
          warning: "#F0C674",
          danger: "#F07F7F",
          info: "#83B9F2",
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
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "monospace",
        ],
      },
      transitionDuration: {
        fast: "160ms",
        normal: "260ms",
        slow: "420ms",
      },
      transitionTimingFunction: {
        standard: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
      animation: {
        fadeIn: "fadeIn 260ms cubic-bezier(0.22, 1, 0.36, 1)",
        slideUp: "slideUp 320ms cubic-bezier(0.22, 1, 0.36, 1)",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideUp: {
          "0%": { transform: "translateY(16px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
      },
    },
  },
  plugins: [],
}
