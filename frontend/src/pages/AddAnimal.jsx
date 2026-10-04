import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import AppLayout from "../components/AppLayout";
import useSeo from "../hooks/useSeo";

const IDENTITY = [
  { k: "animalId", label: "Animal ID", ph: "e.g. COW-004", req: true, icon: "tag" },
  { k: "name", label: "Name", ph: "e.g. Kamdhenu", icon: "sell" },
  { k: "breed", label: "Breed", ph: "e.g. Gir", icon: "pets" },
];
const DETAILS = [
  { k: "age", label: "Age", unit: "years", type: "number", ph: "4", icon: "cake" },
  { k: "weight", label: "Weight", unit: "kg", type: "number", ph: "380", icon: "monitor_weight" },
  { k: "location", label: "Location / shed", ph: "Shed A", icon: "home" },
  { k: "feedType", label: "Feed type", ph: "Green fodder", icon: "grass" },
];

const TRACKS = [
  { icon: "biotech", label: "Per-animal milk quality grading" },
  { icon: "stethoscope", label: "Early mastitis & ketosis warnings" },
  { icon: "monitoring", label: "Herd trend analysis over time" },
  { icon: "water_drop", label: "Yield & collection history" },
];

export default function AddAnimal() {
  useSeo({
    title: "Register an animal — DairyIntel AI",
    description: "Add a cow or buffalo to your herd to unlock per-animal milk quality grading, early mastitis & ketosis detection, and yield tracking over time.",
    noindex: true,
    path: "/add-animal",
  });
  const [form, setForm] = useState({ animalId: "", name: "", breed: "", age: "", weight: "", location: "", feedType: "" });
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault(); setErr(""); setMsg(""); setBusy(true);
    try {
      await api.post("/animals", form);
      setMsg(`${form.name || form.animalId} registered successfully.`);
      setForm({ animalId: "", name: "", breed: "", age: "", weight: "", location: "", feedType: "" });
    } catch (e2) {
      setErr(e2.response?.data?.message || "Failed to add animal");
    } finally { setBusy(false); }
  };

  const renderField = (f) => (
    <div key={f.k} className="aa-field">
      <label className="mc-lbl" htmlFor={`aa-${f.k}`}>
        <span className="aa-lbl-ic material-symbols-outlined">{f.icon}</span>
        {f.label}{f.unit && <span className="mc-unit">{f.unit}</span>}{f.req && <span className="mc-req">*</span>}
      </label>
      <input id={`aa-${f.k}`} className="mc-input" type={f.type || "text"} value={form[f.k]} onChange={set(f.k)} placeholder={f.ph} required={f.req} />
    </div>
  );

  return (
    <AppLayout title="Add animal">
      <div className="aa-page">

        {/* ───── HERO HEADER ───── */}
        <section className="phero dash-enter-1">
          <div className="phero-bg phero-bg-gold" aria-hidden="true" />
          <div className="phero-main">
            <div className="phero-ic phero-ic-gold">
              <span className="material-symbols-outlined" style={{ fontSize: 26 }}>add_circle</span>
            </div>
            <div>
              <h1 className="phero-title">Register an animal</h1>
              <p className="phero-sub">Add a cow or buffalo to start tracking its health, quality &amp; yield.</p>
            </div>
          </div>
        </section>

        {/* ───── MAIN GRID ───── */}
        <div className="aa-grid dash-enter-2">

          {/* LEFT — FORM */}
          <form className="mc-form aa-form" onSubmit={submit}>
            <div className="mc-section">
              <div className="mc-sec-label">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>badge</span>
                Identity
              </div>
              <div className="aa-fields">{IDENTITY.map(renderField)}</div>
            </div>

            <div className="mc-section mc-section-light">
              <div className="mc-sec-label mc-sec-label-muted">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>description</span>
                Details
                <span className="mc-opt-tag">Optional</span>
              </div>
              <div className="aa-fields">{DETAILS.map(renderField)}</div>
            </div>

            <div className="aa-foot">
              {err && <p className="aa-alert err" role="alert"><span className="material-symbols-outlined" style={{ fontSize: 18 }}>error</span>{err}</p>}
              {msg && <p className="aa-alert ok" role="status"><span className="material-symbols-outlined" style={{ fontSize: 18 }}>check_circle</span>{msg}</p>}
              <div className="aa-actions">
                <button type="submit" className="btn btn-primary btn-lg aa-submit" disabled={busy}>
                  {busy ? <><span className="spinner" /> Saving…</> : <><span className="material-symbols-outlined">save</span> Save animal</>}
                </button>
                {msg && (
                  <button type="button" className="btn btn-ghost btn-lg" onClick={() => nav("/dashboard")}>
                    <span className="material-symbols-outlined">space_dashboard</span> Go to dashboard
                  </button>
                )}
                {!msg && (
                  <button type="button" className="btn btn-ghost btn-lg" onClick={() => nav("/dashboard")}>Cancel</button>
                )}
              </div>
            </div>
          </form>

          {/* RIGHT — INFO SIDE PANEL (decorative background) */}
          <aside className="aa-side dash-enter-3" aria-label="What you'll unlock">
            <div className="aa-side-bg" aria-hidden="true" />
            <div className="aa-side-inner">
              <span className="aa-side-badge"><span className="material-symbols-outlined" style={{ fontSize: 15 }}>auto_awesome</span> AI-powered</span>
              <h2 className="aa-side-title">One profile. Full history.</h2>
              <p className="aa-side-text">Registering an animal links every future milk check to it — so DairyIntel can spot problems early and show how each cow performs over time.</p>
              <ul className="aa-tracks">
                {TRACKS.map((t) => (
                  <li key={t.label}>
                    <span className="aa-track-ic"><span className="material-symbols-outlined" style={{ fontSize: 18 }}>{t.icon}</span></span>
                    {t.label}
                  </li>
                ))}
              </ul>
              <div className="aa-side-tip">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>lightbulb</span>
                Tip: use a consistent ID format like <strong>COW-001</strong> or <strong>BUF-001</strong> so your herd stays easy to scan.
              </div>
            </div>
          </aside>
        </div>
      </div>
    </AppLayout>
  );
}