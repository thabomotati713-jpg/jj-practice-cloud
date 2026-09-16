# J&J Practice Cloud — Design System

Every page MUST use this system. The goal: a calm, professional, clinical product.
Brand color: deep teal `#1f7c7a` (primary). Background: `#f4f7f9`. Text: `#0f1f2d`.
Soft glass aesthetic: frosted translucent panels (rgba white + backdrop blur) over an ambient teal wash. No random accent colors (no indigo/blue/purple). One ambient background, glass panels on top — nothing busier.

## Standard page skeleton

Every module page follows this exact structure:

```jsx
<main className="page-shell">
  <header className="app-header">
    <div className="app-header-inner">
      <a href="/dashboard" className="app-brand">
        <img src="/logo.jpg" alt="J&J Practice Cloud" className="app-brand-logo" />
        <span className="app-brand-name">J&J Practice Cloud</span>
      </a>
      {/* right side: sign out button or back link */}
      <button className="btn btn-secondary btn-sm">Sign out</button>
    </div>
  </header>

  <div className="page-inner">
    <div className="page-header">
      <div>
        <h1 className="page-title">Page Title</h1>
        <p className="page-subtitle">One line describing what this page does.</p>
      </div>
      <div className="page-actions">{/* primary action buttons */}</div>
    </div>

    {/* content: .card blocks, .stat-grid rows, .table */}
  </div>
</main>
```

## Component classes (defined in app/globals.css — do not redefine them)

- `.page-shell` — min-height screen, page background. Wrap the whole page.
- `.app-header` / `.app-header-inner` / `.app-brand` / `.app-brand-logo` / `.app-brand-name` — top bar.
- `.page-inner` — max-width 1120px container with padding.
- `.page-header` — flex row: title left, actions right; wraps on mobile.
- `.page-title`, `.page-subtitle` — h1 / description.
- `.page-actions` — flex row of buttons with gap.
- `.btn` — base. `.btn-primary` (teal, white text), `.btn-secondary` (white, border), `.btn-danger` (red), `.btn-sm`.
- `.card` — white rounded panel with subtle border/shadow. `.card-header` (padding + bottom border) with `.card-title`.
- `.stat-grid` — responsive 2/4-col grid; `.stat-card` with `.stat-label` and `.stat-value`.
- `.field` — form field wrapper; `.label` — field label; `.input` — text/select/textarea styling. NOTE: many forms currently use inline `style={{...}}` — replace with `.field`/`.label`/`.input` classes.
- `.table-wrap` — horizontal scroll wrapper; `.table` — full-width table; thead uppercase small gray; rows with subtle borders, hover background.
- `.badge` — pill. Variants: `.badge-green` (active/paid/completed), `.badge-amber` (pending/partial/low stock), `.badge-red` (rejected/overdue), `.badge-blue` (submitted/scheduled), `.badge-gray` (neutral/cancelled).
- `.empty-state` — centered muted block for "no records".
- `.alert-error` (red), `.alert-success` (green), `.alert-info` (teal) — message banners.

## Hard rules

1. PRESERVE ALL LOGIC. Same state, same handlers, same data fetching, same conditionals, same routing. You are changing PRESENTATION ONLY.
2. Touch exactly the file(s) you were assigned. Do NOT edit globals.css, layout.tsx, or any other file.
3. Replace ALL inline `style={{...}}` objects with the design-system classes.
4. Keep any `<style jsx global>` print/media blocks (e.g. sick notes printing) EXACTLY as they are.
5. Keep all existing functionality: search inputs, filters, modals, dropdowns, confirm dialogs.
6. Status text should map to badges: paid/completed/active/in stock → green; pending/submitted/partially paid/scheduled/confirmed → blue; low stock/no show → amber; cancelled/rejected/overdue/out of stock → red; everything else → gray.
7. Money is ZAR: `R 1 250.00` format.
8. Keep every id/label/for association for form accessibility.
9. The page must compile: same imports (add none from files that don't exist), same exports, valid JSX.
10. Consistency beats cleverness. If a section is complex, simplify the VISUAL only.
