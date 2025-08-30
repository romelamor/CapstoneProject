// src/pages/VictimSuspectTables.jsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faHome,
  faUser,
  faFileInvoice,
  faMapLocation,
  faChartLine,
  faBell,
  faRightFromBracket,
} from "@fortawesome/free-solid-svg-icons";
import * as XLSX from "xlsx";

/* ================== CONFIG ================== */
const API_BASE = "http://localhost:8000/api";

// Victim status choices must match models.py exactly (case-sensitive)
const VICTIM_STATUSES = ["Ongoing", "Solved", "Unsolved"];

/* ================== HELPERS ================== */
const fullName = (a, b, c) => [a, b, c].filter(Boolean).join(" ");
const addrBlock = (prefix, o) =>
  [
    o?.[`${prefix}_address`],
    [
      o?.[`${prefix}_region`],
      o?.[`${prefix}_province`],
      o?.[`${prefix}_city_municipality`],
      o?.[`${prefix}_barangay`],
    ]
      .filter(Boolean)
      .join(", "),
  ]
    .filter(Boolean)
    .join("\n");

// normalize victim row status to one of VICTIM_STATUSES (fallback to "Ongoing")
const normalizeVictimStatus = (row) => {
  const value =
    row?.status ?? row?.case_status ?? row?.is_active ?? row?._status;
  const s = String(value ?? "").trim();
  return VICTIM_STATUSES.includes(s) ? s : "Ongoing";
};

