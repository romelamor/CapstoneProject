// src/pages/AdminCrime.jsx
import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faHome,
  faUser,
  faFileInvoice,
  faMapLocation,
  faChartLine,
  faBell,
  faRightFromBracket,
  faSave,
} from "@fortawesome/free-solid-svg-icons";
import "../assets/css/AdminCrime.css";

/* Leaflet (mini-picker map) */
import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";

/* Default Leaflet marker fix */
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
const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";

/* Philippines bounding box */
const PH_BOUNDS = L.latLngBounds(L.latLng(4.5, 116.0), L.latLng(21.5, 127.0));
const PH_CENTER = L.latLng(14.5995, 120.9842); // Manila

/* Nominatim needs: minLon,minLat,maxLon,maxLat */
const toViewbox = (bounds) => {
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  return `${sw.lng},${sw.lat},${ne.lng},${ne.lat}`;
};

const crimeTypes = [
  "Theft","Robbery","Assault","Homicide","Illegal Fishing",
  "Smuggling","Drugs","Vandalism","Fraud","Others",
];

/* ------------ Error Boundary to avoid white screen ------------ */
class ErrorBoundary extends React.Component {
  constructor(props){ super(props); this.state = { hasError: false, err: null }; }
  static getDerivedStateFromError(err){ return { hasError: true, err }; }
  componentDidCatch(err, info){ console.error("ErrorBoundary caught:", err, info); }
  render(){
    if (this.state.hasError) {
      return (
        <div style={{padding:16}}>
          <h3>Something went wrong.</h3>
          <p style={{color:"#6b7280"}}>Please check the address pickers or reload the page.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ================= PSGC Address Picker ================= */
function PhAddressPicker({ label, value, onChange, withAddressLine }) {
  const [regions, setRegions] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [cityMuns, setCityMuns] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [errNote, setErrNote] = useState("");

  // Always return array; swallow 404/429/invalid JSON
  async function safeFetchJson(url) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.warn("PSGC non-OK:", res.status, url);
        return [];
      }
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (e) {
      console.error("PSGC fetch error:", url, e);
      return [];
    }
  }

  useEffect(() => {
    (async () => {
      const d = await safeFetchJson("https://psgc.cloud/api/regions");
      setRegions(Array.isArray(d) ? d : []);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (!value.regionCode) { setProvinces([]); setCityMuns([]); setBarangays([]); return; }
      const url = `https://psgc.cloud/api/regions/${value.regionCode}/provinces`;
      const d = await safeFetchJson(url);
      setProvinces(Array.isArray(d) ? d : []);
      setCityMuns([]); setBarangays([]);
    })();
  }, [value.regionCode]);

  useEffect(() => {
    (async () => {
      if (!value.provinceCode) { setCityMuns([]); setBarangays([]); return; }
      const url = `https://psgc.cloud/api/provinces/${value.provinceCode}/cities-municipalities`;
      const d = await safeFetchJson(url);
      setCityMuns(Array.isArray(d) ? d : []);
      setBarangays([]);
    })();
  }, [value.provinceCode]);

  useEffect(() => {
    (async () => {
      if (!value.cityMunCode) { setBarangays([]); return; }
      const cm = cityMuns.find(x => x.code === value.cityMunCode);
      const isCity = (cm?.type || "").toLowerCase().includes("city");
      // NOTE: PSGC codes sometimes differ in padding; if 404, we still keep [] and do not crash
      const url = isCity
        ? `https://psgc.cloud/api/cities/${value.cityMunCode}/barangays`
        : `https://psgc.cloud/api/municipalities/${value.cityMunCode}/barangays`;
      const d = await safeFetchJson(url);
      setBarangays(Array.isArray(d) ? d : []);
      // optional UX note
      setErrNote(d.length === 0 ? "No barangays fetched (API error or empty). You can proceed without it." : "");
    })();
  }, [value.cityMunCode, cityMuns]);

  const setRegion = (code) => {
    const r = regions.find(x => x.code === code);
    onChange({
      ...value,
      regionCode: code,
      regionName: r?.name || "",
      provinceCode: "", provinceName: "",
      cityMunCode: "", cityMunName: "", cityMunKind: "",
      barangayCode: "", barangayName: "",
    });
  };
  const setProvince = (code) => {
    const p = provinces.find(x => x.code === code);
    onChange({
      ...value,
      provinceCode: code,
      provinceName: p?.name || "",
      cityMunCode: "", cityMunName: "", cityMunKind: "",
      barangayCode: "", barangayName: "",
    });
  };
  const setCityMun = (code) => {
    const cm = cityMuns.find(x => x.code === code);
    const kind = (cm?.type || "").toLowerCase().includes("city") ? "city" : "municipality";
    onChange({
      ...value,
      cityMunCode: code,
      cityMunName: cm?.name || "",
      cityMunKind: kind,
      barangayCode: "", barangayName: "",
    });
  };
  const setBarangay = (code) => {
    const b = barangays.find(x => x.code === code);
    onChange({ ...value, barangayCode: code, barangayName: b?.name || "" });
  };

  return (
    <div className="section">
      <h3>{label}</h3>

      {withAddressLine && (
        <div className="input-group">
          <label>Lot / Street <span className="required">*</span></label>
          <input
            value={value.addressLine || ""}
            onChange={(e) => onChange({ ...value, addressLine: e.target.value })}
            placeholder="House no., Street, etc."
            required
          />
        </div>
      )}

      <div className="grid">
        <div className="input-group">
          <label>Region <span className="required">*</span></label>
          <select value={value.regionCode || ""} onChange={(e) => setRegion(e.target.value)} required>
            <option value="">Select Region</option>
            {Array.isArray(regions) && regions.map(r => <option key={r.code} value={r.code}>{r.name}</option>)}
          </select>
        </div>
        <div className="input-group">
          <label>Province <span className="required">*</span></label>
          <select value={value.provinceCode || ""} onChange={(e) => setProvince(e.target.value)} disabled={!value.regionCode} required>
            <option value="">Select Province</option>
            {Array.isArray(provinces) && provinces.map(p => <option key={p.code} value={p.code}>{p.name}</option>)}
          </select>
        </div>
        <div className="input-group">
          <label>City / Municipality <span className="required">*</span></label>
          <select value={value.cityMunCode || ""} onChange={(e) => setCityMun(e.target.value)} disabled={!value.provinceCode} required>
            <option value="">Select City/Municipality</option>
            {Array.isArray(cityMuns) && cityMuns.map(cm => {
              const kind = (cm.type || "").toLowerCase().includes("city") ? "City" : "Municipality";
              return <option key={cm.code} value={cm.code}>{cm.name} ({kind})</option>;
            })}
          </select>
        </div>
        <div className="input-group">
          <label>Barangay <span className="required">*</span></label>
          <select value={value.barangayCode || ""} onChange={(e) => setBarangay(e.target.value)} disabled={!value.cityMunCode} required>
            <option value="">Select Barangay</option>
            {Array.isArray(barangays) && barangays.map(b => <option key={b.code} value={b.code}>{b.name}</option>)}
          </select>
          {errNote ? <small style={{color:"#6b7280"}}>{errNote}</small> : null}
        </div>
      </div>
    </div>
  );
}

/* ============ Leaflet Helpers ============ */
function KeepMapInPH() {
  const map = useMap();
  useEffect(() => {
    map.setMaxBounds(PH_BOUNDS);
    map.fitBounds(PH_BOUNDS, { padding: [20, 20] });
  }, [map]);
  return null;
}

/* Mini map picker (locked to PH) */
function MiniPickerMap({ lat, lng, onChange }) {
  const initial = Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : PH_CENTER;
  const [pos, setPos] = useState(initial);

  useEffect(() => {
    if (Number.isFinite(lat) && Number.isFinite(lng)) setPos([lat, lng]);
  }, [lat, lng]);

  function DraggableMarker() {
    const markerRef = useRef(null);
    useMapEvents({
      click(e) {
        const { lat, lng } = e.latlng;
        if (!PH_BOUNDS.contains([lat, lng])) return;
        setPos([lat, lng]);
        onChange({ lat, lng });
      },
    });
    return (
      <Marker
        draggable
        eventHandlers={{
          dragend() {
            const m = markerRef.current;
            if (!m) return;
            const ll = m.getLatLng();
            if (!PH_BOUNDS.contains(ll)) return;
            setPos([ll.lat, ll.lng]);
            onChange({ lat: ll.lat, lng: ll.lng });
          },
        }}
        position={pos}
        ref={markerRef}
      />
    );
  }

  return (
    <div style={{ border: "1px solid #eee", borderRadius: 8, overflow: "hidden" }}>
      <MapContainer
        style={{ height: 300, width: "100%" }}
        center={pos}
        zoom={Number.isFinite(lat) && Number.isFinite(lng) ? 15 : 6}
        scrollWheelZoom
        worldCopyJump={false}
        maxBounds={PH_BOUNDS}
        maxBoundsViscosity={1.0}
      >
        <KeepMapInPH />
        <TileLayer
          noWrap
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <DraggableMarker />
      </MapContainer>
    </div>
  );
}

/* ================= Main ================= */
const AdminCrime = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [submenuOpen, setSubmenuOpen] = useState(true);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const crimeId = searchParams.get("id"); // EDIT MODE when present

  const blank = {
    crime_type: "",
    description: "",
    happened_at: "",
    v_first_name: "",
    v_middle_name: "",
    v_last_name: "",
    v_age: "",
    v_addr: {
      addressLine: "",
      regionCode: "",
      regionName: "",
      provinceCode: "",
      provinceName: "",
      cityMunCode: "",
      cityMunName: "",
      cityMunKind: "",
      barangayCode: "",
      barangayName: "",
    },
    loc_addr: {
      addressLine: "",
      regionCode: "",
      regionName: "",
      provinceCode: "",
      provinceName: "",
      cityMunCode: "",
      cityMunName: "",
      cityMunKind: "",
      barangayCode: "",
      barangayName: "",
    },
    latitude: "",
    longitude: "",
    loc_kind: "",
    loc_waterbody: "",
    v_photo_file: null,
    v_photo_preview: "",
    v_photo_existing: "",
  };

  const [form, setForm] = useState(blank);
  const [loading, setLoading] = useState(!!crimeId);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [geoMsg, setGeoMsg] = useState("");

  /* Load existing on edit */
  useEffect(() => {
    if (!crimeId) return;
    (async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/crimes/${crimeId}/`);
        const c = res.data || {};
        setForm({
          crime_type: c.crime_type || "",
          description: c.description || "",
          happened_at: (c.happened_at || "").slice(0, 10),
          v_first_name: c.v_first_name || "",
          v_middle_name: c.v_middle_name || "",
          v_last_name: c.v_last_name || "",
          v_age: c.v_age || "",
          v_addr: {
            addressLine: c.v_address || "",
            regionCode: c.v_region_code || "",
            regionName: c.v_region || "",
            provinceCode: c.v_province_code || "",
            provinceName: c.v_province || "",
            cityMunCode: c.v_city_mun_code || "",
            cityMunName: c.v_city_municipality || "",
            cityMunKind: c.v_city_mun_kind || "",
            barangayCode: c.v_barangay_code || "",
            barangayName: c.v_barangay || "",
          },
          loc_addr: {
            addressLine: c.loc_address || "",
            regionCode: c.loc_region_code || "",
            regionName: c.loc_region || "",
            provinceCode: c.loc_province_code || "",
            provinceName: c.loc_province || "",
            cityMunCode: c.loc_city_mun_code || "",
            cityMunName: c.loc_city_municipality || "",
            cityMunKind: c.loc_city_mun_kind || "",
            barangayCode: c.loc_barangay_code || "",
            barangayName: c.loc_barangay || "",
          },
          latitude: c.latitude || "",
          longitude: c.longitude || "",
          loc_kind: c.loc_kind || "",
          loc_waterbody: c.loc_waterbody || "",
          v_photo_file: null,
          v_photo_preview: "",
          v_photo_existing: c.v_photo_url || c.v_photo || "",
        });
      } catch (e) {
        console.error("load crime error", e?.response?.data || e.message);
        setMessage("Failed to load report.");
      } finally {
        setLoading(false);
      }
    })();
  }, [crimeId]);

  const setVictimAddr = (next) => setForm((p) => ({ ...p, v_addr: next }));
  const setLocAddr = (next) => setForm((p) => ({ ...p, loc_addr: next }));

  const onPickVictimPhoto = (e) => {
    const file = e.target.files?.[0] || null;
    if (!file) {
      setForm((p) => ({ ...p, v_photo_file: null, v_photo_preview: "" }));
      return;
    }
    const url = URL.createObjectURL(file);
    setForm((p) => ({ ...p, v_photo_file: file, v_photo_preview: url }));
  };

  const appendAddr = (fd, prefix, a) => {
    fd.append(`${prefix}_address`, a.addressLine || "");
    fd.append(`${prefix}_region`, a.regionName || "");
    fd.append(`${prefix}_province`, a.provinceName || "");
    fd.append(`${prefix}_city_municipality`, a.cityMunName || "");
    fd.append(`${prefix}_city_mun_kind`, a.cityMunKind || "");
    fd.append(`${prefix}_barangay`, a.barangayName || "");
    fd.append(`${prefix}_region_code`, a.regionCode || "");
    fd.append(`${prefix}_province_code`, a.provinceCode || "");
    fd.append(`${prefix}_city_mun_code`, a.cityMunCode || "");
    fd.append(`${prefix}_barangay_code`, a.barangayCode || "");
  };

  /* =========== PH-focused Geocoding (with guards) =========== */
  const geoTimer = useRef(null);
  const latestGeoRun = useRef(0);

  const queryNominatim = async (paramsObj) => {
    const params = new URLSearchParams({
      format: "jsonv2",
      addressdetails: "1",
      limit: "1",
      countrycodes: "ph",
      bounded: "1",
      viewbox: toViewbox(PH_BOUNDS),
      ...paramsObj,
    });
    const url = `${NOMINATIM_BASE}/search?${params.toString()}`;
    try {
      const res = await fetch(url, { headers: { "Accept-Language": "en" } });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (e) {
      console.error("nominatim fetch error", e);
      return [];
    }
  };

  const geocodeLocation = async () => {
    const run = ++latestGeoRun.current;

    const { addressLine, barangayName, cityMunName, provinceName, regionName } =
      form.loc_addr;

    const hasSome = addressLine || barangayName || cityMunName || provinceName || regionName;
    if (!hasSome) return;

    setGeoMsg("Finding coordinates…");

    try {
      let hit = null;

      // 1) Structured: full (street + barangay + city + province + region + country)
      if (!hit) {
        const data = await queryNominatim({
          street: addressLine || "",
          city: [barangayName, cityMunName].filter(Boolean).join(", "),
          county: provinceName || "",
          state: regionName || "",
          country: "Philippines",
        });
        hit = data[0];
      }

      // 2) Structured: no street (just barangay + city + province + region)
      if (!hit) {
        const data = await queryNominatim({
          city: [barangayName, cityMunName].filter(Boolean).join(", "),
          county: provinceName || "",
          state: regionName || "",
          country: "Philippines",
        });
        hit = data[0];
      }

      // 3) Free-form: full string
      if (!hit) {
        const q = [addressLine, barangayName, cityMunName, provinceName, regionName, "Philippines"]
          .filter(Boolean).join(", ");
        const data = await queryNominatim({ q });
        hit = data[0];
      }

      // 4) Free-form: city + province (+ region)
      if (!hit) {
        const q = [barangayName ? `${barangayName}` : "", cityMunName, provinceName, regionName, "Philippines"]
          .filter(Boolean).join(", ");
        const data = await queryNominatim({ q });
        hit = data[0];
      }

      // 5) Free-form: province + region
      if (!hit) {
        const q = [provinceName, regionName, "Philippines"].filter(Boolean).join(", ");
        const data = await queryNominatim({ q });
        hit = data[0];
      }

      // apply if found & still latest run
      if (run !== latestGeoRun.current) return;

      if (hit && hit.lat && hit.lon) {
        const lat = parseFloat(hit.lat);
        const lon = parseFloat(hit.lon);
        if (Number.isFinite(lat) && Number.isFinite(lon) && PH_BOUNDS.contains([lat, lon])) {
          setForm((p) => ({ ...p, latitude: lat, longitude: lon }));
          setGeoMsg("Coordinates set (PH-bounded). You can fine-tune by dragging the marker.");
        } else {
          setGeoMsg("Found coords outside PH bounds—ignored. Please drag the marker or adjust address.");
        }
      } else {
        setGeoMsg("No matches found for this address. Please adjust or drag the marker.");
      }
    } catch (e) {
      console.error("geocode error", e);
      setGeoMsg("Geocoding failed (network). Please adjust manually or drag the marker.");
    }
  };

  // Debounce: geocode when address changes
  useEffect(() => {
    if (geoTimer.current) clearTimeout(geoTimer.current);

    const { addressLine, barangayName, cityMunName, provinceName, regionName } =
      form.loc_addr;
    const hasSome =
      addressLine || barangayName || cityMunName || provinceName || regionName;
    if (!hasSome) return;

    geoTimer.current = setTimeout(() => {
      geocodeLocation();
    }, 700);

    return () => {
      if (geoTimer.current) clearTimeout(geoTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    form.loc_addr.addressLine,
    form.loc_addr.barangayName,
    form.loc_addr.cityMunName,
    form.loc_addr.provinceName,
    form.loc_addr.regionName,
  ]);

  /* ================= Submit ================= */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      const fd = new FormData();
      fd.append("crime_type", form.crime_type || "");
      fd.append("description", form.description || "");
      fd.append("happened_at", form.happened_at || "");

      fd.append("v_first_name", form.v_first_name);
      fd.append("v_middle_name", form.v_middle_name);
      fd.append("v_last_name", form.v_last_name);
      fd.append("v_age", form.v_age);
      appendAddr(fd, "v", form.v_addr);

      if (form.v_photo_file) fd.append("v_photo", form.v_photo_file);

      appendAddr(fd, "loc", form.loc_addr);
      fd.append("latitude", form.latitude || "");
      fd.append("longitude", form.longitude || "");
      fd.append("loc_kind", form.loc_kind || "");
      fd.append("loc_waterbody", form.loc_waterbody || "");

      if (crimeId) {
        await axios.patch(`${API_BASE}/api/crimes/${crimeId}/`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setMessage("Report updated.");
        navigate("/VictimeSupectTable");
      } else {
        await axios.post(`${API_BASE}/api/crimes/`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setMessage("Report saved.");
        setForm(blank);
        navigate("/VictimeSupectTable");
      }
    } catch (e2) {
      console.error("save crime error", e2?.response?.data || e2.message);
      setMessage("Save failed. Check console.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {/* Top Navigation */}
      <div className="topnav">
        <div className="menu-icon" onClick={() => setSidebarOpen(s => !s)}>☰</div>
        <div className="nav-title">Victim Report</div>
      </div>

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
              <div className="submenu-toggle" onClick={() => setSubmenuOpen(s => !s)}>
                <FontAwesomeIcon icon={faFileInvoice} /> Incident Reports
              </div>
              {submenuOpen && (
                <ul className="submenu">
                  <li><Link to="/VictimeSupectTable">View Reports</Link></li>
                  <li><Link to="/AdminCrime">Victim Reports</Link></li>
                  <li><Link to="/AdminSuspect">Suspects Reports</Link></li>
                </ul>
              )}
            </li>

            <li><Link to="/AdminMaps"><FontAwesomeIcon icon={faMapLocation} /> Maps</Link></li>
            <li><Link to="/AdminAnalytics"><FontAwesomeIcon icon={faChartLine} /> Analytics</Link></li>
            <li><Link to="/admin_dashboard"><FontAwesomeIcon icon={faBell} /> Notifications</Link></li>
            <li><Link to="/logout" className="logout"><FontAwesomeIcon icon={faRightFromBracket} /> Logout</Link></li>
          </ul>
        </aside>

        {/* Main Content */}
        <main className="main-content">
          <ErrorBoundary>
            <form onSubmit={handleSubmit} className="crime-form single">
              <h3 style={{ marginBottom: 12 }}>{crimeId ? "Edit Victim Report" : "Create Victim Report"}</h3>

              {loading ? <p>Loading…</p> : null}
              {message && <div className="alert" style={{ marginBottom: 12 }}>{message}</div>}

              <div className="form-section show">
                <h3>Victim Information</h3>
                <div className="grid">
                  <div className="input-group">
                    <label>First Name</label>
                    <input
                      value={form.v_first_name}
                      onChange={(e) => setForm({ ...form, v_first_name: e.target.value })}
                    />
                  </div>
                  <div className="input-group">
                    <label>Middle Name</label>
                    <input
                      value={form.v_middle_name}
                      onChange={(e) => setForm({ ...form, v_middle_name: e.target.value })}
                    />
                  </div>
                  <div className="input-group">
                    <label>Last Name</label>
                    <input
                      value={form.v_last_name}
                      onChange={(e) => setForm({ ...form, v_last_name: e.target.value })}
                    />
                  </div>
                  <div className="input-group">
                    <label>Age</label>
                    <input
                      type="number"
                      value={form.v_age}
                      onChange={(e) => setForm({ ...form, v_age: e.target.value })}
                    />
                  </div>

                  <div className="input-group">
                    <label>Victim Photo</label>
                    <input type="file" accept="image/*" onChange={onPickVictimPhoto} />
                    {(form.v_photo_preview || form.v_photo_existing) && (
                      <div className="img-preview">
                        <img
                          src={form.v_photo_preview || form.v_photo_existing}
                          alt="Victim"
                          style={{ maxWidth: 160, maxHeight: 160, borderRadius: 8, objectFit: "cover" }}
                        />
                      </div>
                    )}
                  </div>

                  <div className="input-group">
                    <label>Type of Crime/Incident</label>
                    <select
                      value={form.crime_type}
                      onChange={(e) => setForm({ ...form, crime_type: e.target.value })}
                    >
                      <option value="">Select</option>
                      {crimeTypes.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>

                  <div className="input-group">
                    <label>Date of Incident</label>
                    <input
                      type="date"
                      value={form.happened_at}
                      onChange={(e) => setForm({ ...form, happened_at: e.target.value })}
                    />
                  </div>

                  <div className="input-group full">
                    <label>Description / Narrative</label>
                    <textarea
                      rows={3}
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                    />
                  </div>
                </div>

                <PhAddressPicker
                  label="Victim Address"
                  value={form.v_addr}
                  onChange={setVictimAddr}
                  withAddressLine
                />
              </div>

              <div className="form-section show">
                <h3>Crime Location</h3>
                <PhAddressPicker
                  label="Address (Philippines)"
                  value={form.loc_addr}
                  onChange={setLocAddr}
                  withAddressLine
                />

                <div className="grid">
                  <div className="input-group">
                    <label>Latitude</label>
                    <input
                      type="number"
                      step="any"
                      value={form.latitude}
                      onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                    />
                  </div>
                  <div className="input-group">
                    <label>Longitude</label>
                    <input
                      type="number"
                      step="any"
                      value={form.longitude}
                      onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                    />
                  </div>
                  <div className="input-group full">
                    <small style={{ color: "#6b7280" }}>
                      {geoMsg || "Tip: Fill address above. Coordinates will auto-fill (PH-bounded)."}
                    </small>
                  </div>
                </div>

                {/* Mini picker map – locked to PH */}
                <MiniPickerMap
                  lat={Number(form.latitude)}
                  lng={Number(form.longitude)}
                  onChange={({ lat, lng }) =>
                    setForm((p) => ({ ...p, latitude: lat, longitude: lng }))
                  }
                />

                <div className="grid" style={{ marginTop: 12 }}>
                  <div className="input-group">
                    <label>Location Kind</label>
                    <select
                      value={form.loc_kind}
                      onChange={(e) => setForm({ ...form, loc_kind: e.target.value })}
                    >
                      <option value="">-- Select --</option>
                      <option value="marine">Marine</option>
                      <option value="coastal">Coastal</option>
                      <option value="inland">Inland</option>
                      <option value="unknown">Unknown</option>
                    </select>
                  </div>
                  <div className="input-group">
                    <label>Waterbody (optional)</label>
                    <input
                      placeholder="e.g., Tayabas Bay"
                      value={form.loc_waterbody}
                      onChange={(e) => setForm({ ...form, loc_waterbody: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="btn"
                  onClick={() => (crimeId ? navigate("/VictimeSupectTable") : setForm(blank))}
                >
                  {crimeId ? "Back to Table" : "Reset"}
                </button>
                <button type="submit" className="submit-button" disabled={saving}>
                  <FontAwesomeIcon icon={faSave} /> {saving ? "Saving…" : (crimeId ? "Update Report" : "Save Report")}
                </button>
              </div>
            </form>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
};

export default AdminCrime;
