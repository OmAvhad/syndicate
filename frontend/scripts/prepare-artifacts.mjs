import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(await readFile(path.join(root, 'src/lib/shielded/artifactManifest.json'), 'utf8'));
const output = path.join(root, 'public/proving-artifacts', manifest.revision);
const hash = data => createHash('sha1').update(`blob ${data.length}\0`).update(data).digest('hex');
let next = 0, completed = 0;
await Promise.all(Array.from({ length: 4 }, async () => {
  while (next < manifest.files.length) {
    const file = manifest.files[next++];
    const target = path.join(output, `${file.path}.artifact`);
    let valid = false;
    try { const data = await readFile(target); valid = data.length === file.size && hash(data) === file.blob; } catch {}
    if (!valid) {
      const legacy = path.join(output, file.path);
      try {
        const data = await readFile(legacy);
        if (data.length === file.size && hash(data) === file.blob) { await rename(legacy, target); valid = true; }
      } catch {}
    }
    if (!valid) {
      let failure;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const response = await fetch(`https://raw.githubusercontent.com/Robert-MacWha/privacy-protocol-artifacts/${manifest.revision}/artifacts/${file.path}`, { signal: AbortSignal.timeout(180_000) });
          if (!response.ok) throw new Error(`HTTP ${response.status}: ${file.path}`);
          const data = Buffer.from(await response.arrayBuffer());
          if (data.length !== file.size || hash(data) !== file.blob) throw new Error(`Integrity check failed: ${file.path}`);
          await mkdir(path.dirname(target), { recursive: true });
          await writeFile(`${target}.partial`, data); await rename(`${target}.partial`, target);
          failure = null; break;
        } catch (error) { failure = error; }
      }
      if (failure) throw failure;
    }
    console.log(`[${++completed}/${manifest.files.length}] ${valid ? 'Verified' : 'Downloaded'} ${file.path}`);
  }
}));
console.log('Pinned proving files are ready for local serving and production builds.');
