import { Link } from "react-router-dom";

export default function AuthBrand({ quote, pin, children }) {
  return (
    <aside className="auth-brand">
      <Link to="/" className="brand"><img src="/logo.jpeg" alt="DairyIntel AI logo" width="40" height="40" /> DairyIntel AI</Link>
      <div className="brand-mid">
        <div className="brand-quote">{quote}</div>
        <div className="brand-shot">
          <img src="/farm-banner.jpg" alt="Cows grazing on a dairy pasture" loading="lazy" />
          <span className="tagpin"><span className="material-symbols-outlined" style={{ fontSize: 14 }}>verified</span> {pin}</span>
        </div>
      </div>
      <ul className="brand-points">{children}</ul>
    </aside>
  );
}

