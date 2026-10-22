import { parseEncounter } from "@/lib/consultation-workbench";
import styles from "./consultation-workbench.module.css";
export default function EncounterRecord({
  value,
  print = false,
}: {
  value: unknown;
  print?: boolean;
}) {
  let data;
  try {
    data = parseEncounter(value);
  } catch {
    return (
      <p className="alert-error">
        Additional consultation details could not be read.
      </p>
    );
  }
  if (!data.tests.length && !data.transcript.text) return null;
  const transcript = (
    <p className={styles.recordText}>{data.transcript.text}</p>
  );
  return (
    <div className={styles.savedTests}>
      {data.tests.length > 0 && (
        <>
          <h3 className="card-title">Labs & investigations</h3>
          {data.tests.map((test) => (
            <div className={styles.savedTest} key={test.id}>
              <strong>{test.name}</strong>{" "}
              <span
                className={`badge ${test.status === "resulted" ? "badge-green" : test.status === "cancelled" ? "badge-gray" : "badge-amber"}`}
              >
                {test.status}
              </span>
              <div>
                <small>
                  {test.location === "external"
                    ? "External laboratory / provider"
                    : "In practice"}
                  {test.performed_on ? ` · Performed ${test.performed_on}` : ""}
                  {test.specimen ? ` · Sample: ${test.specimen}` : ""}
                </small>
              </div>
              {test.result && (
                <p>
                  <strong>Result:</strong> {test.result}
                  {test.unit ? ` ${test.unit}` : ""}
                </p>
              )}
              {test.reference_range && (
                <p>
                  <strong>Reported reference range:</strong>{" "}
                  {test.reference_range}
                </p>
              )}
              {test.notes && (
                <p>
                  <strong>Action / interpretation:</strong> {test.notes}
                </p>
              )}
            </div>
          ))}
        </>
      )}
      {data.transcript.text &&
        (print ? (
          <div>
            <h3>
              Consultation transcript ·{" "}
              {data.transcript.reviewed ? "reviewed" : "awaiting review"}
            </h3>
            {transcript}
          </div>
        ) : (
          <details className="mt-4">
            <summary className="label cursor-pointer">
              Consultation transcript ·{" "}
              {data.transcript.reviewed ? "reviewed" : "awaiting review"}
            </summary>
            {transcript}
          </details>
        ))}
    </div>
  );
}
