// Produce a self-contained HTML file for review outside the development server.
import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const dir=fileURLToPath(new URL('.',import.meta.url));
const result=await build({entryPoints:[dir+'main.js'],bundle:true,format:'iife',minify:true,write:false,logLevel:'warning'});
const css=await readFile(dir+'style.css','utf8');
const template=await readFile(dir+'index.html','utf8');
const js=result.outputFiles[0].text.replace(/<\/script/gi,'<\\/script');
await writeFile(dir+'preview.html',template.replace('<link rel="stylesheet" href="./style.css">',()=>`<style>${css}</style>`).replace('<script type="module" src="./main.js"></script>',()=>`<script>${js}</script>`));
console.log('Standalone HTML written: '+dir+'preview.html');
