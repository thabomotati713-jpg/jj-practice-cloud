"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { supabase } from "../../lib/supabase";

type Settings = {
  practice_name: string;
  practice_code: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  province: string;
  country: string;
  postal_code: string;
  logo_url: string;
  queue_checkin_token: string;
};

const emptySettings: Settings = {
  practice_name: "",
  practice_code: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  province: "",
  country: "",
  postal_code: "",
  logo_url: "",
  queue_checkin_token: "",
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(emptySettings);
  const [practiceId, setPracticeId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [qrBusy, setQrBusy] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    if (!settings.queue_checkin_token || typeof window === "undefined") {
      setQrDataUrl("");
      return;
    }

    const checkInUrl = `${window.location.origin}/check-in/${settings.queue_checkin_token}`;

    QRCode.toDataURL(checkInUrl, {
      width: 480,
      margin: 2,
      errorCorrectionLevel: "H",
    })
      .then(setQrDataUrl)
      .catch(() => setError("Could not generate the reception QR preview."));
  }, [settings.queue_checkin_token]);

  const loadSettings = async () => {
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

    const { data, error: settingsError } = await supabase
      .from("practice_settings")
      .select("setting_key, setting_value")
      .eq("practice_id", profile.practice_id);

    if (settingsError) {
      setError(settingsError.message);
      setLoading(false);
      return;
    }

    const loaded = { ...emptySettings };

    for (const row of data || []) {
      if (row.setting_key in loaded) {
        loaded[row.setting_key as keyof Settings] = row.setting_value || "";
      }
    }

    setSettings(loaded);
    setLoading(false);
  };

  const generateReceptionQr = async () => {
    if (!practiceId) return;

    setQrBusy(true);
    setError("");
    setMessage("");

    const token = crypto.randomUUID();

    const { error: qrError } = await supabase
      .from("practice_settings")
      .upsert(
        {
          practice_id: practiceId,
          setting_key: "queue_checkin_token",
          setting_value: token,
        },
        { onConflict: "practice_id,setting_key" }
      );

    if (qrError) {
      setError(`Could not generate reception QR: ${qrError.message}`);
      setQrBusy(false);
      return;
    }

    setSettings((current) => ({
      ...current,
      queue_checkin_token: token,
    }));
    setMessage("Reception QR code generated and saved.");
    setQrBusy(false);
  };

  const printReceptionQr = () => {
    if (!qrDataUrl || !settings.queue_checkin_token) return;

    const checkInUrl = `${window.location.origin}/check-in/${settings.queue_checkin_token}`;
    const safeName = (settings.practice_name || "Medical Practice").replace(
      /[&<>"']/g,
      (character) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#039;",
        })[character] || character
    );

    const printWindow = window.open("", "_blank", "width=720,height=900");

    if (!printWindow) {
      setError("Pop-ups are blocked. Allow pop-ups once, then press Print QR again.");
      return;
    }

    printWindow.document.write(`<!doctype html>
      <html>
        <head>
          <title>${safeName} Reception QR</title>
          <style>
            body{font-family:Arial,sans-serif;margin:0;padding:48px;text-align:center;color:#0f172a}
            .sheet{max-width:560px;margin:auto;border:2px solid #0f766e;border-radius:28px;padding:38px}
            h1{font-size:30px;margin:0 0 8px} p{font-size:16px;line-height:1.5;color:#475569}
            img{width:360px;max-width:90%;margin:24px auto;display:block}
            .label{font-size:13px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#0f766e}
            .url{font-size:11px;word-break:break-all;color:#64748b;margin-top:24px}
            .brand{margin-top:30px;font-size:12px;color:#64748b}
            @media print{body{padding:0}.sheet{border:none}}
          </style>
        </head>
        <body>
          <div class="sheet">
            <div class="label">Patient self check-in</div>
            <h1>${safeName}</h1>
            <p>Scan this QR code when you arrive, verify your patient details, and join the consultation queue.</p>
            <img src="${qrDataUrl}" alt="Reception check-in QR code" />
            <p><strong>Scan with your phone camera</strong></p>
            <div class="url">${checkInUrl}</div>
            <div class="brand">Powered by J&amp;J PracticeCloud</div>
          </div>
          <script>window.onload=()=>{window.print();}</script>
        </body>
      </html>`);
    printWindow.document.close();
  };

  const updateField = (key: keyof Settings, value: string) => {
    setSettings((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    setSaving(true);
    setMessage("");
    setError("");

    let finalSettings = { ...settings };

    if (logoFile) {
      const extension =
        logoFile.name.split(".").pop()?.toLowerCase() || "png";

      const filePath = `${practiceId}/${crypto.randomUUID()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("practice-logos")
        .upload(filePath, logoFile, {
          cacheControl: "3600",
          upsert: false,
          contentType: logoFile.type,
        });

      if (uploadError) {
        setError(`Logo upload failed: ${uploadError.message}`);
        setSaving(false);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from("practice-logos")
        .getPublicUrl(filePath);

      finalSettings.logo_url = publicUrlData.publicUrl;
      setSettings(finalSettings);
      setLogoFile(null);
    }

    const rows = Object.entries(finalSettings).map(
      ([setting_key, setting_value]) => ({
        practice_id: practiceId,
        setting_key,
        setting_value,
      })
    );

    const { error: saveError } = await supabase
      .from("practice_settings")
      .upsert(rows, {
        onConflict: "practice_id,setting_key",
      });

    if (saveError) {
      setError(saveError.message);
      setSaving(false);
      return;
    }

    setMessage("Practice settings saved successfully.");
    setSaving(false);
  };

  if (loading) {
    return (
      <main className="page-shell">
        <div className="page-inner">
          <div className="card mx-auto max-w-4xl">
            <div className="empty-state">Loading practice settings...</div>
          </div>
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
                window.location.href = "/dashboard";
              }}
              className="btn btn-secondary btn-sm"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </header>

      <div className="page-inner">
        <div className="page-header">
          <div>
            <h1 className="page-title">Practice Settings</h1>
            <p className="page-subtitle">
              Manage your practice information
            </p>
          </div>

          <div className="page-actions">
            <a href="/audit" className="btn btn-secondary btn-sm">
              Audit Trail
            </a>
          </div>
        </div>

        <form onSubmit={handleSave} className="mx-auto max-w-4xl">
          {message && <div className="alert-success">{message}</div>}

          {error && <div className="alert-error">{error}</div>}

          <section className="card">
            <div className="card-header">
              <h2 className="card-title">Practice Information</h2>
            </div>

            <div className="card-body">
              <div className="grid grid-cols-1 gap-x-5 sm:grid-cols-2">
                <label className="field">
                  <span className="label">Practice Name *</span>
                  <input
                    value={settings.practice_name}
                    onChange={(e) =>
                      updateField("practice_name", e.target.value)
                    }
                    required
                    className="input"
                  />
                </label>

                <label className="field">
                  <span className="label">Practice Code</span>
                  <input
                    value={settings.practice_code}
                    onChange={(e) =>
                      updateField("practice_code", e.target.value)
                    }
                    className="input"
                  />
                </label>

                <label className="field">
                  <span className="label">Email</span>
                  <input
                    type="email"
                    value={settings.email}
                    onChange={(e) => updateField("email", e.target.value)}
                    className="input"
                  />
                </label>

                <label className="field">
                  <span className="label">Phone</span>
                  <input
                    value={settings.phone}
                    onChange={(e) => updateField("phone", e.target.value)}
                    className="input"
                  />
                </label>
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card-header">
              <h2 className="card-title">Address</h2>
            </div>

            <div className="card-body">
              <div className="grid grid-cols-1 gap-x-5 sm:grid-cols-2">
                <label className="field sm:col-span-2">
                  <span className="label">Address</span>
                  <input
                    value={settings.address}
                    onChange={(e) => updateField("address", e.target.value)}
                    className="input"
                  />
                </label>

                <label className="field">
                  <span className="label">City</span>
                  <input
                    value={settings.city}
                    onChange={(e) => updateField("city", e.target.value)}
                    className="input"
                  />
                </label>

                <label className="field">
                  <span className="label">Province</span>
                  <input
                    value={settings.province}
                    onChange={(e) => updateField("province", e.target.value)}
                    className="input"
                  />
                </label>

                <label className="field">
                  <span className="label">Country</span>
                  <input
                    value={settings.country}
                    onChange={(e) => updateField("country", e.target.value)}
                    className="input"
                  />
                </label>

                <label className="field">
                  <span className="label">Postal Code</span>
                  <input
                    value={settings.postal_code}
                    onChange={(e) =>
                      updateField("postal_code", e.target.value)
                    }
                    className="input"
                  />
                </label>
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card-header">
              <h2 className="card-title">Branding</h2>
            </div>

            <div className="card-body">
              <label className="field">
                <span className="label">Practice Logo</span>

                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;

                    if (file && file.size > 2 * 1024 * 1024) {
                      setError("Logo must be 2 MB or smaller.");
                      e.target.value = "";
                      setLogoFile(null);
                      return;
                    }

                    setError("");
                    setLogoFile(file);
                  }}
                  className="input"
                />
              </label>

              {logoFile && (
                <p className="text-sm text-slate-600">
                  Selected: {logoFile.name}
                </p>
              )}

              {settings.logo_url && (
                <div className="mt-4">
                  <p className="label">Current logo</p>

                  <img
                    src={settings.logo_url}
                    alt="Practice logo"
                    className="max-h-32 max-w-[220px] rounded-lg border bg-white p-2"
                  />
                </div>
              )}
            </div>
          </section>

          <section className="card">
            <div className="card-header">
              <h2 className="card-title">Patient Arrival & Queue QR</h2>
            </div>

            <div className="card-body">
              <p className="mb-5 text-sm leading-6 text-slate-600">
                Print this QR code and place it at reception. Existing patients can scan it,
                verify their patient number and mobile number, and automatically join your
                live Patients in Line queue.
              </p>

              <div className="grid gap-6 md:grid-cols-[260px_1fr] md:items-center">
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-center">
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt="Patient reception check-in QR code"
                      className="mx-auto w-full max-w-[230px] rounded-2xl bg-white p-2"
                    />
                  ) : (
                    <div className="grid aspect-square place-items-center rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
                      Generate your practice QR code
                    </div>
                  )}
                </div>

                <div>
                  <p className="label">Reception check-in link</p>
                  <input
                    readOnly
                    value={
                      settings.queue_checkin_token && typeof window !== "undefined"
                        ? `${window.location.origin}/check-in/${settings.queue_checkin_token}`
                        : ""
                    }
                    placeholder="Generate a QR code first"
                    className="input"
                  />

                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => void generateReceptionQr()}
                      disabled={qrBusy}
                      className="btn btn-secondary"
                    >
                      {qrBusy
                        ? "Generating..."
                        : settings.queue_checkin_token
                          ? "Regenerate QR"
                          : "Generate QR"}
                    </button>

                    <button
                      type="button"
                      onClick={printReceptionQr}
                      disabled={!qrDataUrl}
                      className="btn btn-primary"
                    >
                      Print Reception QR
                    </button>

                    {settings.queue_checkin_token ? (
                      <a
                        href={`/check-in/${settings.queue_checkin_token}`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-secondary"
                      >
                        Test Check-In Page
                      </a>
                    ) : null}

                    <a href="/queue" className="btn btn-secondary">
                      Open Patients in Line
                    </a>
                  </div>

                  {settings.queue_checkin_token ? (
                    <p className="mt-4 text-xs leading-5 text-slate-500">
                      Regenerating the QR immediately disables the old printed code. Only
                      regenerate it if the old code has been lost or shared somewhere it
                      should not be.
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </section>

          <div className="page-actions">
            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary w-full"
            >
              {saving ? "Saving..." : "Save Practice Settings"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
