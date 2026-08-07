"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Key,
  FileText,
  Upload,
  Trash2,
  Save,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Link as LinkIcon,
  Calendar,
  ShieldCheck,
  RefreshCw,
  FileIcon,
  ArrowLeft,
  Briefcase,
  Database,
  Building2,
  Mail,
  Clock,
  MapPin,
  UserCheck,
  Plus,
  FileJson,
} from "lucide-react";

// Backend API Base URL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

// Config fields metadata mapped to your backend snake_case fields
const CONFIG_SECTIONS = [
  {
    title: "AI Provider API Keys",
    description: "API keys for primary LLM routing and fallback providers",
    icon: Key,
    fields: [
      {
        key: "gemini_api_key",
        label: "Gemini API Key",
        placeholder: "AIza...",
        type: "password",
        description: "Gemini LLM API key for intent routing, FAQ, and booking AI",
      },
      {
        key: "grok_api_key",
        label: "Grok API Key",
        placeholder: "xai-...",
        type: "password",
        description: "Grok / xAI API key (reserved for future provider switch)",
      },
      {
        key: "openrouter_api_key",
        label: "OpenRouter API Key",
        placeholder: "sk-or-v1-...",
        type: "password",
        description: "OpenRouter API key (reserved for future provider switch)",
      },
      {
        key: "mistral_api_key",
        label: "Mistral API Key",
        placeholder: "Oap0...",
        type: "password",
        description: "Mistral API key (reserved for future provider switch)",
      },
    ],
  },
  {
    title: "Google Calendar Credentials",
    description: "Google Service Account credentials for event booking",
    icon: Calendar,
    fields: [
      {
        key: "calendar_id",
        label: "Google Calendar ID",
        placeholder: "abc123@group.calendar.google.com",
        type: "text",
        description: "Google Calendar ID for booking events",
      },
      {
        key: "google_client_email",
        label: "Google Client Email",
        placeholder: "bot@project.iam.gserviceaccount.com",
        type: "text",
        description: "Service account email for Google Calendar auth",
      },
      {
        key: "google_private_key",
        label: "Google Private Key",
        placeholder: "-----BEGIN PRIVATE KEY-----\\n...",
        type: "textarea",
        description: "Service account private key (PEM format string)",
      },
    ],
  },
  {
    title: "Integration & Webhook URLs",
    description: "Redirect links and internal API base endpoints",
    icon: LinkIcon,
    fields: [
      {
        key: "google_review_url",
        label: "Google Review URL",
        placeholder: "https://g.page/r/XXXX",
        type: "url",
        description: "Google Business review link sent to happy customers",
      },
      {
        key: "tally_form_url",
        label: "Tally Form URL",
        placeholder: "https://tally.so/r/XXXX",
        type: "url",
        description: "Tally feedback form base URL (phone appended as ?phone=)",
      },
      {
        key: "dashboard_api_url",
        label: "Dashboard API URL",
        placeholder: "https://dashboard.company.com",
        type: "url",
        description: "Your backend's base URL — used for HTTP PATCH session sync",
      },
    ],
  },
];

