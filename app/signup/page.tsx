"use client";

import { useEffect, useState } from "react";
import { SPECIALTIES } from "../../lib/specialties";

const provinces = [
  "Eastern Cape",
  "Free State",
  "Gauteng",
  "KwaZulu-Natal",
  "Limpopo",
  "Mpumalanga",
  "North West",
  "Northern Cape",
  "Western Cape",
];

const initialForm = {
  plan: "solo",
  practiceName: "",
  specialty: "general",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  city: "",
  province: "Gauteng",
  password: "",
  confirmPassword: "",
  website: "",
  acceptTerms: false,
};

type FormState = typeof initialForm;

export default function SignupPage() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const requestedPlan = new URLSearchParams(window.location.search).get("plan");
    if (requestedPlan === "solo" || requestedPlan === "group") {
      setForm((current) => ({ ...current, plan: requestedPlan }));
    }
  }, []);

  function update<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (form.password.length < 10) {
      setError("Use a password with at least 10 characters.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    if (!form.acceptTerms) {
      setError("Confirm that you are authorised to register the practice.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Registration could not be completed.");
        setSaving(false);
        return;
      }

      setSuccess(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setError("Registration could not be completed. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  if (success) {
    return (
      <main className="signup-shell">
        <header className="signup-header">
          <a href="/" className="marketing-brand"><img src="/logo.jpg" alt="" /><span><strong>J&amp;J</strong> Practice Cloud</span></a>
          <a href="/login" className="marketing-login">Sign in</a>
        </header>
        <section className="signup-success">
          <span className="success-mark">✓</span>
          <span className="marketing-eyebrow">REGISTRATION COMPLETE</span>
          <h1 className="display-font">Your practice workspace is ready.</h1>
          <p>We created the owner login for <strong>{form.practiceName}</strong>. You can sign in now while our team contacts you to complete onboarding and activation.</p>
          <div className="signup-success-actions">
            <a href="/login" className="marketing-button">Sign in to your practice →</a>
            <a href="https://wa.me/27601128855?text=Hello%20Thabo%2C%20I%20have%20registered%20my%20practice%20on%20J%26J%20Practice%20Cloud." className="marketing-button-ghost">Message Thabo</a>
          </div>
          <small>Check {form.email} for your welcome message. Delivery can take a few minutes.</small>
        </section>
      </main>
    );
  }

  return (
    <main className="signup-shell">
      <header className="signup-header">
        <a href="/" className="marketing-brand"><img src="/logo.jpg" alt="" /><span><strong>J&amp;J</strong> Practice Cloud</span></a>
        <div><span>Already registered?</span><a href="/login" className="marketing-login">Sign in</a></div>
      </header>

      <div className="signup-layout">
        <aside className="signup-aside">
          <span className="marketing-kicker"><i /> Practice registration</span>
          <h1 className="display-font">Start with the details that matter.</h1>
          <p>Register the practice and owner account now. No card details are collected on this page.</p>
          <ol>
            <li className="active"><b>01</b><span><strong>Choose your plan</strong><small>Solo or Group</small></span></li>
            <li><b>02</b><span><strong>Practice details</strong><small>Name, type and location</small></span></li>
            <li><b>03</b><span><strong>Owner account</strong><small>Your secure administrator login</small></span></li>
          </ol>
          <div className="signup-assurance"><span>SEC</span><p><strong>Your information is protected.</strong> Passwords are handled by Supabase Auth and are never emailed or visible to J&amp;J staff.</p></div>
        </aside>

        <form onSubmit={submit} className="signup-form">
          <div className="signup-form-heading">
            <span className="marketing-eyebrow">REGISTER ONLINE</span>
            <h2 className="display-font">Create your practice account</h2>
            <p>Activation is billed after guided onboarding. You can register without a card.</p>
          </div>

          {error && <div className="signup-alert" role="alert">{error}</div>}

          <fieldset className="signup-fieldset">
            <legend><span>01</span> Select a plan</legend>
            <div className="signup-plan-grid">
              <label className={form.plan === "solo" ? "selected" : ""}>
                <input type="radio" name="plan" value="solo" checked={form.plan === "solo"} onChange={() => update("plan", "solo")} />
                <span><strong>Solo</strong><small>Independent provider</small></span><b>R549<small>/mo</small></b>
              </label>
              <label className={form.plan === "group" ? "selected" : ""}>
                <input type="radio" name="plan" value="group" checked={form.plan === "group"} onChange={() => update("plan", "group")} />
                <span><strong>Group</strong><small>Multiple providers</small></span><b>R949<small>/mo</small></b>
              </label>
            </div>
            <p className="signup-activation"><strong>R1 999 once-off activation</strong> · invoiced only after onboarding is confirmed.</p>
          </fieldset>

          <fieldset className="signup-fieldset">
            <legend><span>02</span> Practice details</legend>
            <div className="signup-fields">
              <label className="wide"><span>Practice name</span><input required minLength={2} maxLength={100} value={form.practiceName} onChange={(e) => update("practiceName", e.target.value)} placeholder="e.g. Springs Family Medical Centre" /></label>
              <label><span>Practice type</span><select value={form.specialty} onChange={(e) => update("specialty", e.target.value)}>{SPECIALTIES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
              <label><span>City or town</span><input required maxLength={80} value={form.city} onChange={(e) => update("city", e.target.value)} placeholder="Springs" /></label>
              <label className="wide"><span>Province</span><select value={form.province} onChange={(e) => update("province", e.target.value)}>{provinces.map((province) => <option key={province}>{province}</option>)}</select></label>
            </div>
          </fieldset>

          <fieldset className="signup-fieldset">
            <legend><span>03</span> Practice owner</legend>
            <div className="signup-fields">
              <label><span>First name</span><input required maxLength={60} autoComplete="given-name" value={form.firstName} onChange={(e) => update("firstName", e.target.value)} /></label>
              <label><span>Last name</span><input required maxLength={60} autoComplete="family-name" value={form.lastName} onChange={(e) => update("lastName", e.target.value)} /></label>
              <label><span>Email address</span><input required type="email" maxLength={160} autoComplete="email" inputMode="email" value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="owner@practice.co.za" /></label>
              <label><span>Mobile number</span><input required type="tel" maxLength={24} autoComplete="tel" inputMode="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="060 123 4567" /></label>
              <label><span>Password</span><input required type="password" minLength={10} maxLength={100} autoComplete="new-password" value={form.password} onChange={(e) => update("password", e.target.value)} /><small>At least 10 characters</small></label>
              <label><span>Confirm password</span><input required type="password" minLength={10} maxLength={100} autoComplete="new-password" value={form.confirmPassword} onChange={(e) => update("confirmPassword", e.target.value)} /></label>
            </div>
          </fieldset>

          <label className="signup-honeypot" aria-hidden="true">Website<input tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => update("website", e.target.value)} /></label>
          <label className="signup-consent"><input type="checkbox" checked={form.acceptTerms} onChange={(e) => update("acceptTerms", e.target.checked)} /><span>I confirm that I am authorised to register this practice and that the details supplied are accurate. I understand that the R1 999 activation fee is confirmed during onboarding.</span></label>

          <button type="submit" disabled={saving} className="marketing-button signup-submit">{saving ? "Creating your practice..." : "Create practice account →"}</button>
          <p className="signup-contact">Need help? WhatsApp <a href="https://wa.me/27601128855">060 112 8855</a> or email <a href="mailto:jjpracticecloud@gmail.com">jjpracticecloud@gmail.com</a>.</p>
        </form>
      </div>
    </main>
  );
}
