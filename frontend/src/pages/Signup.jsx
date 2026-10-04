import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import OtpCard from "../components/OtpCard";
import AuthBrand from "../components/AuthBrand";
import { saveSession } from "../utils/session";
import useSeo from "../hooks/useSeo";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const FIELDS = [
  { key: "name", label: "Full name", type: "text", icon: "person", ph: "Your name", ac: "name", req: true },
  { key: "email", label: "Email", type: "email", icon: "mail", ph: "you@example.com", ac: "email", req: true },
  { key: "mobile", label: "Mobile (optional)", type: "tel", icon: "phone", ph: "10-digit mobile", ac: "tel" },
  { key: "village", label: "Village / town (optional)", type: "text", icon: "location_on", ph: "e.g. Nashik", ac: "address-level2" },
  { key: "password", label: "Password", type: "password", icon: "lock", ph: "At least 6 characters", ac: "new-password", req: true },
];

export default function Signup() {
  useSeo({ title: "Create a farmer account", description: "Sign up free to grade milk quality and screen your herd for mastitis and ketosis risk.", path: "/signup" });
  const [form, setForm] = useState({ name: "", email: "", mobile: "", village: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [otpInfo, setOtpInfo] = useState(null);
  const [pending, setPending] = useState("");
  const nav = useNavigate();

  const submit = async (e) => {
    e.preventDefault(); setError("");
    if (!form.name || !form.email || !form.password) { setError("Name, email and password are required."); return; }
    if (form.password.length < 6) { setError("Password must be at least 6 characters."); return; }
    setBusy(true);
    try {
      const { data } = await axios.post(`${API}/auth/register`, form);
      setOtpInfo(data);
    } catch (err) {
      setError(err.response?.data?.message || "Signup failed. Is the backend running?");
    } finally { setBusy(false); }
  };

  const verified = (data) => { saveSession(data); nav("/dashboard"); };

  return (
    <div className="auth">
      <AuthBrand quote={<>Start grading milk in <span>minutes.</span></>} pin="Free for farmers">
        <li><span className="material-symbols-outlined">science</span>Good / Average / Poor grade for every sample</li>
        <li><span className="material-symbols-outlined">stethoscope</span>Early mastitis &amp; ketosis warning</li>
        <li><span className="material-symbols-outlined">mark_email_read</span>Email verified with a one-time code</li>
      </AuthBrand>

      <main className="auth-form-side">
        <div className="auth-bg" style={{ backgroundImage: "url('/login-bg.jpg')" }} />
        {pending ? (
          <div className="auth-card fade-in">
            <div className="otp-icon"><span className="material-symbols-outlined">hourglass_top</span></div>
            <h1 className="auth-h">Almost there</h1><p className="sub">{pending}</p>
            <Link className="btn btn-primary btn-lg btn-block" to="/login">Back to log in</Link>
          </div>
        ) : !otpInfo ? (
          <div className="auth-card fade-in">
            <div className="steps" aria-hidden="true"><i className="on" /><i /></div>
            <h1 className="auth-h">Create your account</h1><p className="sub">Register as a dairy farmer. We'll email you a code to confirm.</p>
            <form onSubmit={submit} noValidate>
              {FIELDS.map((f) => (
                <div className="field" key={f.key}>
                  <label className="lbl" htmlFor={`su-${f.key}`}>{f.label}{f.req && <span className="req"> *</span>}</label>
                  <div className="inp"><span className="material-symbols-outlined">{f.icon}</span>
                    <input id={`su-${f.key}`} type={f.type} autoComplete={f.ac} value={form[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} placeholder={f.ph} /></div>
                </div>
              ))}
              {error && <p className="form-err" role="alert">{error}</p>}
              <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy}>{busy ? <span className="spinner" /> : <>Send verification code <span className="material-symbols-outlined arrow">arrow_forward</span></>}</button>
              <p className="auth-alt">Already have an account? <Link className="link" to="/login">Log in</Link></p>
            </form>
          </div>
        ) : (
          <OtpCard
            info={otpInfo}
            title="Verify your email"
            onVerified={verified}
            onPending={setPending}
            onBack={() => setOtpInfo(null)}
            backLabel="← Change details"
          />
        )}
      </main>
    </div>
  );
}