export default function SettingsPage() {
  const [config, setConfig] = useState({
    gemini_api_key: "",
    grok_api_key: "",
    openrouter_api_key: "",
    mistral_api_key: "",
    calendar_id: "",
    google_client_email: "",
    google_private_key: "",
    google_review_url: "",
    tally_form_url: "",
    dashboard_api_url: "",
  });

  // Company Profile Knowledge Base Form State
  const [companyProfile, setCompanyProfile] = useState({
    companyName: "",
    companyEmail: "",
    description: "",
    openingHours: "09:00 AM",
    closingHours: "06:00 PM",
    servicesOffered: "",
    yearOfCreation: "",
    locations: [{ id: 1, address: "", city: "" }],
    professionals: [
      { id: 1, fullName: "", servicesProvided: "", workingHours: "" },
    ],
  });

  const [documents, setDocuments] = useState([]);
  const [services, setServices] = useState([]);
  const [knowledgeBase, setKnowledgeBase] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [showSecrets, setShowSecrets] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [statusMessage, setStatusMessage] = useState(null);

  const showStatus = (type, text) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const fetchInitialData = async () => {
    setIsLoading(true);
    const token = localStorage.getItem("token");
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    // Load saved company profile from localStorage if present
    const savedProfile = localStorage.getItem("company_profile_data");
    if (savedProfile) {
      try {
        setCompanyProfile(JSON.parse(savedProfile));
      } catch (e) {
        console.error("Error loading saved company profile from storage:", e);
      }
    }

    try {
      const [configRes, docsRes, servicesRes, kbRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/settings/configs`, { headers }),
        fetch(`${API_BASE_URL}/api/settings/documents`, { headers }),
        fetch(`${API_BASE_URL}/api/business/services`, { headers }),
        fetch(`${API_BASE_URL}/api/business/knowledge-base`, { headers }),
      ]);

      if (configRes.ok) {
        const configData = await configRes.json();
        setConfig((prev) => ({ ...prev, ...(configData.data || configData) }));
      }

      if (docsRes.ok) {
        const docsData = await docsRes.json();
        const docList = docsData.documents || docsData.data || docsData;
        setDocuments(docList);

        // If local storage didn't have data, try loading existing JSON document from server
        if (!savedProfile && Array.isArray(docList)) {
          const profileDoc = docList.find(
            (d) => (d.file_name || d.original_name || d.name) === "company_information.json"
          );
          if (profileDoc) {
            try {
              const url = profileDoc.file_url.startsWith("http")
                ? profileDoc.file_url
                : `${API_BASE_URL}${profileDoc.file_url}`;
              const jsonRes = await fetch(url);
              if (jsonRes.ok) {
                const parsedProfile = await jsonRes.json();
                setCompanyProfile(parsedProfile);
                localStorage.setItem("company_profile_data", JSON.stringify(parsedProfile));
              }
            } catch (pErr) {
              console.warn("Could not fetch remote company_information.json:", pErr);
            }
          }
        }
      }

      if (servicesRes.ok) {
        const servicesData = await servicesRes.json();
        setServices(servicesData.services || []);
      }

      if (kbRes.ok) {
        const kbData = await kbRes.json();
        setKnowledgeBase(kbData.content ? kbData : null);
      }
    } catch (error) {
      console.error("Error fetching settings data:", error);
      showStatus("error", "Failed to load settings data");
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch configs & uploaded documents on mount
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      if (isMounted) {
        await fetchInitialData();
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleInputChange = (key, value) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const toggleSecretVisibility = (key) => {
    setShowSecrets((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Dynamic Location Handlers
  const handleAddLocation = () => {
    setCompanyProfile((prev) => ({
      ...prev,
      locations: [
        ...prev.locations,
        { id: Date.now(), address: "", city: "" },
      ],
    }));
  };

  const handleRemoveLocation = (id) => {
    if (companyProfile.locations.length <= 1) return;
    setCompanyProfile((prev) => ({
      ...prev,
      locations: prev.locations.filter((loc) => loc.id !== id),
    }));
  };

  const handleLocationChange = (id, field, value) => {
    setCompanyProfile((prev) => ({
      ...prev,
      locations: prev.locations.map((loc) =>
        loc.id === id ? { ...loc, [field]: value } : loc
      ),
    }));
  };

  // Dynamic Professional Handlers
  const handleAddProfessional = () => {
    setCompanyProfile((prev) => ({
      ...prev,
      professionals: [
        ...prev.professionals,
        { id: Date.now(), fullName: "", servicesProvided: "", workingHours: "" },
      ],
    }));
  };

  const handleRemoveProfessional = (id) => {
    if (companyProfile.professionals.length <= 1) return;
    setCompanyProfile((prev) => ({
      ...prev,
      professionals: prev.professionals.filter((pro) => pro.id !== id),
    }));
  };

  const handleProfessionalChange = (id, field, value) => {
    setCompanyProfile((prev) => ({
      ...prev,
      professionals: prev.professionals.map((pro) =>
        pro.id === id ? { ...pro, [field]: value } : pro
      ),
    }));
  };

  // Save Company Profile & Upload JSON Snapshot to Documents
  const handleSaveCompanyProfile = async (e) => {
    e.preventDefault();
    setIsSavingProfile(true);

    try {
      // 1. Persist data in localStorage so it stays on display across sessions
      localStorage.setItem("company_profile_data", JSON.stringify(companyProfile));

      // 2. Create a JSON File snapshot from the form data
      const jsonBlob = new Blob([JSON.stringify(companyProfile, null, 2)], {
        type: "application/json",
      });
      const jsonFile = new File([jsonBlob], "company_information.json", {
        type: "application/json",
      });

      // 3. Upload to Knowledge Base documents endpoint
      const formData = new FormData();
      formData.append("file", jsonFile);

      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE_URL}/api/settings/documents`, {
        method: "POST",
        headers: {
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: formData,
      });

      if (res.ok) {
        const responseData = await res.json();
        const newDoc = responseData.document || responseData.data || responseData;
        setDocuments((prev) => [
          newDoc,
          ...prev.filter(
            (d) => (d.file_name || d.original_name || d.name) !== "company_information.json"
          ),
        ]);
        showStatus("success", "Company profile saved and uploaded to Knowledge Base!");
      } else {
        const err = await res.json();
        showStatus("error", err.error || "Failed to save company profile document.");
      }
    } catch (error) {
      console.error("Error saving company profile:", error);
      showStatus("error", "Network error saving company profile.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  // 1. POST /api/settings/configs
  const handleSaveConfigs = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE_URL}/api/settings/configs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify(config),
      });

      if (res.ok) {
        showStatus("success", "Configuration keys saved successfully!");
      } else {
        const err = await res.json();
        showStatus("error", err.error || "Failed to save configuration.");
      }
    } catch (error) {
      showStatus("error", "Network error saving settings.");
    } finally {
      setIsSaving(false);
    }
  };

  // 2. POST /api/business/upload
  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("document", selectedFile);

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE_URL}/api/business/upload`, {
        method: "POST",
        headers: {
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: formData,
      });

      if (res.ok) {
        const responseData = await res.json();
        
        // Update services and knowledge base from response
        if (responseData.services) {
          setServices((prev) => {
            const newServices = [...prev];
            responseData.services.forEach(newSvc => {
              if (!newServices.find(s => s.name === newSvc.name)) {
                newServices.push(newSvc);
              }
            });
            return newServices;
          });
        }
        if (responseData.knowledge_base) {
          setKnowledgeBase(responseData.knowledge_base);
        }

        // Add a pseudo-document to the list to reflect the upload in the UI history
        const newDoc = {
          id: Date.now(),
          file_name: responseData.fileName || selectedFile.name,
          uploaded_at: new Date().toISOString(),
          file_size: selectedFile.size
        };
        setDocuments((prev) => [newDoc, ...prev]);
        
        setSelectedFile(null);
        showStatus("success", "Company document ingested successfully!");
      } else {
        const err = await res.json();
        showStatus("error", err.error || err.message || "Failed to upload document.");
      }
    } catch (error) {
      console.error("Upload error:", error);
      showStatus("error", "Error uploading document.");
    } finally {
      setIsUploading(false);
    }
  };

  // 3. DELETE /api/settings/documents/:id
  const handleDeleteDocument = async (id) => {
    setDeletingId(id);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE_URL}/api/settings/documents/${id}`, {
        method: "DELETE",
        headers: {
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      });

      if (res.ok) {
        setDocuments((prev) => prev.filter((doc) => doc.id !== id));
        showStatus("success", "Document deleted successfully.");
      } else {
        showStatus("error", "Failed to delete document.");
      }
    } catch (error) {
      showStatus("error", "Error deleting document.");
    } finally {
      setDeletingId(null);
    }
  };

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="min-h-screen bg-[#F8F9FD] p-6 lg:p-10 text-gray-800">
      {/* Top-Left Back Button */}
      <div className="mb-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:text-gray-900 transition shadow-sm"
        >
          <ArrowLeft className="w-4 h-4 text-gray-500" />
          Dashboard
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Settings & Integrations</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your bot credentials, API keys, company details form, and upload knowledge documents.
          </p>
        </div>

        {statusMessage && (
          <div
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium shadow-sm transition-all animate-in fade-in ${
              statusMessage.type === "success"
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : "bg-rose-50 text-rose-700 border border-rose-200"
            }`}
          >
            {statusMessage.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600" />
            )}
            {statusMessage.text}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 space-y-3">
          <RefreshCw className="w-8 h-8 text-[#7C5CFC] animate-spin" />
          <p className="text-sm font-medium text-gray-500">Loading settings...</p>
        </div>
      ) : (
        <div className="space-y-10">
          {/* COMPANY PROFILE KNOWLEDGE FORM SECTION */}
          <div className="bg-white rounded-2xl p-6 lg:p-8 border border-purple-100 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center gap-3 pb-5 mb-6 border-b border-gray-100">
              <div className="p-2.5 bg-[#F0EDFF] rounded-xl text-[#7C5CFC]">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Company Details & Knowledge Form</h2>
                <p className="text-xs text-gray-500">
                  Enter your business details, locations, and staff profiles. Information remains on display and syncs as a JSON document to your Knowledge Base.
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveCompanyProfile} className="space-y-6">
              {/* Basic Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {/* Company Name */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold tracking-wider text-gray-700 uppercase">
                    Company Name
                  </label>
                  <div className="relative flex items-center">
                    <Building2 className="w-4 h-4 absolute left-3.5 text-gray-400" />
                    <input
                      type="text"
                      required
                      value={companyProfile.companyName}
                      onChange={(e) =>
                        setCompanyProfile((prev) => ({ ...prev, companyName: e.target.value }))
                      }
                      placeholder="e.g. Acme Health Clinic"
                      className="w-full pl-10 pr-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#7C5CFC] focus:bg-white transition"
                    />
                  </div>
                </div>

                {/* Company Email */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold tracking-wider text-gray-700 uppercase">
                    Company Email
                  </label>
                  <div className="relative flex items-center">
                    <Mail className="w-4 h-4 absolute left-3.5 text-gray-400" />
                    <input
                      type="email"
                      required
                      value={companyProfile.companyEmail}
                      onChange={(e) =>
                        setCompanyProfile((prev) => ({ ...prev, companyEmail: e.target.value }))
                      }
                      placeholder="contact@acme.com"
                      className="w-full pl-10 pr-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#7C5CFC] focus:bg-white transition"
                    />
                  </div>
                </div>

                {/* Year of Creation */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold tracking-wider text-gray-700 uppercase">
                    Year of Creation
                  </label>
                  <div className="relative flex items-center">
                    <Calendar className="w-4 h-4 absolute left-3.5 text-gray-400" />
                    <input
                      type="text"
                      value={companyProfile.yearOfCreation}
                      onChange={(e) =>
                        setCompanyProfile((prev) => ({ ...prev, yearOfCreation: e.target.value }))
                      }
                      placeholder="e.g. 2018"
                      className="w-full pl-10 pr-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#7C5CFC] focus:bg-white transition"
                    />
                  </div>
                </div>

                {/* Opening Hours */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold tracking-wider text-gray-700 uppercase">
                    Opening Hours
                  </label>
                  <div className="relative flex items-center">
                    <Clock className="w-4 h-4 absolute left-3.5 text-gray-400" />
                    <input
                      type="text"
                      value={companyProfile.openingHours}
                      onChange={(e) =>
                        setCompanyProfile((prev) => ({ ...prev, openingHours: e.target.value }))
                      }
                      placeholder="e.g. 09:00 AM"
                      className="w-full pl-10 pr-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#7C5CFC] focus:bg-white transition"
                    />
                  </div>
                </div>

                {/* Closing Hours */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold tracking-wider text-gray-700 uppercase">
                    Closing Hours
                  </label>
                  <div className="relative flex items-center">
                    <Clock className="w-4 h-4 absolute left-3.5 text-gray-400" />
                    <input
                      type="text"
                      value={companyProfile.closingHours}
                      onChange={(e) =>
                        setCompanyProfile((prev) => ({ ...prev, closingHours: e.target.value }))
                      }
                      placeholder="e.g. 06:00 PM"
                      className="w-full pl-10 pr-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#7C5CFC] focus:bg-white transition"
                    />
                  </div>
                </div>

                {/* Services Offered */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold tracking-wider text-gray-700 uppercase">
                    Services Offered
                  </label>
                  <div className="relative flex items-center">
                    <Briefcase className="w-4 h-4 absolute left-3.5 text-gray-400" />
                    <input
                      type="text"
                      value={companyProfile.servicesOffered}
                      onChange={(e) =>
                        setCompanyProfile((prev) => ({ ...prev, servicesOffered: e.target.value }))
                      }
                      placeholder="e.g. General Practice, Dentistry, Pediatrics"
                      className="w-full pl-10 pr-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#7C5CFC] focus:bg-white transition"
                    />
                  </div>
                </div>

                {/* Description */}
                <div className="md:col-span-2 lg:col-span-3 space-y-1.5">
                  <label className="block text-xs font-semibold tracking-wider text-gray-700 uppercase">
                    Company Description
                  </label>
                  <textarea
                    rows={3}
                    value={companyProfile.description}
                    onChange={(e) =>
                      setCompanyProfile((prev) => ({ ...prev, description: e.target.value }))
                    }
                    placeholder="Provide a detailed description of your business to help your bot answer customer questions..."
                    className="w-full p-3 text-sm bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#7C5CFC] focus:bg-white transition"
                  />
                </div>
              </div>

              {/* Dynamic Locations Section */}
              <div className="pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[#7C5CFC]" />
                    <h3 className="text-sm font-bold text-gray-900">Locations</h3>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddLocation}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-[#7C5CFC] rounded-lg text-xs font-medium transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Location
                  </button>
                </div>

                <div className="space-y-3">
                  {companyProfile.locations.map((loc, idx) => (
                    <div
                      key={loc.id}
                      className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-xl"
                    >
                      <span className="text-xs font-semibold text-gray-400 w-6">#{idx + 1}</span>
                      <input
                        type="text"
                        placeholder="Street Address (e.g. 123 Main Blvd)"
                        value={loc.address}
                        onChange={(e) => handleLocationChange(loc.id, "address", e.target.value)}
                        className="flex-1 p-2 text-sm bg-white border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#7C5CFC]"
                      />
                      <input
                        type="text"
                        placeholder="City / District"
                        value={loc.city}
                        onChange={(e) => handleLocationChange(loc.id, "city", e.target.value)}
                        className="w-1/3 p-2 text-sm bg-white border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#7C5CFC]"
                      />
                      {companyProfile.locations.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveLocation(loc.id)}
                          className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          title="Remove Location"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Dynamic Professionals Section */}
              <div className="pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-[#7C5CFC]" />
                    <h3 className="text-sm font-bold text-gray-900">Professionals & Staff</h3>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddProfessional}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-[#7C5CFC] rounded-lg text-xs font-medium transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Professional
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {companyProfile.professionals.map((pro, idx) => (
                    <div
                      key={pro.id}
                      className="p-4 bg-gradient-to-br from-purple-50/50 to-gray-50 border border-purple-100 rounded-xl space-y-3 relative group"
                    >
                      <div className="flex items-center justify-between border-b border-purple-100 pb-2">
                        <span className="text-xs font-bold text-[#7C5CFC] uppercase tracking-wider">
                          Professional #{idx + 1}
                        </span>
                        {companyProfile.professionals.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveProfessional(pro.id)}
                            className="p-1 text-gray-400 hover:text-rose-600 rounded transition"
                            title="Remove Professional Card"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="space-y-2">
                        <div>
                          <label className="block text-[10px] font-semibold text-gray-500 uppercase mb-1">
                            Full Name
                          </label>
                          <input
                            type="text"
                            placeholder="Dr. Sarah Connor"
                            value={pro.fullName}
                            onChange={(e) =>
                              handleProfessionalChange(pro.id, "fullName", e.target.value)
                            }
                            className="w-full p-2 text-xs bg-white border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#7C5CFC]"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-semibold text-gray-500 uppercase mb-1">
                            Services Provided
                          </label>
                          <input
                            type="text"
                            placeholder="General Consultation, Surgery"
                            value={pro.servicesProvided}
                            onChange={(e) =>
                              handleProfessionalChange(pro.id, "servicesProvided", e.target.value)
                            }
                            className="w-full p-2 text-xs bg-white border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#7C5CFC]"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-semibold text-gray-500 uppercase mb-1">
                            Working Hours
                          </label>
                          <input
                            type="text"
                            placeholder="Mon - Fri: 09:00 AM - 04:00 PM"
                            value={pro.workingHours}
                            onChange={(e) =>
                              handleProfessionalChange(pro.id, "workingHours", e.target.value)
                            }
                            className="w-full p-2 text-xs bg-white border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#7C5CFC]"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Submit Company Profile Form */}
              <div className="flex justify-end pt-4 border-t border-gray-100">
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="flex items-center gap-2 px-6 py-3 bg-[#7C5CFC] hover:bg-[#6342E8] text-white rounded-xl font-medium text-sm transition shadow-lg shadow-purple-200 disabled:opacity-50"
                >
                  {isSavingProfile ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <FileJson className="w-4 h-4" />
                  )}
                  {isSavingProfile ? "Saving & Syncing JSON..." : "Save Profile & Sync Knowledge Base"}
                </button>
              </div>
            </form>
          </div>

          {/* CONFIGURATION KEYS FORM */}
          <form onSubmit={handleSaveConfigs} className="space-y-8">
            {CONFIG_SECTIONS.map((section, idx) => {
              const SectionIcon = section.icon;
              return (
                <div
                  key={idx}
                  className="bg-white rounded-2xl p-6 lg:p-8 border border-purple-100 shadow-sm transition-all hover:shadow-md"
                >
                  <div className="flex items-center gap-3 pb-5 mb-6 border-b border-gray-100">
                    <div className="p-2.5 bg-[#F0EDFF] rounded-xl text-[#7C5CFC]">
                      <SectionIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-gray-900">{section.title}</h2>
                      <p className="text-xs text-gray-500">{section.description}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {section.fields.map((field) => {
                      const isSecret = field.type === "password";
                      const isVisible = showSecrets[field.key];
                      const isTextarea = field.type === "textarea";

                      return (
                        <div
                          key={field.key}
                          className={isTextarea ? "md:col-span-2 space-y-1.5" : "space-y-1.5"}
                        >
                          <label className="block text-xs font-semibold tracking-wider text-gray-700 uppercase">
                            {field.label}
                          </label>

                          <div className="relative">
                            {isTextarea ? (
                              <textarea
                                rows={4}
                                value={config[field.key] || ""}
                                onChange={(e) => handleInputChange(field.key, e.target.value)}
                                placeholder={field.placeholder}
                                className="w-full font-mono text-xs p-3.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#7C5CFC] focus:bg-white transition"
                              />
                            ) : (
                              <div className="relative flex items-center">
                                <input
                                  type={isSecret && !isVisible ? "password" : "text"}
                                  value={config[field.key] || ""}
                                  onChange={(e) => handleInputChange(field.key, e.target.value)}
                                  placeholder={field.placeholder}
                                  className="w-full pr-10 p-3 text-sm bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#7C5CFC] focus:bg-white transition font-mono"
                                />
                                {isSecret && (
                                  <button
                                    type="button"
                                    onClick={() => toggleSecretVisibility(field.key)}
                                    className="absolute right-3 text-gray-400 hover:text-gray-600 transition"
                                  >
                                    {isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 mt-1">{field.description}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Save Buttons */}
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center gap-2 px-6 py-3 bg-[#7C5CFC] hover:bg-[#6342E8] text-white rounded-xl font-medium text-sm transition shadow-lg shadow-purple-200 disabled:opacity-50"
              >
                {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {isSaving ? "Saving Configuration..." : "Save All Settings"}
              </button>
            </div>
          </form>

          {/* COMPANY DOCUMENTS MANAGEMENT SECTION */}
          <div className="bg-white rounded-2xl p-6 lg:p-8 border border-purple-100 shadow-sm space-y-6">
            <div className="flex items-center justify-between pb-5 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-[#F0EDFF] rounded-xl text-[#7C5CFC]">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Company Context Documents</h2>
                  <p className="text-xs text-gray-500">
                    Upload documents (PDF, TXT, DOCX, JSON) to feed your bot knowledge base
                  </p>
                </div>
              </div>
            </div>

            {/* Upload Area */}
            <form onSubmit={handleFileUpload} className="space-y-4">
              <div className="border-2 border-dashed border-purple-200 rounded-2xl p-6 text-center bg-[#FAF8FF] hover:bg-[#F4EFFF] transition flex flex-col items-center justify-center">
                <Upload className="w-8 h-8 text-[#7C5CFC] mb-2" />
                <p className="text-sm font-medium text-gray-700">Select a company document to upload</p>
                <p className="text-xs text-gray-400 mt-1 mb-4">Supported formats: .pdf, .txt, .doc, .docx, .json</p>

                <input
                  type="file"
                  id="file-upload"
                  accept=".pdf,.txt,.doc,.docx,.json"
                  onChange={(e) => setSelectedFile(e.target.files[0])}
                  className="hidden"
                />

                <label
                  htmlFor="file-upload"
                  className="cursor-pointer px-4 py-2 bg-white border border-purple-200 rounded-xl text-xs font-semibold text-[#7C5CFC] hover:bg-purple-50 transition shadow-sm"
                >
                  {selectedFile ? selectedFile.name : "Browse File"}
                </label>
              </div>

              {selectedFile && (
                <div className="flex items-center justify-between bg-purple-50 px-4 py-2.5 rounded-xl border border-purple-100">
                  <span className="text-xs font-medium text-purple-900 truncate">{selectedFile.name}</span>
                  <button
                    type="submit"
                    disabled={isUploading}
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-[#7C5CFC] hover:bg-[#6342E8] text-white rounded-lg text-xs font-medium transition disabled:opacity-50"
                  >
                    {isUploading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    {isUploading ? "Uploading..." : "Confirm Upload"}
                  </button>
                </div>
              )}
            </form>

            {/* Uploaded Documents List */}
            <div className="pt-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
                Uploaded Documents ({documents.length})
              </h3>

              {documents.length === 0 ? (
                <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-xl text-xs">
                  No company documents uploaded yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {documents.map((doc) => (
                    <div
                      key={doc.id || doc._id}
                      className="flex items-center justify-between p-3.5 bg-gray-50 border border-gray-100 rounded-xl hover:bg-white hover:border-purple-200 transition group"
                    >
                      <div className="flex items-center gap-3">
                        <FileIcon className="w-4 h-4 text-[#7C5CFC]" />
                        <div>
                          <a
                            href={doc.file_url || `${API_BASE_URL}/${doc.file_path}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-gray-800 hover:text-[#7C5CFC] transition"
                          >
                            {doc.file_name || doc.original_name || doc.name}
                          </a>
                          <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                            <span>{formatBytes(doc.file_size_bytes || doc.size || doc.file_size)}</span>
                            <span>•</span>
                            <span>
                              {doc.uploaded_at || doc.created_at
                                ? new Date(doc.uploaded_at || doc.created_at).toLocaleDateString()
                                : "Recently"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDeleteDocument(doc.id || doc._id)}
                        disabled={deletingId === (doc.id || doc._id)}
                        className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                        title="Delete document"
                      >
                        {deletingId === (doc.id || doc._id) ? (
                          <RefreshCw className="w-4 h-4 animate-spin text-rose-600" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* EXTRACTED SERVICES SECTION */}
          <div className="bg-white rounded-2xl p-6 lg:p-8 border border-purple-100 shadow-sm space-y-6">
            <div className="flex items-center gap-3 pb-5 border-b border-gray-100">
              <div className="p-2.5 bg-[#F0EDFF] rounded-xl text-[#7C5CFC]">
                <Briefcase className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Extracted Services</h2>
                <p className="text-xs text-gray-500">
                  Services detected from your ingested documents.
                </p>
              </div>
            </div>

            {services.length === 0 ? (
              <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-xl text-xs">
                No services extracted yet. Upload a document to populate this.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {services.map((svc, idx) => (
                  <div key={svc.id || idx} className="p-4 bg-gray-50 border border-gray-100 rounded-xl space-y-1">
                    <h4 className="font-semibold text-gray-900 text-sm">{svc.name}</h4>
                    <p className="text-xs text-gray-500 capitalize">Dept: {svc.department}</p>
                    <p className="text-xs text-gray-500">Duration: {svc.duration_minutes} min</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* EXTRACTED KNOWLEDGE BASE SECTION */}
          <div className="bg-white rounded-2xl p-6 lg:p-8 border border-purple-100 shadow-sm space-y-6">
            <div className="flex items-center gap-3 pb-5 border-b border-gray-100">
              <div className="p-2.5 bg-[#F0EDFF] rounded-xl text-[#7C5CFC]">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Active Knowledge Base</h2>
                <p className="text-xs text-gray-500">
                  The latest company information powering your AI responses.
                </p>
              </div>
            </div>

            {!knowledgeBase || !knowledgeBase.content ? (
              <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-xl text-xs">
                No knowledge base content available. Upload a document first.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-xs text-gray-500">
                  <span className="font-semibold text-gray-700">Source File:</span> {knowledgeBase.source_file || "Unknown"}
                  <span className="mx-2">•</span>
                  <span className="font-semibold text-gray-700">Updated:</span> {knowledgeBase.updated_at ? new Date(knowledgeBase.updated_at).toLocaleString() : "Recently"}
                </div>
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 whitespace-pre-wrap font-mono">
                  {knowledgeBase.content}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}