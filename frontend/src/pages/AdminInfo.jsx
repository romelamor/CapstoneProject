import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faHome, faUser, faFileInvoice, faMapLocation,
  faChartLine, faBell, faRightFromBracket,
} from "@fortawesome/free-solid-svg-icons";
import "../assets/css/AdminInfo.css";

/* =========================================
   CONFIG
========================================= */
const API_BASE = "http://localhost:8000"; // change if needed

const toAbsoluteUrl = (urlOrPath) => {
  if (!urlOrPath) return "";
  try { return new URL(urlOrPath).href; } catch (_) {}
  const path = urlOrPath.startsWith("/") ? urlOrPath : `/${urlOrPath}`;
  return `${API_BASE}${path}`;
};

// try common server field names
const getProfileImageUrl = (p) => {
  const anyField =
    p.profile_image || p.id_image || p.image || p.photo || p.avatar || "";
  return anyField ? toAbsoluteUrl(anyField) : "";
};

/* =========================================
   Reusable PSGC Address Picker
========================================= */
function PhAddressPicker({ labelPrefix, value, onChange, requireAddressLine }) {
  const [regions, setRegions] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [cityMuns, setCityMuns] = useState([]);
  const [barangays, setBarangays] = useState([]);

  useEffect(() => {
    axios.get("https://psgc.cloud/api/regions")
      .then(res => setRegions(res.data || []))
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!value.regionCode) { setProvinces([]); return; }
    axios.get(`https://psgc.cloud/api/regions/${value.regionCode}/provinces`)
      .then(res => setProvinces(res.data || []))
      .catch(console.error);
  }, [value.regionCode]);

  useEffect(() => {
    if (!value.provinceCode) { setCityMuns([]); return; }
    axios.get(`https://psgc.cloud/api/provinces/${value.provinceCode}/cities-municipalities`)
      .then(res => setCityMuns(res.data || []))
      .catch(console.error);
  }, [value.provinceCode]);

  useEffect(() => {
    if (!value.cityMunCode || !value.cityMunKind) { setBarangays([]); return; }
    const base =
      value.cityMunKind === "city"
        ? `https://psgc.cloud/api/cities/${value.cityMunCode}/barangays`
        : `https://psgc.cloud/api/municipalities/${value.cityMunCode}/barangays`;
    axios.get(base)
      .then(res => setBarangays(res.data || []))
      .catch(console.error);
  }, [value.cityMunCode, value.cityMunKind]);

  const regionNameByCode = useMemo(
    () => Object.fromEntries(regions.map(r => [r.code, r.name])),
    [regions]
  );
  const provinceNameByCode = useMemo(
    () => Object.fromEntries(provinces.map(p => [p.code, p.name])),
    [provinces]
  );
  const cityMunMetaByCode = useMemo(
    () => Object.fromEntries(
      cityMuns.map(cm => {
        const kind = (cm.type || "").toLowerCase().includes("city") ? "city" : "municipality";
        return [cm.code, { name: cm.name, kind }];
      })
    ),
    [cityMuns]
  );
  const barangayNameByCode = useMemo(
    () => Object.fromEntries(barangays.map(b => [b.code, b.name])),
    [barangays]
  );

  const setRegion = (code) => {
    onChange({
      ...value,
      regionCode: code,
      regionName: regionNameByCode[code] || "",
      provinceCode: "", provinceName: "",
      cityMunCode: "", cityMunName: "", cityMunKind: "",
      barangayCode: "", barangayName: "",
    });
  };
  const setProvince = (code) => {
    onChange({
      ...value,
      provinceCode: code,
      provinceName: provinceNameByCode[code] || "",
      cityMunCode: "", cityMunName: "", cityMunKind: "",
      barangayCode: "", barangayName: "",
    });
  };
  const setCityMun = (code) => {
    const meta = cityMunMetaByCode[code] || { name: "", kind: "" };
    onChange({
      ...value,
      cityMunCode: code,
      cityMunName: meta.name,
      cityMunKind: meta.kind,
      barangayCode: "", barangayName: "",
    });
  };
  const setBarangay = (code) => {
    onChange({
      ...value,
      barangayCode: code,
      barangayName: barangayNameByCode[code] || "",
    });
  };

  return (
    <div className="section">
      <h3>{labelPrefix}</h3>

      {requireAddressLine && (
        <div className="input-group">
          <label>Lot, Block, Purok, Street, etc. <span className="required">*</span></label>
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
          <select
            value={value.regionCode || ""}
            onChange={(e) => setRegion(e.target.value)}
            required
          >
            <option value="">Select Region</option>
            {regions.map(r => <option key={r.code} value={r.code}>{r.name}</option>)}
          </select>
        </div>

        <div className="input-group">
          <label>Province <span className="required">*</span></label>
          <select
            value={value.provinceCode || ""}
            onChange={(e) => setProvince(e.target.value)}
            disabled={!value.regionCode}
            required
          >
            <option value="">Select Province</option>
            {provinces.map(p => <option key={p.code} value={p.code}>{p.name}</option>)}
          </select>
        </div>

        <div className="input-group">
          <label>City / Municipality <span className="required">*</span></label>
          <select
            value={value.cityMunCode || ""}
            onChange={(e) => setCityMun(e.target.value)}
            disabled={!value.provinceCode}
            required
          >
            <option value="">Select City/Municipality</option>
            {cityMuns.map(cm => {
              const kind = (cm.type || "").toLowerCase().includes("city") ? "City" : "Municipality";
              return <option key={cm.code} value={cm.code}>{cm.name} ({kind})</option>;
            })}
          </select>
        </div>

        <div className="input-group">
          <label>Barangay <span className="required">*</span></label>
          <select
            value={value.barangayCode || ""}
            onChange={(e) => setBarangay(e.target.value)}
            disabled={!value.cityMunCode}
            required
          >
            <option value="">Select Barangay</option>
            {barangays.map(b => <option key={b.code} value={b.code}>{b.name}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}

/* =========================================
   Main AdminInfo
========================================= */
function AdminInfo() {
  const officerTypeOptions = ["New officer", "Transferee", "Continuing officer"];
  const civilStatusOptions = ["Single", "Married", "Divorced", "Widowed"];
  const nationalityOptions = ["Filipino", "American", "Chinese", "Japanese", "Korean", "Others"];

  function convertDateFormat(dateStr) {
    if (!dateStr) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
    const parts = dateStr.split("/");
    if (parts.length !== 3) return "";
    const [month, day, year] = parts;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  // Sidebar/UI
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [submenuOpen, setSubmenuOpen] = useState(true);
  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
  const toggleSubmenu = () => setSubmenuOpen(!submenuOpen);
  const [activeSection, setActiveSection] = useState("personal");

  // Table data
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);

  // 🔎 Search
  const [searchTerm, setSearchTerm] = useState("");

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState(null);

  // NEW: View modal + edit toggle inside
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewEditing, setViewEditing] = useState(false);

  // Add vs Edit
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Image preview (for Add/Edit)
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);

  // NEW: preview inside view modal
  const [viewImagePreviewUrl, setViewImagePreviewUrl] = useState(null);

  // Lightbox viewer state
  const [imageViewer, setImageViewer] = useState({ open: false, url: "", alt: "" });
  const openImageViewer = (url, alt = "Profile image") => {
    if (!url) return;
    setImageViewer({ open: true, url, alt });
  };
  const closeImageViewer = () => setImageViewer({ open: false, url: "", alt: "" });

  useEffect(() => {
    if (!imageViewer.open) return;
    const onKey = (e) => { if (e.key === "Escape") closeImageViewer(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [imageViewer.open]);

  // Form
  const blankForm = {
    firstName: "", middleName: "", lastName: "", suffix: "",
    badge_number: "", email: "", phone: "",
    department: "", section: "", sex: "", gender: "",
    height: "", weight: "", birthDate: "", birthPlace: "",
    officerType: "", regularofficer: "", civilStatus: "", nationality: "", religion: "",
    lifelongLearner: false, indigenous: false, pwd: false,

    // Officer residential address
    resAddr: {
      addressLine: "",
      regionCode: "", regionName: "",
      provinceCode: "", provinceName: "",
      cityMunCode: "", cityMunName: "", cityMunKind: "",
      barangayCode: "", barangayName: "",
    },
    // Officer permanent address
    permAddr: {
      addressLine: "",
      regionCode: "", regionName: "",
      provinceCode: "", provinceName: "",
      cityMunCode: "", cityMunName: "", cityMunKind: "",
      barangayCode: "", barangayName: "",
    },

    // Mother
    motherFirstName: "", motherMiddleName: "", motherLastName: "",
    motherOccupation: "", motherDOB: "", motherContact: "",
    motherAddr: {
      regionCode: "", regionName: "",
      provinceCode: "", provinceName: "",
      cityMunCode: "", cityMunName: "", cityMunKind: "",
      barangayCode: "", barangayName: "",
    },

    // Father
    fatherFirstName: "", fatherMiddleName: "", fatherLastName: "",
    fatherOccupation: "", fatherDOB: "", fatherContact: "",
    fatherAddr: {
      regionCode: "", regionName: "",
      provinceCode: "", provinceName: "",
      cityMunCode: "", cityMunName: "", cityMunKind: "",
      barangayCode: "", barangayName: "",
    },

    id_image: null,
  };

  const [formData, setFormData] = useState(blankForm);
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // Update image preview whenever a new file is chosen
  useEffect(() => {
    if (formData.id_image instanceof File) {
      const objectUrl = URL.createObjectURL(formData.id_image);
      setImagePreviewUrl(objectUrl);
      setViewImagePreviewUrl(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    } else {
      setImagePreviewUrl(null);
      setViewImagePreviewUrl(null);
    }
  }, [formData.id_image]);

  useEffect(() => { fetchProfiles(); }, []);
  // >>> REPLACE the whole fetchProfiles with this <<<
  const fetchProfiles = async () => {
    try {
      // try server-side ordering + filter (Django/DRF style)
      const res = await axios.get(`${API_BASE}/api/personnel/`, {
        params: {
          is_archived: false,
          ordering: "-created_at",
        },
      });

      const raw = Array.isArray(res.data) ? res.data : res.data.results;

      const notArchived = (raw || []).filter(
        (p) => !(p.is_archived === true || p.archived === true)
      );

      const ordered = [...notArchived].sort((a, b) => {
        const da = a.created_at ? new Date(a.created_at).getTime() : 0;
        const db = b.created_at ? new Date(b.created_at).getTime() : 0;
        if (db !== da) return db - da;
        const ida = Number(a.id) || 0;
        const idb = Number(b.id) || 0;
        return idb - ida;
      });

      setProfiles(ordered);
    } catch (e) {
      console.error("Error fetching profiles", e);
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked, files } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : type === "file" ? files[0] : value,
    }));
  };

  // Address change helpers (immutable updates)
  const setResAddr = (next) => setFormData((p) => ({ ...p, resAddr: next }));
  const setPermAddr = (next) => setFormData((p) => ({ ...p, permAddr: next }));
  const setMotherAddr = (next) => setFormData((p) => ({ ...p, motherAddr: next }));
  const setFatherAddr = (next) => setFormData((p) => ({ ...p, fatherAddr: next }));

  const openAddModal = () => {
    setIsEditing(false);
    setEditingId(null);
    setSelectedProfile(null);
    setFormData(blankForm);
    setImagePreviewUrl(null);
    setActiveSection("personal");
    setShowAddModal(true);
  };

  const handleEditClick = (p) => {
    // (kept for compatibility; not used from table anymore)
    setSelectedProfile(p);
    setIsEditing(true);
    setEditingId(p.id);
    setImagePreviewUrl(null);

    setFormData({
      ...blankForm,
      firstName: p.first_name || "", middleName: p.middle_name || "", lastName: p.last_name || "",
      suffix: p.suffix || "", badge_number: p.officer_id || "", email: p.email || "", phone: p.phone || "",
      department: p.department || "", section: p.section || "", sex: p.sex || "", gender: p.gender || "",
      height: p.height || "", weight: p.weight || "", birthDate: p.birth_date || "", birthPlace: p.birth_place || "",
      officerType: p.officer_type || "", regularofficer: p.regular_officer || "",
      civilStatus: p.civil_status || "", nationality: p.nationality || "", religion: p.religion || "",
      lifelongLearner: !!p.lifelong_learner, indigenous: !!p.indigenous, pwd: !!p.pwd,

      resAddr: {
        addressLine: p.residential_address_line || p.residential_address || "",
        regionCode: p.residential_region_code || "",
        regionName: p.residential_region || "",
        provinceCode: p.residential_province_code || "",
        provinceName: p.residential_province || "",
        cityMunCode: p.residential_city_mun_code || "",
        cityMunName: p.residential_municipality || p.residential_city || p.residential_city_municipality || "",
        cityMunKind: p.residential_city_mun_kind || "",
        barangayCode: p.residential_barangay_code || "",
        barangayName: p.residential_barangay || "",
      },
      permAddr: {
        addressLine: p.permanent_address_line || p.permanent_address || "",
        regionCode: p.permanent_region_code || "",
        regionName: p.permanent_region || "",
        provinceCode: p.permanent_province_code || "",
        provinceName: p.permanent_province || "",
        cityMunCode: p.permanent_city_mun_code || "",
        cityMunName: p.permanent_municipality || p.permanent_city || p.permanent_city_municipality || "",
        cityMunKind: p.permanent_city_mun_kind || "",
        barangayCode: p.permanent_barangay_code || "",
        barangayName: p.permanent_barangay || "",
      },

      motherFirstName: p.mother_first_name || "",
      motherMiddleName: p.mother_middle_name || "",
      motherLastName: p.mother_last_name || "",
      motherOccupation: p.mother_occupation || "",
      motherDOB: p.mother_dob || "",
      motherContact: p.mother_contact || "",
      motherAddr: {
        regionCode: p.mother_region_code || "",
        regionName: p.mother_region || "",
        provinceCode: p.mother_province_code || "",
        provinceName: p.mother_province || "",
        cityMunCode: p.mother_city_mun_code || "",
        cityMunName: p.mother_municipality || p.mother_city || p.mother_city_municipality || "",
        cityMunKind: p.mother_city_mun_kind || "",
        barangayCode: p.mother_barangay_code || "",
        barangayName: p.mother_barangay || "",
      },

      fatherFirstName: p.father_first_name || "",
      fatherMiddleName: p.father_middle_name || "",
      fatherLastName: p.father_last_name || "",
      fatherOccupation: p.father_occupation || "",
      fatherDOB: p.father_dob || "",
      fatherContact: p.father_contact || "",
      fatherAddr: {
        regionCode: p.father_region_code || "",
        regionName: p.father_region || "",
        provinceCode: p.father_province_code || "",
        provinceName: p.father_province || "",
        cityMunCode: p.father_city_mun_code || "",
        cityMunName: p.father_municipality || p.father_city || p.father_city_municipality || "",
        cityMunKind: p.father_city_mun_kind || "",
        barangayCode: p.father_barangay_code || "",
        barangayName: p.father_barangay || "",
      },

      id_image: null,
    });

    setActiveSection("personal");
    setShowEditModal(true);
  };

  // NEW: open View modal (read-only initially)
  const openViewModal = (p) => {
    setSelectedProfile(p);
    setIsEditing(false);
    setEditingId(p.id);
    setViewEditing(false);
    setImagePreviewUrl(null);
    setViewImagePreviewUrl(null);

    setFormData({
      ...blankForm,
      firstName: p.first_name || "", middleName: p.middle_name || "", lastName: p.last_name || "",
      suffix: p.suffix || "", badge_number: p.officer_id || "", email: p.email || "", phone: p.phone || "",
      department: p.department || "", section: p.section || "", sex: p.sex || "", gender: p.gender || "",
      height: p.height || "", weight: p.weight || "", birthDate: p.birth_date || "", birthPlace: p.birth_place || "",
      officerType: p.officer_type || "", regularofficer: p.regular_officer || "",
      civilStatus: p.civil_status || "", nationality: p.nationality || "", religion: p.religion || "",
      lifelongLearner: !!p.lifelong_learner, indigenous: !!p.indigenous, pwd: !!p.pwd,

      resAddr: {
        addressLine: p.residential_address_line || p.residential_address || "",
        regionCode: p.residential_region_code || "",
        regionName: p.residential_region || "",
        provinceCode: p.residential_province_code || "",
        provinceName: p.residential_province || "",
        cityMunCode: p.residential_city_mun_code || "",
        cityMunName: p.residential_municipality || p.residential_city || p.residential_city_municipality || "",
        cityMunKind: p.residential_city_mun_kind || "",
        barangayCode: p.residential_barangay_code || "",
        barangayName: p.residential_barangay || "",
      },
      permAddr: {
        addressLine: p.permanent_address_line || p.permanent_address || "",
        regionCode: p.permanent_region_code || "",
        regionName: p.permanent_region || "",
        provinceCode: p.permanent_province_code || "",
        provinceName: p.permanent_province || "",
        cityMunCode: p.permanent_city_mun_code || "",
        cityMunName: p.permanent_municipality || p.permanent_city || p.permanent_city_municipality || "",
        cityMunKind: p.permanent_city_mun_kind || "",
        barangayCode: p.permanent_barangay_code || "",
        barangayName: p.permanent_barangay || "",
      },

      motherFirstName: p.mother_first_name || "",
      motherMiddleName: p.mother_middle_name || "",
      motherLastName: p.mother_last_name || "",
      motherOccupation: p.mother_occupation || "",
      motherDOB: p.mother_dob || "",
      motherContact: p.mother_contact || "",
      motherAddr: {
        regionCode: p.mother_region_code || "",
        regionName: p.mother_region || "",
        provinceCode: p.mother_province_code || "",
        provinceName: p.mother_province || "",
        cityMunCode: p.mother_city_mun_code || "",
        cityMunName: p.mother_municipality || p.mother_city || p.mother_city_municipality || "",
        cityMunKind: p.mother_city_mun_kind || "",
        barangayCode: p.mother_barangay_code || "",
        barangayName: p.mother_barangay || "",
      },

      fatherFirstName: p.father_first_name || "",
      fatherMiddleName: p.father_middle_name || "",
      fatherLastName: p.father_last_name || "",
      fatherOccupation: p.father_occupation || "",
      fatherDOB: p.father_dob || "",
      fatherContact: p.father_contact || "",
      fatherAddr: {
        regionCode: p.father_region_code || "",
        regionName: p.father_region || "",
        provinceCode: p.father_province_code || "",
        provinceName: p.father_province || "",
        cityMunCode: p.father_city_mun_code || "",
        cityMunName: p.father_municipality || p.father_city || p.father_city_municipality || "",
        cityMunKind: p.father_city_mun_kind || "",
        barangayCode: p.father_barangay_code || "",
        barangayName: p.father_barangay || "",
      },

      id_image: null,
    });

    setActiveSection("personal");
    setShowViewModal(true);
  };

  const handleArchive = async (id) => {
    if (!window.confirm("Are you sure you want to archive this profile?")) return;
    try {
      await axios.post(`${API_BASE}/api/personnel/${id}/archive/`);
      setProfiles((prev) => prev.filter((x) => x.id !== id));
    } catch (e) {
      console.error("Archive failed:", e?.response?.data || e.message);
    }
  };

  const appendAddr = (fd, prefix, addr) => {
    fd.append(`${prefix}_region`, addr.regionName || "");
    fd.append(`${prefix}_province`, addr.provinceName || "");
    fd.append(`${prefix}_city_municipality`, addr.cityMunName || "");
    fd.append(`${prefix}_city_mun_kind`, addr.cityMunKind || "");
    fd.append(`${prefix}_barangay`, addr.barangayName || "");
    if (addr.addressLine !== undefined) {
      fd.append(`${prefix}_address`, addr.addressLine || "");
    }

    fd.append(`${prefix}_region_code`, addr.regionCode || "");
    fd.append(`${prefix}_province_code`, addr.provinceCode || "");
    fd.append(`${prefix}_city_mun_code`, addr.cityMunCode || "");
    fd.append(`${prefix}_barangay_code`, addr.barangayCode || "");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setSuccessMessage("");

    try {
      const fd = new FormData();

      // Basic
      fd.append("first_name", formData.firstName);
      fd.append("middle_name", formData.middleName);
      fd.append("last_name", formData.lastName);
      fd.append("suffix", formData.suffix);
      fd.append("officer_id", formData.badge_number || "");
      fd.append("email", formData.email);
      fd.append("phone", formData.phone);

      // Personnel
      fd.append("department", formData.department);
      fd.append("section", formData.section);
      fd.append("sex", formData.sex);
      fd.append("gender", formData.gender);
      fd.append("height", formData.height);
      fd.append("weight", formData.weight);
      fd.append("birth_date", convertDateFormat(formData.birthDate));
      fd.append("birth_place", formData.birthPlace);
      fd.append("officer_type", formData.officerType);
      fd.append("regular_officer", formData.regularofficer);
      fd.append("civil_status", formData.civilStatus);
      fd.append("nationality", formData.nationality);
      fd.append("religion", formData.religion);

      // Flags
      fd.append("lifelong_learner", String(formData.lifelongLearner));
      fd.append("indigenous", String(formData.indigenous));
      fd.append("pwd", String(formData.pwd));

      // Addresses
      appendAddr(fd, "residential", formData.resAddr);
      appendAddr(fd, "permanent", formData.permAddr);
      appendAddr(fd, "mother", formData.motherAddr);
      appendAddr(fd, "father", formData.fatherAddr);

      // File
      if (formData.id_image) fd.append("id_image", formData.id_image);

      // Mother/Father basic info
      fd.append("mother_first_name", formData.motherFirstName);
      fd.append("mother_middle_name", formData.motherMiddleName);
      fd.append("mother_last_name", formData.motherLastName);
      fd.append("mother_occupation", formData.motherOccupation);
      fd.append("mother_dob", convertDateFormat(formData.motherDOB));
      fd.append("mother_contact", formData.motherContact);

      fd.append("father_first_name", formData.fatherFirstName);
      fd.append("father_middle_name", formData.fatherMiddleName);
      fd.append("father_last_name", formData.fatherLastName);
      fd.append("father_occupation", formData.fatherOccupation);
      fd.append("father_dob", convertDateFormat(formData.fatherDOB));
      fd.append("father_contact", formData.fatherContact);

      // decide if PATCH or POST (also true when editing inside VIEW)
      let resp;
      const doPatch = (isEditing && editingId) || (viewEditing && editingId);

      if (doPatch) {
        resp = await axios.patch(`${API_BASE}/api/personnel/${editingId}/`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      } else {
        resp = await axios.post(`${API_BASE}/api/personnel/`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }

      const saved = resp.data;
      if (doPatch) {
        setProfiles((prev) => prev.map((x) => (x.id === editingId ? { ...x, ...saved } : x)));
        setSuccessMessage("Profile updated successfully!");
        if (showViewModal) {
          setViewEditing(false);
          setSelectedProfile((prev) => ({ ...(prev || {}), ...saved }));
          setViewImagePreviewUrl(null);
        } else {
          setShowEditModal(false);
          setIsEditing(false);
          setEditingId(null);
          setSelectedProfile(null);
          setImagePreviewUrl(null);
        }
      } else {
        setProfiles((prev) => [saved, ...prev]);
        setShowAddModal(false);
        setImagePreviewUrl(null);
        setSuccessMessage("Profile added successfully!");
      }
    } catch (err) {
      console.error(err);
      setSuccessMessage("Error saving data!");
    } finally {
      setIsLoading(false);
      setTimeout(() => setSuccessMessage(""), 3000);
    }
  };

  // 🔎 Filtered rows for the table
  const filteredProfiles = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return profiles;
    const inText = (...vals) => vals.some(v => (v || "").toString().toLowerCase().includes(q));
    return profiles.filter(p =>
      inText(
        p.first_name, p.middle_name, p.last_name,
        p.officer_id, p.email, p.officer_type
      )
    );
  }, [profiles, searchTerm]);

  return (
    <div>
      {/* Top Navigation */}
      <div className="topnav">
        <div className="menu-icon" onClick={toggleSidebar}>☰</div>
        <div className="nav-title">Dashboard</div>
      </div>

      {!sidebarOpen && <div className="overlay" onClick={toggleSidebar}></div>}

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
              <div
                className="submenu-toggle"
                onClick={() => setSubmenuOpen((s) => !s)}
              >
                <FontAwesomeIcon icon={faFileInvoice} /> Incident Reports
              </div>
              {submenuOpen && (
                <ul className="submenu">
                  <li><Link to="/VictimeSupectTable">View Reports</Link></li>
                  <Link to="/AdminCrime">Victim Report</Link>
                  <li><Link to="/AdminSuspect">Suspect Report</Link></li>
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
          <div className="admin-profile-container">
            <div className="header-section">
              <h1>Admin Profile Information</h1>

              {/* 🔎 SEARCH BAR */}
              <div className="table-actions">
                <input
                  type="text"
                  className="table-search"
                  placeholder="Search name, badge #, email, designation…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <button className="add-btn" onClick={openAddModal}>+ Add Profile</button>
              </div>
            </div>

            {loading ? (
              <p>Loading profiles...</p>
            ) : (
              <>
                <p className="table-hint">
                  Showing {filteredProfiles.length} of {profiles.length}
                </p>
                <table className="profile-table">
                  <thead>
                    <tr>
                      <th>Profile Image</th>
                      <th>First Name</th>
                      <th>Middle Name</th>
                      <th>Last Name</th>
                      <th>Badge #</th>
                      <th>Email</th>
                      <th>Designation</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProfiles.map((p) => {
                      const imgUrl = getProfileImageUrl(p);
                      const fullName = [p.first_name, p.middle_name, p.last_name].filter(Boolean).join(" ");
                      return (
                        <tr key={p.id}>
                          <td>
                            {imgUrl ? (
                              <img
                                src={imgUrl}
                                alt={`${fullName || "Profile"} photo`}
                                className="profile-pic clickable"
                                onClick={() => openImageViewer(imgUrl, fullName || "Profile photo")}
                              />
                            ) : (
                              <div className="profile-pic placeholder">No Image</div>
                            )}
                          </td>
                          <td>{p.first_name}</td>
                          <td>{p.middle_name || "-"}</td>
                          <td>{p.last_name}</td>
                          <td>{p.officer_id}</td>
                          <td>{p.email}</td>
                          <td>{p.officer_type}</td>
                          <td>
                            {/* CHANGED: View button (Edit is inside View modal) */}
                            <button className="edit-btn" onClick={() => openViewModal(p)}>👁 View</button>
                            <button className="archive-btn" onClick={() => handleArchive(p.id)}>🗑 Archive</button>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredProfiles.length === 0 && (
                      <tr>
                        <td colSpan="8" style={{ textAlign: "center", opacity: 0.7 }}>
                          No results found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </>
            )}

            {/* ADD MODAL */}
            {showAddModal && (
              <div className="overlay">
                <div className="modal">
                  <form className="form" onSubmit={handleSubmit}>
                    <div className="overlay-wrapper">
                      {/* Tabs */}
                      <div className="form-tabs">
                        <div className="tab-buttons">
                          <button type="button" className={activeSection === "personal" ? "tab-btn active" : "tab-btn"} onClick={() => setActiveSection("personal")}>Personal Information</button>
                          <button type="button" className={activeSection === "family" ? "tab-btn active" : "tab-btn"} onClick={() => setActiveSection("family")}>Family Background</button>
                        </div>
                      </div>

                      {/* Personal */}
                      {activeSection === "personal" && (
                        <div className="form-section show">
                          <h1>Personal Information</h1>

                          {/* Image preview */}
                          <div className="image-preview-wrap">
                            <div className="input-group">
                              <label>Profile Image <span className="required">*</span></label>
                              <input type="file" name="id_image" accept="image/*" onChange={handleChange} required />
                            </div>
                            <div className="image-preview">
                              {imagePreviewUrl ? (
                                <img
                                  src={imagePreviewUrl}
                                  alt="Preview"
                                  className="clickable"
                                  onClick={() => openImageViewer(imagePreviewUrl, "Preview")}
                                />
                              ) : (
                                <div className="image-placeholder">Image preview will appear here</div>
                              )}
                            </div>
                          </div>

                          <div className="grid">
                            <div className="input-group">
                              <label>First Name <span className="required">*</span></label>
                              <input name="firstName" value={formData.firstName} onChange={handleChange} required />
                            </div>
                            <div className="input-group">
                              <label>Middle Name</label>
                              <input name="middleName" value={formData.middleName} onChange={handleChange} />
                            </div>
                            <div className="input-group">
                              <label>Last Name <span className="required">*</span></label>
                              <input name="lastName" value={formData.lastName} onChange={handleChange} required />
                            </div>
                            <div className="input-group">
                              <label>Suffix</label>
                              <input name="suffix" value={formData.suffix} onChange={handleChange} placeholder="Jr., Sr., III, etc." />
                            </div>
                            <div className="input-group">
                              <label>Badge Number <span className="required">*</span></label>
                              <input name="badge_number" value={formData.badge_number} onChange={handleChange} required />
                            </div>
                            <div className="input-group">
                              <label>Email Address <span className="required">*</span></label>
                              <input type="email" name="email" value={formData.email} onChange={handleChange} required />
                            </div>
                            <div className="input-group">
                              <label>Phone Number <span className="required">*</span></label>
                              <input name="phone" value={formData.phone} onChange={handleChange} required />
                            </div>
                            <div className="input-group">
                              <label>Place of Birth <span className="required">*</span></label>
                              <input name="birthPlace" value={formData.birthPlace} onChange={handleChange} required />
                            </div>
                            <div className="input-group">
                              <label>Designation <span className="required">*</span></label>
                              <select name="officerType" value={formData.officerType} onChange={handleChange} required>
                                <option value="">Select officer Type</option>
                                {officerTypeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                              </select>
                            </div>
                            <div className="input-group">
                              <label>Sex / Gender <span className="required">*</span></label>
                              <div className="radio-group">
                                {["Male","Female","Other"].map(g => (
                                  <label key={g}>
                                    <input type="radio" name="gender" value={g} checked={formData.gender === g} onChange={handleChange} required={g==="Male"} />
                                    {g}
                                  </label>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="section">
                            <h3>ℹ️ Additional Information</h3>
                            <div className="grid">
                              <div className="input-group">
                                <label>Civil Status <span className="required">*</span></label>
                                <select name="civilStatus" value={formData.civilStatus} onChange={handleChange} required>
                                  <option value="">Select Civil Status</option>
                                  {civilStatusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                              </div>
                              <div className="input-group">
                                <label>Nationality <span className="required">*</span></label>
                                <select name="nationality" value={formData.nationality} onChange={handleChange} required>
                                  <option value="">Select Nationality</option>
                                  {nationalityOptions.map(n => <option key={n} value={n}>{n}</option>)}
                                </select>
                              </div>
                              <div className="input-group">
                                <label>Religion <span className="required">*</span></label>
                                <input name="religion" value={formData.religion} onChange={handleChange} required />
                              </div>
                              <div className="checkbox-group">
                                {[
                                  { name: "indigenous", label: "🏔️ Part of Indigenous Group?" },
                                  { name: "pwd", label: "♿ Person with Disability?" },
                                ].map(x => (
                                  <label key={x.name} className={`checkbox-label ${formData[x.name] ? "checked" : ""}`}>
                                    <input type="checkbox" name={x.name} checked={formData[x.name]} onChange={handleChange} />
                                    {x.label}
                                  </label>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* OFFICER ADDRESSES */}
                          <PhAddressPicker
                            labelPrefix="🏠 Residential Address"
                            value={formData.resAddr}
                            onChange={setResAddr}
                            requireAddressLine
                          />
                          <PhAddressPicker
                            labelPrefix="🏷️ Permanent Address"
                            value={formData.permAddr}
                            onChange={setPermAddr}
                            requireAddressLine
                          />
                        </div>
                      )}

                      {/* Family */}
                      {activeSection === "family" && (
                        <div className="form-section show">
                          <h1>Family Background</h1>

                          {/* MOTHER */}
                          <h3>Mother's Background</h3>
                          <div className="grid">
                            <div className="input-group"><label>First Name</label><input name="motherFirstName" value={formData.motherFirstName} onChange={handleChange} /></div>
                            <div className="input-group"><label>Middle Name</label><input name="motherMiddleName" value={formData.motherMiddleName} onChange={handleChange} /></div>
                            <div className="input-group"><label>Last Name</label><input name="motherLastName" value={formData.motherLastName} onChange={handleChange} /></div>
                            <div className="input-group">
                              <label>Occupation</label>
                              <select name="motherOccupation" value={formData.motherOccupation} onChange={handleChange}>
                                <option value="">Select occupation</option>
                                {["Housewife","Employed","Self-Employed","OFW"].map(o => <option key={o} value={o}>{o}</option>)}
                              </select>
                            </div>
                            <div className="input-group"><label>Date of Birth</label><input type="date" name="motherDOB" value={formData.motherDOB} onChange={handleChange} /></div>
                            <div className="input-group"><label>Contact Number</label><input name="motherContact" value={formData.motherContact} onChange={handleChange} /></div>
                          </div>
                          <PhAddressPicker
                            labelPrefix="Mother's Address"
                            value={formData.motherAddr}
                            onChange={setMotherAddr}
                          />

                          {/* FATHER */}
                          <h3>Father's Background</h3>
                          <div className="grid">
                            <div className="input-group"><label>First Name</label><input name="fatherFirstName" value={formData.fatherFirstName} onChange={handleChange} /></div>
                            <div className="input-group"><label>Middle Name</label><input name="fatherMiddleName" value={formData.fatherMiddleName} onChange={handleChange} /></div>
                            <div className="input-group"><label>Last Name</label><input name="fatherLastName" value={formData.fatherLastName} onChange={handleChange} /></div>
                            <div className="input-group">
                              <label>Occupation</label>
                              <select name="fatherOccupation" value={formData.fatherOccupation} onChange={handleChange}>
                                <option value="">Select occupation</option>
                                {["Employed","Self-Employed","OFW"].map(o => <option key={o} value={o}>{o}</option>)}
                              </select>
                            </div>
                            <div className="input-group"><label>Date of Birth</label><input type="date" name="fatherDOB" value={formData.fatherDOB} onChange={handleChange} /></div>
                            <div className="input-group"><label>Contact Number</label><input name="fatherContact" value={formData.fatherContact} onChange={handleChange} /></div>
                          </div>
                          <PhAddressPicker
                            labelPrefix="Father's Address"
                            value={formData.fatherAddr}
                            onChange={setFatherAddr}
                          />
                        </div>
                      )}
                    </div>

                    <button type="submit" className="submit-button" disabled={isLoading}>
                      {isLoading ? <>⏳ Saving Changes...</> : <>💾 Save Changes</>}
                    </button>
                    {successMessage && <p className="success-message">{successMessage}</p>}
                    <button type="button" onClick={() => setShowAddModal(false)}>Cancel</button>
                  </form>
                </div>
              </div>
            )}

            {/* EDIT MODAL (kept; not used from table anymore) */}
            {showEditModal && selectedProfile && (
              <div className="overlay">
                <div className="modal">
                  <h2>Edit Profile</h2>
                  <form className="form" onSubmit={handleSubmit}>
                    <div className="overlay-wrapper">
                      <div className="form-tabs">
                        <div className="tab-buttons">
                          <button type="button" className={activeSection === "personal" ? "tab-btn active" : "tab-btn"} onClick={() => setActiveSection("personal")}>Personal Information</button>
                          <button type="button" className={activeSection === "family" ? "tab-btn active" : "tab-btn"} onClick={() => setActiveSection("family")}>Family Background</button>
                        </div>
                      </div>

                      {activeSection === "personal" && (
                        <div className="form-section show">
                          <h1>Personal Information</h1>

                          {/* Image preview: show existing image OR new selection */}
                          <div className="image-preview-wrap">
                            <div className="input-group">
                              <label>Profile Image</label>
                              <input type="file" name="id_image" accept="image/*" onChange={handleChange} />
                            </div>
                            <div className="image-preview">
                              {imagePreviewUrl ? (
                                <img
                                  src={imagePreviewUrl}
                                  alt="Preview"
                                  className="clickable"
                                  onClick={() => openImageViewer(imagePreviewUrl, "Preview")}
                                />
                              ) : getProfileImageUrl(selectedProfile) ? (
                                <img
                                  src={getProfileImageUrl(selectedProfile)}
                                  alt="Current"
                                  className="clickable"
                                  onClick={() => openImageViewer(getProfileImageUrl(selectedProfile), "Current photo")}
                                />
                              ) : (
                                <div className="image-placeholder">No current image</div>
                              )}
                            </div>
                          </div>

                          <div className="grid">
                            <div className="input-group"><label>First Name <span className="required">*</span></label><input name="firstName" value={formData.firstName} onChange={handleChange} required /></div>
                            <div className="input-group"><label>Middle Name</label><input name="middleName" value={formData.middleName} onChange={handleChange} /></div>
                            <div className="input-group"><label>Last Name <span className="required">*</span></label><input name="lastName" value={formData.lastName} onChange={handleChange} required /></div>
                            <div className="input-group"><label>Suffix</label><input name="suffix" value={formData.suffix} onChange={handleChange} placeholder="Jr., Sr., III, etc." /></div>
                            <div className="input-group"><label>Badge Number <span className="required">*</span></label><input name="badge_number" value={formData.badge_number} onChange={handleChange} required /></div>
                            <div className="input-group"><label>Email Address <span className="required">*</span></label><input type="email" name="email" value={formData.email} onChange={handleChange} required /></div>
                            <div className="input-group"><label>Phone Number <span className="required">*</span></label><input name="phone" value={formData.phone} onChange={handleChange} required /></div>
                            <div className="input-group"><label>Place of Birth <span className="required">*</span></label><input name="birthPlace" value={formData.birthPlace} onChange={handleChange} required /></div>
                            <div className="input-group">
                              <label>Designation <span className="required">*</span></label>
                              <select name="officerType" value={formData.officerType} onChange={handleChange} required>
                                <option value="">Select officer Type</option>
                                {officerTypeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                              </select>
                            </div>
                            <div className="input-group">
                              <label>Sex / Gender <span className="required">*</span></label>
                              <div className="radio-group">
                                {["Male","Female","Other"].map(g => (
                                  <label key={g}>
                                    <input type="radio" name="gender" value={g} checked={formData.gender === g} onChange={handleChange} required={g==="Male"} />{g}
                                  </label>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="section">
                            <h3>ℹ️ Additional Information</h3>
                            <div className="grid">
                              <div className="input-group"><label>Civil Status <span className="required">*</span></label>
                                <select name="civilStatus" value={formData.civilStatus} onChange={handleChange} required>
                                  <option value="">Select Civil Status</option>
                                  {civilStatusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                              </div>
                              <div className="input-group"><label>Nationality <span className="required">*</span></label>
                                <select name="nationality" value={formData.nationality} onChange={handleChange} required>
                                  <option value="">Select Nationality</option>
                                  {nationalityOptions.map(n => <option key={n} value={n}>{n}</option>)}
                                </select>
                              </div>
                              <div className="input-group"><label>Religion <span className="required">*</span></label><input name="religion" value={formData.religion} onChange={handleChange} required /></div>
                              <div className="checkbox-group">
                                {[
                                  { name: "indigenous", label: "🏔️ Part of Indigenous Group?" },
                                  { name: "pwd", label: "♿ Person with Disability?" },
                                ].map(x => (
                                  <label key={x.name} className={`checkbox-label ${formData[x.name] ? "checked" : ""}`}>
                                    <input type="checkbox" name={x.name} checked={formData[x.name]} onChange={handleChange} />
                                    {x.label}
                                  </label>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* OFFICER ADDRESSES */}
                          <PhAddressPicker labelPrefix="🏠 Residential Address" value={formData.resAddr} onChange={setResAddr} requireAddressLine />
                          <PhAddressPicker labelPrefix="🏷️ Permanent Address" value={formData.permAddr} onChange={setPermAddr} requireAddressLine />
                        </div>
                      )}

                      {activeSection === "family" && (
                        <div className="form-section show">
                          <h1>Family Background</h1>
                          <h3>Mother's Background</h3>
                          <div className="grid">
                            <div className="input-group"><label>First Name</label><input name="motherFirstName" value={formData.motherFirstName} onChange={handleChange} /></div>
                            <div className="input-group"><label>Middle Name</label><input name="motherMiddleName" value={formData.motherMiddleName} onChange={handleChange} /></div>
                            <div className="input-group"><label>Last Name</label><input name="motherLastName" value={formData.motherLastName} onChange={handleChange} /></div>
                            <div className="input-group">
                              <label>Occupation</label>
                              <select name="motherOccupation" value={formData.motherOccupation} onChange={handleChange}>
                                <option value="">Select occupation</option>
                                {["Housewife","Employed","Self-Employed","OFW"].map(o => <option key={o} value={o}>{o}</option>)}
                              </select>
                            </div>
                            <div className="input-group"><label>Date of Birth</label><input type="date" name="motherDOB" value={formData.motherDOB} onChange={handleChange} /></div>
                            <div className="input-group"><label>Contact Number</label><input name="motherContact" value={formData.motherContact} onChange={handleChange} /></div>
                          </div>
                          <PhAddressPicker labelPrefix="Mother's Address" value={formData.motherAddr} onChange={setMotherAddr} />

                          <h3>Father's Background</h3>
                          <div className="grid">
                            <div className="input-group"><label>First Name</label><input name="fatherFirstName" value={formData.fatherFirstName} onChange={handleChange} /></div>
                            <div className="input-group"><label>Middle Name</label><input name="fatherMiddleName" value={formData.fatherMiddleName} onChange={handleChange} /></div>
                            <div className="input-group"><label>Last Name</label><input name="fatherLastName" value={formData.fatherLastName} onChange={handleChange} /></div>
                            <div className="input-group">
                              <label>Occupation</label>
                              <select name="fatherOccupation" value={formData.fatherOccupation} onChange={handleChange}>
                                <option value="">Select occupation</option>
                                {["Employed","Self-Employed","OFW"].map(o => <option key={o} value={o}>{o}</option>)}
                              </select>
                            </div>
                            <div className="input-group"><label>Date of Birth</label><input type="date" name="fatherDOB" value={formData.fatherDOB} onChange={handleChange} /></div>
                            <div className="input-group"><label>Contact Number</label><input name="fatherContact" value={formData.fatherContact} onChange={handleChange} /></div>
                          </div>
                          <PhAddressPicker labelPrefix="Father's Address" value={formData.fatherAddr} onChange={setFatherAddr} />
                        </div>
                      )}
                    </div>

                    <button type="submit" className="submit-button" disabled={isLoading}>
                      {isLoading ? <>⏳ Saving Changes...</> : <>💾 Save Changes</>}
                    </button>

                    {successMessage && <p className="success-message">{successMessage}</p>}

                    <div>
                      <button type="button" onClick={() => setShowEditModal(false)}>Cancel</button>
                      <button type="submit">Update</button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* NEW: VIEW MODAL with Edit toggle */}
            {showViewModal && selectedProfile && (
              <div className="overlay">
                <div className="modal">
                  <div className="modal-header">
                    <h2>View Profile</h2>
                    <div style={{display:'flex', gap: '0.5rem'}}>
                      {!viewEditing ? (
                        <button
                          className="edit-btn"
                          onClick={() => {
                            setViewEditing(true);
                            setIsEditing(false);
                          }}
                        >
                          ✏ Edit
                        </button>
                      ) : (
                        <button
                          className="archive-btn"
                          onClick={() => {
                            setViewEditing(false);
                            setViewImagePreviewUrl(null);
                            setFormData((prev) => ({ ...prev, id_image: null }));
                          }}
                        >
                          ✖ Cancel Edit
                        </button>
                      )}
                      <button onClick={() => { setShowViewModal(false); setViewEditing(false); }}>Close</button>
                    </div>
                  </div>

                  <form className="form" onSubmit={handleSubmit}>
                    <div className="overlay-wrapper">
                      {/* Same tabs */}
                      <div className="form-tabs">
                        <div className="tab-buttons">
                          <button type="button" className={activeSection === "personal" ? "tab-btn active" : "tab-btn"} onClick={() => setActiveSection("personal")}>Personal Information</button>
                          <button type="button" className={activeSection === "family" ? "tab-btn active" : "tab-btn"} onClick={() => setActiveSection("family")}>Family Background</button>
                        </div>
                      </div>

                      {/* DISABLE all fields when not editing */}
                      <fieldset disabled={!viewEditing} style={{border: 'none', padding: 0, margin: 0}}>
                        {activeSection === "personal" && (
                          <div className="form-section show">
                            <h1>Personal Information</h1>

                            {/* Image area */}
                            <div className="image-preview-wrap">
                              <div className="input-group">
                                <label>Profile Image</label>
                                {viewEditing && (
                                  <input type="file" name="id_image" accept="image/*" onChange={handleChange} />
                                )}
                              </div>
                              <div className="image-preview">
                                {viewImagePreviewUrl ? (
                                  <img
                                    src={viewImagePreviewUrl}
                                    alt="Preview"
                                    className="clickable"
                                    onClick={() => openImageViewer(viewImagePreviewUrl, "Preview")}
                                  />
                                ) : getProfileImageUrl(selectedProfile) ? (
                                  <img
                                    src={getProfileImageUrl(selectedProfile)}
                                    alt="Current"
                                    className="clickable"
                                    onClick={() => openImageViewer(getProfileImageUrl(selectedProfile), "Current photo")}
                                  />
                                ) : (
                                  <div className="image-placeholder">No image</div>
                                )}
                              </div>
                            </div>

                            {/* Same grid as Edit/Add */}
                            <div className="grid">
                              <div className="input-group"><label>First Name <span className="required">*</span></label><input name="firstName" value={formData.firstName} onChange={handleChange} required /></div>
                              <div className="input-group"><label>Middle Name</label><input name="middleName" value={formData.middleName} onChange={handleChange} /></div>
                              <div className="input-group"><label>Last Name <span className="required">*</span></label><input name="lastName" value={formData.lastName} onChange={handleChange} required /></div>
                              <div className="input-group"><label>Suffix</label><input name="suffix" value={formData.suffix} onChange={handleChange} placeholder="Jr., Sr., III, etc." /></div>
                              <div className="input-group"><label>Badge Number <span className="required">*</span></label><input name="badge_number" value={formData.badge_number} onChange={handleChange} required /></div>
                              <div className="input-group"><label>Email Address <span className="required">*</span></label><input type="email" name="email" value={formData.email} onChange={handleChange} required /></div>
                              <div className="input-group"><label>Phone Number <span className="required">*</span></label><input name="phone" value={formData.phone} onChange={handleChange} required /></div>
                              <div className="input-group"><label>Place of Birth <span className="required">*</span></label><input name="birthPlace" value={formData.birthPlace} onChange={handleChange} required /></div>
                              <div className="input-group">
                                <label>Designation <span className="required">*</span></label>
                                <select name="officerType" value={formData.officerType} onChange={handleChange} required>
                                  <option value="">Select officer Type</option>
                                  {officerTypeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                              </div>
                              <div className="input-group">
                                <label>Sex / Gender <span className="required">*</span></label>
                                <div className="radio-group">
                                  {["Male","Female","Other"].map(g => (
                                    <label key={g}>
                                      <input type="radio" name="gender" value={g} checked={formData.gender === g} onChange={handleChange} required={g==="Male"} />{g}
                                    </label>
                                  ))}
                                </div>
                              </div>
                            </div>

                            <div className="section">
                              <h3>ℹ️ Additional Information</h3>
                              <div className="grid">
                                <div className="input-group"><label>Civil Status <span className="required">*</span></label>
                                  <select name="civilStatus" value={formData.civilStatus} onChange={handleChange} required>
                                    <option value="">Select Civil Status</option>
                                    {civilStatusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                                  </select>
                                </div>
                                <div className="input-group"><label>Nationality <span className="required">*</span></label>
                                  <select name="nationality" value={formData.nationality} onChange={handleChange} required>
                                    <option value="">Select Nationality</option>
                                    {nationalityOptions.map(n => <option key={n} value={n}>{n}</option>)}
                                  </select>
                                </div>
                                <div className="input-group"><label>Religion <span className="required">*</span></label><input name="religion" value={formData.religion} onChange={handleChange} required /></div>
                                <div className="checkbox-group">
                                  {[
                                    { name: "indigenous", label: "🏔️ Part of Indigenous Group?" },
                                    { name: "pwd", label: "♿ Person with Disability?" },
                                  ].map(x => (
                                    <label key={x.name} className={`checkbox-label ${formData[x.name] ? "checked" : ""}`}>
                                      <input type="checkbox" name={x.name} checked={formData[x.name]} onChange={handleChange} />
                                      {x.label}
                                    </label>
                                  ))}
                                </div>
                              </div>
                            </div>

                            <PhAddressPicker labelPrefix="🏠 Residential Address" value={formData.resAddr} onChange={setResAddr} requireAddressLine />
                            <PhAddressPicker labelPrefix="🏷️ Permanent Address" value={formData.permAddr} onChange={setPermAddr} requireAddressLine />
                          </div>
                        )}

                        {activeSection === "family" && (
                          <div className="form-section show">
                            <h1>Family Background</h1>

                            <h3>Mother's Background</h3>
                            <div className="grid">
                              <div className="input-group"><label>First Name</label><input name="motherFirstName" value={formData.motherFirstName} onChange={handleChange} /></div>
                              <div className="input-group"><label>Middle Name</label><input name="motherMiddleName" value={formData.motherMiddleName} onChange={handleChange} /></div>
                              <div className="input-group"><label>Last Name</label><input name="motherLastName" value={formData.motherLastName} onChange={handleChange} /></div>
                              <div className="input-group">
                                <label>Occupation</label>
                                <select name="motherOccupation" value={formData.motherOccupation} onChange={handleChange}>
                                  <option value="">Select occupation</option>
                                  {["Housewife","Employed","Self-Employed","OFW"].map(o => <option key={o} value={o}>{o}</option>)}
                                </select>
                              </div>
                              <div className="input-group"><label>Date of Birth</label><input type="date" name="motherDOB" value={formData.motherDOB} onChange={handleChange} /></div>
                              <div className="input-group"><label>Contact Number</label><input name="motherContact" value={formData.motherContact} onChange={handleChange} /></div>
                            </div>
                            <PhAddressPicker labelPrefix="Mother's Address" value={formData.motherAddr} onChange={setMotherAddr} />

                            <h3>Father's Background</h3>
                            <div className="grid">
                              <div className="input-group"><label>First Name</label><input name="fatherFirstName" value={formData.fatherFirstName} onChange={handleChange} /></div>
                              <div className="input-group"><label>Middle Name</label><input name="fatherMiddleName" value={formData.fatherMiddleName} onChange={handleChange} /></div>
                              <div className="input-group"><label>Last Name</label><input name="fatherLastName" value={formData.fatherLastName} onChange={handleChange} /></div>
                              <div className="input-group">
                                <label>Occupation</label>
                                <select name="fatherOccupation" value={formData.fatherOccupation} onChange={handleChange}>
                                  <option value="">Select occupation</option>
                                  {["Employed","Self-Employed","OFW"].map(o => <option key={o} value={o}>{o}</option>)}
                                </select>
                              </div>
                              <div className="input-group"><label>Date of Birth</label><input type="date" name="fatherDOB" value={formData.fatherDOB} onChange={handleChange} /></div>
                              <div className="input-group"><label>Contact Number</label><input name="fatherContact" value={formData.fatherContact} onChange={handleChange} /></div>
                            </div>
                            <PhAddressPicker labelPrefix="Father's Address" value={formData.fatherAddr} onChange={setFatherAddr} />
                          </div>
                        )}
                      </fieldset>
                    </div>

                    {/* Buttons: Save only when editing */}
                    <div style={{display:'flex', gap:'0.5rem', marginTop:'1rem'}}>
                      {viewEditing && (
                        <button type="submit" className="submit-button" disabled={isLoading}>
                          {isLoading ? "⏳ Saving..." : "💾 Save Changes"}
                        </button>
                      )}
                      {successMessage && <p className="success-message">{successMessage}</p>}
                    </div>
                  </form>
                </div>
              </div>
            )}

          </div>
        </main>
      </div>

      {/* LIGHTBOX VIEWER */}
      {imageViewer.open && (
        <div
          className="image-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Image viewer"
          onClick={closeImageViewer}
        >
          <div className="image-lightbox-inner" onClick={(e) => e.stopPropagation()}>
            <button
              className="image-lightbox-close"
              aria-label="Close viewer"
              onClick={closeImageViewer}
            >
              ×
            </button>
            <img src={imageViewer.url} alt={imageViewer.alt || "Image"} />
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminInfo;
