import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import AppLayout from "../components/AppLayout";
import Chip from "../components/Chip";

const typeLabel = {
  disease_risk: "Disease risk",
  high_scc: "High SCC",
  poor_quality: "Poor quality",
  low_production: "Low production",
};
const sevColor = (s) => (s === "high" ? "error" : s === "medium" ? "secondary" : "neutral");
const sevBar = (s) => (s === "high" ? "var(--danger)" : s === "medium" ? "var(--gold)" : "var(--blue)");
const sevTint = (s) => (s === "high" ? "var(--danger-tint)" : s === "medium" ? "var(--gold-tint)" : "var(--blue-tint)");
const sevIcon = (s) => (s === "high" ? "var(--danger)" : s === "medium" ? "#8a6410" : "var(--blue)");

export default function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const nav = useNavigate();
  const isAdmin = localStorage.getItem("role") === "admin";

  const fetchAlerts = () => api.get("/alerts?resolved=false").then((r) => setAlerts(r.data)).catch(() => setAlerts([])).finally(() => setLoading(false));
  const load = () => { setLoading(true); fetchAlerts(); };
  useEffect(() => { fetchAlerts(); }, []);

  const resolve = async (id) => { await api.patch(`/alerts/${id}/resolve`); load(); };
  const scan = async () => {
    try { const { data } = await api.post("/alerts/scan"); setMsg(data.message); load(); }
    catch { setMsg("Scan failed."); }
  };

  return (
    <AppLayout title="Alerts">
      <div className="page-head">
        <div><div className="greet">Alerts</div><div className="subt">Animals and batches that need your attention.</div></div>
        {isAdmin && <button className="btn btn-ghost" onClick={scan}><span className="material-symbols-outlined">radar</span> Scan for alerts</button>}
      </div>

      {msg && <p style={{ color: "var(--primary)", fontSize: ".9rem", marginBottom: ".8rem" }}>{msg}</p>}

      {loading ? (
        <div className="panel"><p style={{ color: "var(--muted)", textAlign: "center", padding: "1.5rem" }}>Loading alerts…</p></div>
      ) : alerts.length === 0 ? (
        <div className="panel">
          <div className="empty">
            <div className="ei"><span className="material-symbols-outlined">verified_user</span></div>
            <h3 style={{ marginBottom: ".4rem" }}>All clear</h3>
            <p style={{ maxWidth: "36ch", margin: "0 auto 1rem" }}>No active alerts right now. Your herd's readings are all within normal range.</p>
            <div style={{ display: "flex", gap: ".7rem", justifyContent: "center", flexWrap: "wrap" }}>
              {isAdmin
                ? <button className="btn btn-primary" onClick={scan}><span className="material-symbols-outlined">radar</span> Run a scan</button>
                : <button className="btn btn-primary" onClick={() => nav("/milk-check")}><span className="material-symbols-outlined">biotech</span> Run a milk check</button>}
              <button className="btn btn-ghost" onClick={load}><span className="material-symbols-outlined">refresh</span> Refresh</button>
            </div>
          </div>
        </div>
      ) : (
        alerts.map((a) => (
          <div key={a._id} className="alert-item">
            <span className="abar" style={{ background: sevBar(a.severity) }} />
            <span className="ai" style={{ background: sevTint(a.severity) }}>
              <span className="material-symbols-outlined" style={{ color: sevIcon(a.severity), fontSize: 20 }}>warning</span>
            </span>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: ".5rem", marginBottom: ".2rem", flexWrap: "wrap" }}>
                <Chip label={typeLabel[a.type] || a.type} color={sevColor(a.severity)} />
                <span style={{ fontSize: ".8rem", color: "var(--faint)" }}>{a.animalId?.animalId || "—"}</span>
              </div>
              <p style={{ color: "var(--ink)" }}>{a.message}</p>
            </div>
            <button className="resolve" onClick={() => resolve(a._id)}>Resolve</button>
          </div>
        ))
      )}
    </AppLayout>
  );
}
