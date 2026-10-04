import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import OtpCard from "../components/OtpCard";
import AuthBrand from "../components/AuthBrand";
import { saveSession } from "../utils/session";
import useSeo from "../hooks/useSeo";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export default function Login() {
  useSeo({ title: "Log in", description: "Log in to DairyIntel AI with your password and a one-time email code.", path: "/login" });
  const [role, setRole] = useState("user");          // "admin" | "user"
  const [step, setStep] = useState("login");         // login | otp | forgot | resetOtp | reset | done
  const [showPw, setShowPw] = useState(false);
  const [form, setForm] = useState({ identifier: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [otpInfo, setOtpInfo] = useState(null);
  const [fpId, setFpId] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [newPw, setNewPw] = useState({ a: "", b: "" });
  const nav = useNavigate();

  const goStep = (s) => { setError(""); setStep(s); };
  const after = (data) => { saveSession(data); nav(data.user.role === "admin" ? "/admin" : "/dashboard"); };

 const submitLogin = async (e) => {
  e.preventDefault(); setError("");
  if (!form.identifier || !form.password) { setError("Enter your email and password."); return; }
  setBusy(true);
  try {
    const { data } = await axios.post(`${API}/auth/login`, { ...form, role });
    if (data.token) { after(data); return; }   // ✅ verified -> straight in, no code
    setOtpInfo(data); goStep("otp");            // only unverified sign-up -> confirm email once
  } catch (err) {
    setError(err.response?.data?.message || "Login failed. Is the backend running?");
  } finally { setBusy(false); }
};

  const sendReset = async (e) => {
    e.preventDefault(); setError("");
    if (!fpId) { setError("Enter your email address."); return; }
    setBusy(true);
    try {
      const { data } = await axios.post(`${API}/auth/forgot-password`, { identifier: fpId });
      setOtpInfo(data); goStep("resetOtp");
    } catch (err) {
      setError(err.response?.data?.message || "Could not send code");
    } finally { setBusy(false); }
  };

  const resetPw = async (e) => {
    e.preventDefault(); setError("");
    if (newPw.a.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (newPw.a !== newPw.b) { setError("Passwords do not match."); return; }
    setBusy(true);
    try {
      await axios.post(`${API}/auth/reset-password`, { identifier: otpInfo.identifier, otp: resetCode, password: newPw.a });
      goStep("done");
    } catch (err) {
      setError(err.response?.data?.message || "Could not reset password");
    } finally { setBusy(false); }
  };

  return (
    <div className="auth">
      <AuthBrand quote={<>One code,<br /><span>and you're in.</span></>} pin="Email OTP secured">
        <li><span className="material-symbols-outlined">pin</span>6-digit code, valid 10 minutes</li>
        <li><span className="material-symbols-outlined">lock</span>Stored hashed on the server, 5 attempts max</li>
        <li><span className="material-symbols-outlined">schedule</span>Resend after 30 seconds</li>
      </AuthBrand>

      <main className="auth-form-side">
        <div className="auth-bg" style={{ backgroundImage: "url('/login-bg.jpg')" }} />

        {step === "login" && (
          <div className="auth-card fade-in">
            <div className="steps" aria-hidden="true"><i className="on" /><i /></div>
            <div className="auth-logo"><img src="/logo.jpeg" alt="" width="96" height="96" /><div className="nm">DairyIntel AI</div></div>
            <h1 className="auth-h">Welcome back</h1><p className="sub">Log in, then confirm with a code sent to your email.</p>
            <div className={`role-toggle ${role === "admin" ? "b" : ""}`} role="tablist" aria-label="Account type">
              <div className="role-glider" />
              <button type="button" role="tab" aria-selected={role === "user"} className={role === "user" ? "on" : ""} onClick={() => setRole("user")}>Dairy farmer</button>
              <button type="button" role="tab" aria-selected={role === "admin"} className={role === "admin" ? "on" : ""} onClick={() => setRole("admin")}>Admin / centre</button>
            </div>
            <form onSubmit={submitLogin} noValidate>
              <div className="field"><label className="lbl" htmlFor="li-id">{role === "admin" ? "Admin email" : "Email or mobile"}</label>
                <div className="inp"><span className="material-symbols-outlined">person</span>
                  <input id="li-id" autoComplete="username" value={form.identifier} onChange={(e) => setForm({ ...form, identifier: e.target.value })} placeholder={role === "admin" ? "admin@dairyintel.ai" : "you@example.com"} /></div></div>
              <div className="field"><label className="lbl" htmlFor="li-pw">Password</label>
                <div className="inp"><span className="material-symbols-outlined">lock</span>
                  <input id="li-pw" autoComplete="current-password" type={showPw ? "text" : "password"} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" style={{ paddingRight: "2.6rem" }} />
                  <button type="button" aria-label={showPw ? "Hide password" : "Show password"} onClick={() => setShowPw((s) => !s)} className="material-symbols-outlined pw-eye">{showPw ? "visibility_off" : "visibility"}</button></div></div>
              {error && <p className="form-err" role="alert">{error}</p>}
              <div className="row-between"><span /><button type="button" className="link" onClick={() => { setFpId(form.identifier); goStep("forgot"); }}>Forgot password?</button></div>
              <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy}>{busy ? <span className="spinner" /> : <>Continue <span className="material-symbols-outlined arrow">arrow_forward</span></>}</button>
              <p className="auth-alt">New farmer? <Link className="link" to="/signup">Create an account</Link></p>
            </form>
          </div>
        )}

        {step === "otp" && otpInfo && (
          <OtpCard info={otpInfo} title={otpInfo.purpose === "signup" ? "Verify your email" : "Check your email"} onVerified={after} onBack={() => goStep("login")} backLabel="← Use a different account" />
        )}

        {step === "forgot" && (
          <div className="auth-card fade-in">
            <div className="otp-icon"><span className="material-symbols-outlined">lock_reset</span></div>
            <h1 className="auth-h">Reset password</h1><p className="sub">We'll email you a 6-digit code.</p>
            <form onSubmit={sendReset} noValidate>
              <div className="field"><label className="lbl" htmlFor="fp">Email address</label>
                <div className="inp"><span className="material-symbols-outlined">mail</span>
                  <input id="fp" type="email" value={fpId} onChange={(e) => setFpId(e.target.value)} placeholder="you@example.com" /></div></div>
              {error && <p className="form-err" role="alert">{error}</p>}
              <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy}>{busy ? <span className="spinner" /> : <>Send code <span className="material-symbols-outlined arrow">send</span></>}</button>
              <p className="auth-alt"><button type="button" className="link" onClick={() => goStep("login")}>← Back to log in</button></p>
            </form>
          </div>
        )}

        {step === "resetOtp" && otpInfo && (
          <OtpCard info={otpInfo} title="Enter the reset code" onVerified={({ code }) => { setResetCode(code); goStep("reset"); }} onBack={() => goStep("forgot")} />
        )}

        {step === "reset" && (
          <div className="auth-card fade-in">
            <div className="otp-icon"><span className="material-symbols-outlined">password</span></div>
            <h1 className="auth-h">New password</h1><p className="sub">Choose a password with at least 6 characters.</p>
            <form onSubmit={resetPw} noValidate>
              <div className="field"><label className="lbl" htmlFor="np1">New password</label>
                <div className="inp"><span className="material-symbols-outlined">lock</span><input id="np1" type="password" autoComplete="new-password" value={newPw.a} onChange={(e) => setNewPw({ ...newPw, a: e.target.value })} placeholder="••••••••" /></div></div>
              <div className="field"><label className="lbl" htmlFor="np2">Confirm password</label>
                <div className="inp"><span className="material-symbols-outlined">lock_reset</span><input id="np2" type="password" autoComplete="new-password" value={newPw.b} onChange={(e) => setNewPw({ ...newPw, b: e.target.value })} placeholder="••••••••" /></div></div>
              {error && <p className="form-err" role="alert">{error}</p>}
              <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy}>{busy ? <span className="spinner" /> : "Save new password"}</button>
            </form>
          </div>
        )}

        {step === "done" && (
          <div className="auth-card fade-in">
            <div className="otp-icon ok"><span className="material-symbols-outlined">check_circle</span></div>
            <h1 className="auth-h">Password updated</h1><p className="sub">Log in with your new password.</p>
            <button className="btn btn-primary btn-lg btn-block" onClick={() => goStep("login")}>Back to log in</button>
          </div>
        )}
      </main>
    </div>
  );
}
