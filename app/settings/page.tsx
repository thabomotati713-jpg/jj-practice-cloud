"use client";

import { useEffect, useState } from "react";
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
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(emptySettings);
  const [practiceId, setPracticeId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadSettings();
  }, []);

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
