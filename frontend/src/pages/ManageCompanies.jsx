import { useEffect, useState } from "react";
import api from "../api";
import AppLayout from "../components/AppLayout";
import Modal from "../components/Modal";
import useSeo from "../hooks/useSeo";

const EMPTY = { name: "", location: "", contact: "", email: "" };
const FIELDS = [
  { k: "name", label: "Company name", req: true, ph: "e.g. Nashik Dairy Co-op" },
  { k: "location", label: "Location", ph: "e.g. Nashik, Maharashtra" },
  { k: "contact", label: "Contact number", ph: "e.g. 98765 43210" },
  { k: "email", label: "Email", ph: "e.g. procurement@dairy.in" },
];

export default function ManageCompanies() {
  useSeo({ title: "Companies", noindex: true });
  const [companies, setCompanies] = useState(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => api.get("/companies").then((r) => setCompanies(r.data)).catch(() => setCompanies([]));
  useEffect(() => { load(); }, []);

  const startAdd = () => { setEditing(null); setForm(EMPTY); setErr(""); setOpen(true); };
  const startEdit = (c) => { setEditing(c._id); setForm({ name: c.name || "", location: c.location || "", contact: c.contact || "", email: c.email || "" }); setErr(""); setOpen(true); };
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault(); setErr("");
    if (!form.name.trim()) { setErr("Company name is required."); return; }
    setBusy(true);
    try {
      if (editing) await api.put(`/companies/${editing}`, form);
      else await api.post("/companies", form);
      setOpen(false); load();
    } catch (e2) { setErr(e2.response?.data?.message || "Could not save"); }
    finally { setBusy(false); }
  };

  const remove = async (c) => {
    if (!window.confirm(`Delete ${c.name}?`)) return;
    try { await api.delete(`/companies/${c._id}`); load(); } catch { /* ignore */ }
  };

  return (
    <AppLayout title="Companies">
      <div className="page-head">
        <div><h1 className="greet">Companies</h1><div className="subt">Collection centres and processing partners.</div></div>
        <button className="btn btn-primary" onClick={startAdd}><span className="material-symbols-outlined">add</span> Add company</button>
      </div>

      <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
        {!companies ? <div className="skeleton" style={{ height: 200, margin: 16 }} /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Name</th><th>Location</th><th>Contact</th><th>Email</th><th></th></tr></thead>
              <tbody>
                {companies.map((c) => (
                  <tr key={c._id}>
                    <td style={{ fontWeight: 700 }}>{c.name}</td>
                    <td>{c.location || "—"}</td>
                    <td>{c.contact || "—"}</td>
                    <td>{c.email || "—"}</td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <button className="icon-btn" title="Edit" onClick={() => startEdit(c)}><span className="material-symbols-outlined">edit</span></button>
                      <button className="icon-btn danger" title="Delete" onClick={() => remove(c)}><span className="material-symbols-outlined">delete</span></button>
                    </td>
                  </tr>
                ))}
                {!companies.length && <tr><td colSpan={5} className="muted" style={{ textAlign: "center", padding: "2rem" }}>No companies yet. Add your first collection centre.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit company" : "Add company"}>
        <form onSubmit={save}>
          {FIELDS.map((f) => (
            <div className="field" key={f.k}>
              <label className="lbl">{f.label}{f.req && <span className="req"> *</span>}</label>
              <input value={form[f.k]} onChange={set(f.k)} placeholder={f.ph} type={f.k === "email" ? "email" : "text"} />
            </div>
          ))}
          {err && <p className="form-err" role="alert">{err}</p>}
          <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy}>{busy ? <span className="spinner" /> : (editing ? "Save changes" : "Add company")}</button>
        </form>
      </Modal>
    </AppLayout>
  );
}