function VictimSuspectTables() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [submenuOpen, setSubmenuOpen] = useState(true);

  const [victims, setVictims] = useState([]);
  const [suspects, setSuspects] = useState([]);
  const [loadingVictims, setLoadingVictims] = useState(true);
  const [loadingSuspects, setLoadingSuspects] = useState(true);
  const [error, setError] = useState("");

  const [currentTab, setCurrentTab] = useState("victims"); // "victims" | "suspects"

  // Per-row save states: { "victim-123": "idle" | "saving" | "saved" | "error" }
  const [saveStates, setSaveStates] = useState({});
  const setRowSaveState = (key, state) =>
    setSaveStates((prev) => ({ ...prev, [key]: state }));

  // debounce & cancel storage
  const timersRef = useRef({}); // debounce timers keyed by `${kind}-${id}`
  const controllersRef = useRef({}); // AbortController per row key

  const [viewOpen, setViewOpen] = useState(false);
  const [viewKind, setViewKind] = useState(null); // "victim" | "suspect"
  const [viewData, setViewData] = useState(null);

  const navigate = useNavigate();

  /* ========= LOAD DATA ========= */
  useEffect(() => {
    fetchVictims();
    fetchSuspects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchVictims = async () => {
    setLoadingVictims(true);
    try {
      const res = await axios.get(`${API_BASE}/crimes/`, {
        params: { is_archived: false, ordering: "-created_at" },
      });
      const rows = Array.isArray(res.data) ? res.data : res.data.results || [];
      setVictims(rows.map((r) => ({ ...r, _status: normalizeVictimStatus(r) })));
    } catch (err) {
      console.error("Error loading victims:", err?.response?.data || err.message);
      setError("Failed to load victim data.");
    } finally {
      setLoadingVictims(false);
    }
  };

  const fetchSuspects = async () => {
    setLoadingSuspects(true);
    try {
      const res = await axios.get(`${API_BASE}/suspects/`, {
        params: { ordering: "-created_at" },
      });
      const rows = Array.isArray(res.data) ? res.data : res.data.results || [];
      setSuspects(rows);
    } catch (err) {
      console.error("Error loading suspects:", err?.response?.data || err.message);
      setError("Failed to load suspect data.");
    } finally {
      setLoadingSuspects(false);
    }
  };

  const openView = (kind, row) => {
    setViewKind(kind);
    setViewData(kind === "victim" ? { ...row, _status: normalizeVictimStatus(row) } : row);
    setViewOpen(true);
  };
  const closeView = () => {
    setViewOpen(false);
    setViewKind(null);
    setViewData(null);
  };
  const editFromView = () => {
    if (!viewData || !viewKind) return;
    const id = viewData.id;
    closeView();
    setTimeout(() => {
      if (viewKind === "victim") {
        navigate(`/AdminCrime?id=${id}`);
      } else {
        navigate(`/AdminSuspect?id=${id}`);
      }
    }, 0);
  };

  const handleArchiveVictim = async (id) => {
    if (!window.confirm("Archive this victim report?")) return;
    try {
      await axios.patch(`${API_BASE}/crimes/${id}/`, { is_archived: true });
    } catch (e1) {
      try {
        await axios.post(`${API_BASE}/crimes/${id}/archive/`);
      } catch (e2) {
        try {
          await axios.delete(`${API_BASE}/crimes/${id}/`);
        } catch (e3) {
          console.error("Archive victim error:", e3?.response?.data || e3.message);
          alert("Failed to archive victim report (see console).");
          return;
        }
      }
    }
    await fetchVictims();
  };

  const handleArchiveSuspect = async (id) => {
    if (!window.confirm("Archive/remove this suspect?")) return;
    try {
      await axios.delete(`${API_BASE}/suspects/${id}/`);
    } catch (err) {
      try {
        await axios.post(`${API_BASE}/suspects/${id}/archive/`);
      } catch (err2) {
        console.error("Archive suspect error:", err2?.response?.data || err2.message);
        alert("Failed to archive/remove suspect.");
        return;
      }
    }
    await fetchSuspects();
  };

  /* ================== SAVE STATUS (Victims only) ================== */

  // One PATCH (multipart/form-data). Field name must be 'status' with exact string from VICTIM_STATUSES.
  const sendVictimStatus = async (id, newStatus, signal) => {
    const url = `${API_BASE}/crimes/${id}/`;
    const form = new FormData();
    form.append("status", newStatus); // "Ongoing" | "Solved" | "Unsolved"
    return axios.patch(url, form, { signal }); // let browser set content-type boundary
  };

  const debouncedSaveVictim = useCallback(
    (id, newStatus) => {
      const key = `victim-${id}`;

      // clear pending debounce
      if (timersRef.current[key]) {
        clearTimeout(timersRef.current[key]);
        delete timersRef.current[key];
      }
      // cancel in-flight request
      if (controllersRef.current[key]) {
        controllersRef.current[key].abort();
        delete controllersRef.current[key];
      }

      setRowSaveState(key, "saving");

      timersRef.current[key] = setTimeout(async () => {
        delete timersRef.current[key];

        const controller = new AbortController();
        controllersRef.current[key] = controller;

        try {
          await sendVictimStatus(id, newStatus, controller.signal);

          // success: also update raw server field so data persists on refresh
          setVictims((prev) =>
            prev.map((v) =>
              v.id === id ? { ...v, _status: newStatus, status: newStatus } : v
            )
          );

          // if modal open on same row, reflect success there too
          setViewData((d) =>
            d && d.id === id && viewKind === "victim" ? { ...d, _status: newStatus, status: newStatus } : d
          );

          setRowSaveState(key, "saved");
          setTimeout(() => setRowSaveState(key, "idle"), 1000);
        } catch (e) {
          if (e.name === "CanceledError" || e.code === "ERR_CANCELED") return;

          // failure: revert UI to previous server value
          setRowSaveState(key, "error");
          const prevRow = victims.find((r) => r.id === id);
          const prevSrv = normalizeVictimStatus(prevRow);

          setVictims((prev) =>
            prev.map((v) => (v.id === id ? { ...v, _status: prevSrv } : v))
          );
          setViewData((d) =>
            d && d.id === id && viewKind === "victim" ? { ...d, _status: prevSrv } : d
          );

          console.error("Save status failed:", e?.response?.status, e?.response?.data || e);
          const msg =
            (e?.response?.data && JSON.stringify(e.response.data)) ||
            String(e.message || "Save failed");
          alert(`Save failed. ${msg}`);
        } finally {
          delete controllersRef.current[key];
        }
      }, 600); // debounce
    },
    [victims, viewKind]
  );

  const handleVictimStatusChange = (id, newStatus) => {
    // reflect user intent immediately in UI (controlled select)
    setVictims((prev) =>
      prev.map((v) => (v.id === id ? { ...v, _status: newStatus } : v))
    );
    if (viewData && viewKind === "victim" && viewData.id === id) {
      setViewData((d) => ({ ...d, _status: newStatus }));
    }
    // persist
    debouncedSaveVictim(id, newStatus);
  };

  const renderVictimStatusCell = (row) => {
    const key = `victim-${row.id}`;
    const state = saveStates[key] || "idle";
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <select
          value={row._status || "Ongoing"}
          onChange={(e) => handleVictimStatusChange(row.id, e.target.value)}
          style={{
            padding: "6px 8px",
            borderRadius: 6,
            border: "1px solid #ddd",
          }}
        >
          {VICTIM_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <small
          style={{
            minWidth: 64,
            color:
              state === "saving"
                ? "#6b7280"
                : state === "saved"
                ? "#16a34a"
                : state === "error"
                ? "#dc2626"
                : "#9ca3af",
          }}
        >
          {state === "saving"
            ? "Saving…"
            : state === "saved"
            ? "Saved"
            : state === "error"
            ? "Error"
            : ""}
        </small>
      </div>
    );
  };

  /* ========= EXPORT to EXCEL ========= */
  const toVictimExportRows = useCallback(() => {
    return victims.map((v) => ({
      ID: v.id,
      "Type of Crime": v.crime_type || "",
      "Full Name": fullName(v.v_first_name, v.v_middle_name, v.v_last_name),
      Age: v.v_age || "",
      Status: normalizeVictimStatus(v),
      Date: v.happened_at || "",
      "Victim Address": addrBlock("v", v),
      "Crime Location": addrBlock("loc", v),
      Latitude: v.latitude || "",
      Longitude: v.longitude || "",
      "Location Kind": v.loc_kind ? String(v.loc_kind).toUpperCase() : "",
      Waterbody: v.loc_waterbody || "",
    }));
  }, [victims]);

  const toSuspectExportRows = useCallback(() => {
    return suspects.map((s) => ({
      ID: s.id,
      "Type of Crime": s.s_crime_type || "",
      "Full Name": fullName(s.s_first_name, s.s_middle_name, s.s_last_name),
      Age: s.s_age || "",
      Date: (s.created_at && String(s.created_at).split("T")[0]) || "",
      "Suspect Address": addrBlock("s", s),
      "Crime Location": addrBlock("loc", s),
      Latitude: s.latitude || "",
      Longitude: s.longitude || "",
      "Location Kind": s.loc_kind ? String(s.loc_kind).toUpperCase() : "",
      Waterbody: s.loc_waterbody || "",
    }));
  }, [suspects]);

  const handleExportExcel = () => {
    try {
      const rows =
        currentTab === "victims" ? toVictimExportRows() : toSuspectExportRows();
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      const sheetName = currentTab === "victims" ? "Victims" : "Suspects";
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
      const stamp = new Date().toISOString().slice(0, 10);
      const fileName =
        currentTab === "victims"
          ? `victims_${stamp}.xlsx`
          : `suspects_${stamp}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch (e) {
      console.error("Export failed:", e);
      alert("Export to Excel failed. Please check console.");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div>
      {/* Top Navigation */}
      <div className="topnav">
        <div className="menu-icon" onClick={() => setSidebarOpen((s) => !s)}>
          ☰
        </div>
        <div className="nav-title">Victim &amp; Suspect Records</div>
      </div>

      <div className="container">
        {/* Sidebar */}
        <aside className={`sidebar ${!sidebarOpen ? "collapsed" : ""}`}>
          <div className="logo-section">
            <img src="/assets/logo.png" alt="Logo" />
            <p>
              <strong>Admin</strong>
              <br />
              Dashboard
            </p>
          </div>

          <ul className="nav-links">
            <li>
              <Link to="/dashboard">
                <FontAwesomeIcon icon={faHome} /> Home
              </Link>
            </li>
            <li>
              <Link to="/adminInfo">
                <FontAwesomeIcon icon={faUser} /> Profile Information
              </Link>
            </li>

            <li className="active">
              <button
                type="button"
                className="submenu-toggle"
                onClick={() => setSubmenuOpen((s) => !s)}
                style={{
                  background: "transparent",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                }}
              >
                <FontAwesomeIcon icon={faFileInvoice} /> Incident Reports
              </button>
              {submenuOpen && (
                <ul className="submenu">
                  <li>
                    <Link to="/VictimeSupectTable">View Reports</Link>
                  </li>
                  <li>
                    <Link to="/AdminCrime">Victim Reports</Link>
                  </li>
                  <li>
                    <Link to="/AdminSuspect">Suspect Reports</Link>
                  </li>
                </ul>
              )}
            </li>

            <li>
              <Link to="/AdminMaps">
                <FontAwesomeIcon icon={faMapLocation} /> Maps
              </Link>
            </li>
            <li>
              <Link to="/AdminAnalytics">
                <FontAwesomeIcon icon={faChartLine} /> Analytics
              </Link>
            </li>
            <li>
              <Link to="/admin_dashboard">
                <FontAwesomeIcon icon={faBell} /> Notifications
              </Link>
            </li>
            <li>
              <Link to="/logout" className="logout">
                <FontAwesomeIcon icon={faRightFromBracket} /> Logout
              </Link>
            </li>
          </ul>
        </aside>

        {/* Main Content */}
        <main className="main-content" style={{ width: "100%", padding: 16 }}>
          {error && (
            <div style={{ color: "crimson", marginBottom: 12 }}>{error}</div>
          )}

          {/* Top actions: tab toggles + Print + Export */}
          <div
            className="action-bar"
            style={{
              display: "flex",
              gap: 10,
              marginBottom: 16,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <button
              onClick={() => setCurrentTab("victims")}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                border:
                  currentTab === "victims"
                    ? "2px solid #2563eb"
                    : "1px solid #ddd",
                background: currentTab === "victims" ? "#eff6ff" : "#fff",
                fontWeight: 600,
              }}
            >
              Victims {loadingVictims ? "…" : `(${victims.length})`}
            </button>

            <button
              onClick={() => setCurrentTab("suspects")}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                border:
                  currentTab === "suspects"
                    ? "2px solid #16a34a"
                    : "1px solid #ddd",
                background: currentTab === "suspects" ? "#ecfdf5" : "#fff",
                fontWeight: 600,
              }}
            >
              Suspects {loadingSuspects ? "…" : `(${suspects.length})`}
            </button>

            <div style={{ flex: 1 }} />

            <button
              onClick={handlePrint}
              className="add-btn"
              style={{ padding: "8px 14px", borderRadius: 8 }}
              title="Print current table"
            >
              🖨️ Print
            </button>

            <button
              onClick={handleExportExcel}
              className="add-btn"
              style={{ padding: "8px 14px", borderRadius: 8 }}
              title="Export current table to Excel"
              disabled={
                (currentTab === "victims" && loadingVictims) ||
                (currentTab === "suspects" && loadingSuspects)
              }
            >
              ⬇️ Export to Excel
            </button>
          </div>

          {/* ======= TABLE VIEW ======= */}
          {currentTab === "victims" && (
            <section style={{ marginBottom: 32 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <h2 style={{ margin: "12px 0" }}>Victims</h2>
                {loadingVictims && <small>Loading…</small>}
              </div>

              <div style={{ overflowX: "auto" }}>
                <table
                  border="1"
                  cellPadding="8"
                  style={{ width: "100%", borderCollapse: "collapse" }}
                >
                  <thead style={{ background: "#f7f7f7" }}>
                    <tr>
                      <th>Type of Crime / Incidents</th>
                      <th>Full Name</th>
                      <th>Age</th>
                      <th>Victim Photo</th>
                      <th>Address</th>
                      <th>Crime Location</th>
                      <th>Date</th>
                      <th>Status</th>
                      <th style={{ width: 180 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {victims.length === 0 ? (
                      <tr>
                        <td colSpan="9" style={{ textAlign: "center" }}>
                          No records.
                        </td>
                      </tr>
                    ) : (
                      victims.map((v) => (
                        <tr key={v.id}>
                          <td>{v.crime_type || "-"}</td>
                          <td>
                            {fullName(
                              v.v_first_name,
                              v.v_middle_name,
                              v.v_last_name
                            ) || "-"}
                          </td>
                          <td>{v.v_age || "-"}</td>
                          <td>
                            {v.v_photo_url ? (
                              <img
                                src={v.v_photo_url}
                                alt="Victim"
                                width="60"
                                style={{ borderRadius: 6 }}
                              />
                            ) : (
                              "N/A"
                            )}
                          </td>
                          <td style={{ whiteSpace: "pre-line" }}>
                            {addrBlock("v", v) || "-"}
                          </td>
                          <td style={{ whiteSpace: "pre-line" }}>
                            {addrBlock("loc", v) || "-"}
                            {v.latitude && v.longitude
                              ? `\n(${v.latitude}, ${v.longitude})`
                              : ""}
                            {v.loc_kind
                              ? `\n${String(v.loc_kind).toUpperCase()}${
                                  v.loc_waterbody ? ` (${v.loc_waterbody})` : ""
                                }`
                              : ""}
                          </td>
                          <td>{v.happened_at || "-"}</td>
                          <td>{renderVictimStatusCell(v)}</td>
                          <td>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              <button onClick={() => openView("victim", v)}>
                                View
                              </button>
                              <button
                                onClick={() => handleArchiveVictim(v.id)}
                                style={{ color: "crimson" }}
                              >
                                Archive
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {currentTab === "suspects" && (
            <section>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <h2 style={{ margin: "12px 0" }}>Suspects</h2>
                {loadingSuspects && <small>Loading…</small>}
              </div>

              <div style={{ overflowX: "auto" }}>
                <table
                  border="1"
                  cellPadding="8"
                  style={{ width: "100%", borderCollapse: "collapse" }}
                >
                  <thead style={{ background: "#f7f7f7" }}>
                    <tr>
                      <th>Type of Crime / Incidents</th>
                      <th>Full Name</th>
                      <th>Age</th>
                      <th>Suspect Photo</th>
                      <th>Address</th>
                      <th>Crime Location</th>
                      <th>Latitude</th>
                      <th>Longitude</th>
                      <th>Date</th>
                      <th style={{ width: 180 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {suspects.length === 0 ? (
                      <tr>
                        <td colSpan="10" style={{ textAlign: "center" }}>
                          No records.
                        </td>
                      </tr>
                    ) : (
                      suspects.map((s) => (
                        <tr key={s.id}>
                          <td>{s.s_crime_type || "-"}</td>
                          <td>
                            {fullName(
                              s.s_first_name,
                              s.s_middle_name,
                              s.s_last_name
                            ) || "-"}
                          </td>
                          <td>{s.s_age || "-"}</td>
                          <td>
                            {s.s_photo_url ? (
                              <img
                                src={s.s_photo_url}
                                alt="Suspect"
                                width="60"
                                style={{ borderRadius: 6 }}
                              />
                            ) : (
                              "N/A"
                            )}
                          </td>
                          <td style={{ whiteSpace: "pre-line" }}>
                            {addrBlock("s", s) || "-"}
                          </td>
                          <td style={{ whiteSpace: "pre-line" }}>
                            {addrBlock("loc", s) || "-"}
                            {s.loc_kind
                              ? `\n${String(s.loc_kind).toUpperCase()}${
                                  s.loc_waterbody ? ` (${s.loc_waterbody})` : ""
                                }`
                              : ""}
                          </td>
                          <td>{s.latitude || "-"}</td>
                          <td>{s.longitude || "-"}</td>
                          <td>
                            {(s.created_at && String(s.created_at).split("T")[0]) ||
                              "-"}
                          </td>
                          <td>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              <button onClick={() => openView("suspect", s)}>
                                View
                              </button>
                              <button
                                onClick={() => handleArchiveSuspect(s.id)}
                                style={{ color: "crimson" }}
                              >
                                Archive
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </main>
      </div>

      {/* VIEW MODAL */}
      {viewOpen && viewData && (
        <div
          onClick={closeView}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 9999,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(900px, 95vw)",
              background: "#fff",
              borderRadius: 10,
              boxShadow: "0 10px 30px rgba(0,0,0,.2)",
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #eee" }}>
              <h3 style={{ margin: 0 }}>
                {viewKind === "victim" ? "Victim Details" : "Suspect Details"}
              </h3>
            </div>

            <div style={{ padding: 20, display: "grid", gap: 16 }}>
              {/* Photo */}
              <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                <div
                  style={{
                    width: 96,
                    height: 96,
                    borderRadius: 8,
                    background: "#f3f4f6",
                    display: "grid",
                    placeItems: "center",
                    overflow: "hidden",
                    border: "1px solid #eee",
                  }}
                >
                  {viewKind === "victim" ? (
                    viewData.v_photo_url ? (
                      <img
                        src={viewData.v_photo_url}
                        alt="Victim"
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <span style={{ fontSize: 12, color: "#999" }}>No Image</span>
                    )
                  ) : viewData.s_photo_url ? (
                    <img
                      src={viewData.s_photo_url}
                      alt="Suspect"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    <span style={{ fontSize: 12, color: "#999" }}>No Image</span>
                  )}
                </div>

                <div>
                  <div>
                    <strong>Name:</strong>{" "}
                    {viewKind === "victim"
                      ? fullName(
                          viewData.v_first_name,
                          viewData.v_middle_name,
                          viewData.v_last_name
                        ) || "-"
                      : fullName(
                          viewData.s_first_name,
                          viewData.s_middle_name,
                          viewData.s_last_name
                        ) || "-"}
                  </div>
                  <div>
                    <strong>Age:</strong>{" "}
                    {viewKind === "victim" ? viewData.v_age || "-" : viewData.s_age || "-"}
                  </div>
                  <div>
                    <strong>Type of Crime:</strong>{" "}
                    {viewKind === "victim"
                      ? viewData.crime_type || "-"
                      : viewData.s_crime_type || "-"}
                  </div>
                </div>
              </div>

              {/* Address */}
              <div>
                <strong>Address</strong>
                <pre
                  style={{
                    margin: 0,
                    whiteSpace: "pre-wrap",
                    background: "#fafafa",
                    padding: 8,
                    borderRadius: 6,
                    border: "1px solid #eee",
                  }}
                >
                  {viewKind === "victim"
                    ? addrBlock("v", viewData) || "-"
                    : addrBlock("s", viewData) || "-"}
                </pre>
              </div>

              {/* Location */}
              <div>
                <strong>Crime Location</strong>
                <pre
                  style={{
                    margin: 0,
                    whiteSpace: "pre-wrap",
                    background: "#fafafa",
                    padding: 8,
                    borderRadius: 6,
                    border: "1px solid #eee",
                  }}
                >
                  {addrBlock("loc", viewData) || "-"}
                  {viewData.latitude && viewData.longitude
                    ? `\n(${viewData.latitude}, ${viewData.longitude})`
                    : ""}
                  {viewData.loc_kind
                    ? `\n${String(viewData.loc_kind).toUpperCase()}${
                        viewData.loc_waterbody ? ` (${viewData.loc_waterbody})` : ""
                      }`
                    : ""}
                </pre>
              </div>

              {/* Date / Description (victim) */}
              {viewKind === "victim" && (
                <>
                  <div>
                    <strong>Date:</strong> {viewData.happened_at || "-"}
                  </div>
                  <div>
                    <strong>Description</strong>
                    <div
                      style={{
                        background: "#fafafa",
                        padding: 8,
                        borderRadius: 6,
                        border: "1px solid #eee",
                      }}
                    >
                      {viewData.description || "-"}
                    </div>
                  </div>

                  {/* Inline Status in Modal (Victim only) */}
                  <div>
                    <strong>Status</strong>
                    <div style={{ marginTop: 6 }}>
                      <select
                        value={normalizeVictimStatus(viewData)}
                        onChange={(e) => {
                          const val = e.target.value;
                          setViewData((d) => ({ ...d, _status: val, status: val }));
                          setVictims((prev) =>
                            prev.map((v) => (v.id === viewData.id ? { ...v, _status: val } : v))
                          );
                          debouncedSaveVictim(viewData.id, val);
                        }}
                        style={{
                          padding: "6px 8px",
                          borderRadius: 6,
                          border: "1px solid #ddd",
                        }}
                      >
                        {VICTIM_STATUSES.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                    <small style={{ color: "#6b7280" }}>
                      Auto-saves after you stop changing for a moment.
                    </small>
                  </div>
                </>
              )}

              {/* Date (suspect) */}
              {viewKind === "suspect" && (
                <div>
                  <strong>Date:</strong>{" "}
                  {(viewData.created_at &&
                    String(viewData.created_at).split("T")[0]) ||
                    "-"}
                </div>
              )}
            </div>

            <div
              style={{
                padding: 16,
                borderTop: "1px solid #eee",
                display: "flex",
                gap: 8,
                justifyContent: "flex-end",
              }}
            >
              <button onClick={editFromView}>Edit</button>
              <button onClick={closeView}>Close</button>
            </div>
          </div>
        </div>
      )}
      {/* PRINT CSS */}
      <style>{`
        @media print {
          .topnav, .sidebar, .action-bar, .submenu, .submenu-toggle, .logout { display: none !important; }
          .main-content { padding: 0 !important; }
          table { font-size: 12px; }
          img { max-height: 60px; }
        }
      `}</style>
    </div>
  );
}

export default VictimSuspectTables;
