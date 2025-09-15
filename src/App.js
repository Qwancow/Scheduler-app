import React, { useState, useEffect, useMemo } from "react";

/* =========================
   Cloud Backup endpoints
========================= */
const BACKUP_URL = "/.netlify/functions/backup";
const RESTORE_URL = "/.netlify/functions/restore";

// Debounced backup helper (top-level so it persists between renders)
let backupTimer = null;
function scheduleBackup(payload, onOk) {
  clearTimeout(backupTimer);
  backupTimer = setTimeout(async () => {
    try {
      const res = await fetch(BACKUP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          site: "scheduler-app",
          data: payload,
          when: new Date().toISOString(),
        }),
      });
      if (res.ok && typeof onOk === "function") {
        onOk(new Date().toISOString());
      }
    } catch (e) {
      console.warn("Backup failed:", e);
    }
  }, 1500);
}

/* =========================
   Small utilities
========================= */
const pad = (n) => String(n).padStart(2, "0");
const toYmd = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const monthLabel = (d) =>
  d.toLocaleString(undefined, { month: "long", year: "numeric" });
const csvEscape = (val) => {
  const s = (val ?? "").toString().replaceAll('"', '""');
  return /[",\n]/.test(s) ? `"${s}"` : s;
};
const timestamp = () =>
  new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
const downloadBlob = (url, filename) => {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};
const slug = (s) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

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
  const [appointments, setAppointments] = useState([]);

  // Doctors (editable)
  const DEFAULT_DOCTORS = {
    sm: { name: "Dr. Smith", color: "#10b981" },
    jn: { name: "Dr. Jones", color: "#f59e0b" },
    ly: { name: "Dr. Lee", color: "#3b82f6" },
  };
  const [doctors, setDoctors] = useState(DEFAULT_DOCTORS);
  const [doctorByDate, setDoctorByDate] = useState({});
  const [docName, setDocName] = useState("");
  const [docColor, setDocColor] = useState("#10b981");
  const [doctorDate, setDoctorDate] = useState("");
  const [doctorKey, setDoctorKey] = useState("");

  // Workers (editable)
  const DEFAULT_WORKERS = ["Alex", "Bailey", "Casey"];
  const [workers, setWorkers] = useState(DEFAULT_WORKERS);
  const [staffByDate, setStaffByDate] = useState({});
  const [workerName, setWorkerName] = useState("");
  const [staffDate, setStaffDate] = useState("");
  const [selectedWorkerId, setSelectedWorkerId] = useState("");

  // Appointment entry
  const [clientName, setClientName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [date, setDate] = useState("");

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

  // Cats
  const emptyCat = { name: "", age: "", color: "", breed: "", sex: "" };
  const [cats, setCats] = useState([{ ...emptyCat }]);

  // UI state
  const [selected, setSelected] = useState(null);
  const [printDate, setPrintDate] = useState("");
  const [printModeDate, setPrintModeDate] = useState("");
  const [searchText, setSearchText] = useState("");
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const [showDoctorSettings, setShowDoctorSettings] = useState(false);
  const [showWorkerSettings, setShowWorkerSettings] = useState(false);
  const [quickDate, setQuickDate] = useState("");
  const [editingId, setEditingId] = useState(null);

  // Backup status
  const [lastBackupAt, setLastBackupAt] = useState(
    () => localStorage.getItem("lastBackupAt") || ""
  );

  /* ---------- Load from localStorage ---------- */
  useEffect(() => {
    const savedA = localStorage.getItem("appointments");
    if (savedA) setAppointments(JSON.parse(savedA));

    const savedDocs = localStorage.getItem("doctors");
    if (savedDocs) {
      const parsed = JSON.parse(savedDocs);
      if (parsed && Object.keys(parsed).length) setDoctors(parsed);
    } else {
      localStorage.setItem("doctors", JSON.stringify(DEFAULT_DOCTORS));
    }

    const savedDocByDate = localStorage.getItem("doctorByDate");
    if (savedDocByDate) setDoctorByDate(JSON.parse(savedDocByDate));

    const savedWorkers = localStorage.getItem("workers");
    if (savedWorkers) {
      const parsed = JSON.parse(savedWorkers);
      if (Array.isArray(parsed) && parsed.length) setWorkers(parsed);
      else localStorage.setItem("workers", JSON.stringify(DEFAULT_WORKERS));
    } else {
      localStorage.setItem("workers", JSON.stringify(DEFAULT_WORKERS));
    }

    const savedStaff = localStorage.getItem("staffByDate");
    if (savedStaff) setStaffByDate(JSON.parse(savedStaff));
  }, []);

  /* ---------- Persist + Cloud backup (debounced) ---------- */
  useEffect(() => {
    // Offline persistence
    localStorage.setItem("appointments", JSON.stringify(appointments));
    localStorage.setItem("doctors", JSON.stringify(doctors));
    localStorage.setItem("doctorByDate", JSON.stringify(doctorByDate));
    localStorage.setItem("workers", JSON.stringify(workers));
    localStorage.setItem("staffByDate", JSON.stringify(staffByDate));

    // Cloud backup
    scheduleBackup(
      { appointments, doctors, doctorByDate, workers, staffByDate },
      (ts) => {
        setLastBackupAt(ts);
        localStorage.setItem("lastBackupAt", ts);
      }
    );
  }, [appointments, doctors, doctorByDate, workers, staffByDate]);

  /* ---------- Helpers ---------- */
  const resetForm = () => {
    setClientName("");
    setAddress("");
    setPhone("");
    setEmail("");
    setDate("");
    setCats([{ ...emptyCat }]);
    setSelectedServices(new Set());
    setServicesNotes("");
  };
  const toggleService = (name) =>
    setSelectedServices((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  const addCatRow = () => setCats((prev) => [...prev, { ...emptyCat }]);
  const removeCatRow = (index) => setCats((prev) => prev.filter((_, i) => i !== index));
  const updateCatField = (index, field, value) =>
    setCats((prev) => prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)));

  const saveAppointment = () => {
    if (!clientName || !date) return;
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
      setEditingId(null);
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
  const cancelEdit = () => {
    setEditingId(null);
    resetForm();
  };
  const deleteAppointment = (id) => {
    setAppointments((prev) => prev.filter((a) => a.id !== id));
    if (selected && selected.id === id) setSelected(null);
  };

  const sortedAppointments = useMemo(
    () => [...appointments].sort((a, b) => a.date.localeCompare(b.date)),
    [appointments]
  );
  const filteredAppointments = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return sortedAppointments;
    return sortedAppointments.filter((a) => (a.clientName || "").toLowerCase().includes(q));
  }, [sortedAppointments, searchText]);
  const groupedByDate = useMemo(() => {
    const map = {};
    for (const appt of filteredAppointments) {
      if (!map[appt.date]) map[appt.date] = [];
      map[appt.date].push(appt);
    }
    return map;
  }, [filteredAppointments]);

  const apptsForDate = (d) => filteredAppointments.filter((a) => a.date === d);

  // Calendar counts
  const sexCountsByDate = useMemo(() => {
    const m = {};
    for (const a of appointments) {
      const dd = a.date;
      if (!m[dd]) m[dd] = { male: 0, female: 0, unknown: 0 };
      if (Array.isArray(a.cats) && a.cats.length) {
        for (const c of a.cats) {
          const sx = normSex(c.sex);
          if (sx === "Male") m[dd].male++;
          else if (sx === "Female") m[dd].female++;
          else m[dd].unknown++;
        }
      }
    }
    return m;
  }, [appointments]);
  const totalApptByDate = useMemo(() => {
    const m = {};
    for (const a of appointments) m[a.date] = (m[a.date] || 0) + 1;
    return m;
  }, [appointments]);

  const printDay = () => {
    if (!printDate) return;
    setPrintModeDate(printDate);
  };

  /* ---------- Export / Import ---------- */
  const exportJson = () => {
    const blob = new Blob([JSON.stringify(appointments, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    downloadBlob(url, `appointments-backup-${timestamp()}.json`);
  };
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
    ];
    const rows = [headers.join(",")];
    for (const a of appts) {
      const base = [a.date, a.clientName, a.address, a.phone, a.email];
      const services = (a.servicesSelected || []).join("; ");
      const notes = a.servicesNotes || "";
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
          ].join(",")
        );
      }
    }
    return rows.join("\n");
  };
  const exportAllCsv = () => {
    const csv = toCsv(appointments);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    downloadBlob(url, `appointments-all-${timestamp()}.csv`);
  };
  const exportDayCsv = () => {
    if (!printDate) return;
    const day = appointments.filter((a) => a.date === printDate);
    const csv = toCsv(day);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    downloadBlob(url, `appointments-${printDate}.csv`);
  };
  const onImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!Array.isArray(data)) throw new Error("Invalid file format");
      const byId = new Map();
      for (const a of appointments) byId.set(a.id, a);
      let added = 0,
        replaced = 0;
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
      alert(`Import complete.\nAdded: ${added}\nReplaced: ${replaced}\nTotal: ${merged.length}`);
      e.target.value = "";
    } catch (err) {
      console.error(err);
      alert("Import failed: " + err.message);
      e.target.value = "";
    }
  };

  /* ---------- Quick workers modal ---------- */
  const modalStyles = {
    overlay: {
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.45)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 16,
      zIndex: 1000,
    },
    modal: {
      background: "white",
      width: "min(520px, 100%)",
      maxHeight: "80vh",
      overflow: "auto",
      borderRadius: 12,
      boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
    },
    header: {
      padding: "12px 14px",
      borderBottom: "1px solid #e5e7eb",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      background: "white",
    },
    body: { padding: 14 },
  };
  const buttonPrimary = {
    padding: "10px 14px",
    background: "#2563eb",
    color: "white",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 600,
  };
  const buttonLight = {
    padding: "8px 12px",
    background: "#f3f4f6",
    color: "#111827",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 500,
  };
  const buttonDanger = {
    padding: "8px 12px",
    background: "#ef4444",
    color: "white",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 600,
  };
  const buttonSecondary = {
    padding: "8px 12px",
    background: "#111827",
    color: "white",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 600,
  };
  const page = { minHeight: "100vh", background: "#f3f4f6", padding: 20 };
  const h1 = { textAlign: "center", marginBottom: 20 };
  const card = {
    background: "white",
    padding: 16,
    borderRadius: 12,
    maxWidth: 1100,
    margin: "0 auto 20px",
    boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
  };
  const label = { fontSize: 13, color: "#374151", marginBottom: 4 };
  const input = {
    width: "100%",
    padding: 10,
    borderRadius: 8,
    border: "1px solid #e5e7eb",
    background: "white",
    outline: "none",
  };
  const textarea = { ...input, minHeight: 80, resize: "vertical" };
  const checkboxWrap = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 8,
    marginTop: 8,
  };
  const chkItem = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "#f9fafb",
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid #e5e7eb",
  };
  const row = { display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" };
  const col = { display: "flex", flexDirection: "column" };
  const listCard = {
    background: "white",
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
    boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  };
  const tag = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "2px 8px",
    borderRadius: 999,
    background: "#eef2ff",
    color: "#3730a3",
    fontSize: 12,
    marginLeft: 8,
  };
  const dot = (bg) => ({
    width: 8,
    height: 8,
    borderRadius: 999,
    background: bg,
    display: "inline-block",
  });
  const chip = (bg, color = "#111827") => ({
    alignSelf: "flex-start",
    padding: "2px 6px",
    borderRadius: 999,
    background: bg,
    color,
    fontSize: 12,
    fontWeight: 600,
  });
  const chipSmall = (bg, color = "#111827") => ({
    alignSelf: "flex-start",
    padding: "1px 6px",
    borderRadius: 999,
    background: bg,
    color,
    fontSize: 11,
    fontWeight: 700,
  });

  /* ---------- Quick Modal ---------- */
  const QuickModal = ({ ymd, onClose, onOpenDay }) => {
    const docId = doctorByDate[ymd];
    const doc = docId ? doctors[docId] : null;
    const staff = staffByDate[ymd] || [];
    return (
      <div style={modalStyles.overlay} onClick={onClose}>
        <div style={modalStyles.modal} onClick={(e) => e.stopPropagation()}>
          <div style={modalStyles.header}>
            <strong>{ymd}</strong>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={buttonSecondary} onClick={onOpenDay}>Open Day</button>
              <button style={buttonLight} onClick={onClose}>Close</button>
            </div>
          </div>
          <div style={modalStyles.body}>
            {doc ? (
              <div style={{ marginBottom: 8 }}>
                <b>Doctor:</b>{" "}
                <span style={{ padding: "2px 6px", borderRadius: 999, background: doc.color, color: "#fff", fontWeight: 700 }}>
                  {doc.name}
                </span>
              </div>
            ) : (
              <div style={{ marginBottom: 8, color: "#6b7280" }}>No doctor assigned.</div>
            )}
            <div>
              <b>Workers:</b>{" "}
              {staff.length ? staff.join(", ") : <span style={{ color: "#6b7280" }}>None assigned</span>}
            </div>
          </div>
        </div>
      </div>
    );
  };

  /* ---------- Print view ---------- */
  if (printModeDate) {
    const dayAppts = apptsForDate(printModeDate);
    const docId = doctorByDate[printModeDate];
    const doc = docId ? doctors[docId] : null;
    const staff = staffByDate[printModeDate] || [];
    const btn = {
      padding: "10px 14px",
      background: "#2563eb",
      color: "#fff",
      border: "none",
      borderRadius: 8,
      cursor: "pointer",
      fontWeight: 600,
    };
    return (
      <div style={{ padding: 20, fontFamily: "Arial, Helvetica, sans-serif", color: "#111827" }}>
        <style>
          {`@media print { .no-print { display: none !important; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
            .card { border:1px solid #e5e7eb; border-radius:10px; padding:12px; margin-bottom:12px; }
            table { width:100%; border-collapse:collapse; margin-top:6px; }
            th, td { text-align:left; padding:6px 8px; border-top:1px solid #e5e7eb; font-size:14px; }
            th { background:#f9fafb; border-bottom:1px solid #e5e7eb; }`}
        </style>

        <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>Client Appointments — {printModeDate}</h2>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={btn} onClick={() => window.print()}>Print</button>
            <button style={{ ...btn, background: "#111827" }} onClick={() => setPrintModeDate("")}>Back to Scheduler</button>
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          {doc && (
            <span style={{ padding:"4px 8px", borderRadius:999, background:doc.color, color:"#fff", fontWeight:700, marginRight:8 }}>
              Doctor: {doc.name}
            </span>
          )}
          {staff.length > 0 && (
            <span style={{ padding:"4px 8px", borderRadius:999, background:"#e5e7eb", color:"#111827", fontWeight:700 }}>
              Staff: {staff.join(", ")}
            </span>
          )}
        </div>

        {dayAppts.length === 0 ? (
          <div>No appointments for this date.</div>
        ) : (
          dayAppts.map((a) => (
            <div key={a.id} className="card">
              <div><b>Client:</b> {a.clientName || "-"}</div>
              <div><b>Address:</b> {a.address || "-"}</div>
              <div><b>Phone:</b> {a.phone || "-"}</div>
              <div><b>Email:</b> {a.email || "-"}</div>

              {!!(a.cats && a.cats.length) && (
                <>
                  <div style={{ fontWeight: 700, marginTop: 8 }}>Cats</div>
                  <table>
                    <thead>
                      <tr><th>Name</th><th>Age</th><th>Color</th><th>Breed</th><th>Sex</th></tr>
                    </thead>
                    <tbody>
                      {a.cats.map((c, i) => {
                        const sx = normSex(c.sex);
                        return (
                          <tr key={i}>
                            <td>{c.name || "-"}</td>
                            <td>{c.age || "-"}</td>
                            <td>{c.color || "-"}</td>
                            <td>{c.breed || "-"}</td>
                            <td>
                              <span style={{ ...tag, padding: "0 6px", background: "transparent", color: "#374151" }}>
                                <i style={dot(sexColor(sx))} /> {sx || "-"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </>
              )}

              {!!(a.servicesSelected && a.servicesSelected.length) && (
                <>
                  <div style={{ fontWeight: 700, marginTop: 8 }}>Selected Services</div>
                  <ul style={{ margin: "6px 0 0 18px" }}>
                    {a.servicesSelected.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </>
              )}

              {a.servicesNotes && (
                <>
                  <div style={{ fontWeight: 700, marginTop: 8 }}>Services Notes</div>
                  <div style={{ whiteSpace: "pre-wrap" }}>{a.servicesNotes}</div>
                </>
              )}
            </div>
          ))
        )}
      </div>
    );
  }

  /* ---------- Normal UI ---------- */
  const printDetails = () => window.print();

  // Calendar grid
  const days = [];
  const firstDay = new Date(calMonth);
  const startWeekday = firstDay.getDay();
  const lastDay = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 0).getDate();
  for (let i = 0; i < startWeekday; i++) days.push(null);
  for (let d = 1; d <= lastDay; d++)
    days.push(new Date(calMonth.getFullYear(), calMonth.getMonth(), d));

  // Workers select options
  const workerOptions = workers.map((w) => ({ id: slug(w) || w, name: w }));

  /* ---------- Manual Cloud buttons ---------- */
  async function backupNow() {
    try {
      const ts = new Date().toISOString();
      const res = await fetch(BACKUP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          site: "scheduler-app",
          data: { appointments, doctors, doctorByDate, workers, staffByDate },
          when: ts,
        }),
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
      const res = await fetch(RESTORE_URL);
      if (!res.ok) return alert("No cloud backup found or restore function not configured.");
      const json = await res.json(); // { site, when, data }
      if (!json?.data) return alert("Backup file is empty.");
      if (!window.confirm(`Restore data from ${json.when}?\nThis will overwrite current data on this device.`)) return;

      const { appointments: A, doctors: D, doctorByDate: DB, workers: W, staffByDate: SB } = json.data;
      if (A) setAppointments(A);
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

  return (
    <div style={page}>
      <h1 style={h1}>📅 Client Appointments</h1>

      {/* Search + Export/Import + Cloud */}
      <div style={{ ...card, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end" }}>
        <div style={{ flex: "1 1 260px", display: "flex", flexDirection: "column" }}>
          <label style={label}>Search by Client</label>
          <input
            style={input}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Type a client's name..."
          />
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button style={buttonSecondary} onClick={exportJson}>Export JSON</button>
          <button style={buttonSecondary} onClick={exportAllCsv}>Export CSV (All)</button>

          <label style={{ ...buttonLight, display: "inline-flex", alignItems: "center", gap: 8 }}>
            Import JSON
            <input type="file" accept="application/json" onChange={onImportFile} style={{ display: "none" }} />
          </label>

          {/* Cloud controls */}
          <button style={buttonSecondary} onClick={backupNow}>Cloud Backup now</button>
          <button style={buttonLight} onClick={restoreFromCloud}>Restore from Cloud</button>

          {/* Last backup status */}
          <span style={{ color: "#6b7280", fontSize: 13 }}>
            Last cloud backup:{" "}
            {lastBackupAt ? new Date(lastBackupAt).toLocaleString() : "never"}
          </span>
        </div>
      </div>

      {/* Doctors Settings (collapsible) */}
      <div style={card}>
        <button
          style={{ ...buttonLight, width: "100%", textAlign: "left" }}
          onClick={() => setShowDoctorSettings((v) => !v)}
        >
          {showDoctorSettings ? "▼" : "▶"} ⚙️ Doctors Settings
        </button>

        {showDoctorSettings && (
          <>
            <div style={{ display: "grid", gap: 8, gridTemplateColumns: "minmax(220px,1fr) minmax(180px,1fr) auto", marginTop: 12 }}>
              <input
                style={input}
                placeholder="Doctor name (e.g., Dr. Rivera)"
                value={docName}
                onChange={(e) => setDocName(e.target.value)}
              />
              <input
                style={{ ...input, padding: 6, height: 42 }}
                type="color"
                value={docColor}
                onChange={(e) => setDocColor(e.target.value)}
                title="Pick badge color"
              />
              <button
                style={buttonPrimary}
                onClick={() => {
                  const name = docName.trim();
                  if (!name) return;
                  const idBase = slug(name) || "doc";
                  let id = idBase, i = 1;
                  while (doctors[id]) id = `${idBase}-${i++}`;
                  const next = { ...doctors, [id]: { name, color: docColor || "#10b981" } };
                  setDoctors(next);
                  setDocName("");
                }}
              >
                + Add Doctor
              </button>
            </div>

            <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", marginTop: 12 }}>
              {Object.entries(doctors).map(([id, d]) => (
                <div key={id} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 10, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 14, height: 14, borderRadius: 999, background: d.color }} />
                  <input
                    style={{ ...input, padding: 6 }}
                    value={d.name}
                    onChange={(e) => setDoctors({ ...doctors, [id]: { ...d, name: e.target.value } })}
                  />
                  <input
                    type="color"
                    value={d.color}
                    onChange={(e) => setDoctors({ ...doctors, [id]: { ...d, color: e.target.value } })}
                    style={{ width: 46, height: 36, padding: 0, border: "none", background: "transparent" }}
                    title="Change color"
                  />
                  <button
                    style={buttonDanger}
                    onClick={() => {
                      if (!window.confirm(`Delete ${d.name}?`)) return;
                      const { [id]: _, ...rest } = doctors;
                      setDoctors(rest);
                      const dbd = { ...doctorByDate };
                      for (const k of Object.keys(dbd)) if (dbd[k] === id) delete dbd[k];
                      setDoctorByDate(dbd);
                    }}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>

            {/* Assign Doctor to Date */}
            <div style={{ marginTop: 16 }}>
              <h4>Assign Doctor to a Date</h4>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <div style={{ display: "flex", flexDirection: "column", minWidth: 180 }}>
                  <label style={label}>Date</label>
                  <input style={input} type="date" value={doctorDate} onChange={(e) => setDoctorDate(e.target.value)} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", minWidth: 220 }}>
                  <label style={label}>Doctor</label>
                  <select style={input} value={doctorKey} onChange={(e) => setDoctorKey(e.target.value)}>
                    <option value="">Select a doctor…</option>
                    {Object.entries(doctors).map(([k, d]) => (
                      <option key={k} value={k}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: "flex", alignItems: "end", gap: 8 }}>
                  <button
                    style={buttonPrimary}
                    onClick={() => {
                      if (!doctorDate || !doctorKey) return;
                      setDoctorByDate((prev) => ({ ...prev, [doctorDate]: doctorKey }));
                    }}
                  >
                    Save Doctor
                  </button>
                  <button
                    style={buttonLight}
                    onClick={() => {
                      if (!doctorDate) return;
                      setDoctorByDate((prev) => {
                        const copy = { ...prev };
                        delete copy[doctorDate];
                        return copy;
                      });
                    }}
                  >
                    Clear
                  </button>
                </div>
              </div>
              {doctorDate && doctorByDate[doctorDate] && (
                <p style={{ marginTop: 8, color: "#374151" }}>
                  Assigned: <b>{doctors[doctorByDate[doctorDate]]?.name}</b> on <b>{doctorDate}</b>
                </p>
              )}
            </div>
          </>
        )}
      </div>

      {/* Workers Settings (collapsible) */}
      <div style={card}>
        <button
          style={{ ...buttonLight, width: "100%", textAlign: "left" }}
          onClick={() => setShowWorkerSettings((v) => !v)}
        >
          {showWorkerSettings ? "▼" : "▶"} ⚙️ Workers Settings
        </button>

        {showWorkerSettings && (
          <>
            <div style={{ display: "grid", gap: 8, gridTemplateColumns: "minmax(260px,1fr) auto", marginTop: 12 }}>
              <input
                style={input}
                placeholder="Worker name (e.g., Taylor)"
                value={workerName}
                onChange={(e) => setWorkerName(e.target.value)}
              />
              <button
                style={buttonPrimary}
                onClick={() => {
                  const name = workerName.trim();
                  if (!name) return;
                  if (!workers.includes(name)) setWorkers([...workers, name]);
                  setWorkerName("");
                }}
              >
                + Add Worker
              </button>
            </div>

            <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {workers.map((w, i) => (
                <span key={i} style={{ padding: "6px 10px", border: "1px solid #e5e7eb", borderRadius: 999, display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <input
                    style={{ ...input, padding: 4, width: 160 }}
                    value={w}
                    onChange={(e) => {
                      const copy = [...workers];
                      copy[i] = e.target.value;
                      setWorkers(copy);
                    }}
                  />
                  <button
                    style={buttonDanger}
                    onClick={() => {
                      if (!window.confirm(`Remove worker "${w}"?`)) return;
                      setWorkers(workers.filter((x) => x !== w));
                      // also remove from any staffByDate entries
                      const sbd = { ...staffByDate };
                      for (const k of Object.keys(sbd)) {
                        sbd[k] = (sbd[k] || []).filter((n) => n !== w);
                      }
                      setStaffByDate(sbd);
                    }}
                  >
                    Delete
                  </button>
                </span>
              ))}
            </div>

            {/* People Working by Date */}
            <div style={{ marginTop: 16 }}>
              <h4>People Working by Date</h4>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <div style={{ display: "flex", flexDirection: "column", minWidth: 180 }}>
                  <label style={label}>Date</label>
                  <input style={input} type="date" value={staffDate} onChange={(e) => setStaffDate(e.target.value)} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", minWidth: 240 }}>
                  <label style={label}>Choose worker</label>
                  <select
                    style={input}
                    value={selectedWorkerId}
                    onChange={(e) => setSelectedWorkerId(e.target.value)}
                  >
                    <option value="">Select…</option>
                    {workerOptions.map((opt) => (
                      <option key={opt.id} value={opt.name}>{opt.name}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: "flex", alignItems: "end", gap: 8 }}>
                  <button
                    style={buttonPrimary}
                    onClick={() => {
                      const name = selectedWorkerId.trim();
                      if (!staffDate || !name) return;
                      setStaffByDate((prev) => {
                        const list = prev[staffDate] ? [...prev[staffDate]] : [];
                        if (!list.includes(name)) list.push(name);
                        return { ...prev, [staffDate]: list };
                      });
                      setSelectedWorkerId("");
                    }}
                  >
                    + Add to Date
                  </button>
                  <button
                    style={buttonLight}
                    onClick={() => {
                      if (!staffDate) return;
                      setStaffByDate((prev) => ({ ...prev, [staffDate]: [] }));
                    }}
                  >
                    Clear All for Date
                  </button>
                </div>
              </div>

              {staffDate && (staffByDate[staffDate]?.length ?? 0) > 0 && (
                <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {staffByDate[staffDate].map((name, i) => (
                    <span key={i} style={{ padding: "4px 8px", borderRadius: 999, background: "#e5e7eb", display: "inline-flex", alignItems: "center", gap: 6 }}>
                      {name}
                      <button
                        style={{ ...buttonDanger, padding: "2px 6px" }}
                        onClick={() => {
                          setStaffByDate((prev) => {
                            const list = [...(prev[staffDate] || [])];
                            list.splice(i, 1);
                            return { ...prev, [staffDate]: list };
                          });
                        }}
                        title="Remove"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Calendar */}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <button
            style={buttonLight}
            onClick={() => {
              const d = new Date(calMonth);
              d.setMonth(d.getMonth() - 1);
              setCalMonth(d);
            }}
          >
            ◀ Prev
          </button>
          <h3 style={{ margin: 0 }}>{monthLabel(calMonth)}</h3>
          <button
            style={buttonLight}
            onClick={() => {
              const d = new Date(calMonth);
              d.setMonth(d.getMonth() + 1);
              setCalMonth(d);
            }}
          >
            Next ▶
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8, marginBottom: 8, color: "#6b7280", fontSize: 12 }}>
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((w) => (
            <div key={w} style={{ textAlign: "center" }}>{w}</div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
          {days.map((d, idx) => {
            if (!d) return <div key={idx} />;
            const ymd = toYmd(d);
            const counts = sexCountsByDate[ymd] || { male: 0, female: 0, unknown: 0 };
            const total = totalApptByDate[ymd] || 0;
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
              <div
                key={idx}
                style={cellStyle}
                onClick={() => setQuickDate(ymd)}
                title={`Open ${ymd}`}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontWeight: 700 }}>{d.getDate()}</div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    {staffCount > 0 && <span style={chipSmall("#e5e7eb", "#111827")}>Staff: {staffCount}</span>}
                    {doc && (
                      <span style={{ padding: "2px 6px", borderRadius: 999, background: doc.color, color: "#fff", fontSize: 12, fontWeight: 700 }}>
                        {doc.name}
                      </span>
                    )}
                  </div>
                </div>
                <span style={chip("#e8f0ff", "#1e3a8a")}>M: {counts.male}</span>
                <span style={chip("#ffe5f1", "#9d174d")}>F: {counts.female}</span>
                <span style={chip("#f3f4f6", "#374151")}>U: {counts.unknown}</span>
                <span style={chip("#ecfeff", "#0e7490")}>Total: {total}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Daily Print Tool */}
      <div style={card}>
        <h3 style={{ marginTop: 0, marginBottom: 12 }}>🖨️ Print a Day</h3>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", minWidth: 220 }}>
            <label style={label}>Choose date</label>
            <input style={input} type="date" value={printDate} onChange={(e) => setPrintDate(e.target.value)} />
          </div>
          <div style={{ display: "flex", alignItems: "end", gap: 8 }}>
            <button style={buttonPrimary} onClick={printDay}>Print All for Date</button>
            <button style={buttonSecondary} onClick={exportDayCsv} disabled={!printDate}>Export CSV (Date)</button>
            {printDate ? (
              <span style={{ alignSelf: "center", color: "#6b7280" }}>
                {apptsForDate(printDate).length} appointment(s) (filtered)
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* Entry Form */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <h3 style={{ margin: 0 }}>New Appointment</h3>
          {editingId && <span style={{ color: "#ef4444", fontWeight: 700 }}>(Editing)</span>}
        </div>

        <div style={row}>
          <div style={col}>
            <label style={label}>Client Name *</label>
            <input style={input} value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Jane Doe" />
          </div>
          <div style={col}>
            <label style={label}>Phone</label>
            <input style={input} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 555-1234" />
          </div>
          <div style={col}>
            <label style={label}>Email</label>
            <input style={input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@example.com" />
          </div>
          <div style={col}>
            <label style={label}>Address</label>
            <input style={input} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Main St, City, ST" />
          </div>
          <div style={col}>
            <label style={label}>Date *</label>
            <input style={input} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>

        {/* Cats */}
        <div style={{ marginTop: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <h4 style={{ margin: 0 }}>🐱 Cats</h4>
            <button style={buttonLight} onClick={addCatRow}>+ Add Cat</button>
          </div>

          {cats.map((cat, idx) => (
            <div
              key={idx}
              style={{
                display: "grid",
                gap: 8,
                gridTemplateColumns:
                  "minmax(120px,1fr) minmax(80px,0.8fr) minmax(100px,1fr) minmax(120px,1fr) minmax(120px,1fr) auto",
                marginBottom: 8,
              }}
            >
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
              <button style={buttonDanger} onClick={() => removeCatRow(idx)} title="Remove this cat">Remove</button>
            </div>
          ))}
        </div>

        {/* Services */}
        <div style={{ marginTop: 16 }}>
          <label style={{ ...label, display: "block" }}>Common Services</label>
          <div style={checkboxWrap}>
            {COMMON_SERVICES.map((svc) => (
              <label key={svc} style={chkItem}>
                <input
                  type="checkbox"
                  checked={selectedServices.has(svc)}
                  onChange={() => toggleService(svc)}
                />
                <span>{svc}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div style={{ marginTop: 12 }}>
          <label style={label}>Services Notes</label>
          <textarea style={textarea} value={servicesNotes} onChange={(e) => setServicesNotes(e.target.value)} placeholder="Any extra details, special instructions, etc." />
        </div>

        <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button style={buttonPrimary} onClick={saveAppointment}>
            {editingId ? "💾 Save Changes" : "➕ Add Appointment"}
          </button>
          {editingId && <button style={buttonLight} onClick={cancelEdit}>Cancel Edit</button>}
        </div>
      </div>

      {/* Appointments list */}
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        {Object.keys(groupedByDate).length === 0 && (
          <p style={{ textAlign: "center", color: "#6b7280" }}>No appointments yet.</p>
        )}
        {Object.entries(groupedByDate).map(([d, appts]) => (
          <div key={d} id={`day-${d}`} style={{ marginBottom: 22 }}>
            <h3 style={{ margin: "8px 0" }}>{d}</h3>
            {appts.map((appt) => (
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
                      {appt.cats.map((c, i) => {
                        const sx = normSex(c.sex);
                        return (
                          <span key={i} style={{ ...tag, background: "#f3f4f6", color: "#374151" }}>
                            <i style={dot(sexColor(sx))} /> {c.name || "Cat"} — {sx || "Unknown"}
                          </span>
                        );
                      })}
                    </div>
                  )}
                  {appt.servicesSelected && appt.servicesSelected.length > 0 && (
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
                  <button
                    onClick={() => {
                      if (window.confirm("Are you sure you want to delete this appointment?")) {
                        deleteAppointment(appt.id);
                      }
                    }}
                    style={buttonDanger}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Quick workers modal */}
      {quickDate && (
        <QuickModal
          ymd={quickDate}
          onClose={() => setQuickDate("")}
          onOpenDay={() => {
            const ymd = quickDate;
            setQuickDate("");
            setPrintDate(ymd);
            const el = document.getElementById(`day-${ymd}`);
            if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        />
      )}

      {/* Details Modal */}
      {selected && (
        <div style={modalStyles.overlay} onClick={() => setSelected(null)}>
          <div style={{ ...modalStyles.modal, width: "min(920px, 100%)" }} onClick={(e) => e.stopPropagation()}>
            <div style={modalStyles.header}>
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

              {selected.cats && selected.cats.length > 0 && (
                <section style={{ marginBottom: 12 }}>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>Cats</div>
                  <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #e5e7eb", fontSize: 14 }}>
                    <thead>
                      <tr style={{ background: "#f9fafb" }}>
                        <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #e5e7eb" }}>Name</th>
                        <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #e5e7eb" }}>Age</th>
                        <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #e5e7eb" }}>Color</th>
                        <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #e5e7eb" }}>Breed</th>
                        <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #e5e7eb" }}>Sex</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.cats.map((c, i) => {
                        const sx = normSex(c.sex);
                        return (
                          <tr key={i}>
                            <td style={{ padding: 8, borderTop: "1px solid #e5e7eb" }}>{c.name || "-"}</td>
                            <td style={{ padding: 8, borderTop: "1px solid #e5e7eb" }}>{c.age || "-"}</td>
                            <td style={{ padding: 8, borderTop: "1px solid #e5e7eb" }}>{c.color || "-"}</td>
                            <td style={{ padding: 8, borderTop: "1px solid #e5e7eb" }}>{c.breed || "-"}</td>
                            <td style={{ padding: 8, borderTop: "1px solid #e5e7eb" }}>
                              <span style={{ ...tag, background: "#f3f4f6", color: "#374151" }}>
                                <i style={dot(sexColor(sx))} /> {sx || "-"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </section>
              )}

              {selected.servicesSelected && selected.servicesSelected.length > 0 && (
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
