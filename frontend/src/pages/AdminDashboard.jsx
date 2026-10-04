import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import api from "../api";
import AppLayout from "../components/AppLayout";
import StatCard from "../components/StatCard";
import TestDetail from "../components/TestDetail";
import useSeo from "../hooks/useSeo";

const GRADE_CHIP = { Good: "chip-good", Average: "chip-avg", Poor: "chip-poor" };
const STATUS_CHIP = { active: "chip-good", pending: "chip-avg", blocked: "chip-poor" };

export default function AdminDashboard() {
  useSeo({ title: "Admin dashboard", noindex: true });
  const [data, setData] = useState(null);
  const [series, setSeries] = useState([]);
  const [open, setOpen] = useState(null);
  const [busyId, setBusyId] = useState("");
  const nav = useNavigate();

  const load = () => api.get("/dashboard/admin").then((r) => setData(r.data)).catch(() => setData({}));
  useEffect(() => {
    load();
    api.get("/milk?range=monthly").then((r) => {
      const byDay = {};
      (r.data || []).forEach((rec) => {
        const d = new Date(rec.collectionDate);
        const key = `${d.getDate()}/${d.getMonth() + 1}`;
        byDay[key] = (byDay[key] || 0) + (rec.quantity || 0);
      });
      setSeries(Object.entries(byDay).reverse().map(([day, litres]) => ({ day, litres: Math.round(litres) })));
    }).catch(() => {});
  }, []);

  const setStatus = async (id, status) => {
    setBusyId(id);
    try { await api.patch(`/users/${id}/status`, { status }); await load(); }
    catch (e) { alert(e.response?.data?.message || "Could not update"); }
    finally { setBusyId(""); }
  };

  const g = data?.grades7d || { Good: 0, Average: 0, Poor: 0 };
  const total = g.Good + g.Average + g.Poor;
  const pct = (n) => (total ? Math.round((n / total) * 100) : 0);

  return (
    <AppLayout title="Admin dashboard">
      <div className="page-head">
        <div><h1 className="greet">Collection centre overview</h1><div className="subt">All farms · last 7 days of milk checks</div></div>
        <button className="btn btn-primary" onClick={() => nav("/admin/users")}><span className="material-symbols-outlined">person_add</span> Add farmer</button>
      </div>

      <div className="stat-grid">
        {data ? (
          <>
            <StatCard icon="group" label={`Farmers · ${data.pendingUsers || 0} awaiting approval`} value={data.totalUsers ?? 0} accent="primary" />
            <StatCard icon="water_drop" label="Milk collected today" value={data.totalMilkToday ?? 0} unit="L" accent="blue" />
            <div className="stat">
              <div className="top"><div className="si" style={{ background: "var(--violet-tint)" }}><span className="material-symbols-outlined" style={{ color: "var(--violet)" }}>donut_small</span></div></div>
              <div className="qmix" aria-label={`Good ${pct(g.Good)}%, Average ${pct(g.Average)}%, Poor ${pct(g.Poor)}%`}>
                <span style={{ width: `${pct(g.Good)}%`, background: "var(--primary)" }} />
                <span style={{ width: `${pct(g.Average)}%`, background: "var(--gold)" }} />
                <span style={{ width: `${pct(g.Poor)}%`, background: "var(--danger)" }} />
              </div>
              <div className="qmix-l"><b style={{ color: "var(--primary)" }}>{pct(g.Good)}%</b> Good · <b style={{ color: "#b07a10" }}>{pct(g.Average)}%</b> Avg · <b style={{ color: "var(--danger)" }}>{pct(g.Poor)}%</b> Poor</div>
              <div className="l">Quality mix · {total} checks</div>
            </div>
            <StatCard icon="stethoscope" label={`High-risk results · ${data.farmsAtRisk || 0} farms`} value={data.highRiskTests?.length ?? 0} accent="danger" />
          </>
        ) : [0, 1, 2, 3].map((i) => <div key={i} className="stat skeleton" style={{ height: 132 }} />)}
      </div>

      <div className="grid-2b">
        <section className="panel">
          <div className="panel-head"><h2 className="h3">Farmers</h2><button className="tag" onClick={() => nav("/admin/users")}>Manage all</button></div>
          <p className="muted small" style={{ marginTop: "-.6rem" }}>Approve sign-ups, block accounts, see each farm's latest grade.</p>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Farmer</th><th>Village</th><th>Last check</th><th>Status</th><th /></tr></thead>
              <tbody>
                {(data?.farmers || []).map((f) => (
                  <tr key={f._id}>
                    <td><div className="who-cell"><span className="row-av">{f.name?.charAt(0)}</span><span>{f.name}{!f.emailVerified && <small className="muted"> · unverified</small>}</span></div></td>
                    <td>{f.village || "—"}</td>
                    <td>{f.lastTest ? <span className={`chip ${GRADE_CHIP[f.lastTest.grade]}`}>{f.lastTest.grade}</span> : "—"}</td>
                    <td><span className={`chip ${STATUS_CHIP[f.status] || "chip-neutral"}`}>{f.status}</span></td>
                    <td className="row-actions">
                      {f.status !== "active" && <button className="icon-btn ok" disabled={busyId === f._id} title="Approve / activate" aria-label={`Activate ${f.name}`} onClick={() => setStatus(f._id, "active")}><span className="material-symbols-outlined">check</span></button>}
                      {f.status !== "blocked" && <button className="icon-btn bad" disabled={busyId === f._id} title="Block" aria-label={`Block ${f.name}`} onClick={() => setStatus(f._id, "blocked")}><span className="material-symbols-outlined">block</span></button>}
                    </td>
                  </tr>
                ))}
                {data && !data.farmers?.length && <tr><td colSpan={5} className="muted" style={{ textAlign: "center", padding: "1.5rem" }}>No farmers yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head"><h2 className="h3">Herd alerts</h2><button className="tag" onClick={() => nav("/alerts")}>All alerts</button></div>
          <p className="muted small" style={{ marginTop: "-.6rem" }}>High-risk results from the disease model, newest first.</p>
          {data?.highRiskTests?.length ? (
            <ul className="risk-list">
              {data.highRiskTests.map((t) => (
                <li key={t._id}>
                  <button onClick={() => setOpen(t)}>
                    <span>
                      <b>{t.animalId?.animalId || `Test ${t.testNo}`}{t.animalId?.name ? ` · ${t.animalId.name}` : ""}</b>
                      <small className="muted">{t.userId?.name || "—"} · {t.testNo} · {new Date(t.testedAt).toLocaleDateString()}</small>
                    </span>
                    <span className="chip chip-poor">{(t.disease?.condition || "Risk").replace("Subclinical ", "")} {Math.round((t.disease?.probabilities?.anyRisk || 0) * 100)}%</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : <p className="muted">No high-risk results in the last 7 days.</p>}
        </section>
      </div>

      <section className="panel">
        <div className="panel-head"><h2 className="h3">Collection volume</h2><span className="tag">This month</span></div>
        {series.length ? (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={series} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <defs><linearGradient id="vol" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#16794a" stopOpacity={0.3} /><stop offset="100%" stopColor="#16794a" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid stroke="var(--line-soft)" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: "var(--faint)" }} />
              <YAxis tick={{ fontSize: 11, fill: "var(--faint)" }} />
              <Tooltip formatter={(v) => [`${v} L`, "Collected"]} contentStyle={{ borderRadius: 12, border: "1px solid var(--line)" }} />
              <Area type="monotone" dataKey="litres" stroke="#16794a" strokeWidth={2.4} fill="url(#vol)" />
            </AreaChart>
          </ResponsiveContainer>
        ) : <p className="muted">No collections recorded this month.</p>}
      </section>

      <TestDetail test={open} onClose={() => setOpen(null)} />
    </AppLayout>
  );
}
