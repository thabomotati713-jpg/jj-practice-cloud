"use client";
import { supabase } from "../supabase";
export class ClaimRequestError extends Error {
  constructor(
    message: string,
    public existingClaimId?: string,
  ) {
    super(message);
  }
}
export async function claimRequest<T>(
  url: string,
  body?: unknown,
  signal?: AbortSignal,
  method: "POST" | "PUT" = "POST",
): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session)
    throw new ClaimRequestError(
      "Sign in with your practice profile to use claims.",
    );
  const response = await fetch(url, {
    method: body === undefined ? "GET" : method,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    cache: "no-store",
    signal,
  });
  const data = await response.json();
  if (!response.ok)
    throw new ClaimRequestError(
      data.error || "The claim request failed.",
      data.existingClaimId,
    );
  return data as T;
}
export async function downloadClaim(claimId: string) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Please sign in again.");
  const response = await fetch(`/api/claims/pdf?claim_id=${claimId}`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: "no-store",
  });
  if (!response.ok) {
    const body = await response.json();
    throw new Error(body.error || "The PDF could not be downloaded.");
  }
  const url = URL.createObjectURL(await response.blob()),
    link = document.createElement("a");
  link.href = url;
  link.download = `Claim-${claimId}.pdf`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
