import { useEffect, useState } from "react";
import axios from "axios";
import OtpInput from "./OtpInput";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

/**
 * Shared "enter the code" card for signup / login / reset.
 * info = response from /register, /login or /forgot-password ({ identifier, email, devOtp, resendInSec, purpose })
 * onVerified(data) is called with the /verify-otp response (token + user) - or, for reset, with { code }.
 */
export default function OtpCard({ info, title, onVerified, onPending, onBack, backLabel = "← Back" }) {
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [meta, setMeta] = useState(info);
  const [left, setLeft] = useState(info.resendInSec ?? 30);
  const [shake, setShake] = useState(false);

  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  const verify = async (e, value = code) => {
    e?.preventDefault(); setErr("");
    if (value.length !== 6) { setErr("Enter the full 6-digit code."); return; }
    setBusy(true);
    try {
      const { data } = await axios.post(`${API}/auth/verify-otp`, { identifier: meta.identifier, otp: value, purpose: meta.purpose });
      onVerified(meta.purpose === "reset" ? { code: value } : data);
    } catch (e2) {
      if (e2.response?.data?.pending && onPending) { onPending(e2.response.data.message); return; }
      setErr(e2.response?.data?.message || "Verification failed");
      setShake(true); setTimeout(() => setShake(false), 450);
      setCode("");
    } finally { setBusy(false); }
  };

  // auto-submit once 6 digits are in
  const onCode = (v) => { setCode(v); if (v.length === 6 && !busy) verify(null, v); };

  const resend = async () => {
    setErr("");
    try {
      const { data } = await axios.post(`${API}/auth/resend-otp`, { identifier: meta.identifier, purpose: meta.purpose });
      setMeta((m) => ({ ...m, ...data }));
      setLeft(data.resendInSec ?? 30);
      setCode("");
    } catch (e2) {
      setErr(e2.response?.data?.message || "Could not resend");
      if (e2.response?.data?.resendInSec) setLeft(e2.response.data.resendInSec);
    }
  };

  return (
    <div className="auth-card fade-in">
      <div className="steps" aria-hidden="true"><i className="on" /><i className="on" /></div>
      <div className="otp-icon"><span className="material-symbols-outlined">mark_email_read</span></div>
      <h2>{title}</h2>
      <p className="sub">We sent a 6-digit code to <b>{meta.email || meta.identifier}</b>. It expires in {meta.expiresInMin || 10} minutes.</p>

      {meta.devOtp && (
        <div className="banner-info dev">
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>construction</span>
          <span><b>Dev mode:</b> email isn't configured, so the code is shown here and in the server console: <b className="devcode">{meta.devOtp}</b>. Add Gmail/SMTP keys in <code>backend/.env</code> to send real emails.</span>
        </div>
      )}
      {meta.previewUrl && (
        <div className="banner-info dev">
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>outgoing_mail</span>
          <span><b>Test inbox:</b> this build uses Ethereal, so no real email was sent.{" "}
            <a href={meta.previewUrl} target="_blank" rel="noreferrer" className="link"><b>Open the email to read your code →</b></a></span>
        </div>
      )}
      {meta.message && !meta.devOtp && <div className="banner-info">{meta.message}</div>}

      <form onSubmit={verify} className={shake ? "shake" : ""}>
        <label className="lbl">Enter code</label>
        <OtpInput value={code} onChange={onCode} disabled={busy} />
        <div className="row-between" style={{ margin: "0 0 1rem", fontSize: ".82rem", color: "var(--muted)" }}>
          <span>Didn't get it? Check spam.</span>
          {left > 0
            ? <span>Resend in 0:{String(left).padStart(2, "0")}</span>
            : <button type="button" className="link" onClick={resend}>Resend code</button>}
        </div>
        {err && <p className="form-err" role="alert">{err}</p>}
        <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy}>
          {busy ? <span className="spinner" /> : <>Verify &amp; continue <span className="material-symbols-outlined arrow">arrow_forward</span></>}
        </button>
        {onBack && <p className="auth-alt"><button type="button" className="link" onClick={onBack}>{backLabel}</button></p>}
      </form>
    </div>
  );
}
