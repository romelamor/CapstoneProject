// src/pages/AdminMaps.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import "../assets/css/dashboard.css";
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
import { Link } from "react-router-dom";

/* == MAP STACK == */
import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";

// Default marker icon
const DefaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

/* == CHART STACK == */
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend,
  Filler,
  BarElement,
} from "chart.js";
import { Line, Bar } from "react-chartjs-2";
ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend, Filler, BarElement);

/* ================= CONFIG ================= */
const API_BASE = "http://localhost:8000";

/* PH bounds (buong Pilipinas) */
const PH_BOUNDS = L.latLngBounds(L.latLng(4.5, 116.0), L.latLng(21.5, 127.0));
const PH_CENTER = PH_BOUNDS.getCenter();

/* Crime types (optional) */
const CRIME_TYPES = [
  "Theft",
  "Robbery",
  "Assault",
  "Homicide",
  "Illegal Fishing",
  "Smuggling",
  "Drugs",
  "Vandalism",
  "Fraud",
  "Others",
];

/* ================= UTILITIES ================= */
const norm = (s) => (s || "").toString().replace(/\s+/g, " ").trim().toLowerCase();
const stripParens = (s) => s.replace(/\s+\(.*?\)$/g, "");
const normProvince = (s) =>
  norm(stripParens(s))
    .replace(/^province of\s+/, "")
    .replace(/\s+province$/, "");

// dataset field helpers
function getProvince(row) {
  return (
    row.loc_province ||
    row.v_province ||
    row.province ||
    row.province_name ||
    ""
  ).toString();
}
function getCrimeType(row) {
  return (row.crime_type || "").toString();
}
function toYMD(dIn) {
  const d = new Date(dIn);
  if (!(d && !isNaN(d))) return null;
  return d.toISOString().slice(0, 10);
}

// Incidents per day
function groupIncidentsByDay(rows) {
  const buckets = new Map();
  rows.forEach((r) => {
    const lbl = toYMD(r.happened_at);
    if (!lbl) return;
    buckets.set(lbl, (buckets.get(lbl) || 0) + 1);
  });
  const labels = Array.from(buckets.keys()).sort();
  const values = labels.map((k) => buckets.get(k));
  return { labels, values };
}

// Victims per day (uses r.victims_count if available; else 1)
function groupVictimsByDay(rows) {
  const buckets = new Map();
  rows.forEach((r) => {
    const lbl = toYMD(r.happened_at);
    if (!lbl) return;
    const victims = Number.isFinite(+r.victims_count) ? +r.victims_count : 1;
    buckets.set(lbl, (buckets.get(lbl) || 0) + victims);
  });
  const labels = Array.from(buckets.keys()).sort();
  const values = labels.map((k) => buckets.get(k));
  return { labels, values };
}

/* Victims by Province (for bar chart) */
function groupVictimsByProvince(rows) {
  const byProv = new Map(); // key: normProv -> { name, count }
  rows.forEach((r) => {
    const raw = (getProvince(r) || "").trim();
    if (!raw) return;
    const key = normProvince(raw);
    const victims = Number.isFinite(+r.victims_count) ? +r.victims_count : 1;
    const curr = byProv.get(key);
    if (curr) curr.count += victims;
    else byProv.set(key, { name: raw, count: victims });
  });
  const sorted = Array.from(byProv.values()).sort((a, b) => b.count - a.count);
  return {
    labels: sorted.map((x) => x.name),
    values: sorted.map((x) => x.count),
  };
}

/* ================== HEAT LAYER WRAPPER ================== */
function HeatLayer({ points, options }) {
  const map = useMap();
  const layerRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    import("leaflet.heat")
      .then(() => {
        if (!isMounted) return;

        if (layerRef.current) {
          map.removeLayer(layerRef.current);
          layerRef.current = null;
        }

        if (!points || points.length === 0) return;

        layerRef.current = L.heatLayer(points, {
          radius: 22,
          blur: 18,
          maxZoom: 5,
          ...options,
        }).addTo(map);

        // Fit to points
        try {
          const ll = points.map((p) => [p[0], p[1]]);
          const bounds = L.latLngBounds(ll);
          if (bounds.isValid()) map.fitBounds(bounds.pad(0.2));
        } catch {}
      })
      .catch((e) => {
        console.error("Heat plugin not available:", e);
      });

    return () => {
      isMounted = false;
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [map, points, options]);

  return null;
}

/* Clamp view to PH by default */
function MapGuards() {
  const map = useMap();
  useEffect(() => {
    map.setMaxBounds(PH_BOUNDS);
    map.fitBounds(PH_BOUNDS, { padding: [20, 20] });
  }, [map]);
  return null;
}

