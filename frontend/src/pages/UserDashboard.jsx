import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import AppLayout from "../components/AppLayout";
import StatCard from "../components/StatCard";
import TestDetail from "../components/TestDetail";
import useSeo from "../hooks/useSeo";

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
};
const greetIcon = () => {
  const h = new Date().getHours();
  return h < 6 ? "dark_mode" : h < 12 ? "wb_sunny" : h < 17 ? "light_mode" : "nights_stay";
};
const GRADE_CHIP = { Good: "chip-good", Average: "chip-avg", Poor: "chip-poor" };
const GRADE_ICON = { Good: "check_circle", Average: "warning", Poor: "error" };

const QUICK = [
  { label: "New milk check", sub: "AI-powered grading", to: "/milk-check", icon: "biotech", accent: "primary" },
  { label: "Add animal", sub: "Register new cattle", to: "/add-animal", icon: "add_circle", accent: "blue" },
  { label: "Check history", sub: "View past results", to: "/checks", icon: "history", accent: "violet" },
  { label: "Collection log", sub: "Track daily litres", to: "/records", icon: "water_drop", accent: "gold" },
];

const ACCENT_MAP = {
  primary: { bg: "var(--primary-tint)", fg: "var(--primary-deep)" },
  blue: { bg: "var(--blue-tint)", fg: "var(--blue)" },
  violet: { bg: "var(--violet-tint)", fg: "var(--violet)" },
  gold: { bg: "var(--gold-tint)", fg: "#8a6410" },
};

export function HealthChip({ t }) {
  const d = t.disease || {};
  if (d.status !== "High Risk") return <span className="chip chip-good"><span className="material-symbols-outlined" style={{ fontSize: 13 }}>check_circle</span>Healthy</span>;
  const c = (d.condition || "").replace("Subclinical ", "");
  return <span className="chip chip-poor"><span className="material-symbols-outlined" style={{ fontSize: 13 }}>warning</span>{c ? `${c[0].toUpperCase()}${c.slice(1)} risk` : "High risk"}</span>;
}

