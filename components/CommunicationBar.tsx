"use client";

/*
 * CommunicationBar — one-tap contact actions for a patient.
 *
 * Uses free platform deep links, no messaging infrastructure required:
 * - WhatsApp click-to-chat (wa.me) with a prefilled greeting
 * - Native phone dialler (tel:)
 * - Native SMS (sms:)
 * - Email client (mailto:)
 *
 * Works on mobile and desktop (desktop opens the corresponding app
 * when installed, or shows the number to call).
 */

type CommunicationBarProps = {
  phone: string | null;
  email: string | null;
  firstName?: string | null;
};

function toInternational(phone: string) {
  const digits = phone.replace(/[^\d+]/g, "");

  if (digits.startsWith("+")) {
    return digits.slice(1);
  }

  // Local SA format 0XXXXXXXXX -> 27XXXXXXXXX
  if (digits.startsWith("0")) {
    return `27${digits.slice(1)}`;
  }

  return digits;
}

export default function CommunicationBar({
  phone,
  email,
  firstName,
}: CommunicationBarProps) {
  if (!phone && !email) return null;

  const whatsappHref = phone
    ? `https://wa.me/${toInternational(phone)}?text=${encodeURIComponent(
        `Hello ${firstName || ""}`.trim()
      )}`
    : null;

  const callHref = phone ? `tel:${toInternational(phone)}` : null;
  const smsHref = phone ? `sms:${toInternational(phone)}` : null;
  const mailHref = email
    ? `mailto:${email}?subject=${encodeURIComponent(
        "J&J Practice Cloud"
      )}`
    : null;

  const linkClasses =
    "btn btn-secondary btn-sm";

  return (
    <div className="page-actions mb-6">
      {whatsappHref && (
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClasses}
          title="Message on WhatsApp"
        >
          WhatsApp
        </a>
      )}

      {callHref && (
        <a href={callHref} className={linkClasses} title="Call patient">
          Call
        </a>
      )}

      {smsHref && (
        <a href={smsHref} className={linkClasses} title="Send an SMS">
          SMS
        </a>
      )}

      {mailHref && (
        <a href={mailHref} className={linkClasses} title="Send an email">
          Email
        </a>
      )}
    </div>
  );
}
