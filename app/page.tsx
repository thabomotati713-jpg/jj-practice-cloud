import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "J&J Practice Cloud | South African Practice Management",
  description:
    "Modern practice management for South African healthcare professionals. Online bookings, patient records, billing, claims, prescriptions, stock and more.",
};

const whatsapp =
  "https://wa.me/27601128855?text=Hello%20Thabo%2C%20I%27d%20like%20to%20know%20more%20about%20J%26J%20Practice%20Cloud.";

const features = [
  ["PA", "Patient records", "Keep clinical details, documents and communication together in one secure patient history."],
  ["AP", "Appointments", "Manage the diary, prevent overlaps and let patients request appointments online at any hour."],
  ["RM", "Automatic reminders", "Daily appointment reminders reduce manual calls and help protect the practice diary."],
  ["RX", "Prescriptions", "Create clear prescription records connected directly to the patient and consultation history."],
  ["SN", "Verified sick notes", "Issue professional medical certificates with QR verification that employers can check online."],
  ["IN", "Billing and payments", "Create invoices, capture payments, track balances and prepare secure online payment links."],
  ["CL", "Medical aid claims", "Generate claims from invoice and patient details without repeatedly capturing the same information."],
  ["ST", "Specialty-aware stock", "Manage inventory with starter catalogues tailored to GPs, dentists, optometrists and other providers."],
  ["AU", "POPIA audit trail", "See who accessed sensitive records and when, with protected server-side audit logging."],
];

const faqs = [
  ["Who is J&J Practice Cloud built for?", "Independent South African practices, including GPs, dentists, optometrists, physiotherapists, dermatologists, paediatricians and mixed group practices."],
  ["Do I need to install software?", "No. It runs securely in a modern web browser on a computer, tablet or phone, so your team can work without maintaining an office server."],
  ["Can patients book online?", "Yes. Each practice can use a public booking page while staff continue managing the main diary inside the portal."],
  ["How does onboarding work?", "Register online without entering card details. We contact you, confirm the practice setup, help configure your account and then issue the once-off activation invoice."],
  ["Is the platform POPIA compliant?", "The platform is designed around POPIA principles, role-based access, protected audit logs and encrypted data transport. Compliance also depends on how each practice configures access and operates its internal processes."],
];

