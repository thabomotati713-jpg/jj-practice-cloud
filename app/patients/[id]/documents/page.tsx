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
      window.location.href = "/";
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
      <main className="flex min-h-screen items-center justify-center bg-slate-100">
        <p className="text-slate-500">Loading patient documents...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-500">
                Patient File
              </p>

              <h1 className="mt-1 text-2xl font-bold text-slate-900">
                Patient Documents
              </h1>

              <p className="mt-1 text-sm text-slate-600">
                {patientName}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  window.location.href = `/patients/${patientId}`;
                }}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Patient Profile
              </button>

              <button
                type="button"
                onClick={() => {
                  window.location.href = `/patients/${patientId}/edit`;
                }}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                Edit Patient
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {message}
          </div>
        )}

        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Total Documents</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">
              {documents.length}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Showing</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">
              {filteredDocuments.length}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Document Types</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">
              {documentTypesInUse.length}
            </p>
          </div>
        </div>

        <section className="mb-6 rounded-2xl bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-slate-900">
              Upload Patient Document
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Upload medical records, referrals, results, IDs and other
              documents. Maximum file size: 10 MB.
            </p>
          </div>

          <form onSubmit={handleUpload}>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Document Name
                </label>

                <input
                  value={documentName}
                  onChange={(e) => setDocumentName(e.target.value)}
                  placeholder="e.g. Blood Test Results"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Document Type
                </label>

                <select
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  {DOCUMENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  File
                </label>

                <input
                  id="document-file"
                  type="file"
                  onChange={(e) =>
                    setFile(e.target.files?.[0] || null)
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                />

                {file && (
                  <p className="mt-1 text-xs text-slate-500">
                    Selected: {file.name} (
                    {(file.size / 1024 / 1024).toFixed(2)} MB)
                  </p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Description
                </label>

                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional description"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                />
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="submit"
                disabled={uploading}
                className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {uploading ? "Uploading..." : "Upload Document"}
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Document History
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Search and manage documents stored in this patient file.
              </p>
            </div>

            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search documents..."
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500 sm:w-64"
              />

              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
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
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
              <p className="text-base font-medium text-slate-700">
                No documents yet
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Upload the first document for this patient above.
              </p>
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
              <p className="text-base font-medium text-slate-700">
                No matching documents
              </p>

              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setTypeFilter("All");
                }}
                className="mt-3 text-sm font-medium text-blue-600 hover:underline"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-3">Document</th>
                    <th className="px-3 py-3">Type</th>
                    <th className="px-3 py-3">Description</th>
                    <th className="px-3 py-3">Date</th>
                    <th className="px-3 py-3">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredDocuments.map((document) => (
                    <tr
                      key={document.id}
                      className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                    >
                      <td className="px-3 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[10px] font-bold text-slate-600">
                            {getDocumentIcon(document.storage_path)}
                          </div>

                          <div className="min-w-0">
                            <p className="max-w-[280px] truncate font-medium text-slate-900">
                              {document.document_name}
                            </p>

                            <p className="text-xs text-slate-500">
                              {getFileExtension(document.storage_path)} file
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-3 py-4">
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                          {document.document_type || "Other"}
                        </span>
                      </td>

                      <td className="max-w-[260px] px-3 py-4 text-slate-600">
                        <span className="line-clamp-2">
                          {document.description || "—"}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-3 py-4 text-slate-600">
                        {new Date(
                          document.created_at
                        ).toLocaleDateString()}
                      </td>

                      <td className="px-3 py-4">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              openDocument(document.storage_path)
                            }
                            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
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
                            className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
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
                            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
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
