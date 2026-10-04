import { useEffect, useState } from "react";
import api from "../api";
import AppLayout from "../components/AppLayout";
import Modal from "../components/Modal";
import Chip from "../components/Chip";

const EMPTY = { name: "", email: "", mobile: "", password: "", role: "user", companyId: "" };

export default function ManageUsers() {
  const [users, setUsers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [err, setErr] = useState("");

  const load = () => {
    api.get("/users").then((r) => setUsers(r.data)).catch(() => {});
    api.get("/companies").then((r) => setCompanies(r.data)).catch(() => {});
  };
  useEffect(load, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const openAdd = () => { setEditing(null); setForm(EMPTY); setErr(""); setOpen(true); };
  const openEdit = (u) => {
    setEditing(u._id);
    setForm({ name: u.name, email: u.email, mobile: u.mobile || "", password: "", role: u.role, companyId: u.companyId?._id || u.companyId || "" });
    setErr(""); setOpen(true);
  };

  const save = async (e) => {
    e.preventDefault(); setErr("");
    try {
      if (editing) await api.put(`/users/${editing}`, form);
      else await api.post("/users", form);
      setOpen(false); load();
    } catch (e2) { setErr(e2.response?.data?.message || "Save failed"); }
  };

  const setStatus = async (u, status) => {
    try { await api.patch(`/users/${u._id}/status`, { status }); load(); }
    catch (e2) { alert(e2.response?.data?.message || "Update failed"); }
  };

  const del = async (u) => {
    if (!window.confirm(`Delete user "${u.name}"?`)) return;
    try { await api.delete(`/users/${u._id}`); load(); }
    catch (e2) { alert(e2.response?.data?.message || "Delete failed"); }
  };

  return (
    <AppLayout title="Manage farmers">
      <div className="page-head">
        <div><div className="greet">Manage farmers</div><div className="subt">{users.length} users registered.</div></div>
        <button className="btn btn-primary" onClick={openAdd}><span className="material-symbols-outlined">add</span> Add user</button>
      </div>

      <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Mobile</th><th>Role</th><th>Status</th><th>Company</th><th style={{ textAlign: "right" }}>Actions</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u._id}>
                  <td><div style={{ display: "flex", alignItems: "center", gap: ".6rem" }}><span className="row-av">{u.name?.charAt(0).toUpperCase()}</span>{u.name}</div></td>
                  <td>{u.email}</td>
                  <td>{u.mobile || "—"}</td>
                  <td><Chip label={u.role} color={u.role === "admin" ? "primary" : "secondary"} /></td>
                  <td><span className={`chip ${u.status === "blocked" ? "chip-poor" : u.status === "pending" ? "chip-avg" : "chip-good"}`}>{u.status || "active"}</span>{u.emailVerified === false && <small className="muted"> · unverified</small>}</td>
                  <td>{u.companyId?.name || "—"}</td>
                  <td>
                    <div style={{ display: "flex", gap: ".6rem", justifyContent: "flex-end" }}>
                      {u.role !== "admin" && u.status !== "active" && <button className="icon-btn ok" title="Approve / activate" aria-label={`Activate ${u.name}`} onClick={() => setStatus(u, "active")}><span className="material-symbols-outlined">check</span></button>}
                      {u.role !== "admin" && u.status !== "blocked" && <button className="icon-btn bad" title="Block" aria-label={`Block ${u.name}`} onClick={() => setStatus(u, "blocked")}><span className="material-symbols-outlined">block</span></button>}
                      <button className="material-symbols-outlined" aria-label={`Edit ${u.name}`} style={{ color: "var(--blue)", background: "none", border: "none", cursor: "pointer" }} onClick={() => openEdit(u)}>edit</button>
                      <button className="material-symbols-outlined" style={{ color: "var(--danger)", background: "none", border: "none", cursor: "pointer" }} onClick={() => del(u)}>delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--muted)", padding: "2rem" }}>No users yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit user" : "Add user"}>
        <form className="form-grid" onSubmit={save}>
          {[
            { k: "name", label: "Full name" },
            { k: "email", label: "Email", type: "email" },
            { k: "mobile", label: "Mobile" },
            { k: "password", label: editing ? "New password (blank = keep)" : "Password", type: "password" },
          ].map((f) => (
            <div key={f.k}>
              <label className="lbl">{f.label}</label>
              <input type={f.type || "text"} value={form[f.k]} onChange={set(f.k)} />
            </div>
          ))}
          <div>
            <label className="lbl">Role</label>
            <select value={form.role} onChange={set("role")}>
              <option value="user">Dairy farmer</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div>
            <label className="lbl">Company</label>
            <select value={form.companyId} onChange={set("companyId")}>
              <option value="">— None —</option>
              {companies.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </div>
          <div className="full">
            {err && <p style={{ color: "var(--danger)", fontSize: ".85rem", marginBottom: ".6rem" }}>{err}</p>}
            <button type="submit" className="btn btn-primary btn-block">{editing ? "Save changes" : "Create user"}</button>
          </div>
        </form>
      </Modal>
    </AppLayout>
  );
}
