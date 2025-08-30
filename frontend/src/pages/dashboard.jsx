// src/pages/Dashboard.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import "../assets/css/dashboard.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faHome,
  faUser,
  faFileInvoice,
  faMapLocation,
  faRightFromBracket,
  faChartLine, faBell
} from "@fortawesome/free-solid-svg-icons";
import { Link, useNavigate } from "react-router-dom";

/* ===== Map stack ===== */
import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
const DefaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

/* ===== Chart stack ===== */
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";
ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend, Filler);

/* ====== CONFIG ====== */
const API_BASE = "http://localhost:8000";
const ENDPOINTS = {
  crimes: `${API_BASE}/api/crimes/`,
  officers: `${API_BASE}/api/personnel/`,
};

/* PH & Region IV-A bounds */
const PH_BOUNDS = L.latLngBounds(L.latLng(4.5, 116.0), L.latLng(21.5, 127.0));
const R4A_BOUNDS = L.latLngBounds(L.latLng(13.0, 120.3), L.latLng(15.1, 122.5));
const R4A_CENTER = R4A_BOUNDS.getCenter();

/* ===== Utils ===== */
function isRegion4A(row) {
  const name =
    (row.loc_region ||
      row.v_region ||
      row.region ||
      row.loc_region_name ||
      row.v_region_name ||
      "") + "";
  const code = (row.loc_region_code || row.v_region_code || row.region_code || "") + "";
  return /IV-A/i.test(name) || /CALABARZON/i.test(name) || code.startsWith("04");
}
function groupIncidentsByDay(rows) {
  const map = new Map();
  rows.forEach(r => {
    const d = r.happened_at ? new Date(r.happened_at) : null;
    if (!(d && !isNaN(d))) return;
    const key = d.toISOString().slice(0,10); // YYYY-MM-DD
    map.set(key, (map.get(key) || 0) + 1);
  });
  const labels = Array.from(map.keys()).sort();
  const values = labels.map(k => map.get(k));
  return { labels, values };
}

const rowsFromPayload = (data) =>
  Array.isArray(data) ? data : (Array.isArray(data?.results) ? data.results : []);

/* Heat layer (dynamic import) */
function HeatLayer({ points, options }) {
  const map = useMap();
  const layerRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    import("leaflet.heat")
      .then(() => {
        if (!mounted) return;
        if (layerRef.current) {
          map.removeLayer(layerRef.current);
          layerRef.current = null;
        }
        if (!points || points.length === 0) return;
        layerRef.current = L.heatLayer(points, { radius: 22, blur: 18, maxZoom: 5, ...options }).addTo(map);
        try {
          const ll = points.map(p => [p[0], p[1]]);
          const b = L.latLngBounds(ll);
          if (b.isValid()) map.fitBounds(b.pad(0.2));
        } catch {}
      })
      .catch(e => console.error("leaflet.heat not available:", e));
    return () => {
      mounted = false;
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [map, points, options]);

  return null;
}

/* ======= Officers count helper (exclude archived) ======= */
async function fetchAllPersonnelVisible() {
  let url = `${ENDPOINTS.officers}?page_size=1000`;
  const all = [];

  while (url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();

    const rows = Array.isArray(data) ? data : (Array.isArray(data.results) ? data.results : []);
    all.push(...rows);

    if (Array.isArray(data)) break; // not paginated

    url = data.next
      ? (data.next.startsWith("http") ? data.next : `${API_BASE}${data.next}`)
      : null;
  }

  const visible = all.filter(p => !(p.is_archived === true || p.archived === true));
  return visible;
}

/* ======= Crimes helper: fetch ALL non-archived (handles pagination) ======= */
async function fetchAllCrimesVisible() {
  let url = `${ENDPOINTS.crimes}?is_archived=false&page_size=1000`;
  const all = [];

  while (url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();

    const rows = rowsFromPayload(data);
    all.push(...rows);

    if (Array.isArray(data)) break; // not paginated
    url = data.next
      ? (data.next.startsWith("http") ? data.next : `${API_BASE}${data.next}`)
      : null;
  }

  return all;
}

