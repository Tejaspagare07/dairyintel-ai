import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import PublicShell from "../components/PublicShell";
import useSeo from "../hooks/useSeo";

/* ---------- data ---------- */

const CAPS = [
  { icon: "science", bg: "var(--primary-tint)", fg: "var(--primary-deep)",
    title: "FSSAI Milk Quality Grading",
    desc: "Instant Good / Average / Poor grade from fat, SNF, CLR, protein and added-water readings — checked against FSSAI and BIS minimums for cow, buffalo or mixed milk. Every reason is listed so you know exactly why.",
    meta: "Cow · buffalo · mixed" },

  { icon: "stethoscope", bg: "var(--danger-tint)", fg: "var(--danger)",
    title: "Mastitis & Ketosis Early Warning",
    desc: "A trained machine-learning model flags samples that look like subclinical mastitis or early ketosis — before visible symptoms appear. Catch it early, save the animal and the milk.",
    meta: "Healthy / High Risk" },

  { icon: "space_dashboard", bg: "var(--blue-tint)", fg: "var(--blue)",
    title: "Farmer + Collection Centre Dashboards",
    desc: "Farmers see their checks, trends and alerts per animal. Collection centres see every farm's quality mix, high-risk animals and total milk volume — all in real time.",
    meta: "Two separate views" },

  { icon: "notifications_active", bg: "var(--gold-tint)", fg: "#8a6410",
    title: "Instant Risk Alerts",
    desc: "The moment a check comes back High Risk or the milk is watered or poor, an alert is raised on both the farmer's and the centre's dashboard — so the animal gets attention before it costs you.",
    meta: "Auto-flagged, both roles" },
];

const STEPS = [
  { n: "1", icon: "edit_note",
    t: "Enter your milk analyzer readings",
    d: "Type in fat, SNF, CLR, protein, lactose, added water and temperature. Add EC and SCC if your analyzer reports them — or leave them blank." },
  { n: "2", icon: "monitoring",
    t: "Get the quality grade and health risk",
    d: "Instantly see a Good / Average / Poor quality grade with reasons, plus a Healthy or High Risk prediction with the likely condition and confidence." },
  { n: "3", icon: "veterinary",
    t: "Act on the alert before it's too late",
    d: "High-risk animals appear on your dashboard and the centre's. Confirm with a CMT test, a ketone strip or your vet — and start treatment early." },
];

const FAQ = [
  ["Is this a diagnosis?",
   'No. DairyIntel AI is a screening aid, not a medical diagnosis. A High Risk result means "check this animal" — confirm it with a California Mastitis Test (CMT), a ketone strip or your veterinarian.'],

  ["Which milk analyzers are supported?",
   "Any milk analyzer that reports fat, SNF, CLR, protein, lactose and added water — including Lactoscan, Milkotester, Speedy and similar devices used at Indian collection centres. Just type in the numbers."],

  ["What if I don't have EC or SCC readings?",
   "Leave them blank. The model predicts from the other readings and tells you which inputs were used. Adding EC or SCC makes the mastitis screen stronger, but it works without them."],

  ["How do I get started?",
   "Sign up with your email, verify once with a 6-digit code, and start testing right away. Built as a college research project for Indian dairy farmers and collection centres."],

  ["Is it a replacement for a vet or a lab test?",
   "No. It is an early-warning screen that works from your daily analyzer readings. A High Risk result means check the animal — always confirm with a CMT test, a ketone strip or your vet before treating."],

  ["How does AI detect mastitis from milk readings?",
   "A Random Forest machine-learning model trained on literature-calibrated data looks at patterns across fat, protein, lactose, SNF, EC and SCC. Mastitis changes these values in predictable ways — higher EC, lower lactose, altered fat-to-protein ratio — and the model learns to spot those patterns early."],

  ["What FSSAI standards are used for grading?",
   "Quality grading follows FSSAI (Food Safety and Standards Authority of India) and BIS (Bureau of Indian Standards) minimums for fat, SNF and protein content — separately for cow milk, buffalo milk and mixed milk."],

  ["How does login work?",
   "Email and password. When you sign up, a one-time 6-digit code is sent to your email to verify it. After that, you log in with just your email and password — no code every time. Password reset uses a code for security."],
];

const TRUST_STATS = [
  { icon: "verified", n: "FSSAI", l: "standards-based grading" },
  { icon: "psychology", n: "ML", l: "trained mastitis model" },
  { icon: "speed", n: "Instant", l: "results in seconds" },
  { icon: "lock", n: "Secure", l: "OTP-verified accounts" },
];

/* ---------- component ---------- */

