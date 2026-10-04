/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // ---- Pasture semantic tokens ----
        bg: "var(--bg)",
        surface: "var(--surface)",
        "surface-soft": "var(--surface-soft)",
        ink: "var(--ink)",
        muted: "var(--muted)",
        faint: "var(--faint)",
        line: "var(--line)",
        "line-soft": "var(--line-soft)",
        primary: "var(--primary)",
        "primary-deep": "var(--primary-deep)",
        "primary-tint": "var(--primary-tint)",
        gold: "var(--gold)",
        "gold-tint": "var(--gold-tint)",
        blue: "var(--blue)",
        "blue-tint": "var(--blue-tint)",
        violet: "var(--violet)",
        "violet-tint": "var(--violet-tint)",
        ok: "var(--ok)",
        warn: "var(--warn)",
        danger: "var(--danger)",
        "danger-tint": "var(--danger-tint)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Bricolage Grotesque", "Inter", "sans-serif"],
      },
      borderRadius: { sm: "10px", md: "14px", lg: "20px", xl: "28px" },
      boxShadow: {
        sm: "0 1px 2px rgba(16,40,28,.05), 0 1px 3px rgba(16,40,28,.04)",
        md: "0 6px 20px rgba(16,40,28,.07)",
        lg: "0 18px 50px rgba(16,40,28,.12)",
      },
    },
  },
  plugins: [],
};
