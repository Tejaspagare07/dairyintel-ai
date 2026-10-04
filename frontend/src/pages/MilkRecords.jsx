import { useEffect, useState } from "react";
import api from "../api";
import AppLayout from "../components/AppLayout";
import Modal from "../components/Modal";
import StatCard from "../components/StatCard";
import useSeo from "../hooks/useSeo";

const GRADE_CHIP = { Good: "chip-good", Average: "chip-avg", Poor: "chip-poor" };
const GRADE_ICON = { Good: "check_circle", Average: "warning", Poor: "error" };
const SUBMIT_FIELDS = [
  { key: "quantity", label: "Total milk quantity (L)", required: true, ph: "e.g. 45.5" },
  { key: "fat", label: "Fat %", ph: "e.g. 4.2" },
  { key: "snf", label: "SNF %", ph: "e.g. 8.6" },
  { key: "protein", label: "Protein %", ph: "e.g. 3.2" },
  { key: "lactose", label: "Lactose %", ph: "e.g. 4.7" },
  { key: "ec", label: "Electrical conductivity (mS/cm)", ph: "e.g. 5.2" },
  { key: "temperature", label: "Milk temperature (°C)", ph: "e.g. 4.5" },
];

// Mirror of backend utils/quality.js so the table can show a grade even though
// GET /api/milk returns raw records without one. Keep in sync with the server rules.
function gradeOf({ fat, snf, protein, temperature }) {
  const num = (v) => (v === undefined || v === null || v === "" ? null : Number(v));
  fat = num(fat); snf = num(snf); protein = num(protein); temperature = num(temperature);
  if (fat === null && snf === null && protein === null && temperature === null) return null;
  let score = 100;
  if (fat !== null) { if (fat < 3.0) score -= 30; else if (fat < 3.5) score -= 12; }
  if (snf !== null) { if (snf < 8.0) score -= 30; else if (snf < 8.5) score -= 12; }
  if (protein !== null) { if (protein < 2.8) score -= 15; }
  if (temperature !== null) { if (temperature > 8) score -= 25; else if (temperature > 6) score -= 10; }
  score = Math.max(0, score);
  if (score < 60) return "Poor";
  if (score < 82) return "Average";
  return "Good";
}

// ---- the "submit a collection" form, shown in a modal ----
function SubmitForm({ onSaved }) {
  const [session, setSession] = useState("Morning");
  const [form, setForm] = useState({});
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault(); setErr(""); setBusy(true);
    try {
      const payload = { session };
      SUBMIT_FIELDS.forEach((f) => { if (form[f.key] !== undefined && form[f.key] !== "") payload[f.key] = Number(form[f.key]); });
      await api.post("/milk", payload);
      onSaved();
    } catch (e2) { setErr(e2.response?.data?.message || "Failed to save"); }
    finally { setBusy(false); }
  };

  return (
    <form className="mr-form" onSubmit={submit}>
      <div className="mr-field full">
        <label className="mc-lbl">Session</label>
        <div className="mr-seg">
          <div className="mr-seg-thumb" style={{ transform: session === "Morning" ? "translateX(0)" : "translateX(100%)" }} />
          {["Morning", "Evening"].map((s) => (
            <button key={s} type="button" onClick={() => setSession(s)} className={session === s ? "on" : ""}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{s === "Morning" ? "wb_sunny" : "nights_stay"}</span> {s}
            </button>
          ))}
        </div>
      </div>
      {SUBMIT_FIELDS.map((f) => (
        <div key={f.key} className="mr-field">
          <label className="mc-lbl">{f.label} {f.required && <span className="mc-req">*</span>}</label>
          <input className="mc-input" type="number" step="any" value={form[f.key] || ""} onChange={set(f.key)} placeholder={f.ph} required={f.required} />
        </div>
      ))}
      <div className="mr-field full">
        {err && <p className="form-err" role="alert">{err}</p>}
        <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy}>
          {busy ? <span className="spinner" /> : <><span className="material-symbols-outlined">save</span> Save collection</>}
        </button>
      </div>
    </form>
  );
}

