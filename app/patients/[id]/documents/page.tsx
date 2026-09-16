"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../../lib/supabase";

type DocumentRecord = {
  id: string;
  document_name: string;
  document_type: string | null;
  storage_path: string;
  description: string | null;
  created_at: string;
};

const DOCUMENT_TYPES = [
  "ID Document",
  "Medical Aid",
  "Referral Letter",
  "Lab Result",
  "Radiology",
  "Prescription",
  "Sick Note",
  "Medical Report",
  "Consent Form",
  "Discharge Summary",
  "Other",
];

export default function PatientDocumentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [patientId, setPatientId] = useState("");
  const [practiceId, setPracticeId] = useState("");
  const [patientName, setPatientName] = useState("");
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);

  const [documentName, setDocumentName] = useState("");
  const [documentType, setDocumentType] = useState("Other");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [deletingId, setDeletingId] = useState("");

  useEffect(() => {
    loadPage();
  }, []);

  const loadPage = async () => {
    const routeParams = await params;
    setPatientId(routeParams.id);

    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      window.location.href = "/login";
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("practice_id")
      .eq("id", userData.user.id)
      .single();

    if (profileError || !profile) {
      setError("Your practice profile could not be found.");
      setLoading(false);
      return;
    }

    setPracticeId(profile.practice_id);

    const { data: patient, error: patientError } = await supabase
      .from("patients")
      .select("first_name, middle_name, last_name, title, patient_id, phone, email")
      .eq("id", routeParams.id)
      .eq("practice_id", profile.practice_id)
      .single();

    if (patientError || !patient) {
      setError("Patient could not be found.");
      setLoading(false);
      return;
    }

    setPatientName(
      [
        patient.title,
        patient.first_name,
        patient.middle_name,
        patient.last_name,
      ]
        .filter(Boolean)
        .join(" ")
    );

    await loadDocuments(routeParams.id, profile.practice_id);

    setLoading(false);
  };

  const loadDocuments = async (id: string, practice: string) => {
    const { data, error: documentsError } = await supabase
      .from("patient_documents")
      .select(
        "id, document_name, document_type, storage_path, description, created_at"
      )
      .eq("patient_id", id)
      .eq("practice_id", practice)
      .order("created_at", { ascending: false });

    if (documentsError) {
      setError(documentsError.message);
      return;
    }

    setDocuments((data || []) as DocumentRecord[]);
  };

  const filteredDocuments = useMemo(() => {
    const query = search.trim().toLowerCase();

    return documents.filter((document) => {
      const matchesSearch =
        !query ||
        document.document_name.toLowerCase().includes(query) ||
        (document.document_type || "").toLowerCase().includes(query) ||
        (document.description || "").toLowerCase().includes(query);

      const matchesType =
        typeFilter === "All" ||
        (document.document_type || "Other") === typeFilter;

      return matchesSearch && matchesType;
    });
  }, [documents, search, typeFilter]);

  const documentTypesInUse = useMemo(() => {
    const types = new Set<string>();

    documents.forEach((document) => {
      types.add(document.document_type || "Other");
    });

    return Array.from(types).sort();
  }, [documents]);

  const getFileExtension = (storagePath: string) => {
    const fileName = storagePath.split("/").pop() || "";
    const parts = fileName.split(".");

    if (parts.length < 2) {
      return "FILE";
    }

    return parts[parts.length - 1].toUpperCase();
  };

  const getDocumentIcon = (storagePath: string) => {
    const extension = getFileExtension(storagePath).toLowerCase();

    if (extension === "pdf") {
      return "PDF";
    }

    if (
      extension === "jpg" ||
      extension === "jpeg" ||
      extension === "png" ||
      extension === "webp"
    ) {
      return "IMG";
    }

    if (extension === "doc" || extension === "docx") {
      return "DOC";
    }

    if (extension === "xls" || extension === "xlsx") {
      return "XLS";
    }

    return "FILE";
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();

    setError("");
    setMessage("");

    if (!file) {
      setError("Please select a document.");
      return;
    }

    if (!documentName.trim()) {
      setError("Please enter a document name.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("Document must be 10 MB or smaller.");
      return;
    }

    setUploading(true);

    const extension =
      file.name.split(".").pop()?.toLowerCase() || "file";

    const storagePath = `${practiceId}/${patientId}/${crypto.randomUUID()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("patient-documents")
      .upload(storagePath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || "application/octet-stream",
      });

    if (uploadError) {
      setError(`Document upload failed: ${uploadError.message}`);
      setUploading(false);
      return;
    }

    const { data: userData } = await supabase.auth.getUser();

    const { error: insertError } = await supabase
      .from("patient_documents")
      .insert({
        practice_id: practiceId,
        patient_id: patientId,
        uploaded_by: userData.user?.id,
        document_name: documentName.trim(),
        document_type: documentType,
        storage_path: storagePath,
        description: description.trim() || null,
      });

    if (insertError) {
      await supabase.storage
        .from("patient-documents")
        .remove([storagePath]);

      setError(`Could not save document record: ${insertError.message}`);
      setUploading(false);
      return;
    }

    setDocumentName("");
    setDocumentType("Other");
    setDescription("");
    setFile(null);

    const fileInput = document.getElementById(
      "document-file"
    ) as HTMLInputElement | null;

    if (fileInput) {
      fileInput.value = "";
    }

    await loadDocuments(patientId, practiceId);

    setMessage("Document uploaded successfully.");
    setUploading(false);
  };

  const getSignedUrl = async (storagePath: string) => {
    const { data, error } = await supabase.storage
      .from("patient-documents")
      .createSignedUrl(storagePath, 60 * 10);

    if (error || !data?.signedUrl) {
      throw new Error(error?.message || "Could not create document link.");
    }

    return data.signedUrl;
  };

  const openDocument = async (storagePath: string) => {
    setError("");
    setMessage("");

    try {
      const signedUrl = await getSignedUrl(storagePath);
      window.open(signedUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not open the document."
      );
    }
  };

  const downloadDocument = async (
    storagePath: string,
    documentName: string
  ) => {
    setError("");
    setMessage("");

    try {
      const signedUrl = await getSignedUrl(storagePath);

      const response = await fetch(signedUrl);

      if (!response.ok) {
        throw new Error("Could not download the document.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = documentName || "document";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not download the document."
      );
    }
  };

  const deleteDocument = async (
    id: string,
    storagePath: string
  ) => {
    const confirmed = window.confirm(
      "Are you sure you want to permanently delete this document?\n\nThis action cannot be undone."
    );

    if (!confirmed) {
      return;
    }

    setError("");
    setMessage("");
    setDeletingId(id);

    const { error: deleteError } = await supabase
      .from("patient_documents")
      .delete()
      .eq("id", id)
      .eq("practice_id", practiceId)
      .eq("patient_id", patientId);

    if (deleteError) {
      setError(`Could not delete document record: ${deleteError.message}`);
      setDeletingId("");
      return;
    }

    const { error: storageError } = await supabase.storage
      .from("patient-documents")
      .remove([storagePath]);

    if (storageError) {
      setError(
        `Document record was deleted, but the stored file could not be removed: ${storageError.message}`
      );
      await loadDocuments(patientId, practiceId);
      setDeletingId("");
      return;
    }

    await loadDocuments(patientId, practiceId);

    setMessage("Document deleted successfully.");
    setDeletingId("");
  };

  if (loading) {
    return (
      <main className="page-shell">
        <header className="app-header">
          <div className="app-header-inner">
            <a href="/dashboard" className="app-brand">
              <img
                src="/logo.jpg"
                alt="J&J Practice Cloud"
                className="app-brand-logo"
              />
              <span className="app-brand-name">J&J Practice Cloud</span>
            </a>
          </div>
        </header>

        <div className="page-inner">
          <div className="empty-state">Loading patient documents...</div>
        </div>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <header className="app-header">
        <div className="app-header-inner">
          <a href="/dashboard" className="app-brand">
            <img
              src="/logo.jpg"
              alt="J&J Practice Cloud"
              className="app-brand-logo"
            />
            <span className="app-brand-name">J&J Practice Cloud</span>
          </a>

          <div className="page-actions">
            <button
              type="button"
              onClick={() => {
                window.location.href = `/patients/${patientId}`;
              }}
              className="btn btn-secondary btn-sm"
            >
              Patient Profile
            </button>

            <button
              type="button"
              onClick={() => {
                window.location.href = `/patients/${patientId}/edit`;
              }}
              className="btn btn-secondary btn-sm"
            >
              Edit Patient
            </button>
          </div>
        </div>
      </header>

      <div className="page-inner">
        <div className="page-header">
          <div>
            <p className="page-subtitle">Patient File</p>

            <h1 className="page-title">Patient Documents</h1>

            <p className="page-subtitle">{patientName}</p>
          </div>
        </div>

        {error && <div className="alert-error">{error}</div>}

        {message && <div className="alert-success">{message}</div>}

        <div className="stat-grid">
          <div className="stat-card">
            <p className="stat-label">Total Documents</p>
            <p className="stat-value">{documents.length}</p>
          </div>

          <div className="stat-card">
            <p className="stat-label">Showing</p>
            <p className="stat-value">{filteredDocuments.length}</p>
          </div>

          <div className="stat-card">
            <p className="stat-label">Document Types</p>
            <p className="stat-value">{documentTypesInUse.length}</p>
          </div>

          <div className="stat-card">
            <p className="stat-label">Patient</p>
            <p className="stat-value">{patientName || "—"}</p>
          </div>
        </div>

        <section className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Upload Patient Document</h2>

              <p className="page-subtitle">
                Upload medical records, referrals, results, IDs and other
                documents. Maximum file size: 10 MB.
              </p>
            </div>
          </div>

          <div className="card-body">
            <form onSubmit={handleUpload}>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="field">
                  <label className="label" htmlFor="document-name">
                    Document Name
                  </label>

                  <input
                    id="document-name"
                    value={documentName}
                    onChange={(e) => setDocumentName(e.target.value)}
                    placeholder="e.g. Blood Test Results"
                    className="input"
                  />
                </div>

                <div className="field">
                  <label className="label" htmlFor="document-type">
                    Document Type
                  </label>

                  <select
                    id="document-type"
                    value={documentType}
                    onChange={(e) => setDocumentType(e.target.value)}
                    className="input"
                  >
                    {DOCUMENT_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label className="label" htmlFor="document-file">
                    File
                  </label>

                  <input
                    id="document-file"
                    type="file"
                    onChange={(e) =>
                      setFile(e.target.files?.[0] || null)
                    }
                    className="input"
                  />

                  {file && (
                    <p className="page-subtitle">
                      Selected: {file.name} (
                      {(file.size / 1024 / 1024).toFixed(2)} MB)
                    </p>
                  )}
                </div>

                <div className="field">
                  <label className="label" htmlFor="document-description">
                    Description
                  </label>

                  <input
                    id="document-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Optional description"
                    className="input"
                  />
                </div>
              </div>

              <div className="page-actions">
                <button
                  type="submit"
                  disabled={uploading}
                  className="btn btn-primary"
                >
                  {uploading ? "Uploading..." : "Upload Document"}
                </button>
              </div>
            </form>
          </div>
        </section>

        <section className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Document History</h2>

              <p className="page-subtitle">
                Search and manage documents stored in this patient file.
              </p>
            </div>

            <div className="page-actions">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search documents..."
                className="input sm:w-64"
              />

              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="input sm:w-auto"
              >
                <option value="All">All Types</option>

                {documentTypesInUse.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {documents.length === 0 ? (
            <div className="empty-state">
              <p>No documents yet</p>

              <p>
                Upload the first document for this patient above.
              </p>
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="empty-state">
              <p>No matching documents</p>

              <div className="page-actions">
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setTypeFilter("All");
                  }}
                  className="btn btn-secondary btn-sm"
                >
                  Clear filters
                </button>
              </div>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Document</th>
                    <th>Type</th>
                    <th>Description</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredDocuments.map((document) => (
                    <tr key={document.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[10px] font-bold text-slate-600">
                            {getDocumentIcon(document.storage_path)}
                          </div>

                          <div className="min-w-0">
                            <p className="max-w-[280px] truncate font-medium">
                              {document.document_name}
                            </p>

                            <p className="text-xs text-muted">
                              {getFileExtension(document.storage_path)} file
                            </p>
                          </div>
                        </div>
                      </td>

                      <td>
                        <span className="badge badge-gray">
                          {document.document_type || "Other"}
                        </span>
                      </td>

                      <td className="max-w-[260px] text-muted">
                        <span className="line-clamp-2">
                          {document.description || "—"}
                        </span>
                      </td>

                      <td className="whitespace-nowrap text-muted">
                        {new Date(
                          document.created_at
                        ).toLocaleDateString()}
                      </td>

                      <td>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              openDocument(document.storage_path)
                            }
                            className="btn btn-secondary btn-sm"
                          >
                            View
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              downloadDocument(
                                document.storage_path,
                                document.document_name
                              )
                            }
                            className="btn btn-secondary btn-sm"
                          >
                            Download
                          </button>

                          <button
                            type="button"
                            disabled={deletingId === document.id}
                            onClick={() =>
                              deleteDocument(
                                document.id,
                                document.storage_path
                              )
                            }
                            className="btn btn-danger btn-sm"
                          >
                            {deletingId === document.id
                              ? "Deleting..."
                              : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