export default function MarketingHome() {
  return (
    <main className="marketing-shell">
      <header className="marketing-nav">
        <a href="/" className="marketing-brand" aria-label="J&J Practice Cloud home">
          <img src="/logo.jpg" alt="" />
          <span><strong>J&amp;J</strong> Practice Cloud</span>
        </a>
        <nav className="marketing-links" aria-label="Main navigation">
          <a href="#product">Product</a>
          <a href="#pricing">Pricing</a>
          <a href="#founder">Founder</a>
          <a href="#contact">Contact</a>
        </nav>
        <div className="marketing-actions">
          <a href="/login" className="marketing-login">Sign in</a>
          <a href="/signup" className="marketing-button marketing-button-small">Register practice</a>
        </div>
      </header>

      <section className="marketing-hero">
        <div className="marketing-orb marketing-orb-one" />
        <div className="marketing-orb marketing-orb-two" />
        <div className="marketing-hero-copy">
          <span className="marketing-kicker"><i /> Built in South Africa for modern practices</span>
          <h1 className="display-font">Your practice,<br /><em>properly connected.</em></h1>
          <p>
            One calm, secure workspace for patients, bookings, clinical records,
            prescriptions, billing, medical aid claims, inventory and your team.
          </p>
          <div className="marketing-hero-actions">
            <a href="/signup" className="marketing-button">Register your practice <span>→</span></a>
            <a href={whatsapp} className="marketing-button-ghost" target="_blank" rel="noreferrer">Talk to us on WhatsApp</a>
          </div>
          <div className="marketing-reassurance">
            <span><b>01</b> No card required</span>
            <span><b>02</b> Guided onboarding</span>
            <span><b>03</b> POPIA-minded design</span>
          </div>
        </div>

        <div className="marketing-product-stage" aria-label="Product dashboard preview">
          <div className="product-window">
            <div className="product-topbar">
              <div className="product-logo"><img src="/logo.jpg" alt="" /></div>
              <div><strong>J&amp;J Practice Cloud</strong><small>Practice overview</small></div>
              <span className="product-status">LIVE</span>
            </div>
            <div className="product-welcome">
              <div><small>GOOD MORNING</small><h2 className="display-font">Your practice at a glance.</h2></div>
              <span>REC <b>64</b></span>
            </div>
            <div className="product-metrics">
              <div><small>INVOICED</small><b>R 13 550</b><i className="teal" /></div>
              <div><small>COLLECTED</small><b>R 13 090</b><i className="green" /></div>
              <div><small>OUTSTANDING</small><b>R 460</b><i className="amber" /></div>
            </div>
            <div className="product-lower">
              <div className="product-chart"><span>Practice activity</span><div className="bars"><i /><i /><i /><i /><i /><i /><i /></div></div>
              <div className="product-list"><span>Next up</span><p><b>09:00</b> Patient consultation</p><p><b>09:30</b> Follow-up visit</p><p><b>10:00</b> Video consultation</p></div>
            </div>
          </div>
          <div className="marketing-float-card"><span>QR</span><div><strong>Sick note verified</strong><small>Secure verification in seconds</small></div></div>
        </div>
      </section>

      <section className="marketing-proof" aria-label="Product highlights">
        <p>ONE PLATFORM</p><span>Patient management</span><span>Online booking</span><span>Medical aid claims</span><span>Practice billing</span><span>Audit trail</span>
      </section>

      <section id="product" className="marketing-section">
        <div className="marketing-section-heading">
          <span className="marketing-eyebrow">THE COMPLETE PRACTICE</span>
          <h2 className="display-font">Less admin between you<br />and your patients.</h2>
          <p>Purpose-built workflows replace scattered spreadsheets, paper files and disconnected systems.</p>
        </div>
        <div className="marketing-feature-grid">
          {features.map(([chip, title, copy]) => (
            <article key={title} className="marketing-feature-card">
              <span className="feature-chip">{chip}</span>
              <h3>{title}</h3><p>{copy}</p><i>Explore module →</i>
            </article>
          ))}
        </div>
      </section>

      <section className="marketing-dark-section">
        <div>
          <span className="marketing-eyebrow marketing-eyebrow-light">A BETTER WORKING DAY</span>
          <h2 className="display-font">From first booking<br />to final payment.</h2>
          <p>J&amp;J Practice Cloud follows the real flow of a practice, keeping information connected from reception to consultation and billing.</p>
          <a href="/signup" className="marketing-button marketing-button-light">Start your registration →</a>
        </div>
        <ol className="marketing-steps">
          <li><b>01</b><span><strong>Book</strong><small>Staff or patients add appointments to one controlled diary.</small></span></li>
          <li><b>02</b><span><strong>Consult</strong><small>Open the patient record and capture the clinical work.</small></span></li>
          <li><b>03</b><span><strong>Document</strong><small>Create prescriptions, sick notes and supporting records.</small></span></li>
          <li><b>04</b><span><strong>Bill</strong><small>Invoice, claim, collect and see exactly what remains outstanding.</small></span></li>
        </ol>
      </section>

      <section id="pricing" className="marketing-section marketing-pricing-section">
        <div className="marketing-section-heading centered">
          <span className="marketing-eyebrow">SIMPLE SOUTH AFRICAN PRICING</span>
          <h2 className="display-font">Professional software.<br />Sensible monthly cost.</h2>
          <p>Every plan includes the core practice platform, guided setup and ongoing product updates.</p>
        </div>
        <div className="pricing-activation"><span>ONCE-OFF ACTIVATION</span><strong>R1 999</strong><p>Practice configuration, owner setup and guided onboarding. Invoiced after registration, not at checkout.</p></div>
        <div className="pricing-grid">
          <article className="pricing-card">
            <span className="pricing-label">SOLO</span><h3>For independent providers</h3><div className="pricing-price"><b>R549</b><span>/ month</span></div>
            <ul><li>One healthcare provider</li><li>Core clinical and admin modules</li><li>Public online booking</li><li>Email appointment reminders</li><li>POPIA audit trail</li></ul>
            <a href="/signup?plan=solo" className="marketing-button-ghost full">Choose Solo</a>
            <p className="pricing-annual">Or R5 900/year — save R688</p>
          </article>
          <article className="pricing-card pricing-card-featured">
            <span className="pricing-badge">MOST POPULAR</span><span className="pricing-label">GROUP</span><h3>For growing practice teams</h3><div className="pricing-price"><b>R949</b><span>/ month</span></div>
            <ul><li>Multiple providers and specialties</li><li>Role-based staff access</li><li>All Solo plan capabilities</li><li>Shared practice operations</li><li>Priority onboarding support</li></ul>
            <a href="/signup?plan=group" className="marketing-button full">Choose Group</a>
            <p className="pricing-annual">Best for multi-doctor and mixed practices</p>
          </article>
        </div>
        <p className="pricing-note">Prices are quoted in South African rand. Custom integrations, payment transaction fees and optional dedicated infrastructure are excluded.</p>
      </section>

      <section id="founder" className="founder-section">
        <div className="founder-portraits">
          <div className="founder-main"><img src="/founder-thabo.png" alt="Thabo Simon Motati, founder of J&J Practice Cloud" /></div>
          <div className="founder-secondary"><img src="/founder-thabo-suit.png" alt="Thabo Simon Motati in a formal portrait" /></div>
          <span className="founder-location">SPRINGS · GAUTENG</span>
        </div>
        <div className="founder-copy">
          <span className="marketing-eyebrow">BUILT CLOSE TO THE PROBLEM</span>
          <h2 className="display-font">Meet the developer<br />behind the platform.</h2>
          <blockquote>“Good practice software should feel calm, clear and useful from the first day.”</blockquote>
          <p>I’m <strong>Thabo Simon Motati</strong>, a 36-year-old app developer and software designer from Springs. I built J&amp;J Practice Cloud to give South African healthcare practices a modern alternative to expensive, complicated systems.</p>
          <p>The product is shaped around the day-to-day realities of independent practices: limited time, sensitive patient information, medical aid administration and the need to keep the business moving.</p>
          <div className="founder-signoff"><span>TSM</span><div><strong>Thabo Simon Motati</strong><small>Founder · App Developer · Software Designer</small></div></div>
        </div>
      </section>

      <section className="marketing-section faq-section">
        <div className="marketing-section-heading"><span className="marketing-eyebrow">STRAIGHT ANSWERS</span><h2 className="display-font">Before you register.</h2></div>
        <div className="faq-list">{faqs.map(([q, a]) => <details key={q}><summary>{q}<span>+</span></summary><p>{a}</p></details>)}</div>
      </section>

      <section id="contact" className="marketing-final-cta">
        <div><span className="marketing-eyebrow marketing-eyebrow-light">READY WHEN YOU ARE</span><h2 className="display-font">Give your practice a<br />better operating system.</h2></div>
        <div><p>Register online now, or talk directly to Thabo about your practice and onboarding needs.</p><div className="marketing-hero-actions"><a href="/signup" className="marketing-button marketing-button-light">Register your practice →</a><a href={whatsapp} target="_blank" rel="noreferrer" className="marketing-button-outline">WhatsApp 060 112 8855</a></div></div>
      </section>

      <footer className="marketing-footer">
        <div className="marketing-footer-top"><a href="/" className="marketing-brand"><img src="/logo.jpg" alt="" /><span><strong>J&amp;J</strong> Practice Cloud</span></a><p>Modern practice management, built in Springs for South African healthcare.</p></div>
        <div className="marketing-footer-grid"><div><strong>Product</strong><a href="#product">Capabilities</a><a href="#pricing">Pricing</a><a href="/signup">Register</a><a href="/login">Client sign in</a></div><div><strong>Contact</strong><a href={whatsapp}>WhatsApp</a><a href="mailto:jjpracticecloud@gmail.com">jjpracticecloud@gmail.com</a><span>Springs, Gauteng</span></div><div><strong>Privacy</strong><span>Designed around POPIA principles, controlled access and auditable record activity.</span></div></div>
        <div className="marketing-footer-bottom"><span>© 2026 J&amp;J Practice Cloud. All rights reserved.</span><span>Built by Thabo Simon Motati.</span></div>
      </footer>
      <a className="whatsapp-float" href={whatsapp} target="_blank" rel="noreferrer" aria-label="Chat on WhatsApp"><span>WA</span><b>Let’s talk</b></a>
    </main>
  );
}
