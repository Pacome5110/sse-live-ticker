# QA Report

Generated on 2026-05-24 for `http://localhost:3001`.

## Automated Tests

Command:

```bash
npm test
```

Result: Passed.

- Test files: 1
- Tests: 7
- Coverage focus: market endpoints, auth lifecycle, refresh-token rotation, current-user endpoint, favorites, alerts, and validation failures.

## Static Accessibility Check

Command:

```bash
npm run a11y
```

Result: Passed.

Checks include:

- HTML `lang` attribute
- duplicate IDs
- labels or `aria-label` for form controls
- alt text for images
- accessible names for icon-only buttons

## Dependency Audit

Command:

```bash
npm audit --audit-level=moderate
```

Result: Passed with 0 vulnerabilities after applying the available safe audit fix.

## Lighthouse

Command used:

```bash
npx --yes lighthouse http://localhost:3001 --chrome-path="C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --chrome-flags="--headless --no-sandbox --disable-gpu" --output=json --output-path=docs\qa\lighthouse.json --quiet
```

The JSON report was written to `docs/qa/lighthouse.json`.

| Category | Score |
| --- | ---: |
| Performance | 70 |
| Accessibility | 90 |
| Best Practices | 88 |
| SEO | 100 |

The JSON report was generated successfully.

## Screenshots

Report screenshots are stored in `docs/screenshots`:

1. `01-dashboard.png`
2. `02-auth-modal.png`
3. `03-watchlist.png`
4. `04-alerts-modal.png`
5. `05-chart-modal.png`
6. `06-mobile.png`
7. `07-empty-error-state.png`
8. `08-theme-ocean.png`

## Known QA Notes

- Performance score is affected by the external Google Fonts and Lightweight Charts CDN requests plus the animated/live dashboard workload.
- Accessibility is good enough for the course target, but further improvement should focus on color contrast in muted table text and keyboard focus review in a real browser.
