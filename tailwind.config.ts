import type { Config } from "tailwindcss";

// ---------------------------------------------------------------------------
// reev Brand Guidelines
// ---------------------------------------------------------------------------
// Typography: Arial — chosen because it is a widely available system font
// that can be freely distributed across all platforms without licensing issues.
//
// Primary colors (from reev brand guideline):
//   Yellow        #FFC100   — primary accent / CTA
//   Dark          #131924   — primary text / dark backgrounds
//   Light Gray    #B5C1C8   — muted text, borders, secondary elements
//
// Status palette:
//   Green         #43D090   — available
//   Blue          #5492ED   — charging
//   Red           #FF2B3A   — faulted
//   Orange        #E19100   — warning
//
// Each status color has -light and -dark variants for contrast flexibility.
// ---------------------------------------------------------------------------

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#fffbeb",
          100: "#fff3c4",
          200: "#ffe950",
          300: "#ffc100",
          400: "#e5ad00",
          500: "#cc9a00",
          600: "#997300",
          700: "#664d00",
          800: "#131924",
          900: "#0e1119",
          950: "#090b0f",
        },
        reev: {
          dark: "#131924",
          yellow: "#ffc100",
          "yellow-light": "#ffe950",
          muted: "#b5c1c8",
          "muted-dark": "#5a636b",
          green: "#43d090",
          "green-light": "#97e8b8",
          "green-dark": "#00af57",
          red: "#ff2b3a",
          "red-light": "#ff9ea1",
          "red-dark": "#ee0012",
          blue: "#5492ed",
          "blue-light": "#9dc7ea",
          "blue-dark": "#2772cc",
          orange: "#e19100",
          "orange-light": "#ffd86c",
          "orange-dark": "#c97700",
        },
      },
      fontFamily: {
        sans: ["Arial", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [require("@tailwindcss/forms")],
};

export default config;