/* ================== MAIN PAGE ================== */
const AdminAnalytics = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [submenuOpen, setSubmenuOpen] = useState(true);

  // Filters
  const [crimeType, setCrimeType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Place filter (Province only)
  const [province, setProvince] = useState(""); // selected province NAME

  // View mode: 'heat' | 'line' | 'bar'
  const [viewMode, setViewMode] = useState("heat");

  // Data
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");

  // PSGC reference data
  const [psgcProvinces, setPsgcProvinces] = useState([]); // [{code,name}]

  const toggleSubmenu = () => setSubmenuOpen((s) => !s);

  // Fetch all crimes (client-side filtering)
  const fetchCrimes = async () => {
    try {
      setLoading(true);
      setError("");

      const url = `${API_BASE}/api/crimes/`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const all = Array.isArray(data) ? data : data.results || [];
      setRows(all);
    } catch (e) {
      console.error("fetch crimes error", e);
      setError("Di makuha ang incidents. Pakisubukan ulit.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCrimes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ====== PSGC: Provinces list (PH-wide) ====== */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("https://psgc.cloud/api/provinces");
        const data = await res.json();
        if (!alive) return;
        const list = (data || []).map((p) => ({ code: p.code, name: p.name }));
        list.sort((a, b) => a.name.localeCompare(b.name));
        setPsgcProvinces(list);
      } catch (e) {
        console.error("PSGC provinces error", e);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  /* ======== Apply filters ======== */
  // For heatmap + line chart (place-aware)
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (province && normProvince(getProvince(r)) !== normProvince(province)) return false;
      if (crimeType) {
        const t = getCrimeType(r).toLowerCase();
        if (t !== crimeType.toLowerCase()) return false;
      }
      const ymd = toYMD(r.happened_at);
      if (!ymd) return false;
      if (dateFrom && ymd < dateFrom) return false;
      if (dateTo && ymd > dateTo) return false;
      return true;
    });
  }, [rows, province, crimeType, dateFrom, dateTo]);

  // For bar chart (PH-wide by province): ignore province filter but respect crime/date
  const rowsForProvinceChart = useMemo(() => {
    return rows.filter((r) => {
      if (crimeType) {
        const t = getCrimeType(r).toLowerCase();
        if (t !== crimeType.toLowerCase()) return false;
      }
      const ymd = toYMD(r.happened_at);
      if (!ymd) return false;
      if (dateFrom && ymd < dateFrom) return false;
      if (dateTo && ymd > dateTo) return false;
      return true;
    });
  }, [rows, crimeType, dateFrom, dateTo]);

  /* ======== Heat points from filteredRows ======== */
  const points = useMemo(() => {
    return filteredRows
      .map((r) => {
        const lat = parseFloat(r.latitude);
        const lng = parseFloat(r.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        let weight = 1;
        if (getCrimeType(r).toLowerCase() === "homicide") weight = 2;
        return [lat, lng, weight];
      })
      .filter(Boolean);
  }, [filteredRows]);

  /* ======== Charts ======== */
  // Line (daily incidents) – place-aware
  const dailyInc = useMemo(() => groupIncidentsByDay(filteredRows), [filteredRows]);

  const areaLabel = province || "Philippines";

  const lineData = useMemo(
    () => ({
      labels: dailyInc.labels,
      datasets: [
        {
          label: `Incidents per day (${areaLabel})`,
          data: dailyInc.values,
          fill: true,
          tension: 0.3,
          pointRadius: 3,
        },
      ],
    }),
    [dailyInc, areaLabel]
  );

  // Bar (victims by province) – PH-wide
  const victimsByProv = useMemo(
    () => groupVictimsByProvince(rowsForProvinceChart),
    [rowsForProvinceChart]
  );

  const TOP_N = 20;
  const barProvData = useMemo(
    () => ({
      labels: victimsByProv.labels.slice(0, TOP_N),
      datasets: [
        {
          label: `Victims (Top ${TOP_N} provinces)`,
          data: victimsByProv.values.slice(0, TOP_N),
          borderWidth: 1,
        },
      ],
    }),
    [victimsByProv]
  );

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      plugins: {
        legend: { display: true },
        tooltip: { intersect: false, mode: "index" },
      },
      scales: {
        x: {
          title: { display: true, text: "Date (YYYY-MM-DD)" },
          ticks: { autoSkip: true, maxRotation: 0 },
        },
        y: {
          beginAtZero: true,
          title: { display: true, text: "Count" },
          ticks: { precision: 0 },
        },
      },
    }),
    []
  );

  // Separate options for province bar (horizontal)
  const barProvOptions = useMemo(
    () => ({
      responsive: true,
      indexAxis: "y",
      plugins: {
        legend: { display: true },
        tooltip: { intersect: false, mode: "index" },
      },
      scales: {
        x: {
          beginAtZero: true,
          title: { display: true, text: "Victims" },
          ticks: { precision: 0 },
        },
        y: {
          title: { display: false, text: "Province" },
          ticks: { autoSkip: false, maxRotation: 0 },
        },
      },
    }),
    []
  );

  /* ======== KPI Cards ======== */
  const totalIncidents = filteredRows.length;
  const totalVictims = useMemo(
    () =>
      filteredRows.reduce(
        (sum, r) => sum + (Number.isFinite(+r.victims_count) ? +r.victims_count : 1),
        0
      ),
    [filteredRows]
  );
  const dateRange = useMemo(() => {
    const ds = filteredRows
      .map((r) => new Date(r.happened_at))
      .filter((d) => d && !isNaN(d));
    if (ds.length === 0) return "—";
    const min = new Date(Math.min(...ds));
    const max = new Date(Math.max(...ds));
    const toYMDLocal = (d) => d.toISOString().slice(0, 10);
    return `${toYMDLocal(min)} → ${toYMDLocal(max)}`;
  }, [filteredRows]);

  // NEW KPI: Top Provinces w/ Crime (by incident count, PH-wide with crime/date filters)
  const topProvIncidents = useMemo(() => {
    const byProv = new Map(); // key: norm -> { name, count }
    rowsForProvinceChart.forEach((r) => {
      const raw = (getProvince(r) || "").trim();
      if (!raw) return;
      const key = normProvince(raw);
      const curr = byProv.get(key);
      if (curr) curr.count += 1;
      else byProv.set(key, { name: raw, count: 1 });
    });
    return Array.from(byProv.values()).sort((a, b) => b.count - a.count).slice(0, 3);
  }, [rowsForProvinceChart]);

  const topProvValue = topProvIncidents.length
    ? topProvIncidents.map((x) => x.name).join(", ")
    : "—";
  const topProvTitle = topProvIncidents.map((x) => `${x.name}: ${x.count}`).join(", ");

  const buttonBase = "btn-toggle";
  const activeStyle = {
    background: "#0f172a",
    color: "#fff",
    borderColor: "#0f172a",
  };

  return (
    <div>
      {/* Top Navigation */}
      <div className="topnav">
        <div className="menu-icon" onClick={() => setSidebarOpen((s) => !s)}>
          ☰
        </div>
        <div className="nav-title">Dashboard</div>
      </div>

      {/* Overlay (for mobile view) */}
      <div
        className="overlay"
        onClick={() => setSidebarOpen(true)}
        style={{ display: !sidebarOpen ? "block" : "none" }}
      />

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
              <div className="submenu-toggle" onClick={toggleSubmenu}>
                <FontAwesomeIcon icon={faFileInvoice} /> Incident Reports
              </div>
              {submenuOpen && (
                <ul className="submenu">
                  <li>
                    <Link to="/VictimeSupectTable">View Reports</Link>
                  </li>
                  <li>
                    <Link to="/AdminCrime">Victim Reports</Link>
                  </li>
                  <li>
                    <Link to="/AdminSuspect">Suspect Report</Link>
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
        <main className="main-content">
          <h1 style={{ marginBottom: 12 }}>Maps & Charts – {areaLabel}</h1>

          {/* Filters (HIDDEN when viewMode === 'bar') */}
          {viewMode !== "bar" && (
            <div className="card" style={{ marginBottom: 12 }}>
              <div className="grid" style={{ alignItems: "end" }}>
                {/* Province (PSGC, buong PH) */}
                <div className="input-group">
                  <label>Province</label>
                  <select
                    value={province}
                    onChange={(e) => setProvince(e.target.value)}
                  >
                    <option value="">All (Philippines)</option>
                    {psgcProvinces.map((p) => (
                      <option key={p.code} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Crime type */}
                <div className="input-group">
                  <label>Crime/Incident Type</label>
                  <select value={crimeType} onChange={(e) => setCrimeType(e.target.value)}>
                    <option value="">All</option>
                    {CRIME_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Date range */}
                <div className="input-group">
                  <label>Date From</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                </div>
                <div className="input-group">
                  <label>Date To</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </div>

                {/* Data reload / Clear */}
                <div className="input-group" style={{ display: "flex", gap: 6 }}>
                  <button className="btn" type="button" onClick={fetchCrimes} disabled={loading}>
                    {loading ? "Loading…" : "Refresh data"}
                  </button>
                  <button
                    className="btn"
                    type="button"
                    onClick={() => {
                      setProvince("");
                      setCrimeType("");
                      setDateFrom("");
                      setDateTo("");
                    }}
                  >
                    Clear filters
                  </button>
                </div>
              </div>
              {error ? <div className="alert" style={{ marginTop: 10 }}>{error}</div> : null}
              <small style={{ color: "#6b7280" }}>
                Province list via <b>PSGC</b>.
              </small>
            </div>
          )}

          {/* KPI Cards */}
          <div className="grid" style={{ marginBottom: 12, gap: 12 }}>
            <div className="card kpi">
              <div className="kpi-label">Total Incidents</div>
              <div className="kpi-value">{totalIncidents}</div>
            </div>
            <div className="card kpi">
              <div className="kpi-label">Total Victims</div>
              <div className="kpi-value">{totalVictims}</div>
            </div>
            <div className="card kpi">
              <div className="kpi-label">Date Range</div>
              <div className="kpi-value" style={{ fontSize: 14 }}>{dateRange}</div>
            </div>
            <div className="card kpi">
              <div className="kpi-label">Top Provinces w/ Crime</div>
              <div className="kpi-value" title={topProvTitle}>{topProvValue}</div>
            </div>
          </div>

          {/* View Switcher Buttons */}
          <div className="card" style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                className={buttonBase}
                style={viewMode === "heat" ? activeStyle : undefined}
                onClick={() => setViewMode("heat")}
                aria-pressed={viewMode === "heat"}
              >
                🔥 Heatmap
              </button>
              <button
                type="button"
                className={buttonBase}
                style={viewMode === "line" ? activeStyle : undefined}
                onClick={() => setViewMode("line")}
                aria-pressed={viewMode === "line"}
              >
                📈 Line Graph
              </button>
              <button
                type="button"
                className={buttonBase}
                style={viewMode === "bar" ? activeStyle : undefined}
                onClick={() => setViewMode("bar")}
                aria-pressed={viewMode === "bar"}
              >
                📊 Bar Graph
              </button>
            </div>
          </div>

          {/* Conditional Content */}
          {viewMode === "heat" && (
            <div className="card" style={{ overflow: "hidden" }}>
              <div style={{ height: 520, width: "100%" }}>
                <MapContainer
                  center={PH_CENTER}
                  zoom={6}
                  scrollWheelZoom
                  maxBounds={PH_BOUNDS}
                  maxBoundsViscosity={1.0}
                  style={{ height: "100%", width: "100%" }}
                >
                  <MapGuards />
                  <TileLayer
                    noWrap
                    attribution="&copy; OpenStreetMap contributors"
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <HeatLayer points={points} />
                </MapContainer>
              </div>
              <small style={{ color: "#0d1b36ff", display: "block", marginTop: 8 }}>
                Base: <b>{filteredRows.length}</b> incidents in <b>{areaLabel}</b>
                {crimeType ? ` for ${crimeType}` : ""}.
              </small>
            </div>
          )}

          {viewMode === "line" && (
            <div className="card">
              <h3 style={{ marginBottom: 8 }}>Daily Incidents — {areaLabel}</h3>
              <div style={{ width: "100%", maxWidth: 1000 }}>
                <Line data={lineData} options={chartOptions} height={120} />
              </div>
              <small style={{ color: "#0d1b36ff" }}>
                Base: <b>{filteredRows.length}</b> incidents in <b>{areaLabel}</b>
                {crimeType ? ` for ${crimeType}` : ""}.
              </small>
            </div>
          )}

          {viewMode === "bar" && (
            <div className="card">
              <h3 style={{ marginBottom: 8 }}>Victims by Province — Philippines (Top {TOP_N})</h3>
              <div style={{ width: "100%", maxWidth: 1100 }}>
                <Bar data={barProvData} options={barProvOptions} height={TOP_N * 6} />
              </div>
              <small style={{ color: "#0d1b36ff" }}>
                Note: PH-wide aggregation. Crime type at date filters lang ang applied dito (province filter is ignored para ma-compare lahat ng probinsya).
              </small>
            </div>
          )}
        </main>
      </div>

      {/* Minimal styles for new elements (or move to your CSS) */}
      <style>{`
        .btn-toggle {
          border: 1px solid #cbd5e1;
          background: #fff;
          color: #0f172a;
          padding: 8px 12px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
        }
        .btn-toggle:hover { background: #f8fafc; }

        .card.kpi {
          display: flex;
          flex-direction: column;
          gap: 6px;
          padding: 14px 16px;
        }
        .kpi-label {
          font-size: 12px;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: .04em;
        }
        .kpi-value {
          font-size: 22px;
          font-weight: 700;
          color: #0f172a;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      `}</style>
    </div>
  );
};

export default AdminAnalytics;
