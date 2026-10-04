// Result panels shared by the Milk check page and the check-history detail modal.

const GRADE_CLS = { Good: "good", Average: "avg", Poor: "poor" };
const ICON = { ok: "check_circle", warn: "warning", bad: "cancel", info: "info" };

export function Reasons({ items = [] }) {
  return (
    <ul className="reasons">
      {items.map((r, i) => (
        <li key={i} className={`r-${r.level}`} style={{ animationDelay: `${i * 60}ms` }}>
          <span className="material-symbols-outlined">{ICON[r.level] || "info"}</span>
          <span>{r.text}</span>
        </li>
      ))}
    </ul>
  );
}

export function QualityCard({ q }) {
  if (!q) return null;
  const cls = GRADE_CLS[q.grade] || "avg";
  const C = 2 * Math.PI * 34;
  return (
    <section className="panel result-panel fade-in" aria-live="polite">
      <div className="panel-head"><h2 className="h3">Milk quality</h2><span className="chip chip-neutral">{q.standard}</span></div>
      <div className={`grade-hero g-${cls}`}>
        <svg viewBox="0 0 80 80" width="84" height="84" className="score-ring" aria-hidden="true">
          <circle cx="40" cy="40" r="34" className="ring-bg" />
          <circle cx="40" cy="40" r="34" className="ring-fg" strokeDasharray={C} strokeDashoffset={C * (1 - (q.score || 0) / 100)} />
          <text x="40" y="45" textAnchor="middle">{q.score}</text>
        </svg>
        <div>
          <div className="gh-l">Grade</div>
          <div className="gh-v">{q.grade}</div>
          <div className="gh-s">Score {q.score}/100</div>
        </div>
      </div>
      <Reasons items={q.reasons} />
    </section>
  );
}

export function HealthCard({ d, threshold }) {
  if (!d) return null;
  const high = d.status === "High Risk";
  const thr = threshold ?? d.threshold ?? 0.35;
  const bars = [["Mastitis", d.probabilities?.Mastitis || 0, "var(--danger)"], ["Ketosis", d.probabilities?.Ketosis || 0, "var(--warn)"]];
  return (
    <section className={`panel result-panel fade-in ${high ? "risk" : "safe"}`} aria-live="polite">
      <div className="panel-head">
        <h2 className="h3">Animal health</h2>
        <span className={`chip ${high ? "chip-poor" : "chip-good"}`}>{d.status}</span>
      </div>
      <p className="likely">
        {high ? <>Likely condition: <b>{d.condition}</b></> : <>No disease pattern found in this sample.</>}
        <span className="muted"> · Risk level {d.riskLevel}</span>
      </p>
      <div className="lab-used">
        {d.labInputsUsed?.length
          ? <span className="chip chip-good"><span className="material-symbols-outlined">labs</span> Used lab readings: {d.labInputsUsed.map((x) => x.toUpperCase()).join(" + ")}</span>
          : <span className="chip chip-neutral"><span className="material-symbols-outlined">science</span> Composition only — add EC / SCC for a stronger mastitis check</span>}
      </div>
      <div className="probs">
        {bars.map(([name, p, color]) => (
          <div key={name} className="prob">
            <div className="prob-top"><span>{name}</span><b>{Math.round(p * 100)}%</b></div>
            <div className="prob-track">
              <div className="prob-fill" style={{ width: `${Math.max(2, p * 100)}%`, background: color }} />
              <div className="prob-thr" style={{ left: `${thr * 100}%` }} title={`Alert threshold ${Math.round(thr * 100)}%`} />
            </div>
          </div>
        ))}
        <div className="thr-note">Marker = alert threshold ({Math.round(thr * 100)}%), chosen on cross-validation</div>
      </div>
      <Reasons items={d.reasons} />
      <div className={`advice ${high ? "warn" : "ok"}`}>
        <span className="material-symbols-outlined">{high ? "medical_services" : "thumb_up"}</span>{d.advice}
      </div>
    </section>
  );
}
