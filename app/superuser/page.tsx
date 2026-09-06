"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type Practice = {
  id: string;
  name: string;
  practice_code: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  province: string | null;
  active: boolean;
  created_at: string;
};

type Stats = {
  totalPractices: number;
  activePractices: number;
  totalUsers: number;
};

export default function SuperuserPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [userName, setUserName] = useState("");
  const [updatingPracticeId, setUpdatingPracticeId] =
    useState("");

  const [stats, setStats] = useState<Stats>({
    totalPractices: 0,
    activePractices: 0,
    totalUsers: 0,
  });

  const [practices, setPractices] = useState<Practice[]>(
    []
  );

  useEffect(() => {
    loadSuperuserDashboard();
  }, []);

  const loadSuperuserDashboard = async () => {
    try {
      setLoading(true);
      setError("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/";
        return;
      }

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      const accessToken = session?.access_token;

      if (sessionError || !accessToken) {
        await supabase.auth.signOut();
        window.location.href = "/";
        return;
      }

      const response = await fetch(
        "/api/superuser/dashboard",
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        setError(
          result.error ||
            "Could not load the Superuser dashboard."
        );

        if (
          response.status === 401 ||
          response.status === 403
        ) {
          await supabase.auth.signOut();
          window.location.href = "/";
        }

        return;
      }

      setUserName(
        result.user?.name ||
          result.userName ||
          "Superuser"
      );

      setPractices(
        (result.practices || []) as Practice[]
      );

      setStats({
        totalPractices:
          result.stats?.totalPractices || 0,

        activePractices:
          result.stats?.activePractices || 0,

        totalUsers:
          result.stats?.totalUsers || 0,
      });
    } catch (error) {
      console.error(
        "Superuser dashboard error:",
        error
      );

      setError(
        "Could not load the Superuser dashboard."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePractice = async (
    practice: Practice
  ) => {
    const newActiveStatus = !practice.active;

    const action = newActiveStatus
      ? "activate"
      : "disable";

    const confirmed = window.confirm(
      `Are you sure you want to ${action} ${practice.name}?`
    );

    if (!confirmed) {
      return;
    }

    try {
      setError("");
      setUpdatingPracticeId(practice.id);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const accessToken = session?.access_token;

      if (!accessToken) {
        setError("Your login session has expired.");
        return;
      }

      const response = await fetch(
        "/api/superuser/practices/toggle-active",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            practiceId: practice.id,
            active: newActiveStatus,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        setError(
          result.error ||
            "Could not update the practice status."
        );
        return;
      }

      await loadSuperuserDashboard();
    } catch (error) {
      console.error(
        "Toggle practice error:",
        error
      );

      setError(
        "Could not update the practice status."
      );
    } finally {
      setUpdatingPracticeId("");
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <p className="text-slate-600">
          Loading Superuser dashboard...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-5">
          <div>
            <p className="text-sm font-semibold text-blue-700">
              J&J PRACTICE CLOUD
            </p>

            <h1 className="text-2xl font-bold text-slate-900">
              Superuser Control Centre
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Signed in as {userName}
            </p>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                window.location.href =
                  "/superuser/practices/new";
              }}
              className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
            >
              + Create Practice
            </button>

            <button
              type="button"
              onClick={handleSignOut}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8">
        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="mb-8 grid gap-5 md:grid-cols-3">
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Total Practices
            </p>

            <p className="mt-2 text-3xl font-bold text-slate-900">
              {stats.totalPractices}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Active Practices
            </p>

            <p className="mt-2 text-3xl font-bold text-green-700">
              {stats.activePractices}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Total Users
            </p>

            <p className="mt-2 text-3xl font-bold text-blue-700">
              {stats.totalUsers}
            </p>
          </div>
        </section>

        <section className="rounded-2xl bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                Practices
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                All practices registered on J&J Practice Cloud.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                window.location.href =
                  "/superuser/practices/new";
              }}
              className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
            >
              Create Practice
            </button>
          </div>

          {practices.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              No practices have been created yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-6 py-4 font-semibold">
                      Practice
                    </th>

                    <th className="px-6 py-4 font-semibold">
                      Practice Code
                    </th>

                    <th className="px-6 py-4 font-semibold">
                      Contact
                    </th>

                    <th className="px-6 py-4 font-semibold">
                      Location
                    </th>

                    <th className="px-6 py-4 font-semibold">
                      Status
                    </th>

                    <th className="px-6 py-4 font-semibold">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {practices.map((practice) => (
                    <tr key={practice.id}>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900">
                          {practice.name}
                        </div>

                        <div className="mt-1 text-xs text-slate-500">
                          Created{" "}
                          {new Date(
                            practice.created_at
                          ).toLocaleDateString(
                            "en-ZA"
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4 text-slate-600">
                        {practice.practice_code || "—"}
                      </td>

                      <td className="px-6 py-4 text-slate-600">
                        <div>
                          {practice.email || "—"}
                        </div>

                        {practice.phone && (
                          <div className="mt-1 text-xs text-slate-500">
                            {practice.phone}
                          </div>
                        )}
                      </td>

                      <td className="px-6 py-4 text-slate-600">
                        {[practice.city, practice.province]
                          .filter(Boolean)
                          .join(", ") || "—"}
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={
                            practice.active
                              ? "rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700"
                              : "rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700"
                          }
                        >
                          {practice.active
                            ? "Active"
                            : "Inactive"}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <button
                          type="button"
                          disabled={
                            updatingPracticeId ===
                            practice.id
                          }
                          onClick={() =>
                            handleTogglePractice(
                              practice
                            )
                          }
                          className="min-w-[110px] rounded-lg px-4 py-2 text-xs font-bold shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                          style={{
                            backgroundColor:
                              practice.active
                                ? "#dc2626"
                                : "#16a34a",
                            color: "#ffffff",
                            border:
                              practice.active
                                ? "1px solid #b91c1c"
                                : "1px solid #15803d",
                          }}
                        >
                          {updatingPracticeId ===
                          practice.id
                            ? "Updating..."
                            : practice.active
                            ? "Disable"
                            : "Activate"}
                        </button>
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