/* ============= Component ============= */
const Dashboard = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [submenuOpen, setSubmenuOpen] = useState(true);
  const navigate = useNavigate();

  // KPIs
  const [kpis, setKpis] = useState({
    total_crimes: 0,
    total_officers: 0,
    total_solved: 0,
    unresolved: 0,      // <-- replaced 'ongoing' with 'unresolved'
  });

  // Heat + Line chart data
  const [rows, setRows] = useState([]);
  const [points, setPoints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const toggleSidebar = () => setSidebarOpen(s => !s);
  const toggleSubmenu = () => setSubmenuOpen(s => !s);

  /* ---------- KPI fetching (accurate, paginated) ---------- */
  async function fetchKPIs() {
    try {
      // Crimes (all non-archived)
      const crimes = await fetchAllCrimesVisible();

      // Officers (exclude archived)
      let totalOfficers = 0;
      try {
        const visible = await fetchAllPersonnelVisible();
        totalOfficers = visible.length;
      } catch (e) {
        console.warn("Officers fetch failed:", e);
        totalOfficers = 0;
      }

      // Count by exact model choices
      const totalCrimes = crimes.length;
      const totalSolved = crimes.filter(r => (r.status || "") === "Solved").length;
      const totalUnresolved = crimes.filter(r => (r.status || "") === "Unsolved").length; // <-- here

      setKpis({
        total_crimes: totalCrimes,
        total_officers: totalOfficers,
        total_solved: totalSolved,
        unresolved: totalUnresolved,
      });
    } catch (e) {
      console.error("fetchKPIs error", e);
    }
  }

  /* ---------- Incidents for heatmap + chart ---------- */
  async function fetchIncidents() {
    try {
      setLoading(true);
      setErr("");
      const res = await fetch(`${ENDPOINTS.crimes}?is_archived=false&ordering=-happened_at&page_size=1000`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const all = rowsFromPayload(data);
      const inR4A = all.filter(isRegion4A);

      const pts = inR4A
        .map(r => {
          const lat = parseFloat(r.latitude);
          const lng = parseFloat(r.longitude);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
          let w = 1;
          if ((r.crime_type || "").toLowerCase() === "homicide") w = 2;
          return [lat, lng, w];
        })
        .filter(Boolean);

      setRows(inR4A);
      setPoints(pts);
    } catch (e) {
      console.error("incidents error", e);
      setErr("Di makuha ang incidents. Subukan muli.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchKPIs();
    fetchIncidents();
  }, []);

  const daily = useMemo(() => groupIncidentsByDay(rows), [rows]);
  const lineData = useMemo(() => ({
    labels: daily.labels,
    datasets: [{
      label: "Incident Count per Day (Region IV-A)",
      data: daily.values,
      fill: true,
      tension: 0.3,
      pointRadius: 3,
    }],
  }), [daily]);

  const chartOptions = useMemo(() => ({
    responsive: true,
    plugins: { legend: { display: true }, tooltip: { intersect: false, mode: "index" } },
    scales: {
      x: { title: { display: true, text: "Date" }, ticks: { autoSkip: true, maxRotation: 0 } },
      y: { beginAtZero: true, title: { display: true, text: "Number of Incidents" }, ticks: { precision: 0 } },
    },
  }), []);

  /* ------- quick nav helpers for KPI cards ------- */
  const goCrimes = () => navigate("/VictimeSupectTable");
  const goOfficers = () => navigate("/adminInfo");
  const goSolved = () => navigate("/VictimeSupectTable?status=Solved");
  const goUnresolved = () => navigate("/VictimeSupectTable?status=Unsolved"); // <-- new

  return (
    <div>
      {/* Top Navigation */}
      <div className="topnav">
        <div className="menu-icon" onClick={toggleSidebar}>☰</div>
        <div className="nav-title">Dashboard</div>
      </div>

      {/* Overlay (mobile) */}
      {!sidebarOpen && <div className="overlay" onClick={() => setSidebarOpen(true)}></div>}

      <div className="container">
        {/* Sidebar */}
        <aside className={`sidebar ${!sidebarOpen ? "collapsed" : ""}`}>
          <div className="logo-section">
            <img src="/assets/logo.png" alt="Logo" />
            <p><strong>Admin</strong><br />Dashboard</p>
          </div>
          <ul className="nav-links">
            <li><Link to="/dashboard"><FontAwesomeIcon icon={faHome} /> Home</Link></li>
            <li><Link to="/adminInfo"><FontAwesomeIcon icon={faUser} /> Profile Information</Link></li>

            <li className="active">
              <div className="submenu-toggle" onClick={toggleSubmenu}>
                <FontAwesomeIcon icon={faFileInvoice} /> Incident Reports
              </div>
              {submenuOpen && (
                <ul className="submenu">
                  <li><Link to="/VictimeSupectTable">View Reports</Link></li>
                  <li><Link to="/AdminCrime">Victim Reports</Link></li>
                  <li><Link to="/AdminSuspect">Suspect Report</Link></li>
                </ul>
              )}
            </li>

            <li><Link to="/AdminMaps"><FontAwesomeIcon icon={faMapLocation} /> Maps</Link></li>
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
            <li><Link to="/logout" className="logout"><FontAwesomeIcon icon={faRightFromBracket} /> Logout</Link></li>
          </ul>
        </aside>

        {/* ==================== Main Content ==================== */}
        <main className="main-content">
          <h1 style={{ marginBottom: 16 }}>PNP MARITIME ADMIN DASHBOARD</h1>

          {/* KPI CARDS (CLICKABLE) */}
          
          <div className="kpi-row">
            <button className="kpi-card kpi-blue kpi-click" onClick={goCrimes} title="Go to View Reports">
              <div className="kpi-value">{kpis.total_crimes}</div>
              <div className="kpi-label">Total Crimes Reported</div>
            </button>

            <button className="kpi-card kpi-cyan kpi-click" onClick={goOfficers} title="Go to Profile Information">
              <div className="kpi-value">{kpis.total_officers}</div>
              <div className="kpi-label">Total Police Officers</div>
            </button>

            <button className="kpi-card kpi-yellow kpi-click" onClick={goSolved} title="View Solved Cases">
              <div className="kpi-value">{kpis.total_solved}</div>
              <div className="kpi-label">Total Crimes Solved</div>
            </button>

           {/* Crime Unresolved → RED card */}
            <button className="kpi-card kpi-red kpi-click" onClick={goUnresolved} title="View Unresolved (Unsolved) Cases">
              <div className="kpi-value">{kpis.unresolved}</div>
              <div className="kpi-label">Crime Unresolved</div>
            </button>
          </div>

          {/* HEATMAP + INCIDENTS PER DAY */}
          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-grid-2">
              <div className="card-pane">
                <h3 style={{ margin: "0 0 8px" }}>Heatmap of Incidents</h3>
                <div style={{ height: 380, width: "100%" }}>
                  <MapContainer
                    center={R4A_CENTER}
                    zoom={8}
                    scrollWheelZoom
                    maxBounds={PH_BOUNDS}
                    maxBoundsViscosity={1.0}
                    style={{ height: "100%", width: "100%" }}
                  >
                    <TileLayer
                      noWrap
                      attribution="&copy; OpenStreetMap contributors"
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <HeatLayer points={points} />
                  </MapContainer>
                </div>
              </div>

              <div className="card-pane">
                <h3 style={{ margin: "0 0 8px" }}>Incidents Per Day</h3>
                <div style={{ width: "100%", height: 380 }}>
                  <Line data={lineData} options={chartOptions} height={140} />
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  {err && <div className="alert">{err}</div>}
                </div>
              </div>
            </div>
          </div>
        </main>
        {/* ================== End Main Content ================== */}
      </div>
    </div>
  );
};

export default Dashboard;
