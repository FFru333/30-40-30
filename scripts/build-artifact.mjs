// Impacchetta la build in un'unica pagina HTML (CSS e JS inline), per pubblicarla come Artifact.
import { execSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

execSync('npx vite build', { stdio: 'inherit', env: { ...process.env, VITE_ARTIFACT: '1' } });

const dir = 'dist-artifact/assets';
const files = readdirSync(dir);
const js = files.filter((f) => f.endsWith('.js'));
const css = files.filter((f) => f.endsWith('.css'));
if (js.length !== 1) throw new Error(`Attesi 1 file JS, trovati ${js.length}: ${js}`);

const style = css.map((f) => readFileSync(join(dir, f), 'utf8')).join('\n');
const script = readFileSync(join(dir, js[0]), 'utf8').replace(/<\/script/gi, '<\\/script');
const icon = readFileSync('public/icon.svg', 'utf8');

const html = `<title>Zone Planner</title>
<meta name="description" content="Pasti a Zona per due: blocchi, bilanciamento, archivio alimenti.">
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@300;400;500;600&display=swap">
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(icon)}">
<style>${style}</style>
<div id="root"></div>
<script type="module">${script}</script>
`;
writeFileSync('dist-artifact/zone-planner.html', html);
console.log(`dist-artifact/zone-planner.html ${(html.length / 1024).toFixed(0)} KB`);
