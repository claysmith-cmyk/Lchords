import { packager } from '@electron/packager';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const included = new Set(['package.json', 'desktop.cjs', 'index.html', 'style.css', 'app.js', 'music.js']);
const paths = await packager({
  dir: root,
  name: 'Chord Quest',
  platform: 'win32',
  arch: 'x64',
  out: fileURLToPath(new URL('./release', import.meta.url)),
  overwrite: true,
  asar: true,
  prune: false,
  ignore: file => file !== '' && !included.has(file.replace(/^[/\\]/, '')),
  win32metadata: { ProductName: 'Chord Quest', FileDescription: 'Chord Quest — Piano chord practice' },
});
console.log(`Desktop app: ${paths[0]}`);