export default function MilkRecords() {
  const admin = localStorage.getItem("role") === "admin";
  useSeo({
    title: admin ? "All milk collection — DairyIntel AI" : "Milk collection log — DairyIntel AI",
    description: "Track daily milk collection by session with litres, fat, SNF and protein readings and automatic FSSAI-based quality grading for every batch.",
    noindex: true,
    path: "/records",
  });
  const [records, setRecords] = useState([]);
  const [range, setRange] = useState("all");
  const [loading, setLoading] = useState(true);
  const [showSubmit, setShowSubmit] = useState(false);

  const load = () => {
    setLoading(true);
    api.get(`/milk?range=${range}`).then((r) => setRecords(r.data)).catch(() => setRecords([])).finally(() => setLoading(false));
  };
  useEffect(load, [range]);

  const totalLitres = records.reduce((s, r) => s + (Number(r.quantity) || 0), 0);
  const fats = records.map((r) => Number(r.fat)).filter((n) => !Number.isNaN(n));
  const snfs = records.map((r) => Number(r.snf)).filter((n) => !Number.isNaN(n));
  const avg = (arr) => (arr.length ? (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2) : "—");
  const avgFat = avg(fats);
  const avgSnf = avg(snfs);
  const goodCount = records.filter((r) => gradeOf(r) === "Good").length;

  return (
    <AppLayout title={admin ? "All milk collection" : "Milk collection"}>
      <div className="mr-page">

        {/* ───── HERO HEADER ───── */}
        <section className="phero dash-enter-1">
          <div className="phero-bg phero-bg-blue" aria-hidden="true" />
          <div className="phero-main">
            <div className="phero-ic phero-ic-blue">
              <span className="material-symbols-outlined" style={{ fontSize: 26 }}>water_drop</span>
            </div>
            <div>
              <h1 className="phero-title">Milk collection</h1>
              <p className="phero-sub">
                {loading ? "Loading collections…" : <>Logged <strong>{records.length}</strong> collection{records.length === 1 ? "" : "s"} · <strong>{totalLitres.toLocaleString("en-IN")} L</strong> total</>}
              </p>
            </div>
          </div>
          <div className="phero-actions">
            <div className="mr-range">
              {[["all", "All"], ["daily", "Today"], ["monthly", "This month"]].map(([r, l]) => (
                <button key={r} onClick={() => { if (r !== range) setRange(r); }} className={range === r ? "on" : ""}>{l}</button>
              ))}
            </div>
            {!admin && <button className="btn btn-primary" onClick={() => setShowSubmit(true)}>
              <span className="material-symbols-outlined">add</span> Submit collection
            </button>}
          </div>
        </section>

        {/* ───── STAT ROW ───── */}
        <div className="stat-row dash-enter-2" role="list" aria-label="Collection summary">
          <StatCard icon="water_drop" label="Total litres" value={loading ? "…" : totalLitres.toLocaleString("en-IN")} unit={loading ? "" : "L"} accent="blue" />
          <StatCard icon="inventory_2" label="Collections" value={loading ? "…" : records.length} accent="primary" />
          <StatCard icon="opacity" label="Avg fat" value={avgFat} unit={avgFat !== "—" ? "%" : ""} accent="gold" />
          <StatCard icon="science" label="Avg SNF" value={avgSnf} unit={avgSnf !== "—" ? "%" : ""} accent={avgSnf !== "—" && Number(avgSnf) < 8.3 ? "danger" : "violet"} />
        </div>

        {/* ───── TABLE ───── */}
        <section className="panel-v3 dash-enter-3" aria-label="Collection records">
          <div className="pv3-head">
            <h2 className="pv3-title">
              <span className="pv3-icon" style={{ background: "var(--blue-tint)", color: "var(--blue)" }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>list_alt</span>
              </span>
              Collection log
              {records.length > 0 && <span className="pv3-count">{records.length}</span>}
            </h2>
            {!loading && records.length > 0 && <span className="mr-good-note"><span className="material-symbols-outlined" style={{ fontSize: 15 }}>verified</span>{goodCount} graded Good</span>}
          </div>

          {loading ? <div className="skeleton" style={{ height: 300, borderRadius: 12 }} /> : records.length === 0 ? (
            <div className="empty-v3">
              <span className="material-symbols-outlined ev3-icon">water_drop</span>
              <p className="ev3-text">No collections yet{range !== "all" ? " for this period" : ""}</p>
              {!admin && range === "all" && (
                <button className="btn btn-primary" onClick={() => setShowSubmit(true)}>
                  <span className="material-symbols-outlined">add</span> Log your first collection
                </button>
              )}
            </div>
          ) : (
            <div className="table-wrap tv3">
              <table>
                <thead>
                  <tr>
                    <th>Session</th><th>Date</th><th>Qty (L)</th>
                    <th className="hide-sm">Fat %</th><th className="hide-sm">SNF %</th><th className="hide-sm">Protein %</th>
                    <th className="hide-sm">EC</th><th className="hide-sm">Temp °C</th><th>Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => {
                    const g = gradeOf(r);
                    return (
                      <tr key={r._id}>
                        <td><span className={`shift-tag ${r.session === "Morning" ? "morning" : "evening"}`}>{r.session}</span></td>
                        <td>{new Date(r.collectionDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</td>
                        <td><span className="mr-qty">{r.quantity}</span></td>
                        <td className="hide-sm num">{r.fat ?? "—"}</td>
                        <td className="hide-sm num">{r.snf ?? "—"}</td>
                        <td className="hide-sm num">{r.protein ?? "—"}</td>
                        <td className="hide-sm num">{r.ec ?? "—"}</td>
                        <td className="hide-sm num">{r.temperature ?? "—"}</td>
                        <td>{g ? (
                          <span className={`chip ${GRADE_CHIP[g]}`}>
                            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>{GRADE_ICON[g]}</span>{g}
                          </span>
                        ) : <span style={{ color: "var(--faint)" }}>—</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <Modal open={showSubmit} onClose={() => setShowSubmit(false)} title="Submit milk collection">
        <p className="muted small" style={{ marginTop: 0 }}>Combined milk from your whole herd for this session.</p>
        <SubmitForm onSaved={() => { setShowSubmit(false); load(); }} />
      </Modal>
    </AppLayout>
  );
}