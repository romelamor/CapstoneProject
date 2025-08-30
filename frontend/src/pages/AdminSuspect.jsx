// src/pages/AdminSuspectForm.jsx
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

/* Leaflet (PH-locked mini picker) */
import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";

/* Fix default marker icons */
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

/* Philippines bounds & helpers */
const PH_BOUNDS = L.latLngBounds(L.latLng(4.5, 116.0), L.latLng(21.5, 127.0));
const PH_CENTER = L.latLng(14.5995, 120.9842); // Manila
const toViewbox = (bounds) => {
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  return `${sw.lng},${sw.lat},${ne.lng},${ne.lat}`; // minLon,minLat,maxLon,maxLat
};

/* ========= Error Boundary (prevents white screen) ========= */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errMsg: "" };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, errMsg: error?.message || "Unknown error" };
  }
  componentDidCatch(error, info) {
    console.error("ErrorBoundary caught:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 16 }}>
          <h3>Something went wrong while rendering this page.</h3>
          <pre style={{ whiteSpace: "pre-wrap", color: "#b91c1c" }}>{this.state.errMsg}</pre>
          <p>Try reloading the page or going back.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ================= Address Picker (PSGC) ================= */
function PhAddressPicker({ label, value, onChange, withAddressLine }) {
  const [regions, setRegions] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [cityMuns, setCityMuns] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [note, setNote] = useState("");

  // Safe fetch helper: never throws, always returns an array
  async function safeFetchJson(url) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.warn("PSGC non-OK:", res.status, url);
        setNote(`PSGC ${res.status} for ${url}`);
        return [];
      }
      const text = await res.text();
      try {
        const data = JSON.parse(text);
        return Array.isArray(data) ? data : [];
      } catch {
        console.warn("PSGC non-JSON:", url);
        setNote(`PSGC returned non-JSON for ${url}`);
        return [];
      }
    } catch (e) {
      console.error("PSGC fetch error:", url, e);
      setNote(`PSGC fetch error for ${url}`);
      return [];
    }
  }

  useEffect(() => {
    (async () => {
      setRegions(await safeFetchJson("https://psgc.cloud/api/regions"));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    (async () => {
      if (!value?.regionCode) {
        setProvinces([]); setCityMuns([]); setBarangays([]);
        return;
      }
      const url = `https://psgc.cloud/api/regions/${value.regionCode}/provinces`;
      setProvinces(await safeFetchJson(url));
      setCityMuns([]); setBarangays([]);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.regionCode]);

  useEffect(() => {
    (async () => {
      if (!value?.provinceCode) {
        setCityMuns([]); setBarangays([]); return;
      }
      const url = `https://psgc.cloud/api/provinces/${value.provinceCode}/cities-municipalities`;
      setCityMuns(await safeFetchJson(url));
      setBarangays([]);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.provinceCode]);

  useEffect(() => {
    (async () => {
      if (!value?.cityMunCode) { setBarangays([]); return; }
      const cm = (cityMuns || []).find(x => x.code === value.cityMunCode);
      const isCity = (cm?.type || "").toLowerCase().includes("city");
      const url = isCity
        ? `https://psgc.cloud/api/cities/${value.cityMunCode}/barangays`
        : `https://psgc.cloud/api/municipalities/${value.cityMunCode}/barangays`;
      const list = await safeFetchJson(url);
      setBarangays(list);
      if (!list.length) setNote("No barangays fetched (API limit/error).");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.cityMunCode, cityMuns]);

  const setRegion = (code) => {
    const r = (regions || []).find(x => x.code === code);
    onChange({
      ...(value || {}),
      regionCode: code,
      regionName: r?.name || "",
      provinceCode: "", provinceName: "",
      cityMunCode: "", cityMunName: "", cityMunKind: "",
      barangayCode: "", barangayName: "",
    });
  };
  const setProvince = (code) => {
    const p = (provinces || []).find(x => x.code === code);
    onChange({
      ...(value || {}),
      provinceCode: code,
      provinceName: p?.name || "",
      cityMunCode: "", cityMunName: "", cityMunKind: "",
      barangayCode: "", barangayName: "",
    });
  };
  const setCityMun = (code) => {
    const cm = (cityMuns || []).find(x => x.code === code);
    const kind = (cm?.type || "").toLowerCase().includes("city") ? "city" : "municipality";
    onChange({
      ...(value || {}),
      cityMunCode: code,
      cityMunName: cm?.name || "",
      cityMunKind: kind,
      barangayCode: "", barangayName: "",
    });
  };
  const setBarangay = (code) => {
    const b = (barangays || []).find(x => x.code === code);
    onChange({ ...(value || {}), barangayCode: code, barangayName: b?.name || "" });
  };

  return (
    <div className="section">
      <h3>{label}</h3>
      {withAddressLine && (
        <div className="input-group">
          <label>Lot / Street <span className="required">*</span></label>
          <input
            value={value?.addressLine || ""}
            onChange={(e) => onChange({ ...(value || {}), addressLine: e.target.value })}
            placeholder="House no., Street, etc."
            required
          />
        </div>
      )}
      <div className="grid">
        <div className="input-group">
          <label>Region <span className="required">*</span></label>
          <select value={value?.regionCode || ""} onChange={(e)=>setRegion(e.target.value)} required>
            <option value="">Select Region</option>
            {(regions || []).map(r=> <option key={r.code} value={r.code}>{r.name}</option>)}
          </select>
        </div>
        <div className="input-group">
          <label>Province <span className="required">*</span></label>
          <select value={value?.provinceCode || ""} onChange={(e)=>setProvince(e.target.value)} disabled={!value?.regionCode} required>
            <option value="">Select Province</option>
            {(provinces || []).map(p=> <option key={p.code} value={p.code}>{p.name}</option>)}
          </select>
        </div>
        <div className="input-group">
          <label>City / Municipality <span className="required">*</span></label>
          <select value={value?.cityMunCode || ""} onChange={(e)=>setCityMun(e.target.value)} disabled={!value?.provinceCode} required>
            <option value="">Select City/Municipality</option>
            {(cityMuns || []).map(cm=>{
              const kind = (cm.type||"").toLowerCase().includes("city") ? "City" : "Municipality";
              return <option key={cm.code} value={cm.code}>{cm.name} ({kind})</option>;
            })}
          </select>
        </div>
        <div className="input-group">
          <label>Barangay <span className="required">*</span></label>
          <select value={value?.barangayCode || ""} onChange={(e)=>setBarangay(e.target.value)} disabled={!value?.cityMunCode} required>
            <option value="">Select Barangay</option>
            {(barangays || []).map(b=> <option key={b.code} value={b.code}>{b.name}</option>)}
          </select>
        </div>
        {!!note && (
          <div className="input-group full">
            <small style={{ color: "#b45309" }}>{note}</small>
          </div>
        )}
      </div>
    </div>
  );
}

/* ================= Mini Map (locked to PH) ================= */
function KeepMapInPH() {
  const map = useMap();
  useEffect(() => {
    map.setMaxBounds(PH_BOUNDS);
    map.fitBounds(PH_BOUNDS, { padding: [20, 20] });
  }, [map]);
  return null;
}

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
const crimeTypes = [
  "Theft","Robbery","Assault","Homicide","Illegal Fishing",
  "Smuggling","Drugs","Vandalism","Fraud","Others",
];

function AdminSuspectFormInner() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [submenuOpen, setSubmenuOpen] = useState(true);

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const suspectId = searchParams.get("id");         // EDIT MODE via ?id=
  const preselectCrime = searchParams.get("crime_report");

  const [crimes, setCrimes] = useState([]);
  const [loading, setLoading] = useState(!!suspectId);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [geoMsg, setGeoMsg] = useState("");

  const blank = {
    crime_report: preselectCrime || "",
    s_first_name: "",
    s_middle_name: "",
    s_last_name: "",
    s_age: "",
    s_crime_type: "",
    s_addr: {
      addressLine: "",
      regionCode: "", regionName: "",
      provinceCode: "", provinceName: "",
      cityMunCode: "", cityMunName: "", cityMunKind: "",
      barangayCode: "", barangayName: "",
    },
    loc_addr: {
      addressLine: "",
      regionCode: "", regionName: "",
      provinceCode: "", provinceName: "",
      cityMunCode: "", cityMunName: "", cityMunKind: "",
      barangayCode: "", barangayName: "",
    },
    latitude: "",
    longitude: "",
    loc_kind: "",
    loc_waterbody: "",
    s_photo_file: null,
    s_photo_preview: "",
    s_photo_existing: "",
  };
  const [form, setForm] = useState(blank);

  // load case list
  useEffect(() => {
    axios.get(`${API_BASE}/api/crimes/`, { params: { is_archived: false, ordering: "-created_at" }})
      .then(res => {
        const rows = Array.isArray(res.data) ? res.data : res.data.results;
        setCrimes(rows || []);
      })
      .catch((e) => {
        console.error("load crimes error", e?.response?.data || e.message);
        setCrimes([]);
      });
  }, []);

  // load suspect if editing
  useEffect(() => {
    if (!suspectId) { setLoading(false); return; }
    axios.get(`${API_BASE}/api/suspects/${suspectId}/`)
      .then(res => {
        const s = res.data || {};
        setForm({
          crime_report: s.crime_report || preselectCrime || "",
          s_first_name: s.s_first_name || "",
          s_middle_name: s.s_middle_name || "",
          s_last_name: s.s_last_name || "",
          s_age: s.s_age || "",
          s_crime_type: s.s_crime_type || "",

          s_addr: {
            addressLine: s.s_address || "",
            regionCode: s.s_region_code || "",
            regionName: s.s_region || "",
            provinceCode: s.s_province_code || "",
            provinceName: s.s_province || "",
            cityMunCode: s.s_city_mun_code || "",
            cityMunName: s.s_city_municipality || "",
            cityMunKind: s.s_city_mun_kind || "",
            barangayCode: s.s_barangay_code || "",
            barangayName: s.s_barangay || "",
          },

          loc_addr: {
            addressLine: s.loc_address || "",
            regionCode: s.loc_region_code || "",
            regionName: s.loc_region || "",
            provinceCode: s.loc_province_code || "",
            provinceName: s.loc_province || "",
            cityMunCode: s.loc_city_mun_code || "",
            cityMunName: s.loc_city_municipality || "",
            cityMunKind: s.loc_city_mun_kind || "",
            barangayCode: s.loc_barangay_code || "",
            barangayName: s.loc_barangay || "",
          },
          latitude: s.latitude || "",
          longitude: s.longitude || "",
          loc_kind: s.loc_kind || "",
          loc_waterbody: s.loc_waterbody || "",

          s_photo_file: null,
          s_photo_preview: "",
          s_photo_existing: s.s_photo_url || s.s_photo || "",
        });
      })
      .catch((e) => {
        console.error("load suspect error", e?.response?.data || e.message);
        setMessage("Failed to load suspect.");
      })
      .finally(() => setLoading(false));
  }, [suspectId, preselectCrime]);

  const appendAddr = (fd, prefix, a = {}) => {
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

  const onPickSuspectPhoto = (e) => {
    const file = e.target.files?.[0] || null;
    if (!file) {
      setForm((p) => ({ ...p, s_photo_file: null, s_photo_preview: "" }));
      return;
    }
    const url = URL.createObjectURL(file);
    setForm((p) => ({ ...p, s_photo_file: file, s_photo_preview: url }));
  };

  /* ================= PH-focused Geocoding (auto-fill lat/lng) ================= */
  const geoTimer = useRef(null);
  const latestGeoRun = useRef(0);

  const queryNominatim = async (paramsObj) => {
    try {
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
      const res = await fetch(url, { headers: { "Accept-Language": "en" } });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (e) {
      console.warn("Nominatim fetch error", e);
      return [];
    }
  };

  const geocodeLocation = async () => {
    const run = ++latestGeoRun.current;

    const { addressLine, barangayName, cityMunName, provinceName, regionName } =
      form.loc_addr || {};
    if (!(barangayName || cityMunName || provinceName || regionName || addressLine)) return;

    setGeoMsg("Finding coordinates…");

    try {
      let hit = null;

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
      if (!hit) {
        const data = await queryNominatim({
          city: [barangayName, cityMunName].filter(Boolean).join(", "),
          county: provinceName || "",
          state: regionName || "",
          country: "Philippines",
        });
        hit = data[0];
      }
      if (!hit) {
        const q = [addressLine, barangayName, cityMunName, provinceName, regionName, "Philippines"]
          .filter(Boolean).join(", ");
        const data = await queryNominatim({ q });
        hit = data[0];
      }
      if (!hit) {
        const q = [barangayName ? `${barangayName}` : "", cityMunName, provinceName, regionName, "Philippines"]
          .filter(Boolean).join(", ");
        const data = await queryNominatim({ q });
        hit = data[0];
      }
      if (!hit) {
        const q = [provinceName, regionName, "Philippines"].filter(Boolean).join(", ");
        const data = await queryNominatim({ q });
        hit = data[0];
      }

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
        setGeoMsg("No matches found. Please adjust address or drag the marker.");
      }
    } catch (e) {
      console.error("geocode error", e);
      setGeoMsg("Geocoding failed. Please adjust manually or drag the marker.");
    }
  };

  // Debounce geocode when Crime Location Address changes
  useEffect(() => {
    if (geoTimer.current) clearTimeout(geoTimer.current);

    const { addressLine, barangayName, cityMunName, provinceName, regionName } = form.loc_addr || {};
    const hasSome = addressLine || barangayName || cityMunName || provinceName || regionName;
    if (!hasSome) return;

    geoTimer.current = setTimeout(() => {
      geocodeLocation();
    }, 700);

    return () => {
      if (geoTimer.current) clearTimeout(geoTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    form.loc_addr?.addressLine,
    form.loc_addr?.barangayName,
    form.loc_addr?.cityMunName,
    form.loc_addr?.provinceName,
    form.loc_addr?.regionName,
  ]);

  /* ================= Submit ================= */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      if (!form.crime_report) {
        alert("Please select a Crime Report.");
        setSaving(false);
        return;
      }

      const fd = new FormData();
      fd.append("crime_report", form.crime_report);
      fd.append("s_first_name", form.s_first_name || "");
      fd.append("s_middle_name", form.s_middle_name || "");
      fd.append("s_last_name", form.s_last_name || "");
      fd.append("s_age", form.s_age || "");
      fd.append("s_crime_type", form.s_crime_type || "");
      appendAddr(fd, "s", form.s_addr);

      appendAddr(fd, "loc", form.loc_addr);
      fd.append("latitude", form.latitude || "");
      fd.append("longitude", form.longitude || "");
      fd.append("loc_kind", form.loc_kind || "");
      fd.append("loc_waterbody", form.loc_waterbody || "");

      if (form.s_photo_file) fd.append("s_photo", form.s_photo_file);

      if (suspectId) {
        await axios.patch(`${API_BASE}/api/suspects/${suspectId}/`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setMessage("Suspect updated.");
        navigate("/VictimeSupectTable");
      } else {
        await axios.post(`${API_BASE}/api/suspects/`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setMessage("Suspect saved.");
        setForm({ ...blank, crime_report: preselectCrime || "" });
        navigate("/VictimeSupectTable");
      }
    } catch (e2) {
      console.error("save suspect error", e2?.response?.data || e2.message);
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
        <div className="nav-title">Suspect Form</div>
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

        {/* Main Content (FORM ONLY) */}
        <main className="main-content">
          {loading ? (
            <p>Loading…</p>
          ) : (
            <form onSubmit={handleSubmit} className="crime-form">
              <h3 style={{ marginBottom: 12 }}>
                {suspectId ? "Edit Suspect" : "Create Suspect"}
              </h3>

              {message && <div className="alert" style={{ marginBottom: 12 }}>{message}</div>}

              <div className="input-group">
                <label>Attach to Crime Report <span className="required">*</span></label>
                <select
                  value={form.crime_report || ""}
                  onChange={(e) => setForm({ ...form, crime_report: e.target.value })}
                  required
                >
                  <option value="">Select case…</option>
                  {(crimes || []).map(cr => (
                    <option key={cr.id} value={cr.id}>
                      #{cr.id} — {cr.crime_type || "Incident"} ({cr.happened_at || "No date"})
                    </option>
                  ))}
                </select>
              </div>

              <div className="section">
                <h3>Suspect Details</h3>
                <div className="grid">
                  <div className="input-group">
                    <label>First Name</label>
                    <input
                      value={form.s_first_name || ""}
                      onChange={(e) => setForm({ ...form, s_first_name: e.target.value })}
                    />
                  </div>
                  <div className="input-group">
                    <label>Middle Name</label>
                    <input
                      value={form.s_middle_name || ""}
                      onChange={(e) => setForm({ ...form, s_middle_name: e.target.value })}
                    />
                  </div>
                  <div className="input-group">
                    <label>Last Name</label>
                    <input
                      value={form.s_last_name || ""}
                      onChange={(e) => setForm({ ...form, s_last_name: e.target.value })}
                    />
                  </div>
                  <div className="input-group">
                    <label>Age</label>
                    <input
                      type="number"
                      value={form.s_age || ""}
                      onChange={(e) => setForm({ ...form, s_age: e.target.value })}
                    />
                  </div>
                  <div className="input-group">
                    <label>Suspect Crime Type</label>
                    <select
                      value={form.s_crime_type || ""}
                      onChange={(e) => setForm({ ...form, s_crime_type: e.target.value })}
                    >
                      <option value="">Select</option>
                      {crimeTypes.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="input-group">
                    <label>Suspect Photo</label>
                    <input type="file" accept="image/*" onChange={onPickSuspectPhoto} />
                    {(form.s_photo_preview || form.s_photo_existing) && (
                      <div className="img-preview">
                        <img
                          src={form.s_photo_preview || form.s_photo_existing}
                          alt="Suspect"
                          style={{ maxWidth: 160, maxHeight: 160, borderRadius: 8, objectFit: "cover" }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <PhAddressPicker
                label="Suspect Address"
                value={form.s_addr}
                onChange={(next) => setForm((p) => ({ ...p, s_addr: next }))}
                withAddressLine
              />

              <PhAddressPicker
                label="Crime Location Address"
                value={form.loc_addr}
                onChange={(next) => setForm((p) => ({ ...p, loc_addr: next }))}
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
                    {geoMsg || "Tip: Fill the address above; coordinates will auto-fill (PH-bounded). You can also drag the marker."}
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
                    value={form.loc_kind || ""}
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
                    value={form.loc_waterbody || ""}
                    onChange={(e) => setForm({ ...form, loc_waterbody: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-actions">
                <button type="button" className="btn" onClick={() => navigate("/VictimeSupectTable")} disabled={saving}>
                  Back to Table
                </button>
                <button type="submit" className="submit-button" disabled={saving}>
                  <FontAwesomeIcon icon={faSave} /> {saving ? "Saving…" : (suspectId ? "Update Suspect" : "Save Suspect")}
                </button>
              </div>
            </form>
          )}
        </main>
      </div>
    </div>
  );
}

/* Wrap with ErrorBoundary to avoid white screen on unexpected errors */
export default function AdminSuspectForm() {
  return (
    <ErrorBoundary>
      <AdminSuspectFormInner />
    </ErrorBoundary>
  );
}
