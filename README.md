# Agentic cancel experience (v2)

Interactive prototype of a Prompt | Code journey shell: chat and an editable
plan write a YAML journey file; the canvas and subscriber preview compile from
that file. Cancel and acquisition (pricing table → checkout) share the same
shell.

**Live demo:** https://agentic-cancel-experience-v2.vercel.app/

v1 (frozen) remains at https://agentic-cancel-experience.vercel.app/

## Getting started

Built with **React 18 + TypeScript + Vite + Tailwind CSS**, state via **Zustand**,
and UI primitives from **@chargebee/sting-react**.

## Getting started

```bash
npm install
npm run dev
```

Then open the printed local URL (Vite defaults to http://localhost:5173).

## Scripts

| Command           | Description                          |
| ----------------- | ------------------------------------ |
| `npm run dev`     | Start the Vite dev server            |
| `npm run build`   | Type-check and build to `dist/`      |
| `npm run preview` | Preview the production build locally |

## Notes

- `@chargebee/sting-react` is a private package installed from the committed
  tarball at `vendor/chargebee-sting-react-1.2.0.tgz` (referenced via a `file:`
  dependency in `package.json`). The tarball is intentionally committed so the
  project installs and builds anywhere, including CI/hosting.
- React is pinned to v18 because `@chargebee/sting-react` relies on React 18
  internals.

## Deploying to Vercel

This is a standard Vite single-page app. On Vercel:

- **Framework preset:** Vite
- **Build command:** `npm run build`
- **Output directory:** `dist`
- **Install command:** `npm install`

No environment variables are required.
