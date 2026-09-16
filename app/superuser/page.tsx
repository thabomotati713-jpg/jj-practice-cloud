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
        window.location.href = "/login";
        return;
      }

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      const accessToken = session?.access_token;

      if (sessionError || !accessToken) {
        await supabase.auth.signOut();
        window.location.href = "/login";
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
          window.location.href = "/login";
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
    window.location.href = "/login";
  };

  if (loading) {
    return (
      <main className="page-shell">
        <div className="page-inner">
          <p className="page-subtitle">
            Loading Superuser dashboard...
          </p>
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
            <span className="app-brand-name">
              J&J Practice Cloud
            </span>
          </a>

          <div className="page-actions">
            <button
              type="button"
              onClick={() => {
                window.location.href =
                  "/superuser/practices/new";
              }}
              className="btn btn-primary btn-sm"
            >
              + Create Practice
            </button>

            <button
              type="button"
              onClick={handleSignOut}
              className="btn btn-secondary btn-sm"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="page-inner">
        <div className="page-header">
          <div>
            <h1 className="page-title">
              Superuser Control Centre
            </h1>

            <p className="page-subtitle">
              Signed in as {userName}
            </p>
          </div>
        </div>

        {error && (
          <div className="alert-error">{error}</div>
        )}

        <section className="stat-grid">
          <div className="stat-card">
            <p className="stat-label">
              Total Practices
            </p>

            <p className="stat-value">
              {stats.totalPractices}
            </p>
          </div>

          <div className="stat-card">
            <p className="stat-label">
              Active Practices
            </p>

            <p className="stat-value">
              {stats.activePractices}
            </p>
          </div>

          <div className="stat-card">
            <p className="stat-label">Total Users</p>

            <p className="stat-value">
              {stats.totalUsers}
            </p>
          </div>
        </section>

        <section className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Practices</h2>

              <p className="page-subtitle">
                All practices registered on J&J Practice
                Cloud.
              </p>
            </div>

            <div className="page-actions">
              <button
                type="button"
                onClick={() => {
                  window.location.href =
                    "/superuser/practices/new";
                }}
                className="btn btn-primary btn-sm"
              >
                Create Practice
              </button>
            </div>
          </div>

          {practices.length === 0 ? (
            <div className="empty-state">
              No practices have been created yet.
            </div>
          ) : (
            <div className="table-wrap border-0 shadow-none">
              <table className="table">
                <thead>
                  <tr>
                    <th>Practice</th>

                    <th>Practice Code</th>

                    <th>Contact</th>

                    <th>Location</th>

                    <th>Status</th>

                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {practices.map((practice) => (
                    <tr key={practice.id}>
                      <td>
                        <div className="font-semibold">
                          {practice.name}
                        </div>

                        <div className="page-subtitle text-xs">
                          Created{" "}
                          {new Date(
                            practice.created_at
                          ).toLocaleDateString(
                            "en-ZA"
                          )}
                        </div>
                      </td>

                      <td>
                        {practice.practice_code || "—"}
                      </td>

                      <td>
                        <div>
                          {practice.email || "—"}
                        </div>

                        {practice.phone && (
                          <div className="page-subtitle text-xs">
                            {practice.phone}
                          </div>
                        )}
                      </td>

                      <td>
                        {[practice.city, practice.province]
                          .filter(Boolean)
                          .join(", ") || "—"}
                      </td>

                      <td>
                        <span
                          className={
                            practice.active
                              ? "badge badge-green"
                              : "badge badge-red"
                          }
                        >
                          {practice.active
                            ? "Active"
                            : "Inactive"}
                        </span>
                      </td>

                      <td>
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
                          className={`btn btn-sm ${
                            practice.active
                              ? "btn-danger"
                              : "btn-secondary"
                          }`}
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
