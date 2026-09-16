import { supabase } from "./supabase";

/**
 * Fire-and-forget POPIA audit logging.
 *
 * Call from any client component after a sensitive record is viewed or
 * changed. Never throws — auditing must never break the workflow.
 * Identity is attached server-side from the session.
 */
export function logAudit(
  action: "view" | "create" | "update" | "delete" | "print",
  entity: string,
  entityId?: string | null,
  details?: string
): void {
  void (async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) return;

      await fetch("/api/audit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action,
          entity,
          entity_id: entityId || null,
          details: details || null,
        }),
      });
    } catch {
      // Intentionally silent.
    }
  })();
}
