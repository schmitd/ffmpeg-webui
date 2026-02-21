import './style.css';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import JSZip from 'jszip';

type OutputFormat = 'webp' | 'jpg' | 'png';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) {
  throw new Error('App mount point not found');
}

app.innerHTML = `
  <main class="container">
    <section class="card">
      <h1>Batch Image Optimizer</h1>
      <p>Convert and optimize multiple images in-browser using FFmpeg WASM.</p>

      <div class="grid">
        <div>
          <label for="files">Images</label>
          <input id="files" type="file" accept="image/*" multiple />
        </div>

        <div>
          <label for="format">Output format</label>
          <select id="format">
            <option value="webp">WebP</option>
            <option value="jpg">JPG</option>
            <option value="png">PNG</option>
          </select>
        </div>

        <div>
          <label for="quality">Quality (1-100)</label>
          <input id="quality" type="number" min="1" max="100" value="80" />
        </div>

        <div>
          <label for="maxWidth">Max width (optional)</label>
          <input id="maxWidth" type="number" min="64" placeholder="ex: 1920" />
        </div>
      </div>

      <button id="run">Convert batch</button>
      <button id="downloadZip" style="margin-top:10px; display:none;">Download all as ZIP</button>
      <div id="progress" class="progress"></div>
      <div id="error" class="error"></div>
      <div id="results" class="results"></div>
    </section>
  </main>
`;

const filesInput = document.querySelector<HTMLInputElement>('#files')!;
const formatInput = document.querySelector<HTMLSelectElement>('#format')!;
const qualityInput = document.querySelector<HTMLInputElement>('#quality')!;
const maxWidthInput = document.querySelector<HTMLInputElement>('#maxWidth')!;
const runButton = document.querySelector<HTMLButtonElement>('#run')!;
const downloadZipButton = document.querySelector<HTMLButtonElement>('#downloadZip')!;
const progressNode = document.querySelector<HTMLDivElement>('#progress')!;
const errorNode = document.querySelector<HTMLDivElement>('#error')!;
const resultsNode = document.querySelector<HTMLDivElement>('#results')!;

const ffmpeg = new FFmpeg();
let loaded = false;
let outputFiles: { name: string; blob: Blob }[] = [];

async function ensureLoaded() {
  if (loaded) return;
  progressNode.textContent = 'Loading FFmpeg core (first run can take a while)...';

  const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.9/dist/esm';
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    workerURL: await toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, 'text/javascript')
  });

  loaded = true;
}

function extensionFor(format: OutputFormat): string {
  return format === 'jpg' ? 'jpg' : format;
}

function buildArgs(inName: string, outName: string, format: OutputFormat, quality: number, maxWidth?: number) {
  const args = ['-i', inName];

  if (maxWidth && Number.isFinite(maxWidth) && maxWidth > 0) {
    args.push('-vf', `scale='min(${maxWidth},iw)':-2`);
  }

  if (format === 'webp') {
    const q = Math.max(0, Math.min(100, quality));
    args.push('-c:v', 'libwebp', '-q:v', String(q), '-compression_level', '6', outName);
  } else if (format === 'jpg') {
    const q = Math.max(2, Math.min(31, Math.round(((100 - quality) / 100) * 29 + 2)));
    args.push('-q:v', String(q), outName);
  } else {
    const compression = Math.max(0, Math.min(9, Math.round(((100 - quality) / 100) * 9)));
    args.push('-compression_level', String(compression), outName);
  }

  return args;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

runButton.addEventListener('click', async () => {
  errorNode.textContent = '';
  resultsNode.innerHTML = '';
  outputFiles = [];
  downloadZipButton.style.display = 'none';

  const selected = filesInput.files;
  if (!selected || selected.length === 0) {
    errorNode.textContent = 'Select at least one image file.';
    return;
  }

  const format = formatInput.value as OutputFormat;
  const quality = Number(qualityInput.value || 80);
  const maxWidth = maxWidthInput.value ? Number(maxWidthInput.value) : undefined;

  runButton.disabled = true;
  downloadZipButton.disabled = true;

  try {
    await ensureLoaded();

    for (let i = 0; i < selected.length; i += 1) {
      const file = selected[i];
      const inName = `in_${i}_${file.name.replace(/[^a-zA-Z0-9_.-]/g, '_')}`;
      const outExt = extensionFor(format);
      const base = file.name.replace(/\.[^.]+$/, '');
      const outName = `${base}.${outExt}`;

      progressNode.textContent = `Processing ${i + 1}/${selected.length}: ${file.name}`;

      await ffmpeg.writeFile(inName, await fetchFile(file));
      await ffmpeg.exec(buildArgs(inName, outName, format, quality, maxWidth));
      const data = await ffmpeg.readFile(outName);

      const mime = format === 'jpg' ? 'image/jpeg' : `image/${format}`;
      const blob = new Blob([data], { type: mime });
      outputFiles.push({ name: outName, blob });

      await ffmpeg.deleteFile(inName);
      await ffmpeg.deleteFile(outName);
    }

    progressNode.textContent = `Done. ${outputFiles.length} file(s) processed.`;

    outputFiles.forEach(({ name, blob }) => {
      const row = document.createElement('div');
      row.className = 'result-item';

      const sizeKb = Math.round((blob.size / 1024) * 10) / 10;
      row.innerHTML = `<span>${name} (${sizeKb} KB)</span>`;

      const dl = document.createElement('a');
      dl.href = '#';
      dl.textContent = 'Download';
      dl.addEventListener('click', (ev) => {
        ev.preventDefault();
        downloadBlob(blob, name);
      });

      row.appendChild(dl);
      resultsNode.appendChild(row);
    });

    if (outputFiles.length > 1) {
      downloadZipButton.style.display = 'block';
      downloadZipButton.disabled = false;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    errorNode.textContent = `Conversion failed: ${message}`;
    progressNode.textContent = '';
  } finally {
    runButton.disabled = false;
  }
});

downloadZipButton.addEventListener('click', async () => {
  if (!outputFiles.length) return;

  downloadZipButton.disabled = true;
  progressNode.textContent = 'Building ZIP...';

  try {
    const zip = new JSZip();
    outputFiles.forEach(({ name, blob }) => zip.file(name, blob));
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    downloadBlob(zipBlob, 'optimized-images.zip');
    progressNode.textContent = 'ZIP downloaded.';
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    errorNode.textContent = `ZIP failed: ${message}`;
  } finally {
    downloadZipButton.disabled = false;
  }
});
