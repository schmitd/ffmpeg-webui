# Batch Image Optimizer (Vite + Bun + FFmpeg WASM)

A simple SPA that converts/optimizes multiple images in-browser using `@ffmpeg/ffmpeg` (WASM).

## Tech

- Vite SPA (TypeScript, no framework)
- Bun package manager/runtime
- FFmpeg WASM for client-side image conversion
- JSZip for optional "download all" output

## Local development

```bash
bun install
bun run dev
```

Then open the local Vite URL (usually `http://localhost:5173`).

## Build

```bash
bun run build
bun run preview
```

## How it works

1. Select multiple image files.
2. Choose output format (`webp`, `jpg`, `png`) and quality.
3. Optionally set max width for resize.
4. Click **Convert batch**.
5. Download individual files or all outputs as a ZIP.

## Railway deployment

This repo includes `railway.json` with:

- build: `bun install --frozen-lockfile && bun run build`
- start: `bun run start`

`start` runs `vite preview` on `$PORT` for Railway.

### Deploy steps

1. Push this project to GitHub.
2. In Railway, create a new project from that GitHub repo.
3. Railway detects `railway.json` and applies build/start commands.
4. After deploy, open the generated Railway URL.

## Notes

- First conversion run downloads FFmpeg core assets in the browser and may take a little longer.
- All processing happens client-side in the browser.
