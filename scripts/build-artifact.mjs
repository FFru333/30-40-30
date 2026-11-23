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

// Versione autonoma: un solo file .html da salvare e aprire nel browser, anche offline
// (senza rete usa il font di sistema; la scansione delle etichette lì non c'è).
const standalone = `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#c9c7c0">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Zona">
<title>Zone Planner</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@300;400;500;600&display=swap">
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(icon)}">
<style>${style}</style>
</head>
<body>
<div id="root"></div>
<script type="module">${script}</script>
</body>
</html>
`;
writeFileSync('dist-artifact/zone-planner-standalone.html', standalone);
