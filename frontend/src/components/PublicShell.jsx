import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

export default function PublicShell({ children }) {
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const loggedIn = !!localStorage.getItem("token");
  const home = localStorage.getItem("role") === "admin" ? "/admin" : "/dashboard";
  return (
    <div className="public">
      <a href="#main" className="skip">Skip to content</a>
      <header className="mk-nav">
        <div className="mk-nav-in">
          <Link to="/" className="brand" aria-label="DairyIntel AI home"><img src="/logo.jpeg" alt="" width="36" height="36" /> DairyIntel AI</Link>
          <nav className={`mk-links ${open ? "open" : ""}`} aria-label="Main">
            <a href="/#features">Features</a>
            <a href="/#how">How it works</a>
            <a href="/#faq">FAQ</a>
          </nav>
          <div className="mk-cta">
            {loggedIn ? (
              <button className="btn btn-primary" onClick={() => nav(home)}>Open dashboard</button>
            ) : (
              <>
                <button className="btn btn-ghost hide-sm" onClick={() => nav("/login")}>Log in</button>
                <button className="btn btn-primary" onClick={() => nav("/signup")}>Get started</button>
              </>
            )}
            <button className="tb-icon mk-burger" aria-label="Menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
              <span className="material-symbols-outlined">{open ? "close" : "menu"}</span>
            </button>
          </div>
        </div>
      </header>
      <main id="main">{children}</main>
      <footer className="mk-foot">
        <div>
          <div className="brand" style={{ fontSize: "1.05rem" }}><img src="/logo.jpeg" width="30" height="30" style={{ width: 30, height: 30 }} alt="" /> DairyIntel AI</div>
          <p>Milk quality grading and early mastitis & ketosis screening for Indian dairy farms and collection centres. Built with FSSAI standards and machine learning.</p>
          <p className="muted small">Decision support only — not a veterinary diagnosis. © {new Date().getFullYear()} DairyIntel AI.</p>
        </div>
        <nav aria-label="Product"><h2 className="foot-h">Product</h2><ul><li><a href="/#features">Features</a></li><li><a href="/#how">How it works</a></li><li><a href="/#faq">FAQ</a></li></ul></nav>
        <nav aria-label="Account"><h2 className="foot-h">Account</h2><ul><li><Link to="/signup">Create account</Link></li><li><Link to="/login">Log in</Link></li><li><a href="/#faq">Help & FAQ</a></li></ul></nav>
      </footer>
    </div>
  );
}