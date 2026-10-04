import { useEffect, useState } from "react";
import api from "../api";
import AppLayout from "../components/AppLayout";
import { QualityCard, HealthCard } from "../components/ResultCards";
import useSeo from "../hooks/useSeo";

const EMPTY = { animalId: "", shift: "Morning", species: "cow", fat: "", snf: "", clr: "", protein: "", lactose: "", addedWater: "", temp: "", ec: "", scc: "" };

/* FSSAI / BIS required composition parameters for grading */
const CORE_FIELDS = [
  { k: "fat", label: "Fat", unit: "%", step: "0.01", min: 0, max: 15, req: true, ph: "e.g. 4.5", hint: "FSSAI min: 3.0% cow · 5.0% buffalo" },
  { k: "snf", label: "SNF", unit: "%", step: "0.01", min: 0, max: 15, req: true, ph: "e.g. 8.5", hint: "FSSAI min: 8.3% cow · 9.0% buffalo" },
  { k: "clr", label: "CLR / Density", unit: "", step: "0.1", min: 0, max: 45, req: true, ph: "e.g. 28.0", hint: "Corrected lactometer reading at 27°C" },
  { k: "protein", label: "Protein", unit: "%", step: "0.01", min: 0, max: 10, req: true, ph: "e.g. 3.2", hint: "BIS min: 3.0% cow · 3.3% buffalo" },
  { k: "addedWater", label: "Added water", unit: "%", step: "0.1", min: 0, max: 100, req: true, ph: "e.g. 0", hint: "Adulteration detection" },
];

const EXTRA_FIELDS = [
  { k: "lactose", label: "Lactose", unit: "%", step: "0.01", min: 0, max: 10, ph: "e.g. 4.7" },
  { k: "temp", label: "Milk temp", unit: "°C", step: "0.1", min: -5, max: 60, ph: "optional" },
];

