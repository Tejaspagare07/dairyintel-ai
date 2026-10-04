// accent: primary | blue | violet | danger | gold
const ACCENT = {
  primary: { bg: "var(--primary-tint)", fg: "var(--primary-deep)" },
  secondary: { bg: "var(--blue-tint)", fg: "var(--blue)" },
  blue: { bg: "var(--blue-tint)", fg: "var(--blue)" },
  tertiary: { bg: "var(--violet-tint)", fg: "var(--violet)" },
  violet: { bg: "var(--violet-tint)", fg: "var(--violet)" },
  error: { bg: "var(--danger-tint)", fg: "var(--danger)" },
  danger: { bg: "var(--danger-tint)", fg: "var(--danger)" },
  gold: { bg: "var(--gold-tint)", fg: "#8a6410" },
};

export default function StatCard({ icon, label, value, unit, accent = "primary", trend }) {
  const a = ACCENT[accent] || ACCENT.primary;
  return (
    <div className="stat">
      <div className="top">
        <div className="si" style={{ background: a.bg }}>
          <span className="material-symbols-outlined" style={{ color: a.fg }}>{icon}</span>
        </div>
        {trend && <span className={`trend ${trend.dir || "up"}`}>{trend.text}</span>}
      </div>
      <div className="v">{value}{unit && <small> {unit}</small>}</div>
      <div className="l">{label}</div>
    </div>
  );
}