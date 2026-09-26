export type AppointmentForRisk = {
  id: string;
  patient_id: string;
  appointment_date: string;
  start_time: string;
  status: string | null;
  reminder_sent: boolean | null;
};

export type PatientForRisk = {
  id: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  phone: string | null;
  email: string | null;
};

export type HistoricalOutcome = {
  id: string;
  patient_id: string;
  status: string;
};

export type RiskLevel = "High" | "Medium" | "Low";

export type ScoredAppointment = {
  appointment: AppointmentForRisk;
  patient: PatientForRisk | null;
  score: number;
  level: RiskLevel;
  reasons: string[];
  action: string;
};

const johannesburgDate = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Johannesburg",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function dateInJohannesburg(now = new Date()): string {
  const parts = Object.fromEntries(
    johannesburgDate.formatToParts(now).map((part) => [part.type, part.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function shiftCalendarDate(date: string, days: number): string {
  const shifted = new Date(`${date}T12:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

export function appointmentStart(appointment: AppointmentForRisk): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(appointment.appointment_date) ||
      !/^\d{2}:\d{2}(:\d{2})?$/.test(appointment.start_time)) return null;

  // South Africa uses UTC+02:00 year-round. Appointment times are local to
  // the practice; an explicit offset avoids the viewer's device time zone.
  const start = new Date(
    `${appointment.appointment_date}T${appointment.start_time.slice(0, 5)}:00+02:00`
  );
  return Number.isNaN(start.getTime()) ? null : start;
}

/** Rule-based follow-up priority. The number is not a no-show probability. */
export function scoreAppointments(
  upcoming: AppointmentForRisk[],
  history: HistoricalOutcome[],
  patients: PatientForRisk[],
  now = new Date()
): ScoredAppointment[] {
  const outcomes = new Map<string, { missed: number; cancelled: number }>();
  for (const row of history) {
    const counts = outcomes.get(row.patient_id) || { missed: 0, cancelled: 0 };
    if (row.status === "no_show") counts.missed += 1;
    if (row.status === "cancelled") counts.cancelled += 1;
    outcomes.set(row.patient_id, counts);
  }
  const patientsById = new Map(patients.map((patient) => [patient.id, patient]));

  return upcoming.flatMap((appointment) => {
    const start = appointmentStart(appointment);
    if (!start || start <= now ||
        !["scheduled", "confirmed"].includes(appointment.status || "scheduled")) return [];

    const patient = patientsById.get(appointment.patient_id) || null;
    const counts = outcomes.get(appointment.patient_id) || { missed: 0, cancelled: 0 };
    const hoursUntil = (start.getTime() - now.getTime()) / 3_600_000;
    const reasons: string[] = [];
    let score = 20;

    if (counts.missed) {
      score += Math.min(counts.missed, 2) * 25;
      reasons.push(`${counts.missed} recorded no-show${counts.missed === 1 ? "" : "s"} in the past year`);
    }
    if (counts.cancelled) {
      score += Math.min(counts.cancelled, 2) * 10;
      reasons.push(`${counts.cancelled} recorded cancellation${counts.cancelled === 1 ? "" : "s"} in the past year`);
    }
    if (appointment.status === "confirmed") {
      score -= 10;
      reasons.push("Appointment confirmed");
    } else if (hoursUntil <= 24) {
      score += 15;
      reasons.push("Within 24 hours and not confirmed");
    } else if (hoursUntil <= 72) {
      score += 5;
      reasons.push("Within 3 days and not confirmed");
    }
    if (patient && !patient.phone?.trim()) {
      score += 10;
      reasons.push("No phone number saved");
    }
    if (appointment.reminder_sent) reasons.push("Automated reminder already sent");
    if (!reasons.length) reasons.push("No recorded attendance concerns");

    score = Math.max(5, Math.min(95, score));
    const level: RiskLevel = score >= 65 ? "High" : score >= 35 ? "Medium" : "Low";
    const action = level === "High"
      ? "Call to confirm, and offer help with rescheduling if needed."
      : level === "Medium"
        ? "Request confirmation using a suitable contact method."
        : "Continue with the normal reminder process.";

    return [{ appointment, patient, score, level, reasons, action }];
  }).sort((a, b) =>
    b.score - a.score ||
    `${a.appointment.appointment_date} ${a.appointment.start_time}`.localeCompare(
      `${b.appointment.appointment_date} ${b.appointment.start_time}`
    )
  );
}
