import React, { useEffect, useMemo, useState } from "react";

/* =========================
   Utilities
========================= */
const pad = (n) => String(n).padStart(2, "0");
const toYmd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const monthLabel = (d) => d.toLocaleString(undefined, { month: "long", year: "numeric" });
const csvEscape = (val) => {
  const s = (val ?? "").toString().replaceAll('"', '""');
  return /[",\n]/.test(s) ? `"${s}"` : s;
};
const timestamp = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
const downloadBlob = (url, filename) => {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

/* =========================
   Sex helpers
========================= */
function normSex(s) {
  const v = (s || "").toString().trim().toLowerCase();
  if (v.startsWith("m")) return "Male";
  if (v.startsWith("f")) return "Female";
  if (!v) return "";
  return "Unknown";
}
function sexColor(s) {
  switch (s) {
    case "Male":
      return "#2563eb";
    case "Female":
      return "#ec4899";
    default:
      return "#6b7280";
  }
}

/* =========================
   Main App
========================= */
export default function App() {
  /* ---------- Core state ---------- */
  const DEFAULT_DOCTORS = {
    sm: { name: "Dr. Smith", color: "#10b981" },
    jn: { name: "Dr. Jones", color: "#f59e0b" },
    ly: { name: "Dr. Lee", color: "#3b82f6" },
  };
  const DEFAULT_WORKERS = ["Alex", "Bailey", "Casey"];

  const [appointments, setAppointments] = useState([]);              // active (non-archived)
  const [archivedAppointments, setArchivedAppointments] = useState([]); // archived/past

  const [doctors, setDoctors] = useState(DEFAULT_DOCTORS);
  const [doctorByDate, setDoctorByDate] = useState({});
  const [workers, setWorkers] = useState(DEFAULT_WORKERS);
  const [staffByDate, setStaffByDate] = useState({});

  const [lastBackupAt, setLastBackupAt] = useState(() => localStorage.getItem("lastBackupAt") || "");

  /* ---------- Entry form state ---------- */
  const emptyCat = { name: "", age: "", color: "", breed: "", sex: "" };
  const [clientName, setClientName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [date, setDate] = useState("");
  const [cats, setCats] = useState([{ ...emptyCat }]);
  const COMMON_SERVICES = [
    "Revolution",
    "Ear Tip",
    "Snap Test",
    "Pain Meds To Go 1x",
    "Pain Meds To Go 2x",
    "Pain Meds To Go 3x",
    "Microchip",
    "E-Collar",
    "Proof Of Vax",
  ];
  const [selectedServices, setSelectedServices] = useState(new Set());
  const [servicesNotes, setServicesNotes] = useState("");
  const [editingId, setEditingId] = useState(null);

  /* ---------- UI state ---------- */
  const [searchText, setSearchText] = useState("");
  const [showDoctorSettings, setShowDoctorSettings] = useState(false);
  const [showWorkerSettings, setShowWorkerSettings] = useState(false);
  const [printDate, setPrintDate] = useState("");
  const [printModeDate, setPrintModeDate] = useState("");
  const [selected, setSelected] = useState(null);
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const [collapsedDates, setCollapsedDates] = useState({});
  const [showArchived, setShowArchived] = useState(false);
  const [compactCards, setCompactCards] = useState(true);

  /* ---------- Doctor/Worker assignment state (light) ---------- */
  const [docName, setDocName] = useState("");
  const [docColor, setDocColor] = useState("#10b981");
  const [doctorDate, setDoctorDate] = useState("");
  const [doctorKey, setDoctorKey] = useState("");

  const [workerName, setWorkerName] = useState("");
  const [staffDate, setStaffDate] = useState("");
  const [selectedWorkerId, setSelectedWorkerId] = useState("");
  const workerOptions = workers.map((w) => ({ id: slug(w) || w, name: w }));

  /* =========================
     Load from localStorage
  ========================= */
  useEffect(() => {
    const sA = localStorage.getItem("appointments");
    if (sA) setAppointments(JSON.parse(sA));
    const sArch = localStorage.getItem("archivedAppointments");
    if (sArch) setArchivedAppointments(JSON.parse(sArch));

    const sDocs = localStorage.getItem("doctors");
    if (sDocs) setDoctors(JSON.parse(sDocs));
    const sDocBy = localStorage.getItem("doctorByDate");
    if (sDocBy) setDoctorByDate(JSON.parse(sDocBy));

    const sWorkers = localStorage.getItem("workers");
    if (sWorkers) setWorkers(JSON.parse(sWorkers));
    const sStaffBy = localStorage.getItem("staffByDate");
    if (sStaffBy) setStaffByDate(JSON.parse(sStaffBy));
  }, []);

  /* =========================
     Persist (local only)
     (Manual-only cloud backup; nothing auto here)
  ========================= */
  useEffect(() => {
    localStorage.setItem("appointments", JSON.stringify(appointments));
    localStorage.setItem("archivedAppointments", JSON.stringify(archivedAppointments));
    localStorage.setItem("doctors", JSON.stringify(doctors));
    localStorage.setItem("doctorByDate", JSON.stringify(doctorByDate));
    localStorage.setItem("workers", JSON.stringify(workers));
    localStorage.setItem("staffByDate", JSON.stringify(staffByDate));
  }, [appointments, archivedAppointments, doctors, doctorByDate, workers, staffByDate]);

  /* =========================
     Helpers
  ========================= */
  const resetForm = () => {
    setClientName("");
    setAddress("");
    setPhone("");
    setEmail("");
    setDate("");
    setCats([{ ...emptyCat }]);
    setSelectedServices(new Set());
    setServicesNotes("");
    setEditingId(null);
  };
  const toggleService = (name) =>
    setSelectedServices((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  const addCatRow = () => setCats((prev) => [...prev, { ...emptyCat }]);
  const removeCatRow = (i) => setCats((prev) => prev.filter((_, idx) => idx !== i));
  const updateCatField = (i, k, v) => setCats((prev) => prev.map((c, idx) => (idx === i ? { ...c, [k]: v } : c)));

  const saveAppointment = () => {
    if (!clientName || !date) {
      alert("Client Name and Date are required.");
      return;
    }
    const updated = {
      id: editingId ?? Date.now(),
      clientName,
      address,
      phone,
      email,
      date,
      cats: cats
        .map((c) => ({ ...c, sex: normSex(c.sex) }))
        .filter((c) => c.name || c.age || c.color || c.breed || c.sex),
      servicesSelected: Array.from(selectedServices),
      servicesNotes,
    };
    if (editingId) {
      setAppointments((prev) => prev.map((a) => (a.id === editingId ? updated : a)));
    } else {
      setAppointments((prev) => [...prev, updated]);
    }
    resetForm();
  };

  const startEdit = (appt) => {
    setEditingId(appt.id);
    setClientName(appt.clientName || "");
    setAddress(appt.address || "");
    setPhone(appt.phone || "");
    setEmail(appt.email || "");
    setDate(appt.date || "");
    setCats(Array.isArray(appt.cats) && appt.cats.length ? appt.cats : [{ ...emptyCat }]);
    setSelectedServices(new Set(appt.servicesSelected || []));
    setServicesNotes(appt.servicesNotes || "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteAppointment = (id) => {
    if (!window.confirm("Are you sure you want to delete this appointment?")) return;
    setAppointments((prev) => prev.filter((a) => a.id !== id));
    if (selected?.id === id) setSelected(null);
  };

  /* =========================
     Search & group (ACTIVE)
  ========================= */
  const todayYmd = toYmd(new Date());
  const filteredActive = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    let arr = appointments;
    if (q) arr = arr.filter((a) => (a.clientName || "").toLowerCase().includes(q));
    return [...arr].sort((a, b) => a.date.localeCompare(b.date));
  }, [appointments, searchText]);

  const groupedActiveByDate = useMemo(() => {
    const map = {};
    for (const a of filteredActive) {
      (map[a.date] ||= []).push(a);
    }
    return map;
  }, [filteredActive]);

  /* =========================
     Calendar counts: cats per day
  ========================= */
  const sexCountsByDate = useMemo(() => {
    const m = {};
    const all = [...appointments, ...archivedAppointments]; // counts across everything
    for (const a of all) {
      const dd = a.date;
      if (!m[dd]) m[dd] = { male: 0, female: 0, unknown: 0 };
      if (Array.isArray(a.cats)) {
        for (const c of a.cats) {
          const sx = normSex(c.sex);
          if (sx === "Male") m[dd].male++;
          else if (sx === "Female") m[dd].female++;
          else m[dd].unknown++;
        }
      }
    }
    return m;
  }, [appointments, archivedAppointments]);

  const totalCatsByDate = useMemo(() => {
    const out = {};
    for (const [d, c] of Object.entries(sexCountsByDate)) {
      out[d] = (c.male || 0) + (c.female || 0) + (c.unknown || 0);
    }
    return out;
  }, [sexCountsByDate]);

  /* =========================
     ARCHIVE: move past -> archive
  ========================= */
  const archivePast = () => {
    if (!window.confirm("Archive all appointments before today?")) return;
    const active = [];
    const gone = [];
    for (const a of appointments) {
      if (a.date < todayYmd) gone.push(a);
      else active.push(a);
    }
    if (!gone.length) {
      alert("No past appointments to archive.");
      return;
    }
    setAppointments(active);
    setArchivedAppointments((prev) => [...prev, ...gone].sort((x, y) => x.date.localeCompare(y.date)));
    alert(`Archived ${gone.length} appointment(s).`);
  };

  const unarchiveAll = () => {
    if (!window.confirm("Restore ALL archived appointments to active list?")) return;
    setAppointments((prev) => [...prev, ...archivedAppointments].sort((x, y) => x.date.localeCompare(y.date)));
    setArchivedAppointments([]);
  };

  /* =========================
     EXPORT / IMPORT
  ========================= */
  const toCsv = (appts) => {
    const headers = [
      "Date",
      "Client Name",
      "Address",
      "Phone",
      "Email",
      "Cat Name",
      "Cat Age",
      "Cat Color",
      "Cat Breed",
      "Cat Sex",
      "Selected Services",
      "Services Notes",
      "Appointment ID",
      "Archived",
    ];
    const rows = [headers.join(",")];
    for (const a of appts) {
      const base = [a.date, a.clientName, a.address, a.phone, a.email];
      const services = (a.servicesSelected || []).join("; ");
      const notes = a.servicesNotes || "";
      const isArch = archivedAppointments.some((x) => x.id === a.id) ? "Yes" : "No";
      if (Array.isArray(a.cats) && a.cats.length) {
        for (const c of a.cats) {
          rows.push(
            [
              ...base.map(csvEscape),
              csvEscape(c.name || ""),
              csvEscape(c.age || ""),
              csvEscape(c.color || ""),
              csvEscape(c.breed || ""),
              csvEscape(normSex(c.sex) || ""),
              csvEscape(services),
              csvEscape(notes),
              csvEscape(a.id),
              csvEscape(isArch),
            ].join(",")
          );
        }
      } else {
        rows.push(
          [
            ...base.map(csvEscape),
            "", "", "", "", "",
            csvEscape(services),
            csvEscape(notes),
            csvEscape(a.id),
            csvEscape(isArch),
          ].join(",")
        );
      }
    }
    return rows.join("\n");
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(appointments, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    downloadBlob(url, `appointments-active-${timestamp()}.json`);
  };
  const exportAllCsv = () => {
    const all = [...appointments, ...archivedAppointments];
    const csv = toCsv(all);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    downloadBlob(url, `appointments-all-${timestamp()}.csv`);
  };
  const onImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!Array.isArray(data)) throw new Error("Invalid JSON format");
      const byId = new Map(appointments.map((a) => [a.id, a]));
      let added = 0, replaced = 0;
      for (const a of data) {
        if (!a || typeof a !== "object") continue;
        if (byId.has(a.id)) {
          byId.set(a.id, a);
          replaced++;
        } else {
          byId.set(a.id, a);
          added++;
        }
      }
      const merged = Array.from(byId.values()).sort((x, y) => x.date.localeCompare(y.date));
      setAppointments(merged);
      alert(`Import complete. Added: ${added}, Replaced: ${replaced}, Total: ${merged.length}`);
      e.target.value = "";
    } catch (err) {
      alert("Import failed: " + err.message);
      e.target.value = "";
    }
  };

  /* =========================
     Cloud backup (manual only)
  ========================= */
  async function backupNow() {
    try {
      const payload = { appointments, archivedAppointments, doctors, doctorByDate, workers, staffByDate };

      // Prevent accidental empty overwrite
      const isEmpty =
        (!payload.appointments?.length && !payload.archivedAppointments?.length) &&
        (!Object.keys(payload.doctors || {}).length) &&
        (!Object.keys(payload.doctorByDate || {}).length) &&
        (!payload.workers?.length) &&
        (!Object.keys(payload.staffByDate || {}).length);

      if (isEmpty && !window.confirm("Data looks empty. Overwrite cloud backup with an empty snapshot?")) return;

      const ts = new Date().toISOString();
      const res = await fetch("/.netlify/functions/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site: "scheduler-app", data: payload, when: ts }),
      });
      if (!res.ok) throw new Error("Backup failed.");
      setLastBackupAt(ts);
      localStorage.setItem("lastBackupAt", ts);
      alert("✅ Cloud backup saved.");
    } catch (e) {
      console.error(e);
      alert("❌ Backup failed. Check your internet or Netlify logs.");
    }
  }

  async function restoreFromCloud() {
    try {
      const res = await fetch("/.netlify/functions/restore");
      if (!res.ok) return alert("No cloud backup found or restore function not configured.");
      const json = await res.json(); // { site, when, data }
      if (!json?.data) return alert("Backup file empty.");

      if (!window.confirm(`Restore data from ${json.when}?\nThis will overwrite current data on this device.`)) return;

      const { appointments: A = [], archivedAppointments: AA = [], doctors: D, doctorByDate: DB, workers: W, staffByDate: SB } = json.data;

      setAppointments(Array.isArray(A) ? A : []);
      setArchivedAppointments(Array.isArray(AA) ? AA : []);
      if (D) setDoctors(D);
      if (DB) setDoctorByDate(DB);
      if (W) setWorkers(W);
      if (SB) setStaffByDate(SB);

      alert("✅ Restore complete.");
    } catch (e) {
      console.error(e);
      alert("❌ Restore failed. Check your internet or Netlify logs.");
    }
  }

  /* =========================
     Styles
  ========================= */
  const page = { minHeight: "100vh", background: "#f3f4f6", padding: 20 };
  const card = { background: "white", padding: 16, borderRadius: 12, maxWidth: 1100, margin: "0 auto 20px", boxShadow: "0 2px 6px rgba(0,0,0,0.1)" };
  const h1 = { textAlign: "center", marginBottom: 20 };
  const label = { fontSize: 13, color: "#374151", marginBottom: 4 };
  const input = { width: "100%", padding: 10, borderRadius: 8, border: "1px solid #e5e7eb", background: "white", outline: "none" };
  const textarea = { ...input, minHeight: 80, resize: "vertical" };
  const buttonPrimary = { padding: "10px 14px", background: "#2563eb", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600 };
  const buttonLight = { padding: "8px 12px", background: "#f3f4f6", color: "#111827", border: "1px solid #e5e7eb", borderRadius: 8, cursor: "pointer", fontWeight: 500 };
  const buttonSecondary = { padding: "8px 12px", background: "#111827", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600 };
  const buttonDanger = { padding: "8px 12px", background: "#ef4444", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600 };
  const chkWrap = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8, marginTop: 8 };
  const chkItem = { display: "flex", alignItems: "center", gap: 8, background: "#f9fafb", padding: "8px 10px", borderRadius: 8, border: "1px solid #e5e7eb" };
  const listCard = {
    background: "white",
    padding: compactCards ? 10 : 12,
    borderRadius: 10,
    marginBottom: compactCards ? 8 : 12,
    boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: compactCards ? 8 : 12,
  };
  const tag = { display: "inline-flex", alignItems: "center", gap: 6, padding: "2px 8px", borderRadius: 999, background: "#eef2ff", color: "#3730a3", fontSize: 12, marginLeft: 8 };
  const dot = (bg) => ({ width: 8, height: 8, borderRadius: 999, background: bg, display: "inline-block" });
  const chip = (bg, color = "#111827") => ({ alignSelf: "flex-start", padding: "2px 6px", borderRadius: 999, background: bg, color, fontSize: 12, fontWeight: 600 });
  const chipSmall = (bg, color = "#111827") => ({ alignSelf: "flex-start", padding: "1px 6px", borderRadius: 999, background: bg, color, fontSize: 11, fontWeight: 700 });

  /* =========================
     Calendar prep
  ========================= */
  const days = [];
  const firstDay = new Date(calMonth);
  const startWeekday = firstDay.getDay();
  const lastDay = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 0).getDate();
  for (let i = 0; i < startWeekday; i++) days.push(null);
  for (let d = 1; d <= lastDay; d++) days.push(new Date(calMonth.getFullYear(), calMonth.getMonth(), d));

  /* =========================
     Print view (unchanged)
  ========================= */
  const apptsForDate = (d) => appointments.filter((a) => a.date === d);
  const printDay = () => { if (printDate) setPrintModeDate(printDate); };
  const printDetails = () => window.print();

  if (printModeDate) {
    const dayAppts = apptsForDate(printModeDate);
    return (
      <div style={{ padding: 20 }}>
        <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>Client Appointments — {printModeDate}</h2>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={buttonPrimary} onClick={() => window.print()}>Print</button>
            <button style={buttonSecondary} onClick={() => setPrintModeDate("")}>Back to Scheduler</button>
          </div>
        </div>
        {dayAppts.length === 0 ? <div>No appointments for this date.</div> : dayAppts.map((a) => (
          <div key={a.id} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 12, marginBottom: 12 }}>
            <div><b>Client:</b> {a.clientName || "-"}</div>
            <div><b>Address:</b> {a.address || "-"}</div>
            <div><b>Phone:</b> {a.phone || "-"}</div>
            <div><b>Email:</b> {a.email || "-"}</div>
            {!!(a.cats && a.cats.length) && (
              <>
                <div style={{ fontWeight: 700, marginTop: 8 }}>Cats</div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr><th>Name</th><th>Age</th><th>Color</th><th>Breed</th><th>Sex</th></tr></thead>
                  <tbody>
                    {a.cats.map((c, i) => (
                      <tr key={i}>
                        <td>{c.name || "-"}</td><td>{c.age || "-"}</td><td>{c.color || "-"}</td><td>{c.breed || "-"}</td>
                        <td><span style={{ ...tag, background: "transparent", color: "#374151" }}><i style={dot(sexColor(normSex(c.sex)))} /> {normSex(c.sex) || "-"}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
            {a.servicesSelected?.length ? (
              <>
                <div style={{ fontWeight: 700, marginTop: 8 }}>Selected Services</div>
                <ul style={{ margin: 0, paddingLeft: 18 }}>{a.servicesSelected.map((s, i) => <li key={i}>{s}</li>)}</ul>
              </>
            ) : null}
            {a.servicesNotes && (<><div style={{ fontWeight: 700, marginTop: 8 }}>Services Notes</div><div style={{ whiteSpace: "pre-wrap" }}>{a.servicesNotes}</div></>)}
          </div>
        ))}
      </div>
    );
  }

  /* =========================
     Render
  ========================= */
  return (
    <div style={page}>
      <h1 style={h1}>📅 Client Appointments</h1>

      {/* Controls */}
      <div style={{ ...card, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end" }}>
        <div style={{ flex: "1 1 260px", display: "flex", flexDirection: "column" }}>
          <label style={label}>Search by Client</label>
          <input style={input} value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="Type a client's name..." />
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button style={buttonSecondary} onClick={exportJson}>Export JSON</button>
          <button style={buttonSecondary} onClick={exportAllCsv}>Export CSV (All)</button>
          <label style={{ ...buttonLight, display: "inline-flex", alignItems: "center", gap: 8 }}>
            Import JSON
            <input type="file" accept="application/json" onChange={onImportFile} style={{ display: "none" }} />
          </label>

          {/* Cloud controls (manual only) */}
          <button style={buttonSecondary} onClick={backupNow}>Cloud Backup now</button>
          <button style={buttonLight} onClick={restoreFromCloud}>Restore from Cloud</button>
          <span style={{ color: "#6b7280", fontSize: 13 }}>
            Last cloud backup: {lastBackupAt ? new Date(lastBackupAt).toLocaleString() : "never"}
          </span>

          {/* View options */}
          <label style={{ color:"#6b7280", fontSize:13 }}>
            <input type="checkbox" checked={compactCards} onChange={(e)=>setCompactCards(e.target.checked)} style={{ marginRight: 6 }} />
            Compact cards
          </label>
        </div>
      </div>

      {/* Archive bar */}
      <div style={{ ...card, display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button style={buttonLight} onClick={archivePast}>Archive past (before today)</button>
          <button style={buttonLight} onClick={() => setShowArchived((v) => !v)}>{showArchived ? "Hide" : "Show"} archived</button>
          {archivedAppointments.length > 0 && <button style={buttonLight} onClick={unarchiveAll}>Restore ALL archived</button>}
        </div>
        <div style={{ color: "#6b7280", fontSize: 13 }}>
          Archived count: <b>{archivedAppointments.length}</b>
        </div>
      </div>

      {/* Calendar */}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <button style={buttonLight} onClick={() => { const d = new Date(calMonth); d.setMonth(d.getMonth() - 1); setCalMonth(d); }}>◀ Prev</button>
          <h3 style={{ margin: 0 }}>{monthLabel(calMonth)}</h3>
          <button style={buttonLight} onClick={() => { const d = new Date(calMonth); d.setMonth(d.getMonth() + 1); setCalMonth(d); }}>Next ▶</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8, marginBottom: 8, color: "#6b7280", fontSize: 12 }}>
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((w) => <div key={w} style={{ textAlign: "center" }}>{w}</div>)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
          {days.map((d, idx) => {
            if (!d) return <div key={idx} />;
            const ymd = toYmd(d);
            const counts = sexCountsByDate[ymd] || { male: 0, female: 0, unknown: 0 };
            const totalCats = totalCatsByDate[ymd] || 0;
            const docId = doctorByDate[ymd];
            const doc = docId ? doctors[docId] : null;
            const staffCount = (staffByDate[ymd]?.length) || 0;

            const cellStyle = {
              border: "1px solid " + (doc ? doc.color : "#e5e7eb"),
              minHeight: 120,
              padding: 8,
              borderRadius: 8,
              background: "#fafafa",
              display: "flex",
              flexDirection: "column",
              gap: 6,
              cursor: "pointer",
              boxShadow: doc ? `inset 0 0 0 2px ${doc.color}20` : "none",
            };
            return (
              <div key={idx} style={cellStyle} title={ymd}
                onClick={() => {
                  // scroll to that day in the list if it exists
                  const el = document.getElementById(`day-${ymd}`);
                  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                  setCollapsedDates((prev)=>({ ...prev, [ymd]: false }));
                }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontWeight: 700 }}>{d.getDate()}</div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    {staffCount > 0 && <span style={chipSmall("#e5e7eb", "#111827")}>Staff: {staffCount}</span>}
                    {doc && <span style={{ padding: "2px 6px", borderRadius: 999, background: doc.color, color: "#fff", fontSize: 12, fontWeight: 700 }}>{doc.name}</span>}
                  </div>
                </div>
                <span style={chip("#e8f0ff", "#1e3a8a")}>M: {counts.male}</span>
                <span style={chip("#ffe5f1", "#9d174d")}>F: {counts.female}</span>
                <span style={chip("#f3f4f6", "#374151")}>U: {counts.unknown}</span>
                <span style={chip("#ecfeff", "#0e7490")}>Cats: {totalCats}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Entry form */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <h3 style={{ margin: 0 }}>{editingId ? "Edit Appointment" : "New Appointment"}</h3>
          {editingId && <button style={buttonLight} onClick={() => resetForm()}>Cancel</button>}
        </div>

        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
          <div>
            <label style={label}>Client Name *</label>
            <input style={input} value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Jane Doe" />
          </div>
          <div>
            <label style={label}>Phone</label>
            <input style={input} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 555-1234" />
          </div>
          <div>
            <label style={label}>Email</label>
            <input style={input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@example.com" />
          </div>
          <div>
            <label style={label}>Address</label>
            <input style={input} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Main St, City, ST" />
          </div>
          <div>
            <label style={label}>Date *</label>
            <input style={input} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <h4 style={{ margin: 0 }}>🐱 Cats</h4>
            <button style={buttonLight} onClick={addCatRow}>+ Add Cat</button>
          </div>
          {cats.map((cat, idx) => (
            <div key={idx} style={{ display: "grid", gap: 8, gridTemplateColumns: "minmax(120px,1fr) minmax(80px,0.8fr) minmax(100px,1fr) minmax(120px,1fr) minmax(120px,1fr) auto", marginBottom: 8 }}>
              <input style={input} placeholder="Name" value={cat.name} onChange={(e) => updateCatField(idx, "name", e.target.value)} />
              <input style={input} placeholder="Age" value={cat.age} onChange={(e) => updateCatField(idx, "age", e.target.value)} />
              <input style={input} placeholder="Color" value={cat.color} onChange={(e) => updateCatField(idx, "color", e.target.value)} />
              <input style={input} placeholder="Breed" value={cat.breed} onChange={(e) => updateCatField(idx, "breed", e.target.value)} />
              <select style={input} value={cat.sex} onChange={(e) => updateCatField(idx, "sex", e.target.value)}>
                <option value="">Sex...</option>
                <option>Male</option>
                <option>Female</option>
                <option>Unknown</option>
              </select>
              <button style={buttonDanger} onClick={() => removeCatRow(idx)}>Remove</button>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 16 }}>
          <label style={{ ...label, display: "block" }}>Common Services</label>
          <div style={chkWrap}>
            {COMMON_SERVICES.map((svc) => (
              <label key={svc} style={chkItem}>
                <input type="checkbox" checked={selectedServices.has(svc)} onChange={() => toggleService(svc)} />
                <span>{svc}</span>
              </label>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <label style={label}>Services Notes</label>
          <textarea style={textarea} value={servicesNotes} onChange={(e) => setServicesNotes(e.target.value)} placeholder="Any extra details, special instructions, etc." />
        </div>

        <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button style={buttonPrimary} onClick={saveAppointment}>{editingId ? "💾 Save Changes" : "➕ Add Appointment"}</button>
          {editingId && <button style={buttonLight} onClick={() => resetForm()}>Cancel Edit</button>}
        </div>
      </div>

      {/* Appointments (ACTIVE) - collapsible by date */}
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        {Object.keys(groupedActiveByDate).length === 0 && (
          <p style={{ textAlign: "center", color: "#6b7280" }}>No active appointments yet.</p>
        )}
        {Object.entries(groupedActiveByDate).map(([d, appts]) => {
          const c = sexCountsByDate[d] || { male: 0, female: 0, unknown: 0 };
          const totalCats = (c.male || 0) + (c.female || 0) + (c.unknown || 0);
          const collapsed = !!collapsedDates[d];
          return (
            <div key={d} id={`day-${d}`} style={{ marginBottom: 22 }}>
              <h3 style={{ margin: "8px 0", display: "flex", alignItems: "center", gap: 8 }}>
                <button style={buttonLight} onClick={() => setCollapsedDates((prev)=>({ ...prev, [d]: !prev[d] }))}>
                  {collapsed ? "▶" : "▼"}
                </button>
                <span>{d}</span>
                <span style={{ marginLeft: 8, color: "#6b7280", fontSize: 13 }}>
                  Cats — M:{c.male} F:{c.female} U:{c.unknown} • Total:{totalCats}
                </span>
              </h3>
              {!collapsed && appts.map((appt) => (
                <div key={appt.id} style={listCard}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                      <strong style={{ fontSize: 16 }}>{appt.clientName}</strong>
                      {appt.cats?.length ? <span style={tag}>{appt.cats.length} cat(s)</span> : null}
                    </div>
                    <div style={{ marginTop: 6, fontSize: 14, color: "#374151" }}>
                      {appt.address && <div>📍 {appt.address}</div>}
                      {appt.phone && <div>📞 {appt.phone}</div>}
                      {appt.email && <div>✉️ {appt.email}</div>}
                    </div>
                    {appt.cats?.length > 0 && (
                      <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {appt.cats.map((c, i) => (
                          <span key={i} style={{ ...tag, background: "#f3f4f6", color: "#374151" }}>
                            <i style={dot(sexColor(normSex(c.sex)))} /> {(c.name || "Cat")} — {normSex(c.sex) || "Unknown"}
                          </span>
                        ))}
                      </div>
                    )}
                    {appt.servicesSelected?.length > 0 && (
                      <div style={{ marginTop: 6 }}>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>Selected Services</div>
                        <ul style={{ margin: 0, paddingLeft: 18 }}>
                          {appt.servicesSelected.map((s, i) => <li key={i}>{s}</li>)}
                        </ul>
                      </div>
                    )}
                    {appt.servicesNotes && (
                      <div style={{ marginTop: 6 }}>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>Services Notes</div>
                        <div style={{ whiteSpace: "pre-wrap", color: "#374151" }}>{appt.servicesNotes}</div>
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => setSelected(appt)} style={buttonSecondary}>View</button>
                    <button onClick={() => startEdit(appt)} style={buttonLight}>Edit</button>
                    <button onClick={() => deleteAppointment(appt.id)} style={buttonDanger}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Archived list (optional view) */}
      {showArchived && (
        <div style={card}>
          <h3 style={{ marginTop: 0 }}>🗂️ Archived Appointments</h3>
          {archivedAppointments.length === 0 ? (
            <div style={{ color: "#6b7280" }}>No archived items.</div>
          ) : (
            archivedAppointments.map((a) => (
              <div key={a.id} style={listCard}>
                <div style={{ flex: 1 }}>
                  <strong>{a.clientName}</strong> <span style={{ color: "#6b7280" }}>({a.date})</span>
                  {a.cats?.length ? <span style={tag}>{a.cats.length} cat(s)</span> : null}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    style={buttonLight}
                    onClick={() => {
                      setAppointments((prev) => [...prev, a].sort((x, y) => x.date.localeCompare(y.date)));
                      setArchivedAppointments((prev) => prev.filter((x) => x.id !== a.id));
                    }}
                  >
                    Restore
                  </button>
                  <button
                    style={buttonDanger}
                    onClick={() => {
                      if (!window.confirm("Permanently delete this archived appointment?")) return;
                      setArchivedAppointments((prev) => prev.filter((x) => x.id !== a.id));
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Details modal */}
      {selected && (
        <div
          onClick={() => setSelected(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 1000 }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: "white", width: "min(920px, 100%)", maxHeight: "80vh", overflow: "auto", borderRadius: 12 }}>
            <div style={{ padding: 12, borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <strong style={{ fontSize: 18 }}>{selected.clientName}</strong>
                <span style={{ marginLeft: 8, color: "#6b7280" }}>{selected.date}</span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button style={buttonSecondary} onClick={printDetails}>Print</button>
                <button style={buttonLight} onClick={() => setSelected(null)}>Close</button>
              </div>
            </div>
            <div style={{ padding: 16 }}>
              <section style={{ marginBottom: 12 }}>
                {selected.address && <div>📍 <b>Address:</b> {selected.address}</div>}
                {selected.phone && <div>📞 <b>Phone:</b> {selected.phone}</div>}
                {selected.email && <div>✉️ <b>Email:</b> {selected.email}</div>}
                <div><b>Date:</b> {selected.date}</div>
              </section>
              {selected.cats?.length > 0 && (
                <section style={{ marginBottom: 12 }}>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>Cats</div>
                  <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #e5e7eb", fontSize: 14 }}>
                    <thead><tr style={{ background: "#f9fafb" }}>
                      <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #e5e7eb" }}>Name</th>
                      <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #e5e7eb" }}>Age</th>
                      <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #e5e7eb" }}>Color</th>
                      <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #e5e7eb" }}>Breed</th>
                      <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #e5e7eb" }}>Sex</th>
                    </tr></thead>
                    <tbody>
                      {selected.cats.map((c, i) => (
                        <tr key={i}>
                          <td style={{ padding: 8, borderTop: "1px solid #e5e7eb" }}>{c.name || "-"}</td>
                          <td style={{ padding: 8, borderTop: "1px solid #e5e7eb" }}>{c.age || "-"}</td>
                          <td style={{ padding: 8, borderTop: "1px solid #e5e7eb" }}>{c.color || "-"}</td>
                          <td style={{ padding: 8, borderTop: "1px solid #e5e7eb" }}>{c.breed || "-"}</td>
                          <td style={{ padding: 8, borderTop: "1px solid #e5e7eb" }}>
                            <span style={{ ...tag, background: "#f3f4f6", color: "#374151" }}>
                              <i style={{ ...dot(sexColor(normSex(c.sex))) }} /> {normSex(c.sex) || "-"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              )}
              {selected.servicesSelected?.length > 0 && (
                <section style={{ marginBottom: 12 }}>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>Selected Services</div>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {selected.servicesSelected.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </section>
              )}
              {selected.servicesNotes && (
                <section>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>Services Notes</div>
                  <div style={{ whiteSpace: "pre-wrap" }}>{selected.servicesNotes}</div>
                </section>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
