export type ConsultationDraftData = Record<string, string>;
type RpcError = { code?: string; message: string };
export type DraftRpc = (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: RpcError | null }>;
export type SavedDraft = { id: string; revision: number; data: ConsultationDraftData; updated_at?: string };
export const draftSnapshot = (data: ConsultationDraftData) => JSON.stringify(Object.fromEntries(Object.keys(data).sort().map(key => [key, data[key]])));

/** Serialises saves and finalisation, so a late autosave cannot overwrite a newer edit. */
export class ConsultationDraftSession {
  revision: number;
  persisted: string;
  conflict = false;
  finishing = false;
  completed = false;
  private tail: Promise<unknown> = Promise.resolve();

  constructor(private rpc: DraftRpc, readonly id: string, readonly patientId: string,
    readonly appointmentId: string | null, initial: ConsultationDraftData, revision = 0) {
    this.revision = revision;
    this.persisted = draftSnapshot(initial);
  }

  private enqueue<T>(action: () => Promise<T>): Promise<T> {
    const task = this.tail.catch(() => undefined).then(action);
    this.tail = task;
    return task;
  }

  private async persist(data: ConsultationDraftData) {
    if (this.conflict) throw new Error("A newer draft exists in another tab. Reload before continuing.");
    if (this.completed) return;
    const snapshot = draftSnapshot(data);
    if (this.revision > 0 && snapshot === this.persisted) return;
    const { data: saved, error } = await this.rpc("pc_save_consultation_draft", {
      p_id: this.id, p_patient_id: this.patientId, p_appointment_id: this.appointmentId,
      p_data: data, p_revision: this.revision,
    });
    if (error) {
      if (error.code === "40001") this.conflict = true;
      throw new Error(error.message);
    }
    const result = saved as { revision?: number } | null;
    if (!result?.revision) throw new Error("The draft could not be confirmed. Please retry.");
    this.revision = result.revision;
    this.persisted = snapshot;
  }

  save(data: ConsultationDraftData) {
    if (this.finishing || this.completed) return this.tail.then(() => undefined);
    return this.enqueue(() => this.persist(data));
  }

  finalize(data: ConsultationDraftData): Promise<string> {
    if (this.finishing) return Promise.reject(new Error("This consultation is already being saved."));
    this.finishing = true;
    return this.enqueue(async () => {
      try {
        await this.persist(data);
        const result = await this.rpc("pc_finalize_consultation", {
          p_id: this.id, p_patient_id: this.patientId, p_appointment_id: this.appointmentId,
          p_data: data, p_revision: this.revision,
        });
        if (result.error) {
          if (result.error.code === "40001") this.conflict = true;
          throw new Error(result.error.message);
        }
        if (typeof result.data !== "string") throw new Error("The consultation could not be confirmed. Please retry.");
        this.completed = true;
        return result.data;
      } finally {
        this.finishing = false;
      }
    });
  }
}
