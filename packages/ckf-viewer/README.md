# Open CKF Viewer — Standalone

Drop a `.ckf.json` file (or compile one with `ckf-compiler`) and explore its sections, rules, definitions, procedures, and source traceability. **Everything runs in your browser. Nothing is uploaded.**

## Quick start

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # → dist/
npm run preview
```

## Hosting

Static SPA. Same options as the compiler — GitHub Pages, Netlify, S3, nginx, or open `dist/index.html` directly.

## What it shows

- Metadata (title, language, compiler, status)
- Concepts, entities, definitions
- Statements, rules
- Procedures (step-by-step)
- Q&A pairs
- Source excerpts + traceability mapping
- Real-time text search across the package

## License

MIT.
