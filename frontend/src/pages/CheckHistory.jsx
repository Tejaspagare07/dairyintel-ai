import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import AppLayout from "../components/AppLayout";
import TestDetail from "../components/TestDetail";
import { HealthChip } from "./UserDashboard";
import useSeo from "../hooks/useSeo";

const GRADE_CHIP = { Good: "chip-good", Average: "chip-avg", Poor: "chip-poor" };
const GRADE_ICON = { Good: "check_circle", Average: "warning", Poor: "error" };
const RISK_CHIP = { High: "chip-poor", Medium: "chip-avg", Low: "chip-good" };

/* ─── "Herd trend (AI)" analyser: reads an animal's recent history for a developing problem ─── */
function HerdTrend() {
  const [animals, setAnimals] = useState([]);
  const [animalId, setAnimalId] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    api.get("/animals").then((r) => { setAnimals(r.data); if (r.data[0]) setAnimalId(r.data[0]._id); }).catch(() => {});
  }, []);

  const run = async () => {
    setErr(""); setResult(null); setLoading(true);
    try { const { data } = await api.post("/predict/history", { animalId }); setResult(data); }
    catch (e2) { setErr(e2.response?.data?.message || "Analysis failed"); }
    finally { setLoading(false); }
  };

  return (
    <section className="panel-v3" aria-label="Herd trend analysis">
      <div className="pv3-head">
        <h2 className="pv3-title">
          <span className="pv3-icon" style={{ background: "var(--violet-tint)", color: "var(--violet)" }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>monitoring</span>
          </span>
          Herd trend (AI)
        </h2>
      </div>
      <p className="muted small" style={{ marginTop: "-.4rem", marginBottom: "1rem" }}>
        Analyses one animal's recent milk history for a developing problem (mastitis / ketosis).
      </p>
      {!animals.length ? (
        <div className="empty-v3">
          <span className="material-symbols-outlined ev3-icon">timeline</span>
          <p className="ev3-text">Add an animal and record a few checks first — the trend needs some history to analyse.</p>
        </div>
      ) : (
        <>
          <div className="ch-trend-row">
            <select aria-label="Choose animal" value={animalId} onChange={(e) => setAnimalId(e.target.value)} className="ch-trend-sel">
              {animals.map((a) => <option key={a._id} value={a._id}>{a.animalId}{a.name ? ` — ${a.name}` : ""}</option>)}
            </select>
            <button className="btn btn-primary" onClick={run} disabled={loading || !animalId}>
              {loading ? <><span className="spinner" /> Analysing…</> : <><span className="material-symbols-outlined">auto_awesome</span> Run AI analysis</>}
            </button>
          </div>
          {err && <p className="form-err" role="alert">{err}</p>}
          {result && (
            <div className={`verdict ${result.riskLevel === "Low" ? "ok" : "warn"}`} style={{ marginTop: "1rem" }}>
              <span className="material-symbols-outlined">{result.riskLevel === "Low" ? "check_circle" : "warning"}</span>
              <div>
                <p style={{ margin: "0 0 .4rem" }}>
                  <b>Risk level: <span className={`chip ${RISK_CHIP[result.riskLevel] || "chip-neutral"}`}>{result.riskLevel}</span></b>
                  {result.diseases?.length > 0 && <> · {result.diseases.join(", ")}</>}
                </p>
                <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>{result.explanation?.map((e, i) => <li key={i}>{e}</li>)}</ul>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default function CheckHistory() {
  const admin = localStorage.getItem("role") === "admin";
  useSeo({
    title: admin ? "All milk checks — DairyIntel AI" : "Milk check history — DairyIntel AI",
    description: "Browse every AI-graded milk quality check with FSSAI & BIS scoring, mastitis & ketosis health flags, and one-click CSV export for your dairy records.",
    noindex: true,
    path: "/checks",
  });
  const [tests, setTests] = useState(null);
  const [q, setQ] = useState("");
  const [grade, setGrade] = useState("");
  const [risk, setRisk] = useState("");
  const [open, setOpen] = useState(null);
  const [view, setView] = useState("checks");
  const nav = useNavigate();

  useEffect(() => { api.get("/tests?limit=500").then((r) => setTests(r.data)).catch(() => setTests([])); }, []);

  const rows = useMemo(() => (tests || []).filter((t) =>
    (!grade || t.quality?.grade === grade) &&
    (!risk || t.disease?.status === risk) &&
    (!q || [t.testNo, t.animalId?.animalId, t.animalId?.name, t.userId?.name].join(" ").toLowerCase().includes(q.toLowerCase()))
  ), [tests, q, grade, risk]);

  const healthy = (tests || []).filter((t) => t.disease?.status !== "High Risk").length;
  const atRisk = (tests || []).filter((t) => t.disease?.status === "High Risk").length;

  const exportCsv = () => {
    const head = ["testNo", "date", "farmer", "animal", "shift", "fat", "snf", "clr", "protein", "lactose", "addedWater", "temp", "ec", "scc", "grade", "score", "health", "condition", "riskPct"];
    const lines = rows.map((t) => [t.testNo, new Date(t.testedAt).toISOString(), t.userId?.name || "", t.animalId?.animalId || "", t.shift, t.fat, t.snf, t.clr, t.protein, t.lactose, t.addedWater, t.temp, t.ec, t.scc,
      t.quality?.grade, t.quality?.score, t.disease?.status, t.disease?.condition || "", Math.round((t.disease?.probabilities?.anyRisk || 0) * 100)]
      .map((v) => (v == null ? "" : `"${String(v).replace(/"/g, '""')}"`)).join(","));
    const blob = new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "milk-checks.csv"; a.click();
  };

  return (
    <AppLayout title={admin ? "All milk checks" : "Check history"}>
      <div className="ch-page">

        {/* ───── HERO HEADER ───── */}
        <section className="phero dash-enter-1">
          <div className="phero-bg" aria-hidden="true" />
          <div className="phero-main">
            <div className="phero-ic phero-ic-primary">
              <span className="material-symbols-outlined" style={{ fontSize: 26 }}>history</span>
            </div>
            <div>
              <h1 className="phero-title">{admin ? "All milk checks" : "Check history"}</h1>
              <p className="phero-sub">
                {tests ? (
                  <>Showing <strong>{rows.length}</strong> of <strong>{tests.length}</strong> AI-graded checks
                    {atRisk > 0 && <span className="phero-pill danger"><span className="material-symbols-outlined" style={{ fontSize: 13 }}>priority_high</span>{atRisk} at risk</span>}
                    {atRisk === 0 && tests.length > 0 && <span className="phero-pill ok"><span className="material-symbols-outlined" style={{ fontSize: 13 }}>verified</span>all healthy</span>}
                  </>
                ) : "Loading records…"}
              </p>
            </div>
          </div>
          <div className="phero-actions">
            <button className="btn btn-ghost" onClick={exportCsv} disabled={!rows.length}>
              <span className="material-symbols-outlined">download</span> Export CSV
            </button>
            {!admin && <button className="btn btn-primary" onClick={() => nav("/milk-check")}>
              <span className="material-symbols-outlined">add</span> New check
            </button>}
          </div>
        </section>

        {/* ───── VIEW TABS ───── */}
        {!admin && (
          <div className="segv3 dash-enter-2" role="tablist" aria-label="History view">
            <button role="tab" aria-selected={view === "checks"} className={view === "checks" ? "on" : ""} onClick={() => setView("checks")}>
              <span className="material-symbols-outlined" style={{ fontSize: 17 }}>table_rows</span> Checks
            </button>
            <button role="tab" aria-selected={view === "trend"} className={view === "trend" ? "on" : ""} onClick={() => setView("trend")}>
              <span className="material-symbols-outlined" style={{ fontSize: 17 }}>auto_awesome</span> Herd trend (AI)
            </button>
          </div>
        )}

        {view === "trend" && !admin ? <HerdTrend /> : (
          <section className="panel-v3 dash-enter-3" aria-label="Milk checks">
            {/* filter bar */}
            <div className="ch-filters">
              <div className="ch-search">
                <span className="material-symbols-outlined">search</span>
                <input aria-label="Search" placeholder={admin ? "Search test, animal or farmer…" : "Search test or animal…"} value={q} onChange={(e) => setQ(e.target.value)} />
                {q && <button className="ch-clear" onClick={() => setQ("")} aria-label="Clear search"><span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span></button>}
              </div>
              <select aria-label="Filter by grade" value={grade} onChange={(e) => setGrade(e.target.value)} className="ch-sel">
                <option value="">All grades</option><option>Good</option><option>Average</option><option>Poor</option>
              </select>
              <select aria-label="Filter by health" value={risk} onChange={(e) => setRisk(e.target.value)} className="ch-sel">
                <option value="">All health results</option><option value="Healthy">Healthy</option><option value="High Risk">High Risk</option>
              </select>
            </div>

            {!tests ? <div className="skeleton" style={{ height: 300, borderRadius: 12 }} /> : rows.length === 0 ? (
              <div className="empty-v3">
                <span className="material-symbols-outlined ev3-icon">search_off</span>
                <p className="ev3-text">{tests.length === 0 ? "No milk checks yet" : "No checks match your filters"}</p>
                {tests.length === 0 && !admin && (
                  <button className="btn btn-primary" onClick={() => nav("/milk-check")}>
                    <span className="material-symbols-outlined">add</span> Run your first check
                  </button>
                )}
                {tests.length > 0 && (
                  <button className="btn btn-ghost" onClick={() => { setQ(""); setGrade(""); setRisk(""); }}>Clear filters</button>
                )}
              </div>
            ) : (
              <div className="table-wrap tv3">
                <table>
                  <thead>
                    <tr>
                      <th>Test ID</th><th>Date</th>{admin && <th>Farmer</th>}<th>Animal</th>
                      <th className="hide-sm">Fat</th><th className="hide-sm">SNF</th><th className="hide-sm">Water</th>
                      <th>Quality</th><th>Health</th>
                      <th style={{ width: 36 }} className="hide-sm" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((t) => (
                      <tr key={t._id} className="clickable" tabIndex={0} onClick={() => setOpen(t)} onKeyDown={(e) => e.key === "Enter" && setOpen(t)}>
                        <td><span className="tid">{t.testNo}</span></td>
                        <td>
                          <div className="ch-datecell">
                            <span>{new Date(t.testedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                            <span className={`shift-tag ${t.shift === "Morning" ? "morning" : "evening"}`}>{t.shift}</span>
                          </div>
                        </td>
                        {admin && <td>{t.userId?.name || "—"}</td>}
                        <td>
                          <div className="acell">
                            <span className="acell-av">{(t.animalId?.animalId || "BK")[0]}</span>
                            <span className="acell-name">{t.animalId?.animalId || "Bulk"}</span>
                          </div>
                        </td>
                        <td className="hide-sm num">{t.fat ?? "—"}</td>
                        <td className="hide-sm num">{t.snf ?? "—"}</td>
                        <td className="hide-sm num">{t.addedWater != null && t.addedWater > 0 ? <span className="num-warn">{t.addedWater}%</span> : (t.addedWater ?? "—")}</td>
                        <td>
                          <span className={`chip ${GRADE_CHIP[t.quality?.grade] || "chip-neutral"}`}>
                            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>{GRADE_ICON[t.quality?.grade] || "help"}</span>
                            {t.quality?.grade} · {t.quality?.score}
                          </span>
                        </td>
                        <td><HealthChip t={t} /></td>
                        <td className="hide-sm"><span className="material-symbols-outlined row-arrow">chevron_right</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </div>
      <TestDetail test={open} onClose={() => setOpen(null)} />
    </AppLayout>
  );
}