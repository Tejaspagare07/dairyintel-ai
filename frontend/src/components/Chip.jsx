// Maps both new grade names and legacy color names to Pasture chip styles.
const MAP = {
  good: "chip-good", average: "chip-avg", poor: "chip-poor",
  primary: "chip-primary", secondary: "chip-secondary", warn: "chip-warn",
  error: "chip-error", high: "chip-poor", medium: "chip-avg", low: "chip-good",
  neutral: "chip-neutral",
};

export default function Chip({ label, color = "neutral" }) {
  const key = String(color).toLowerCase();
  const cls = MAP[key] || MAP[String(label).toLowerCase()] || "chip-neutral";
  return <span className={`chip ${cls}`}>{label}</span>;
}
