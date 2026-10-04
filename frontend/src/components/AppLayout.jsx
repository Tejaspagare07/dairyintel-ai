import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import api from "../api";

const ADMIN_NAV = [
  { group: "Admin" },
  { label: "Overview", icon: "dashboard", to: "/admin" },
  { label: "Manage farmers", icon: "group", to: "/admin/users" },
  { label: "All milk checks", icon: "biotech", to: "/checks" },
  { label: "Milk collection", icon: "water_drop", to: "/records" },
  { label: "Companies", icon: "domain", to: "/admin/companies" },
];

const FARMER_NAV = [
  { group: "My farm" },
  { label: "Dashboard", icon: "space_dashboard", to: "/dashboard" },
  { label: "Milk check", icon: "biotech", to: "/milk-check" },
  { label: "Check history", icon: "history", to: "/checks" },
  { label: "Milk collection", icon: "water_drop", to: "/records" },
  { label: "Add animal", icon: "add_circle", to: "/add-animal" },
];

export default function AppLayout({ title, children }) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [alertCount, setAlertCount] = useState(0);
  const nav = useNavigate();
  const loc = useLocation();
  const role = localStorage.getItem("role");
  const name = localStorage.getItem("name") || (role === "admin" ? "Admin" : "Farmer");
  const items = role === "admin" ? ADMIN_NAV : FARMER_NAV;
  const roleLabel = role === "admin" ? "Centre admin" : "Dairy farmer";
  const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  useEffect(() => {
    api.get("/alerts?resolved=false").then((r) => setAlertCount(r.data.length)).catch(() => {});
  }, []);

  const logout = () => { localStorage.clear(); window.location.href = "/login"; };
  const isActive = (to) => loc.pathname === to;

  return (
    <div className={`app-v3 ${collapsed ? "sidebar-collapsed" : ""}`}>
      {/* mobile scrim */}
      {open && <div className="sidebar-scrim-v3" onClick={() => setOpen(false)} />}

      <aside className={`sidebar-v3 ${open ? "open" : ""}`}>
        {/* brand */}
        <div className="sb-brand">
          <img src="/logo.jpeg" alt="DairyIntel AI" width="36" height="36" className="sb-logo" />
          <div className="sb-brand-text">
            <div className="sb-name">DairyIntel<span>AI</span></div>
            <div className="sb-tagline">Smart dairy console</div>
          </div>
          <button className="sb-collapse-btn" onClick={() => setCollapsed(!collapsed)} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            <span className="material-symbols-outlined">{collapsed ? "chevron_right" : "chevron_left"}</span>
          </button>
        </div>

        {/* nav */}
        <nav className="sb-nav" aria-label="App">
          {items.map((it) =>
            it.group ? (
              <div className="sb-group" key={it.group}>{it.group}</div>
            ) : (
              <button
                key={it.to}
                aria-current={isActive(it.to) ? "page" : undefined}
                className={`sb-item ${isActive(it.to) ? "active" : ""}`}
                onClick={() => { setOpen(false); nav(it.to); }}
                title={collapsed ? it.label : undefined}
              >
                <span className="sb-item-indicator" />
                <span className="sb-item-icon material-symbols-outlined">{it.icon}</span>
                <span className="sb-item-label">{it.label}</span>
                {it.to === "/alerts" && alertCount > 0 && <span className="sb-badge">{alertCount}</span>}
              </button>
            )
          )}
        </nav>

        {/* bottom: user + logout */}
        <div className="sb-foot">
          <div className="sb-user">
            <div className="sb-avatar">{initials}</div>
            <div className="sb-user-info">
              <div className="sb-user-name">{name}</div>
              <div className="sb-user-role">{roleLabel}</div>
            </div>
          </div>
          <button className="sb-item sb-logout" onClick={logout} title="Log out">
            <span className="sb-item-indicator" />
            <span className="sb-item-icon material-symbols-outlined">logout</span>
            <span className="sb-item-label">Log out</span>
          </button>
        </div>
      </aside>

      <div className="main-v3">
        <header className="topbar-v3">
          <div className="tb-left-v3">
            <button className="tb-hamburger" onClick={() => setOpen(true)} title="Menu">
              <span className="material-symbols-outlined">menu</span>
            </button>
            <div className="tb-breadcrumb">
              <span className="tb-bc-icon material-symbols-outlined">home</span>
              <span className="tb-bc-sep">/</span>
              <span className="tb-bc-current">{title}</span>
            </div>
          </div>
          <div className="tb-right-v3">
            <div className="tb-search">
              <span className="material-symbols-outlined">search</span>
              <input type="text" placeholder="Search..." readOnly />
            </div>
            <button className="tb-notif" onClick={() => nav("/alerts")} title="Alerts">
              <span className="material-symbols-outlined">notifications</span>
              {alertCount > 0 && <span className="tb-notif-dot">{alertCount}</span>}
            </button>
            <div className="tb-user-pill" title={name}>
              <div className="tb-avatar">{initials}</div>
              <span className="tb-user-name-sm">{name.split(" ")[0]}</span>
            </div>
          </div>
        </header>

        <main className="content-v3 fade-in" key={loc.pathname}>{children}</main>
      </div>
    </div>
  );
}