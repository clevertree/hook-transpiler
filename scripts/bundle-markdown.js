import * as esbuild from 'esbuild';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const rootDir = join(__dirname, '..');
const outfile = join(rootDir, 'android/src/main/assets/markdown-to-jsx.min.js');

console.log(`Bundling markdown-to-jsx to ${outfile}...`);

try {
    esbuild.buildSync({
        entryPoints: [join(rootDir, 'node_modules/markdown-to-jsx/dist/index.js')],
        bundle: true,
        minify: true,
        format: 'iife',
        globalName: 'MarkdownToJsx',
        outfile: outfile,
        target: 'es2015', // Ensure compatibility with JSC
    });
    console.log('Successfully bundled markdown-to-jsx!');
} catch (err) {
    console.error('Failed to bundle markdown-to-jsx:', err);
    process.exit(1);
}
