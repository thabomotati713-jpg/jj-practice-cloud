"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type PracticeAccessGuardProps = {
  children: React.ReactNode;
};

export default function PracticeAccessGuard({
  children,
}: PracticeAccessGuardProps) {
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkAccess = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/";
        return;
      }

      const {
        data: profile,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select("role, active, practice_id")
        .eq("id", user.id)
        .single();

      if (
        profileError ||
        !profile ||
        !profile.active
      ) {
        await supabase.auth.signOut();
        window.location.href = "/";
        return;
      }

      if (profile.role === "superuser") {
        window.location.href = "/superuser";
        return;
      }

      if (!profile.practice_id) {
        await supabase.auth.signOut();
        window.location.href = "/";
        return;
      }

      const {
        data: practice,
        error: practiceError,
      } = await supabase
        .from("practices")
        .select("active")
        .eq("id", profile.practice_id)
        .single();

      if (
        practiceError ||
        !practice ||
        !practice.active
      ) {
        await supabase.auth.signOut();
        window.location.href = "/";
        return;
      }

      setChecking(false);
    };

    checkAccess();
  }, []);

  if (checking) {
    return (
      <main className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <p className="text-sm text-slate-600">
          Checking practice access...
        </p>
      </main>
    );
  }

  return <>{children}</>;
}
