"use client";
import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  VISIT_TEMPLATES,
  TEST_CATALOG,
  fillEmptyNotes,
  patientContext,
  appendNote,
  newInvestigation,
  collectSpeech,
  type EncounterDetails,
  type NoteFields,
  type Investigation,
} from "@/lib/consultation-workbench";
import styles from "./consultation-workbench.module.css";

import {
  prepareDictation,
  abortDictation,
  type Recognizer,
  type SpeechConstructor,
} from "@/lib/consultation-speech";

type Props = {
  fields: NoteFields;
  onFields: (fields: NoteFields) => void;
  allergies: string | null;
  chronic: string | null;
  previous: {
    date: string;
    diagnosis: string | null;
    treatment: string | null;
  } | null;
  details: EncounterDetails;
  onDetails: Dispatch<SetStateAction<EncounterDetails>>;
  disabled: boolean;
  onRecording: (active: boolean) => void;
};
export default function ConsultationWorkbench({
  fields,
  onFields,
  allergies,
  chronic,
  previous,
  details,
  onDetails,
  disabled,
  onRecording,
}: Props) {
  const [activeTab, setActiveTab] = useState("templates");
  const [templateId, setTemplateId] = useState("general");
  const [testSearch, setTestSearch] = useState("");
  const [customTest, setCustomTest] = useState("");
  const [notice, setNotice] = useState("");
  const [speechStatus, setSpeechStatus] = useState(
    "Ready for typed notes or optional dictation.",
  );
  const [recording, setRecording] = useState(false);
  const [starting, setStarting] = useState(false);
  const [interim, setInterim] = useState("");
  const [mode, setMode] = useState<"local" | "browser_service">("local");
  const [consent, setConsent] = useState(false);
  const [previousDisabled, setPreviousDisabled] = useState(disabled);
  if (disabled !== previousDisabled) {
    setPreviousDisabled(disabled);
    if (disabled) {
      setRecording(false);
      setStarting(false);
      setInterim("");
    }
  }
  const recognition = useRef<Recognizer | null>(null);
  const generation = useRef(0);
  const onRecordingRef = useRef(onRecording);
  useEffect(() => {
    onRecordingRef.current = onRecording;
  }, [onRecording]);
  useEffect(
    () => () => {
      generation.current++;
      abortDictation(recognition.current);
      recognition.current = null;
      onRecordingRef.current(false);
    },
    [],
  );
  useEffect(() => {
    if (disabled) {
      generation.current++;
      abortDictation(recognition.current);
      recognition.current = null;
      onRecordingRef.current(false);
    }
  }, [disabled]);
  function addTest(name: string, category: string) {
    if (details.tests.length >= 40) {
      setNotice("This consultation already contains 40 investigations.");
      return;
    }
    if (
      details.tests.some(
        (test) =>
          test.name.toLowerCase() === name.toLowerCase() &&
          test.status !== "cancelled",
      )
    ) {
      setNotice(
        "That investigation is already listed. Edit its existing entry.",
      );
      return;
    }
    onDetails((current) => ({
      ...current,
      tests: [
        ...current.tests,
        newInvestigation(name, category, crypto.randomUUID()),
      ],
    }));
    setNotice(
      `Added ${name} as planned. Set its status to reflect what actually happened.`,
    );
  }
  function updateTest(id: string, patch: Partial<Investigation>) {
    onDetails((current) => ({
      ...current,
      tests: current.tests.map((test) =>
        test.id === id ? { ...test, ...patch } : test,
      ),
    }));
  }
  async function startDictation() {
    if (disabled || recording || starting) return;
    if (mode === "browser_service" && !consent) {
      setSpeechStatus(
        "Confirm consent before using the browser speech service.",
      );
      return;
    }
    const requestId = ++generation.current;
    setStarting(true);
    onRecordingRef.current(true);
    setInterim("");
    try {
      const w = window as unknown as {
        SpeechRecognition?: SpeechConstructor;
        webkitSpeechRecognition?: SpeechConstructor;
      };
      const Speech = w.SpeechRecognition || w.webkitSpeechRecognition;
      const r = await prepareDictation(
        Speech,
        mode,
        consent,
        details.transcript.language,
      );
      if (generation.current !== requestId) {
        abortDictation(r);
        return;
      }
      const seen = new Set<number>();
      const finish = (message: string) => {
        if (generation.current !== requestId) return;
        generation.current++;
        abortDictation(r);
        recognition.current = null;
        setRecording(false);
        onRecordingRef.current(false);
        setStarting(false);
        setInterim("");
        setSpeechStatus(message);
      };
      r.onresult = (event) => {
        if (generation.current !== requestId) return;
        const words = collectSpeech(event.results, seen);
        setInterim(words.interim);
        if (words.final)
          onDetails((current) => ({
            ...current,
            transcript: {
              ...current.transcript,
              text: [current.transcript.text.trim(), words.final]
                .filter(Boolean)
                .join(" "),
              reviewed: false,
              mode,
            },
          }));
      };
      r.onerror = (event) =>
        finish(
          `Dictation stopped (${event.error}). Your completed text is retained. You can type or paste to continue.`,
        );
      r.onend = () =>
        finish(
          "Microphone stopped. Review the completed transcript before saving.",
        );
      recognition.current = r;
      r.start();
      setRecording(true);
      onRecordingRef.current(true);
      setSpeechStatus(
        mode === "local"
          ? "Listening with on-device recognition."
          : "Listening with the browser speech service.",
      );
    } catch (error) {
      if (generation.current === requestId) {
        abortDictation(recognition.current);
        recognition.current = null;
        setRecording(false);
        onRecordingRef.current(false);
        setSpeechStatus(
          error instanceof Error ? error.message : "Could not start dictation.",
        );
      }
    } finally {
      if (generation.current === requestId) {
        setStarting(false);
        if (!recognition.current) onRecordingRef.current(false);
      }
    }
  }
  function stopDictation() {
    try {
      recognition.current?.stop();
      setSpeechStatus("Stopping microphone…");
    } catch {
      generation.current++;
      abortDictation(recognition.current);
      recognition.current = null;
      setRecording(false);
      setStarting(false);
      setInterim("");
      onRecordingRef.current(false);
      setSpeechStatus("Microphone stopped. Your completed text is retained.");
    }
  }
  const matchingTests = TEST_CATALOG.filter(([name, category]) =>
    `${name} ${category}`.toLowerCase().includes(testSearch.toLowerCase()),
  ).slice(0, 12);
  return (
    <div className={styles.workbench}>
      <div
        className={styles.tabs}
        role="tablist"
        aria-label="Consultation tools"
      >
        {[
          { id: "templates", label: "Quick-start templates" },
          { id: "labs", label: `Labs & tests (${details.tests.length})` },
          {
            id: "transcript",
            label: recording
              ? "Transcript · microphone active"
              : details.transcript.text && !details.transcript.reviewed
                ? "Transcript · review needed"
                : "Transcript & dictation",
          },
        ].map((tab) => (
          <button
            type="button"
            role="tab"
            key={tab.id}
            id={`consult-tool-${tab.id}`}
            aria-selected={activeTab === tab.id}
            aria-controls={`consult-panel-${tab.id}`}
            tabIndex={activeTab === tab.id ? 0 : -1}
            disabled={(recording || starting) && activeTab !== tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              setNotice("");
            }}
            onKeyDown={(event) => {
              if (recording || starting) return;
              const ids = ["templates", "labs", "transcript"];
              const index = ids.indexOf(tab.id);
              const next =
                event.key === "ArrowRight"
                  ? ids[(index + 1) % 3]
                  : event.key === "ArrowLeft"
                    ? ids[(index + 2) % 3]
                    : event.key === "Home"
                      ? ids[0]
                      : event.key === "End"
                        ? ids[2]
                        : null;
              if (next) {
                event.preventDefault();
                setActiveTab(next);
                setNotice("");
                document.getElementById(`consult-tool-${next}`)?.focus();
              }
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <section
        hidden={activeTab !== "templates"}
        role="tabpanel"
        id="consult-panel-templates"
        aria-labelledby="consult-tool-templates"
        className={`card ${styles.templateCard}`}
      >
        <div className="card-header">
          <div>
            <p className={styles.eyebrow}>CONSULTATION QUICK START</p>
            <h2 className="card-title">
              Start with the structure. Focus on the patient.
            </h2>
          </div>
          <span className="badge badge-green">16 visit templates</span>
        </div>
        <div className="card-body">
          <div className={styles.quickRow}>
            <label className="field">
              <span className="label">Visit template</span>
              <select
                className="input"
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
              >
                {VISIT_TEMPLATES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label} · {t.group}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                const preset = VISIT_TEMPLATES.find(
                  (t) => t.id === templateId,
                )!;
                onFields(fillEmptyNotes(fields, preset));
                onDetails((current) => ({
                  ...current,
                  template_id: preset.id,
                }));
                setNotice(
                  "Template prompts added to empty sections. Your existing notes and measured values were preserved.",
                );
              }}
            >
              Prefill empty sections
            </button>
          </div>
          <div className="page-actions">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                const context = patientContext(allergies, chronic);
                if (!fields.history_of_present_illness.includes(context))
                  onFields({
                    ...fields,
                    history_of_present_illness: appendNote(
                      fields.history_of_present_illness,
                      context,
                    ),
                  });
                setNotice("Patient-record context added for verification.");
              }}
            >
              Insert allergies & chronic history
            </button>
            {previous && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  const ref = `Previous consultation (${previous.date.slice(0, 10)}) — reference only; reassess today:\nRecorded diagnosis: ${previous.diagnosis || "Not recorded"}\nPrevious plan: ${previous.treatment || "Not recorded"}`;
                  if (!fields.history_of_present_illness.includes(ref))
                    onFields({
                      ...fields,
                      history_of_present_illness: appendNote(
                        fields.history_of_present_illness,
                        ref,
                      ),
                    });
                  setNotice(
                    "Previous visit added as a dated reference. Current findings were not copied.",
                  );
                }}
              >
                Insert last-visit reference
              </button>
            )}
          </div>
          <p className={styles.hint}>
            Prompts never mark findings as normal, diagnose the patient, enter
            measured values or prescribe treatment.
          </p>
          {notice && (
            <p className="alert-info" role="status">
              {notice}
            </p>
          )}
        </div>
      </section>
      <section
        hidden={activeTab !== "labs"}
        role="tabpanel"
        id="consult-panel-labs"
        aria-labelledby="consult-tool-labs"
        className="card"
      >
        <div className="card-header">
          <div>
            <h2 className="card-title">Labs & investigations</h2>
            <p className="page-subtitle">
              Record tests requested, performed here, or received from a
              laboratory.
            </p>
          </div>
          <span className="badge badge-gray">
            {details.tests.length} recorded
          </span>
        </div>
        <div className="card-body">
          <label className="field">
            <span className="label">Find a preloaded test</span>
            <input
              type="search"
              className="input"
              value={testSearch}
              maxLength={100}
              onChange={(e) => setTestSearch(e.target.value)}
              placeholder="FBC, glucose, urine, ECG, eye tests…"
            />
          </label>
          <div className={styles.testChoices}>
            {matchingTests.map(([name, category]) => (
              <button
                type="button"
                key={name}
                className={styles.testChoice}
                onClick={() => addTest(name, category)}
              >
                <span>＋ {name}</span>
                <small>{category}</small>
              </button>
            ))}
          </div>
          {notice && (
            <p className="alert-info" role="status">
              {notice}
            </p>
          )}
          <div className={styles.quickRow}>
            <label className="field">
              <span className="label">Custom test / investigation</span>
              <input
                className="input"
                value={customTest}
                maxLength={160}
                onChange={(e) => setCustomTest(e.target.value)}
                placeholder="Enter a test not in the catalogue"
              />
            </label>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={!customTest.trim()}
              onClick={() => {
                addTest(customTest.trim(), "Other");
                setCustomTest("");
              }}
            >
              Add custom test
            </button>
          </div>
          {!details.tests.length && (
            <p className={styles.hint}>
              No tests recorded. Added entries start as planned; this does not
              send an order to a laboratory.
            </p>
          )}
          <div className={styles.testList}>
            {details.tests.map((test) => (
              <article className={styles.testEntry} key={test.id}>
                <div className={styles.entryHeading}>
                  <strong>{test.name}</strong>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      if (
                        window.confirm(`Remove ${test.name} from this draft?`)
                      )
                        onDetails((current) => ({
                          ...current,
                          tests: current.tests.filter(
                            (row) => row.id !== test.id,
                          ),
                        }));
                    }}
                  >
                    Remove
                  </button>
                </div>
                <div className={styles.fields}>
                  <label className="field">
                    <span className="label">Status</span>
                    <select
                      className="input"
                      value={test.status}
                      onChange={(e) =>
                        updateTest(test.id, {
                          status: e.target.value as Investigation["status"],
                        })
                      }
                    >
                      <option value="planned">Planned / to consider</option>
                      <option value="ordered">Requested · awaiting test</option>
                      <option value="performed">
                        Performed · awaiting result
                      </option>
                      <option value="resulted">Result recorded</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </label>
                  <label className="field">
                    <span className="label">Where</span>
                    <select
                      className="input"
                      value={test.location}
                      onChange={(e) =>
                        updateTest(test.id, {
                          location: e.target.value as Investigation["location"],
                        })
                      }
                    >
                      <option value="practice">In practice</option>
                      <option value="external">
                        External laboratory / provider
                      </option>
                    </select>
                  </label>
                  <label className="field">
                    <span className="label">Date performed (if known)</span>
                    <input
                      type="date"
                      className="input"
                      value={test.performed_on}
                      onChange={(e) =>
                        updateTest(test.id, { performed_on: e.target.value })
                      }
                    />
                  </label>
                  <label className="field">
                    <span className="label">Specimen / sample</span>
                    <input
                      className="input"
                      maxLength={100}
                      value={test.specimen}
                      onChange={(e) =>
                        updateTest(test.id, { specimen: e.target.value })
                      }
                    />
                  </label>
                  <label className={`field ${styles.wide}`}>
                    <span className="label">Actual result / report</span>
                    <textarea
                      className="input"
                      rows={3}
                      maxLength={4000}
                      value={test.result}
                      onChange={(e) =>
                        updateTest(test.id, { result: e.target.value })
                      }
                      placeholder="Enter only the result obtained; leave blank while pending."
                    />
                  </label>
                  <label className="field">
                    <span className="label">Units (if applicable)</span>
                    <input
                      className="input"
                      maxLength={40}
                      value={test.unit}
                      onChange={(e) =>
                        updateTest(test.id, { unit: e.target.value })
                      }
                    />
                  </label>
                  <label className="field">
                    <span className="label">
                      Lab reference range (if supplied)
                    </span>
                    <input
                      className="input"
                      maxLength={200}
                      value={test.reference_range}
                      onChange={(e) =>
                        updateTest(test.id, { reference_range: e.target.value })
                      }
                    />
                  </label>
                  <label className={`field ${styles.wide}`}>
                    <span className="label">
                      Interpretation / action / follow-up
                    </span>
                    <textarea
                      rows={2}
                      className="input"
                      maxLength={2000}
                      value={test.notes}
                      onChange={(e) =>
                        updateTest(test.id, { notes: e.target.value })
                      }
                    />
                  </label>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section
        hidden={activeTab !== "transcript"}
        role="tabpanel"
        id="consult-panel-transcript"
        aria-labelledby="consult-tool-transcript"
        className="card"
      >
        <div className="card-header">
          <div>
            <h2 className="card-title">Consultation transcript</h2>
            <p className="page-subtitle">
              Type, paste or dictate; review the words before completing the
              visit.
            </p>
          </div>
          <span className={`badge ${recording ? "badge-red" : "badge-gray"}`}>
            {recording ? "Microphone active" : "Microphone off"}
          </span>
        </div>
        <div className="card-body">
          <div className={styles.fields}>
            <label className="field">
              <span className="label">
                Dictation language (browser support varies)
              </span>
              <select
                className="input"
                value={details.transcript.language}
                disabled={recording || starting}
                onChange={(e) =>
                  onDetails((current) => ({
                    ...current,
                    transcript: {
                      ...current.transcript,
                      language: e.target.value,
                    },
                  }))
                }
              >
                <option value="en-ZA">English · South Africa</option>
                <option value="en-GB">English · United Kingdom</option>
                <option value="en-US">English · United States</option>
                <option value="af-ZA">Afrikaans</option>
                <option value="zu-ZA">isiZulu</option>
                <option value="st-ZA">Sesotho</option>
              </select>
            </label>
            <label className="field">
              <span className="label">Speech processing</span>
              <select
                className="input"
                value={mode}
                disabled={recording || starting}
                onChange={(e) => {
                  setMode(e.target.value as typeof mode);
                  setConsent(false);
                }}
              >
                <option value="local">On-device only · if supported</option>
                <option value="browser_service">
                  Browser speech service · consent required
                </option>
              </select>
            </label>
          </div>
          {mode === "browser_service" && (
            <label className={styles.consent}>
              <input
                type="checkbox"
                checked={consent}
                disabled={recording || starting}
                onChange={(e) => setConsent(e.target.checked)}
              />
              <span>
                Consent and practice approval are in place to send this
                consultation audio to the browser’s speech provider. Audio may
                be processed off-device.
              </span>
            </label>
          )}
          <div className="page-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={
                disabled ||
                recording ||
                starting ||
                (mode === "browser_service" && !consent)
              }
              onClick={() => void startDictation()}
            >
              {starting ? "Checking speech support…" : "Start dictation"}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={!recording}
              onClick={stopDictation}
            >
              Stop microphone
            </button>
          </div>
          <p className={styles.hint} role="status">
            {speechStatus}
          </p>
          {interim && (
            <p className={styles.interim} aria-live="polite">
              Provisional: {interim}
            </p>
          )}
          <label className="field">
            <span className="label">
              Editable transcript ·{" "}
              {details.transcript.text.length.toLocaleString()} / 20,000
              characters
            </span>
            <textarea
              className="input"
              rows={7}
              maxLength={20000}
              value={details.transcript.text}
              disabled={recording || starting}
              onChange={(e) =>
                onDetails((current) => ({
                  ...current,
                  transcript: {
                    ...current.transcript,
                    text: e.target.value,
                    reviewed: false,
                    mode: "typed",
                  },
                }))
              }
              placeholder="Dictated words appear here. You can also type or paste an existing transcript."
            />
          </label>
          <label className={styles.consent}>
            <input
              type="checkbox"
              checked={details.transcript.reviewed}
              disabled={
                recording || starting || !details.transcript.text.trim()
              }
              onChange={(e) =>
                onDetails((current) => ({
                  ...current,
                  transcript: {
                    ...current.transcript,
                    reviewed: e.target.checked,
                  },
                }))
              }
            />
            <span>
              I reviewed and corrected this transcript, including names,
              medicines, numbers and clinical wording.
            </span>
          </label>
          <p className={styles.hint}>
            Completed text saves with your private draft. A non-empty transcript
            must be reviewed before finalising. The app stores text, not audio;
            dictation is not a diagnosis or an automatic medical summary.
          </p>
        </div>
      </section>
    </div>
  );
}
