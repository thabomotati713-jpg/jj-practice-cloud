"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

/*
 * In-app video consultation room.
 *
 * Uses Jitsi Meet (meet.jit.si public server) with a room name derived
 * from the appointment ID, so doctor and patient land in the same room
 * without scheduling infrastructure. The patient joins via the link in
 * their confirmation email; the doctor opens this page at appointment
 * time.
 *
 * Note: the public meet.jit.si server is fine for a pilot, but a medical
 * product should eventually self-host Jitsi for POPIA-grade confidentiality.
 */
export default function ConsultRoomPage() {
  const params = useParams<{ id: string }>();
  const [joined, setJoined] = useState(false);
  const [copied, setCopied] = useState(false);

  const appointmentId = params?.id;
  const roomName = appointmentId
    ? `jjpractice-${appointmentId}`
    : "";
  const meetUrl = roomName
    ? `https://meet.jit.si/${roomName}`
    : "";
  const patientLink = appointmentId
    ? `/consult/${appointmentId}`
    : "";

  useEffect(() => {
    document.title = "Video Consultation — J&J Practice Cloud";
  }, []);

  if (!appointmentId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4f7f9]">
        <p className="text-sm text-slate-500">
          No consultation room specified.
        </p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-[#0f1f2d]">
      <header className="flex items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <img
            src="/logo.jpg"
            alt=""
            className="h-9 w-9 rounded-lg bg-white object-contain p-0.5"
          />
          <p className="text-sm font-semibold text-white">
            Video Consultation
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(
              `${window.location.origin}${patientLink}`
            );
            setCopied(true);
          }}
          className="rounded-xl bg-white/10 px-4 py-2 text-xs font-semibold text-white ring-1 ring-white/20 transition hover:bg-white/20"
        >
          {copied ? "Patient link copied ✓" : "Copy patient link"}
        </button>
      </header>

      <div className="flex-1">
        {joined ? (
          <iframe
            title="Video consultation"
            src={meetUrl}
            allow="camera; microphone; fullscreen; display-capture; autoplay"
            className="h-full w-full border-0"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-6 px-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#2b9a95]/20 text-3xl">
              🩺
            </div>

            <div>
              <h1 className="text-2xl font-bold text-white">
                Ready to start the consultation?
              </h1>

              <p className="mt-2 max-w-md text-sm text-white/60">
                Room{" "}
                <span className="font-mono text-white/80">
                  {roomName}
                </span>
                . The patient joins the same room from the link in
                their confirmation email.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => setJoined(true)}
                className="rounded-xl bg-[#2b9a95] px-8 py-3 text-sm font-semibold text-white transition hover:bg-[#1f7c7a]"
              >
                Join consultation room
              </button>

              <button
                type="button"
                onClick={() => window.history.back()}
                className="rounded-xl border border-white/20 px-6 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/10"
              >
                Back
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
