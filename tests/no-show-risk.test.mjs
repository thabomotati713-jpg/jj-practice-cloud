import assert from "node:assert/strict";
import {
  dateInJohannesburg,
  scoreAppointments,
  shiftCalendarDate,
} from "../lib/ai/noShowRisk.ts";

const now = new Date("2026-09-26T10:00:00Z"); // 12:00 in Johannesburg
const appointment = (id, patient_id, appointment_date, start_time, status, reminder_sent = false) => ({
  id, patient_id, appointment_date, start_time, status, reminder_sent,
});
const patient = (id) => ({
  id, first_name: "Test", middle_name: null, last_name: "Patient",
  phone: "0710000000", email: null,
});

const upcoming = [
  appointment("a", "p1", "2026-09-27", "09:00:00", "scheduled"),
  appointment("b", "p2", "2026-09-27", "10:00:00", "confirmed", true),
  appointment("c", "p3", "2026-09-27", "11:00:00", "cancelled"),
  appointment("d", "p4", "2026-09-26", "10:00:00", "scheduled"),
];
const history = [
  { id: "h1", patient_id: "p1", status: "no_show" },
  { id: "h2", patient_id: "p1", status: "cancelled" },
  { id: "h3", patient_id: "p2", status: "completed" },
];
const result = scoreAppointments(upcoming, history, [patient("p1"), patient("p2")], now);
assert.deepEqual(result.map((item) => item.appointment.id), ["a", "b"]);
assert.equal(result[0].level, "High");
assert.ok(result[0].reasons.some((reason) => reason.includes("no-show")));
assert.equal(result[1].level, "Low");
assert.ok(result[1].reasons.includes("Automated reminder already sent"));

// Unknown attendance is not invented from a past scheduled booking.
const unknown = scoreAppointments(
  [appointment("e", "p5", "2026-09-27", "09:00", "scheduled")],
  [{ id: "h4", patient_id: "p5", status: "scheduled" }],
  [patient("p5")], now
);
assert.equal(unknown.length, 1);
assert.ok(!unknown[0].reasons.some((reason) => reason.includes("no-show")));

assert.equal(dateInJohannesburg(new Date("2026-09-26T22:30:00Z")), "2026-09-27");
assert.equal(shiftCalendarDate("2026-09-26", 30), "2026-10-26");
console.log("Live PracticeCloud no-show scoring checks passed.");
