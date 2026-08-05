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
        placeholder: "https://dashboard.expleo.com",
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

  const [documents, setDocuments] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [showSecrets, setShowSecrets] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
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

    try {
      const [configRes, docsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/settings/configs`, { headers }),
        fetch(`${API_BASE_URL}/api/settings/documents`, { headers }),
      ]);

      if (configRes.ok) {
        const configData = await configRes.json();
        setConfig((prev) => ({ ...prev, ...(configData.data || configData) }));
      }

      if (docsRes.ok) {
        const docsData = await docsRes.json();
        setDocuments(docsData.documents || docsData.data || docsData);
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

  // 2. POST /api/settings/documents
  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
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
        setDocuments((prev) => [newDoc, ...prev]);
        setSelectedFile(null);
        showStatus("success", "Company document uploaded successfully!");
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
            Manage your bot credentials, API keys, webhook URLs, and upload knowledge documents.
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
                    Upload documents (PDF, TXT, DOCX) to feed your bot knowledge base
                  </p>
                </div>
              </div>
            </div>

            {/* Upload Area */}
            <form onSubmit={handleFileUpload} className="space-y-4">
              <div className="border-2 border-dashed border-purple-200 rounded-2xl p-6 text-center bg-[#FAF8FF] hover:bg-[#F4EFFF] transition flex flex-col items-center justify-center">
                <Upload className="w-8 h-8 text-[#7C5CFC] mb-2" />
                <p className="text-sm font-medium text-gray-700">Select a company document to upload</p>
                <p className="text-xs text-gray-400 mt-1 mb-4">Supported formats: .pdf, .txt, .doc, .docx</p>

                <input
                  type="file"
                  id="file-upload"
                  accept=".pdf,.txt,.doc,.docx"
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
        </div>
      )}
    </div>
  );
}