export default function UserDashboard() {
  useSeo({
    title: "Farmer dashboard — DairyIntel AI",
    description: "Monitor milk quality, cattle health alerts, and daily collection stats. AI-powered dairy management for Indian farmers built on FSSAI & BIS standards.",
    noindex: true,
    path: "/dashboard",
  });
  const [data, setData] = useState(null);
  const [stats, setStats] = useState(null);
  const [tests, setTests] = useState(null);
  const [open, setOpen] = useState(null);
  const [error, setError] = useState("");
  const nav = useNavigate();
  const name = localStorage.getItem("name") || "Farmer";
  const firstName = name.split(" ")[0];
  const today = new Date();
  const dateStr = today.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short", year: "numeric" });

  useEffect(() => {
    api.get("/dashboard/user").then((r) => setData(r.data)).catch((e) => setError(e.response?.data?.message || "Failed to load"));
    api.get("/tests/stats?days=14").then((r) => setStats(r.data)).catch(() => setStats({}));
    api.get("/tests?limit=8").then((r) => setTests(r.data)).catch(() => setTests([]));
  }, []);

  return (
    <AppLayout title="Farmer dashboard">
      <div className="dash-page" role="region" aria-label="Farmer dashboard overview">

        {/* ───── GREETING CARD ───── */}
        <section className="greet-card-v3 dash-enter-1" aria-label="Welcome">
          <div className="gc-left">
            <span className="gc-date">{dateStr}</span>
            <h1 className="gc-heading">
              <span className="wave-hand" aria-hidden="true">
                <span className="material-symbols-outlined" style={{ fontSize: 30 }}>{greetIcon()}</span>
              </span>
              {greeting()}, {firstName}
            </h1>
            <p className="gc-sub">
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>bar_chart</span>
              <strong>{stats?.count ?? "…"}</strong> milk checks in the last 14 days
              {stats?.highRisk > 0 && (
                <span className="gc-alert">
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>priority_high</span>
                  {stats.highRisk} need attention
                </span>
              )}
            </p>
          </div>
          <div className="gc-right">
            <button className="gc-cta" onClick={() => nav("/milk-check")}>
              <span className="material-symbols-outlined">add</span> New milk check
            </button>
          </div>
        </section>

        {error && <div className="form-err">{error}</div>}

        {/* ───── STAT CARDS ───── */}
        <div className="stat-row dash-enter-2" role="list" aria-label="Key metrics">
          {stats ? (
            <>
              <StatCard icon="opacity" label="Avg fat" value={stats.avgFat ?? "—"} unit={stats.avgFat != null ? "%" : ""} accent="primary" />
              <StatCard icon="science" label="Avg SNF" value={stats.avgSnf ?? "—"} unit={stats.avgSnf != null ? "%" : ""} accent={stats.avgSnf != null && stats.avgSnf < 8.3 ? "gold" : "blue"} />
              <StatCard icon="water_drop" label="Watered samples" value={stats.watered ?? 0} accent="gold" />
              <StatCard icon="stethoscope" label={`High-risk · ${stats.mastitis || 0}M · ${stats.ketosis || 0}K`} value={stats.highRisk ?? 0} accent="danger" />
            </>
          ) : [0, 1, 2, 3].map((i) => <div key={i} className="stat skeleton" style={{ height: 120 }} />)}
        </div>

        {/* ───── RECENT CHECKS — full width ───── */}
        <section className="panel-v3 dash-enter-3" aria-label="Recent milk checks">
          <div className="pv3-head">
            <h2 className="pv3-title">
              <span className="pv3-icon" style={{ background: "var(--primary-tint)", color: "var(--primary)" }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>biotech</span>
              </span>
              Recent checks
              {tests?.length > 0 && <span className="pv3-count">{tests.length}</span>}
            </h2>
            <button className="pv3-link" onClick={() => nav("/checks")}>
              View all <span className="material-symbols-outlined" style={{ fontSize: 15 }}>east</span>
            </button>
          </div>
          {!tests ? <div className="skeleton" style={{ height: 240, borderRadius: 12 }} /> : tests.length === 0 ? (
            <div className="empty-v3">
              <span className="material-symbols-outlined ev3-icon">science</span>
              <p className="ev3-text">No milk checks yet</p>
              <button className="btn btn-primary" onClick={() => nav("/milk-check")}>
                <span className="material-symbols-outlined">add</span> Run your first check
              </button>
            </div>
          ) : (
            <div className="table-wrap tv3">
              <table>
                <thead>
                  <tr>
                    <th>Test ID</th>
                    <th>Animal</th>
                    <th>Shift</th>
                    <th>Quality</th>
                    <th>Health</th>
                    <th className="hide-sm" style={{ width: 40 }} />
                  </tr>
                </thead>
                <tbody>
                  {tests.map((t) => (
                    <tr key={t._id} className="clickable" tabIndex={0} onClick={() => setOpen(t)} onKeyDown={(e) => e.key === "Enter" && setOpen(t)}>
                      <td><span className="tid">{t.testNo}</span></td>
                      <td>
                        <div className="acell">
                          <span className="acell-av">{(t.animalId?.animalId || "BK")[0]}</span>
                          <span className="acell-name">{t.animalId?.animalId || "Bulk"}</span>
                        </div>
                      </td>
                      <td><span className={`shift-tag ${t.shift === "Morning" ? "morning" : "evening"}`}>{t.shift}</span></td>
                      <td>
                        <span className={`chip ${GRADE_CHIP[t.quality?.grade] || "chip-neutral"}`}>
                          <span className="material-symbols-outlined" style={{ fontSize: 13 }}>{GRADE_ICON[t.quality?.grade] || "help"}</span>
                          {t.quality?.grade}
                        </span>
                      </td>
                      <td><HealthChip t={t} /></td>
                      <td className="hide-sm">
                        <span className="material-symbols-outlined row-arrow">chevron_right</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ───── QUICK ACTIONS ───── */}
        <div className="dash-enter-4" style={{ marginBottom: "1.2rem" }}>
          <div className="sec-label">
            <span className="material-symbols-outlined" style={{ fontSize: 17 }}>bolt</span> Quick actions
          </div>
          <div className="qa-grid">
            {QUICK.map((q) => {
              const ac = ACCENT_MAP[q.accent];
              return (
                <button key={q.to} className="qa-card" onClick={() => nav(q.to)}>
                  <span className="qa-icon" style={{ background: ac.bg, color: ac.fg }}>
                    <span className="material-symbols-outlined">{q.icon}</span>
                  </span>
                  <div className="qa-text">
                    <span className="qa-label">{q.label}</span>
                    <span className="qa-sub">{q.sub}</span>
                  </div>
                  <span className="material-symbols-outlined qa-go">east</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ───── ANIMALS + ALERTS ───── */}
        <div className="duo-grid dash-enter-5">
          <section className="panel-v3" aria-label="My animals">
            <div className="pv3-head">
              <h2 className="pv3-title">
                <span className="pv3-icon" style={{ background: "var(--primary-tint)", color: "var(--primary)" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>pets</span>
                </span>
                My animals
                {data?.animals?.length > 0 && <span className="pv3-count">{data.animals.length}</span>}
              </h2>
              <button className="pv3-link" onClick={() => nav("/add-animal")}>
                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>add</span> Add
              </button>
            </div>
            {!data ? <div className="skeleton" style={{ height: 120, borderRadius: 10 }} /> : data.animals?.length ? (
              <div className="anim-list">
                {data.animals.map((a) => (
                  <div key={a._id} className="anim-row">
                    <div className="anim-av">{a.name?.[0] || "?"}</div>
                    <div className="anim-info">
                      <span className="anim-name">{a.name}</span>
                      <span className="anim-tags">
                        <span className="at-id">{a.animalId}</span>
                        <span className="at-breed">{a.breed || "—"}</span>
                      </span>
                    </div>
                    <span className="anim-loc">
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>location_on</span>
                      {a.location || "—"}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-v3 small">
                <span className="material-symbols-outlined ev3-icon">pets</span>
                <p className="ev3-text">No animals registered yet</p>
              </div>
            )}
          </section>

          {/* alerts */}
          {data?.alerts?.length > 0 ? (
            <section className="panel-v3 alert-panel" aria-label="Open alerts">
              <div className="pv3-head">
                <h2 className="pv3-title">
                  <span className="pv3-icon" style={{ background: "var(--danger-tint)", color: "var(--danger)" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>warning</span>
                  </span>
                  Open alerts
                  <span className="pv3-count danger">{data.alerts.length}</span>
                </h2>
                <button className="pv3-link" onClick={() => nav("/alerts")}>
                  View all <span className="material-symbols-outlined" style={{ fontSize: 15 }}>east</span>
                </button>
              </div>
              <div className="alert-list-v3">
                {data.alerts.slice(0, 4).map((a) => (
                  <div key={a._id} className={`alr ${a.severity}`}>
                    <span className={`alr-dot ${a.severity}`} />
                    <div className="alr-body">
                      <span className={`alr-sev ${a.severity}`}>{a.severity}</span>
                      <span className="alr-msg">{a.message}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : (
            <section className="panel-v3" aria-label="Alerts">
              <div className="pv3-head">
                <h2 className="pv3-title">
                  <span className="pv3-icon" style={{ background: "var(--primary-tint)", color: "var(--primary)" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>verified</span>
                  </span>
                  All clear
                </h2>
              </div>
              <div className="empty-v3 small">
                <span className="material-symbols-outlined ev3-icon" style={{ color: "var(--ok)" }}>check_circle</span>
                <p className="ev3-text">No open alerts — your herd looks healthy</p>
              </div>
            </section>
          )}
        </div>

        <TestDetail test={open} onClose={() => setOpen(null)} />
      </div>
    </AppLayout>
  );
}