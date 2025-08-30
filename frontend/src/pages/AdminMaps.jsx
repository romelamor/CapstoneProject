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
import axios from "axios";

/* == MAP STACK == */
import "leaflet/dist/leaflet.css";
import {
  MapContainer,
  TileLayer,
  LayersControl,
  LayerGroup,
  useMap,
  Marker,
  CircleMarker,
  Popup,
} from "react-leaflet";
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

/* ================= CONFIG ================= */
const API_BASE = "http://localhost:8000";

/* PH bounds (buong Pilipinas) */
const PH_BOUNDS = L.latLngBounds(L.latLng(4.5, 116.0), L.latLng(21.5, 127.0));
const PH_CENTER = PH_BOUNDS.getCenter();

/* ===== Helpers copied from VictimSuspectTables ===== */
const VICTIM_STATUSES = ["Ongoing", "Solved", "Unsolved"];
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

const normalizeVictimStatus = (row) => {
  const value =
    row?.status ?? row?.case_status ?? row?.is_active ?? row?._status;
  const s = String(value ?? "").trim();
  return VICTIM_STATUSES.includes(s) ? s : "Ongoing";
};

/* Red star for suspects */
const starIcon = L.divIcon({
  className: "star-marker",
  html: `<div style="font-size:28px;color:#ef4444;transform:translate(-50%,-50%);text-shadow:0 0 3px rgba(0,0,0,.4)">★</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

/* Fit bounds + clamp to PH (same behavior) */
function MapController({ fitTo }) {
  const map = useMap();
  React.useEffect(() => {
    map.setMaxBounds(PH_BOUNDS);
    if (fitTo && fitTo.length) {
      const b = L.latLngBounds(fitTo);
      map.fitBounds(b, { padding: [24, 24] });
    } else {
      map.fitBounds(PH_BOUNDS, { padding: [24, 24] });
    }
  }, [map, fitTo]);
  return null;
}

/* ================== MAIN PAGE ================== */
const AdminMaps = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [submenuOpen, setSubmenuOpen] = useState(true);

  // Data for the map (same as old Show Map)
  const [victims, setVictims] = useState([]);
  const [suspects, setSuspects] = useState([]);
  const [loadingVictims, setLoadingVictims] = useState(true);
  const [loadingSuspects, setLoadingSuspects] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchVictims();
    fetchSuspects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchVictims = async () => {
    setLoadingVictims(true);
    try {
      const res = await axios.get(`${API_BASE}/api/crimes/`, {
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
      const res = await axios.get(`${API_BASE}/api/suspects/`, {
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

  /* ========= Map data ========= */
  const mapPoints = useMemo(() => {
    const pts = [];
    victims.forEach((v) => {
      const lat = Number(v.latitude);
      const lng = Number(v.longitude);
      if (
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        PH_BOUNDS.contains([lat, lng])
      ) {
        pts.push({
          kind: "victim",
          id: `v-${v.id}`,
          lat,
          lng,
          title: v.crime_type || "Incident",
          name:
            fullName(v.v_first_name, v.v_middle_name, v.v_last_name) ||
            "Unnamed Victim",
          where: [v.loc_barangay, v.loc_city_municipality, v.loc_province]
            .filter(Boolean)
            .join(", "),
          when: v.happened_at || "",
          extra: v.loc_kind
            ? `${String(v.loc_kind).toUpperCase()}${
                v.loc_waterbody ? ` (${v.loc_waterbody})` : ""
              }`
            : "",
          _status: normalizeVictimStatus(v),
        });
      }
    });
    suspects.forEach((s) => {
      const lat = Number(s.latitude);
      const lng = Number(s.longitude);
      if (
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        PH_BOUNDS.contains([lat, lng])
      ) {
        pts.push({
          kind: "suspect",
          id: `s-${s.id}`,
          lat,
          lng,
          title: s.s_crime_type || "Incident",
          name:
            fullName(s.s_first_name, s.s_middle_name, s.s_last_name) ||
            "Unnamed Suspect",
          where: [s.loc_barangay, s.loc_city_municipality, s.loc_province]
            .filter(Boolean)
            .join(", "),
          when:
            (s.created_at && String(s.created_at).split("T")[0]) || "",
          extra: s.loc_kind
            ? `${String(s.loc_kind).toUpperCase()}${
                s.loc_waterbody ? ` (${s.loc_waterbody})` : ""
              }`
            : "",
        });
      }
    });
    return pts;
  }, [victims, suspects]);

  const fitLatLngs = useMemo(
    () => mapPoints.map((p) => L.latLng(p.lat, p.lng)),
    [mapPoints]
  );

  const toggleSubmenu = () => setSubmenuOpen((s) => !s);

  return (
    <div>
      {/* Top Navigation */}
      <div className="topnav">
        <div className="menu-icon" onClick={() => setSidebarOpen((s) => !s)}>
          ☰
        </div>
        <div className="nav-title">Crime Map</div>
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

        {/* ======= MAIN CONTENT (exact Show Map view) ======= */}
        <main className="main-content" style={{ width: "100%", padding: 16 }}>
          {error && (
            <div style={{ color: "crimson", marginBottom: 12 }}>{error}</div>
          )}
          <h1>Crime/Incidents Maps</h1>
          <section style={{ height: "70vh", minHeight: 480 }}>
            <div
              style={{
                height: "100%",
                borderRadius: 10,
                overflow: "hidden",
                border: "1px solid #e5e7eb",
              }}
            >
              <MapContainer
                className="leaflet-map"
                center={PH_CENTER}
                zoom={6}
                maxBounds={PH_BOUNDS}
                maxBoundsViscosity={1.0}
                worldCopyJump={false}
                style={{ height: "100%", width: "100%" }}
              >
                <MapController fitTo={fitLatLngs} />
                <LayersControl position="topright">
                  <LayersControl.BaseLayer checked name="Satellite (with labels)">
                    <LayerGroup>
                      <TileLayer
                        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                        attribution="&copy; Esri"
                        detectRetina
                      />
                      <TileLayer
                        url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
                        attribution=""
                        opacity={0.95}
                      />
                    </LayerGroup>
                  </LayersControl.BaseLayer>

                  <LayersControl.BaseLayer name="OpenStreetMap (Standard)">
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution="&copy; OpenStreetMap contributors"
                      detectRetina
                    />
                  </LayersControl.BaseLayer>

                  {/* Victims layer (yellow circles) */}
                  <LayersControl.Overlay checked name="Victims (yellow circles)">
                    <LayerGroup>
                      {mapPoints
                        .filter((p) => p.kind === "victim")
                        .map((p) => (
                          <CircleMarker
                            key={p.id}
                            center={[p.lat, p.lng]}
                            radius={8}
                            pathOptions={{
                              color:
                                p._status === "Unsolved"
                                  ? "#dc2626"
                                  : p._status === "Solved"
                                  ? "#16a34a"
                                  : "#eab308",
                              fillColor:
                                p._status === "Unsolved"
                                  ? "#fecaca"
                                  : p._status === "Solved"
                                  ? "#bbf7d0"
                                  : "#fde047",
                              fillOpacity: 0.9,
                              weight: 2,
                            }}
                          >
                            <Popup>
                              <div style={{ minWidth: 200 }}>
                                <strong>Victim</strong>
                                <br />
                                <strong>{p.title}</strong>
                                <br />
                                {p.name}
                                <br />
                                {p.where || ""}
                                <br />
                                {p.lat.toFixed(5)}, {p.lng.toFixed(5)}
                                <br />
                                {p.extra && <em>{p.extra}</em>}
                                <br />
                                {p.when && <small>{p.when}</small>}
                                <br />
                                <small>Status: {p._status}</small>
                              </div>
                            </Popup>
                          </CircleMarker>
                        ))}
                    </LayerGroup>
                  </LayersControl.Overlay>

                  {/* Suspects layer (red stars) */}
                  <LayersControl.Overlay checked name="Suspects (red stars)">
                    <LayerGroup>
                      {mapPoints
                        .filter((p) => p.kind === "suspect")
                        .map((p) => (
                          <Marker key={p.id} position={[p.lat, p.lng]} icon={starIcon}>
                            <Popup>
                              <div style={{ minWidth: 200 }}>
                                <strong>Suspect</strong>
                                <br />
                                <strong>{p.title}</strong>
                                <br />
                                {p.name}
                                <br />
                                {p.where || ""}
                                <br />
                                {p.lat.toFixed(5)}, {p.lng.toFixed(5)}
                                <br />
                                {p.extra && <em>{p.extra}</em>}
                                <br />
                                {p.when && <small>{p.when}</small>}
                              </div>
                            </Popup>
                          </Marker>
                        ))}
                    </LayerGroup>
                  </LayersControl.Overlay>
                </LayersControl>
              </MapContainer>
            </div>

            <div
              style={{
                marginTop: 10,
                display: "flex",
                gap: 8,
                alignItems: "center",
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span
                  style={{
                    width: 14,
                    height: 14,
                    background: "#fde047",
                    border: "2px solid #eab308",
                    borderRadius: "50%",
                    display: "inline-block",
                  }}
                />
              </span>
              <small>Victim</small>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  marginLeft: 12,
                }}
              >
                <span style={{ color: "#ef4444", fontSize: 16, lineHeight: 0 }}>★</span>
              </span>
              <small>Suspect</small>
              <div style={{ marginLeft: 12, color: "#6b7280" }}>
                {loadingVictims || loadingSuspects ? "Loading map data…" : ""}
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
};

export default AdminMaps;
