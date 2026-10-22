import type { ClaimSnapshot, ClaimIssue } from "@/lib/claims/model";
export default function ClaimPacketPreview({
  snapshot: s,
  issues = [],
}: {
  snapshot: ClaimSnapshot;
  issues?: ClaimIssue[];
}) {
  return (
    <div>
      {issues.length > 0 && (
        <div className="alert-error" role="alert">
          <strong>Complete before submission</strong>
          <ul>
            {issues.map((issue, i) => (
              <li key={`${issue.code}-${i}`}>{issue.message}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <section>
          <h3 className="label">Patient & membership</h3>
          <p>
            {s.patient.name} · {s.patient.dob || "Date of birth missing"}
          </p>
          <p>ID / passport: {s.patient.identity || "Missing"}</p>
          <p>
            {s.member.scheme || "Scheme missing"} · {s.member.plan}
          </p>
          <p>
            Member: {s.member.number || "Missing"} · Dependent:{" "}
            {s.member.dependent || "Missing"}
          </p>
          <p>Main member: {s.member.main_member || "Missing"}</p>
        </section>
        <section>
          <h3 className="label">Practice & treating practitioner</h3>
          <p>{s.practice.name}</p>
          <p>{s.provider.name || "Select consultation"}</p>
          <p>PCNS: {s.provider.pcns || "Configure in Claim settings"}</p>
          <p>Registration: {s.provider.registration || "Missing"}</p>
          <p>{s.practice.address}</p>
          <p>
            {s.practice.email} · {s.practice.phone}
          </p>
        </section>
      </div>
      <div className="table-wrap mt-5">
        <table>
          <thead>
            <tr>
              <th>Service date / code</th>
              <th>Item</th>
              <th>ICD-10</th>
              <th>Qty</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {s.invoice.lines.map((l) => (
              <tr key={l.id}>
                <td>
                  {s.consultation.service_date || "Select consultation"}
                  <br />
                  {l.service_code || "Tariff / NAPPI missing"}
                </td>
                <td>{l.description}</td>
                <td>{l.diagnosis_code || "Missing"}</td>
                <td>{l.quantity}</td>
                <td>R {l.total.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4">
        <strong>
          {s.invoice.number} · Amount claimed R {s.invoice.balance.toFixed(2)}
        </strong>
      </p>
      <p className="page-subtitle mt-2">
        Details come from the saved patient, consultation, invoice and
        practitioner settings. Check membership on the service date, tariff and
        ICD-10 suitability, authorisations and required supporting documents
        before submission.
      </p>
    </div>
  );
}
