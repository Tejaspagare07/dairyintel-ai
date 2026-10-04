import { Link } from "react-router-dom";
import PublicShell from "../components/PublicShell";
import useSeo from "../hooks/useSeo";

export default function NotFound() {
  useSeo({ title: "Page not found", noindex: true });
  return (
    <PublicShell>
      <div className="content" style={{ textAlign: "center", padding: "5rem 1rem" }}>
        <div className="empty"><div className="ei"><span className="material-symbols-outlined">search_off</span></div></div>
        <h1 className="greet">Page not found</h1>
        <p className="muted">The page you're looking for doesn't exist.</p>
        <Link className="btn btn-primary" to="/" style={{ marginTop: "1rem" }}>Go home</Link>
      </div>
    </PublicShell>
  );
}
