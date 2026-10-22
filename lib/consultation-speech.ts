import type { SpeechResultList } from "./consultation-workbench";

export type Recognizer = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  processLocally?: boolean;
  onresult: ((event: { results: SpeechResultList }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
export type SpeechConstructor = {
  new (): Recognizer;
  available?: (options: {
    langs: string[];
    processLocally: boolean;
    quality?: string;
  }) => Promise<string>;
};

// Preparation never starts a microphone, installs a language pack, or silently
// switches from on-device processing to a remote speech provider.
export async function prepareDictation(
  Speech: SpeechConstructor | undefined,
  mode: "local" | "browser_service",
  consent: boolean,
  language: string,
) {
  if (mode === "browser_service" && !consent)
    throw new Error("Confirm consent before using the browser speech service.");
  if (!Speech)
    throw new Error(
      "Speech recognition is unavailable in this browser. Type or paste a transcript, or use your device keyboard dictation.",
    );
  const r = new Speech();
  if (mode === "local") {
    if (!("processLocally" in r))
      throw new Error(
        "On-device recognition is unavailable here. Use typed/pasted text or explicitly select the browser speech service.",
      );
    if (Speech.available) {
      const state = await Speech.available({
        langs: [language],
        processLocally: true,
        quality: "dictation",
      });
      if (state !== "available")
        throw new Error(
          "This on-device language pack is not installed or supported. Try another language or use typed/pasted text.",
        );
    }
    r.processLocally = true;
  } else if ("processLocally" in r) r.processLocally = false;
  r.lang = language;
  r.continuous = true;
  r.interimResults = true;
  return r;
}

export function abortDictation(r: Recognizer | null) {
  if (!r) return;
  r.onresult = null;
  r.onerror = null;
  r.onend = null;
  try {
    r.abort();
  } catch {}
}
