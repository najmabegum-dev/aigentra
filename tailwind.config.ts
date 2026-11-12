import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/ui/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/rooms/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/studio/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        background: "var(--background)",
        foreground: "var(--foreground)",
        // Ink & Signal Design Tokens
        bg: "var(--color-bg)",
        surface: {
          DEFAULT: "var(--color-surface)",
          2: "var(--color-surface-2)",
          raised: "var(--color-surface-2)",
          overlay: "var(--color-surface-2)",
        },
        line: {
          DEFAULT: "var(--color-line)",
          strong: "var(--color-line-strong)",
        },
        text: {
          DEFAULT: "var(--color-text)",
          dim: "var(--color-text-dim)",
        },
        signal: "var(--color-signal)",
        allow: "var(--color-allow)",
        approval: "var(--color-approval)",
        deny: "var(--color-deny)",
        ink: "var(--ink)",
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        status: {
          allow: "var(--status-allow)",
          approval: "var(--status-approval)",
          deny: "var(--status-deny)",
          info: "var(--status-info)",
          sandbox: "var(--status-sandbox)",
        },
      },
      borderRadius: {
        DEFAULT: "var(--radius, 6px)",
        sm: "var(--radius-sm, 4px)",
        md: "var(--radius-md, 6px)",
        lg: "var(--radius-lg, 6px)",
        xl: "var(--radius-xl, 8px)",
        card: "6px",
        input: "4px",
      },
      fontFamily: {
        display: [
          "var(--font-instrument-serif)",
          "Georgia",
          "serif",
        ],
        sans: [
          "var(--font-inter-tight)",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
        mono: [
          "var(--font-jetbrains-mono)",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },
      transitionDuration: {
        standard: "150ms",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
