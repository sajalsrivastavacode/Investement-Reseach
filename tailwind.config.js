/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        inkNavy: "var(--ink-navy)",
        ledgerSurface: "var(--ledger-surface)",
        line: "var(--line)",
        stampRose: "var(--stamp-rose)",
        mutedRose: "var(--muted-rose)",
        steelBlue: "var(--steel-blue)",
        paleBlue: "var(--pale-blue)",
        paper: "var(--paper)",
        textMuted: "var(--text-muted)",
        textDim: "var(--text-dim)",
      },
      fontFamily: {
        sans: ["var(--font-ibm-sans)", "sans-serif"],
        mono: ["var(--font-ibm-mono)", "monospace"],
      },
      borderRadius: {
        lg: "12px",
        md: "8px",
        sm: "4px",
      },
    },
  },
  plugins: [],
};
