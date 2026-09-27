# Approved club identity and personalized cards

Status: the project owner reviewed the local experience and explicitly approved public deployment.

- Branch: `design/club-identity-preview`
- Base production commit: `03e7bac`
- Preview: `http://127.0.0.1:8787`
- Release through the existing `main` GitHub Actions deployment to `https://jdsc.ahmedbahathiq.com`.
- The standalone card gallery is a local review artifact, generated in ignored `test-results/`; it is not part of the production build.

## Changes

- Original Data Science Club logo in the header, footer, result card and downloadable A6 PDF.
- Saudi green and white, soft lime highlights, and blue details drawn from the club logo.
- Redesigned home with an animated three-question visual and clearer explanation of the journey.
- Refined question, feedback, souvenir card, voting and results layouts.
- Gentle entry, chart and card motion, with reduced-motion support.
- Responsive layouts for phones and booth displays.
- Optional participant name, held only in React state and never sent to the API or stored in the database/browser storage.
- Four score-based card themes: green sprout (0), turquoise compass (1), blue data network (2), blue trophy with soft mint accents (3, خبير البيانات).
- One card layout shared by the live SVG preview, 1260 × 1776 PNG download, and A6 PDF with embedded Arabic font.

## Run locally

```sh
npm run build
npx wrangler dev --env staging --ip 127.0.0.1 --port 8787
```

Use local D1 data for design review. No production data or credentials are needed.
The PDF generated in the local preview contains the local preview address. Generate the final event PDF and QR only from the approved production site.

## Logo

See `public/brand/README.md` for the source and ownership notice. The MIT license covers the project code, not the club's logo.
