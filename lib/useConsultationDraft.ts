"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
import { ConsultationDraftSession, draftSnapshot, type ConsultationDraftData, type DraftRpc, type SavedDraft } from "./consultationDraft";

const callRpc: DraftRpc = async (name, args) => {
  const { data, error } = await supabase.rpc(name, args);
  return { data, error };
};

export function useConsultationDraft(patientId: string, appointmentId: string | null, enabled: boolean,
  data: ConsultationDraftData, restore: (data: ConsultationDraftData) => void) {
  const [session, setSession] = useState<ConsultationDraftSession | null>(null);
  const [status, setStatus] = useState("Loading draft…");
  const [error, setError] = useState("");
  const [restored, setRestored] = useState(false);
  const dataRef = useRef(data);
  const restoreRef = useRef(restore);
  const snapshot = draftSnapshot(data);

  useEffect(() => { dataRef.current = data; restoreRef.current = restore; });

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const load = async () => {
      try {
        const result = await callRpc("pc_consultation_draft", { p_patient_id: patientId, p_appointment_id: appointmentId });
        if (!active) return;
        if (result.error) throw new Error(result.error.message);
        const saved = result.data as SavedDraft | null;
        const initial = saved?.data || dataRef.current;
        if (saved) { restoreRef.current(initial); setRestored(true); }
        setSession(new ConsultationDraftSession(callRpc, saved?.id || crypto.randomUUID(), patientId, appointmentId, initial, saved?.revision || 0));
        setStatus(saved ? "Saved draft restored" : "Drafts save automatically as you type");
        setError("");
      } catch (e) {
        if (active) { setError(e instanceof Error ? e.message : "Could not load the draft. Please reload."); setStatus("Draft unavailable"); }
      }
    };
    void load();
    return () => { active = false; };
  }, [patientId, appointmentId, enabled]);

  const saveNow = useCallback(async () => {
    if (!session || session.patientId !== patientId || session.appointmentId !== appointmentId || !enabled) throw new Error("The draft is still loading.");
    setStatus("Saving draft…");
    try {
      await session.save(dataRef.current);
      setError("");
      setStatus(draftSnapshot(dataRef.current) === session.persisted ? "Draft saved" : "Changes waiting to save");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not save the draft. Keep this tab open and retry.";
      setError(message); setStatus(session.conflict ? "Draft changed in another tab" : "Draft not saved — keep this tab open");
      throw e;
    }
  }, [session, patientId, appointmentId, enabled]);

  useEffect(() => {
    if (!enabled || !session || session.patientId !== patientId || session.appointmentId !== appointmentId || session.finishing || session.completed || snapshot === session.persisted) return;
    const timer = setTimeout(() => { void saveNow().catch(() => undefined); }, 800);
    return () => clearTimeout(timer);
  }, [session, snapshot, saveNow, enabled, patientId, appointmentId]);

  useEffect(() => {
    const retry = () => { if (session && !session.completed && !session.conflict && draftSnapshot(dataRef.current) !== session.persisted) void saveNow().catch(() => undefined); };
    const protectChanges = (event: BeforeUnloadEvent) => {
      if (session && !session.completed && draftSnapshot(dataRef.current) !== session.persisted) { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("online", retry);
    window.addEventListener("beforeunload", protectChanges);
    return () => { window.removeEventListener("online", retry); window.removeEventListener("beforeunload", protectChanges); };
  }, [session, saveNow]);

  const finalize = async () => {
    if (!session || session.patientId !== patientId || session.appointmentId !== appointmentId || !enabled) throw new Error("The draft is still loading.");
    const id = await session.finalize(dataRef.current);
    setStatus("Consultation saved"); setError("");
    return id;
  };
  return { ready: Boolean(enabled && session && session.patientId === patientId && session.appointmentId === appointmentId), status, error, restored, conflict: session?.conflict || false, saveNow, finalize,
    dirty: Boolean(session && !session.completed && snapshot !== session.persisted) };
}