export default function Landing() {
  useSeo({
    title: "Milk Quality Testing & Mastitis Screening for Indian Dairy",
    description: "Grade milk quality (Good / Average / Poor) and get early mastitis & ketosis warnings from your Lactoscan or milk analyzer readings. FSSAI-based grading for Indian dairy farms and collection centres.",
    path: "/",
  });
  const nav = useNavigate();

  // reveal-on-scroll
  useEffect(() => {
    const els = document.querySelectorAll(".reveal");
    if (!("IntersectionObserver" in window)) { els.forEach((e) => e.classList.add("in")); return; }
    const io = new IntersectionObserver((ents) => ents.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
    }), { threshold: 0.12 });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);

  return (
    <PublicShell>
      {/* ───── HERO ───── */}
      <section className="hero" aria-labelledby="hero-h">
        <div>
          <span className="eyebrow"><span className="material-symbols-outlined" style={{ fontSize: 18 }}>agriculture</span> Built for Indian dairy farms &amp; collection centres</span>
          <h1 id="hero-h">
            Grade your milk.<br />
            Screen your herd.<br />
            <em>In one test.
              <svg className="hero-underline" viewBox="0 0 300 20" preserveAspectRatio="none" aria-hidden="true">
                <path d="M2 14c60-9 200-11 296-4" stroke="var(--gold)" strokeWidth="5" fill="none" strokeLinecap="round" />
              </svg>
            </em>
          </h1>
          <p className="hero-sub">Enter your Lactoscan or milk analyzer readings and instantly get a <strong>Good / Average / Poor</strong> quality grade plus an <strong>early warning for mastitis or ketosis</strong> — with the reasons shown.</p>
          <div className="hero-stats">
            <div className="hstat"><div className="n">9+</div><div className="l">parameters analysed</div></div>
            <div className="hstat"><div className="n">FSSAI</div><div className="l">standards grading</div></div>
            <div className="hstat"><div className="n">ML</div><div className="l">powered predictions</div></div>
          </div>
        </div>
        <div>
          <div className="hero-visual hero-float" aria-label="Example milk check result showing Good quality and Healthy animal">
            <div className="hv-top"><div className="hv-title">Sample T-012 · Evening</div><span className="chip chip-neutral">Lactoscan</span></div>
            <div className="hv-sample">
              {[["Fat", "4.8 %"], ["SNF", "8.6 %"], ["Protein / Lactose", "3.30 / 4.81 %"], ["Added water", "0.0 %"]].map(([k, v]) => (
                <div className="hv-row" key={k}><span>{k}</span><span>{v}</span></div>
              ))}
            </div>
            <div className="hv-result">
              <div><div style={{ fontSize: ".8rem", opacity: .85 }}>Milk quality</div><div className="big">Good</div></div>
              <div><div style={{ fontSize: ".8rem", opacity: .85 }}>Animal health</div><div className="big">Healthy</div></div>
              <span className="material-symbols-outlined" style={{ fontSize: 30 }}>check_circle</span>
            </div>
          </div>
        </div>
      </section>

      {/* ───── TRUST BAR ───── */}
      <section className="trust-bar" aria-label="Key highlights">
        <div className="trust-bar-in">
          {TRUST_STATS.map((s) => (
            <div className="tstat" key={s.n}>
              <span className="material-symbols-outlined tstat-icon">{s.icon}</span>
              <div><div className="tstat-n">{s.n}</div><div className="tstat-l">{s.l}</div></div>
            </div>
          ))}
        </div>
      </section>

      {/* ───── FEATURES ───── */}
      <section className="features" id="features" aria-labelledby="f-h">
        <div className="features-head reveal">
          <h2 id="f-h">One milk test, two dashboards, zero guesswork</h2>
          <p>A farmer view and a collection-centre view — quality grade, health screen and alerts from a single set of analyzer readings. No new hardware needed.</p>
        </div>
        <div className="fgrid">
          {CAPS.map((c, i) => (
            <article className={`fcard reveal ${i < 2 ? "fcard-featured" : ""}`} key={c.title} style={{ transitionDelay: `${i * 60}ms` }}>
              <div className="fi" style={{ background: c.bg }}><span className="material-symbols-outlined" style={{ color: c.fg }}>{c.icon}</span></div>
              <h3>{c.title}</h3><p>{c.desc}</p>
              <div className="fmeta">{c.meta} <span className="material-symbols-outlined">arrow_forward</span></div>
            </article>
          ))}
        </div>
      </section>

      {/* ───── HOW IT WORKS ───── */}
      <section className="band" id="how" aria-labelledby="how-h">
        <div className="band-in">
          <div className="reveal">
            <h2 id="how-h">From analyzer reading to decision — three simple steps</h2>
            <p>No new hardware. No lab wait. Type in the numbers your collection centre already records and get a result in seconds.</p>
            <button className="btn btn-gold btn-lg" style={{ marginTop: "1.6rem" }} onClick={() => nav("/signup")}>Try it now <span className="material-symbols-outlined arrow">arrow_forward</span></button>
          </div>
          <ol className="band-steps">
            {STEPS.map((s) => (
              <li className="bstep reveal" key={s.n}>
                
                <div><h3>{s.t}</h3><p>{s.d}</p></div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ───── FAQ ───── */}
      <section className="features faq" id="faq" aria-labelledby="faq-h">
        <div className="features-head reveal"><h2 id="faq-h">Questions dairy farmers ask</h2><p>Everything you need to know before your first milk test.</p></div>
        <div className="faq-list">
          {FAQ.map(([q, a]) => (
            <details key={q} className="reveal"><summary>{q}<span className="material-symbols-outlined">expand_more</span></summary><p>{a}</p></details>
          ))}
        </div>
      </section>

      {/* ───── CTA BANNER ───── */}
      <section className="cta-banner reveal" aria-label="Get started">
        <div className="cta-banner-in">
          <h2>Ready to check your milk?</h2>
          <p>Sign up in 30 seconds — start grading milk and screening your herd instantly.</p>
          <button className="btn btn-primary btn-lg hero-btn-pop" onClick={() => nav("/signup")}>
            Create account <span className="material-symbols-outlined arrow">arrow_forward</span>
          </button>
        </div>
      </section>

      {/* ───── FAQ STRUCTURED DATA ───── */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org", "@type": "FAQPage",
        mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
      }) }} />
    </PublicShell>
  );
}