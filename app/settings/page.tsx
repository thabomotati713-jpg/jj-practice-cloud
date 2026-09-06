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
      <main className="min-h-screen bg-slate-100 p-6">
        <div className="mx-auto max-w-4xl rounded-xl bg-white p-6 shadow">
          Loading practice settings...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Practice Settings
            </h1>
            <p className="text-sm text-slate-500">
              Manage your practice information
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              window.location.href = "/dashboard";
            }}
            className="rounded-lg border bg-white px-4 py-2 text-sm font-medium text-slate-700"
          >
            Back to Dashboard
          </button>
        </div>

        <form
          onSubmit={handleSave}
          className="space-y-6 rounded-xl bg-white p-6 shadow"
        >
          {message && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
              {message}
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <section>
            <h2 className="mb-4 text-lg font-semibold text-slate-900">
              Practice Information
            </h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Practice Name *
                </label>
                <input
                  value={settings.practice_name}
                  onChange={(e) =>
                    updateField("practice_name", e.target.value)
                  }
                  required
                  className="w-full rounded-lg border px-3 py-2"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Practice Code
                </label>
                <input
                  value={settings.practice_code}
                  onChange={(e) =>
                    updateField("practice_code", e.target.value)
                  }
                  className="w-full rounded-lg border px-3 py-2"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Email
                </label>
                <input
                  type="email"
                  value={settings.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  className="w-full rounded-lg border px-3 py-2"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Phone
                </label>
                <input
                  value={settings.phone}
                  onChange={(e) => updateField("phone", e.target.value)}
                  className="w-full rounded-lg border px-3 py-2"
                />
              </div>
            </div>
          </section>

          <section>
            <h2 className="mb-4 text-lg font-semibold text-slate-900">
              Address
            </h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Address
                </label>
                <input
                  value={settings.address}
                  onChange={(e) => updateField("address", e.target.value)}
                  className="w-full rounded-lg border px-3 py-2"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  City
                </label>
                <input
                  value={settings.city}
                  onChange={(e) => updateField("city", e.target.value)}
                  className="w-full rounded-lg border px-3 py-2"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Province
                </label>
                <input
                  value={settings.province}
                  onChange={(e) => updateField("province", e.target.value)}
                  className="w-full rounded-lg border px-3 py-2"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Country
                </label>
                <input
                  value={settings.country}
                  onChange={(e) => updateField("country", e.target.value)}
                  className="w-full rounded-lg border px-3 py-2"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Postal Code
                </label>
                <input
                  value={settings.postal_code}
                  onChange={(e) =>
                    updateField("postal_code", e.target.value)
                  }
                  className="w-full rounded-lg border px-3 py-2"
                />
              </div>
            </div>
          </section>

          <section>
            <h2 className="mb-4 text-lg font-semibold text-slate-900">
              Branding
            </h2>

            <label className="mb-1 block text-sm font-medium text-slate-700">
              Practice Logo
            </label>

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
              className="w-full rounded-lg border px-3 py-2"
            />

            {logoFile && (
              <p className="mt-2 text-sm text-slate-600">
                Selected: {logoFile.name}
              </p>
            )}

            {settings.logo_url && (
              <div className="mt-4">
                <p className="mb-2 text-sm font-medium text-slate-700">
                  Current logo
                </p>

                <img
                  src={settings.logo_url}
                  alt="Practice logo"
                  className="max-h-32 max-w-[220px] rounded-lg border bg-white p-2"
                />
              </div>
            )}
          </section>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-slate-900 px-4 py-3 font-medium text-white disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Practice Settings"}
          </button>
        </form>
      </div>
    </main>
  );
}