export default function MilkCheck() {
  useSeo({
    title: "AI milk quality check — DairyIntel AI",
    description: "Run AI-powered milk quality grading based on FSSAI & BIS standards. Analyse fat, SNF, protein, CLR and detect adulteration or disease risk in seconds.",
    noindex: true,
    path: "/milk-check",
  });
  const [form, setForm] = useState(EMPTY);
  const [animals, setAnimals] = useState([]);
  const [res, setRes] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.get("/animals").then((r) => setAnimals(r.data)).catch(() => {}); }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault(); setErr("");
    const missing = CORE_FIELDS.filter((f) => f.req && form[f.k] === "");
    if (missing.length) { setErr(`Required: ${missing.map((f) => f.label).join(", ")}`); return; }
    setBusy(true);
    try {
      const { data } = await api.post("/tests", form);
      setRes(data);
      if (window.innerWidth < 960) setTimeout(() => document.getElementById("results")?.scrollIntoView({ behavior: "smooth" }), 80);
    } catch (e2) {
      setErr(e2.response?.data?.message || "Check failed");
    } finally { setBusy(false); }
  };

  const t = res?.test;
  return (
    <AppLayout title="Milk check">
      <div className="mc-page">

        {/* ───── PAGE HEADER ───── */}
        <section className="mc-hero dash-enter-1">
          <div className="mc-hero-left">
            <h1 className="mc-title">
              <span className="mc-title-icon">
                <span className="material-symbols-outlined" style={{ fontSize: 26 }}>biotech</span>
              </span>
              Milk quality check
            </h1>
            <p className="mc-subtitle">AI-powered grading based on <strong>FSSAI</strong> &amp; <strong>BIS</strong> standards</p>
          </div>
          {res?.model && (
            <span className="mc-model-chip">
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>model_training</span>
              Model v{res.model.version} · {res.model.rows} samples
            </span>
          )}
        </section>

        {/* ───── MAIN GRID ───── */}
        <div className="mc-grid dash-enter-2">

          {/* LEFT — FORM */}
          <form className="mc-form" onSubmit={submit} noValidate>

            {/* sample info */}
            <div className="mc-section">
              <div className="mc-sec-label">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>info</span>
                Sample details
              </div>
              <div className="mc-sample-row">
                <div className="mc-field mc-field-grow">
                  <label className="mc-lbl" htmlFor="mc-animal">Animal</label>
                  <select id="mc-animal" value={form.animalId} onChange={set("animalId")}>
                    <option value="">Bulk / not tagged</option>
                    {animals.map((a) => <option key={a._id} value={a._id}>{a.animalId}{a.name ? ` · ${a.name}` : ""}</option>)}
                  </select>
                </div>
                <div className="mc-field">
                  <label className="mc-lbl" htmlFor="mc-shift">Shift</label>
                  <select id="mc-shift" value={form.shift} onChange={set("shift")}><option>Morning</option><option>Evening</option></select>
                </div>
                <div className="mc-field">
                  <label className="mc-lbl" htmlFor="mc-sp">Milk type</label>
                  <select id="mc-sp" value={form.species} onChange={set("species")}><option value="cow">Cow</option><option value="buffalo">Buffalo</option><option value="mixed">Mixed</option></select>
                </div>
              </div>
            </div>

            {/* core composition — FSSAI required */}
            <div className="mc-section">
              <div className="mc-sec-label">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>science</span>
                Composition readings
                <span className="mc-fssai-tag">FSSAI / BIS</span>
              </div>
              <div className="mc-fields-grid">
                {CORE_FIELDS.map((f) => (
                  <div key={f.k} className="mc-field">
                    <label className="mc-lbl" htmlFor={`mc-${f.k}`}>
                      {f.label}{f.unit && <span className="mc-unit">{f.unit}</span>}
                      {f.req && <span className="mc-req">*</span>}
                    </label>
                    <input id={`mc-${f.k}`} type="number" inputMode="decimal" step={f.step} min={f.min} max={f.max}
                      placeholder={f.ph} value={form[f.k]} onChange={set(f.k)} className="mc-input" />
                    {f.hint && <span className="mc-hint">{f.hint}</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* extra composition — optional */}
            <div className="mc-section mc-section-light">
              <div className="mc-sec-label mc-sec-label-muted">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>tune</span>
                Additional readings
                <span className="mc-opt-tag">Optional</span>
              </div>
              <div className="mc-fields-grid mc-fields-2">
                {EXTRA_FIELDS.map((f) => (
                  <div key={f.k} className="mc-field">
                    <label className="mc-lbl" htmlFor={`mc-${f.k}`}>{f.label}{f.unit && <span className="mc-unit">{f.unit}</span>}</label>
                    <input id={`mc-${f.k}`} type="number" inputMode="decimal" step={f.step} min={f.min} max={f.max}
                      placeholder={f.ph} value={form[f.k]} onChange={set(f.k)} className="mc-input" />
                  </div>
                ))}
              </div>
            </div>

            {/* lab readings */}
            <div className="mc-section mc-section-dashed">
              <div className="mc-sec-label mc-sec-label-muted">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>labs</span>
                Lab readings
                <span className="mc-opt-tag">Optional</span>
              </div>
              <div className="mc-fields-grid mc-fields-2">
                <div className="mc-field">
                  <label className="mc-lbl" htmlFor="mc-ec">Electrical conductivity<span className="mc-unit">mS/cm</span></label>
                  <input id="mc-ec" type="number" inputMode="decimal" step="0.1" min="0" max="30" placeholder="e.g. 5.2" value={form.ec} onChange={set("ec")} className="mc-input" />
                </div>
                <div className="mc-field">
                  <label className="mc-lbl" htmlFor="mc-scc">Somatic cell count<span className="mc-unit">cells/mL</span></label>
                  <input id="mc-scc" type="number" inputMode="numeric" step="1000" min="0" placeholder="e.g. 180000" value={form.scc} onChange={set("scc")} className="mc-input" />
                </div>
              </div>
              <p className="mc-lab-note">
                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>lightbulb</span>
                EC + SCC boost mastitis detection from ~66% to ~82%. Leave blank to predict from composition alone.
              </p>
            </div>

            {err && <p className="form-err" role="alert">{err}</p>}

            {/* action buttons */}
            <div className="mc-actions">
              <button type="submit" className="btn btn-primary btn-lg mc-submit" disabled={busy}>
                {busy
                  ? <><span className="spinner" /> Analysing…</>
                  : <><span className="material-symbols-outlined">biotech</span> Run check</>}
              </button>
              <button type="button" className="btn btn-ghost btn-lg" onClick={() => { setForm(EMPTY); setRes(null); setErr(""); }}>
                <span className="material-symbols-outlined">restart_alt</span> Clear
              </button>
            </div>
          </form>

          {/* RIGHT — RESULTS */}
          <div id="results" className="mc-results dash-enter-3">
            {!t && (
              <div className="mc-empty">
                <div className="mc-empty-icon">
                  <span className="material-symbols-outlined">science</span>
                </div>
                <h2 className="mc-empty-title">Results appear here</h2>
                <p className="mc-empty-text">Enter readings and press <strong>Run check</strong> to get an AI-powered quality grade with health-risk analysis.</p>
                <div className="mc-empty-badges">
                  <span className="mc-badge mc-badge-green">
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>verified</span> FSSAI grading
                  </span>
                  <span className="mc-badge mc-badge-blue">
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>stethoscope</span> Disease detection
                  </span>
                  <span className="mc-badge mc-badge-gold">
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>water_drop</span> Adulteration check
                  </span>
                </div>
                <p className="mc-empty-disclaimer">Decision support only — confirm a High Risk result with a CMT test or your vet.</p>
              </div>
            )}
            {t && (
              <>
                <div className="mc-saved fade-in">
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>check_circle</span>
                  <span>Saved as <strong>{t.testNo}</strong>{t.animalId ? "" : " (bulk)"} · {new Date(t.testedAt).toLocaleString("en-IN")}</span>
                </div>
                <QualityCard q={t.quality} />
                <HealthCard d={t.disease} threshold={res.model?.threshold} />
              </>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}