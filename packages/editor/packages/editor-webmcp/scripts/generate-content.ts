import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import blockSources from 'virtual:8f4e-sources/reference-blocks';
import compilerDocs from 'virtual:8f4e-sources/reference-compiler';
import editorDocs from 'virtual:8f4e-sources/reference-editor';
import projectSources from 'virtual:8f4e-sources/reference-projects';
import { analyzeDocument, analyzeExamples, type DocumentationMetadata, type ExampleContent } from './catalog.js';

const packageRoot = fileURLToPath(new URL('../', import.meta.url));
const output = join(packageRoot, 'src/generated');
rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });

type Doc = DocumentationMetadata & { file: string };
type Example = Omit<ExampleContent, 'source'> & { file: string };
const docs: Doc[] = [];
const examples: Example[] = [];
let fileIndex = 0;
function content(source: string): string {
	const file = `content-${fileIndex++}.js`;
	writeFileSync(join(output, file.replace(/\.js$/, '.ts')), `export default ${JSON.stringify(source)};\n`);
	return file;
}
function addDocument(topic: string, source: string) {
	const file = content(source);
	docs.push(...analyzeDocument(topic, source).map(metadata => ({ ...metadata, file })));
}

for (const [prefix, sources] of [
	['compiler', compilerDocs],
	['editor', editorDocs],
] as const) {
	for (const [path, load] of sources) {
		addDocument(`${prefix}/${path}`, await load());
	}
}
const helpText = readFileSync(join(packageRoot, 'help.md'), 'utf8');
addDocument('bridge/help', helpText);

for (const [kind, sources] of [
	['block', blockSources],
	['project', projectSources],
] as const) {
	const loaded = new Map(await Promise.all([...sources].map(async ([path, load]) => [path, await load()] as const)));
	for (const { source, ...metadata } of analyzeExamples(kind, loaded)) {
		examples.push({ ...metadata, file: content(source) });
	}
}

function entries(items: Array<Doc | Example>): string {
	return items
		.map(
			({ file, ...metadata }) =>
				`${JSON.stringify(metadata).slice(0, -1)}, load: () => import('./${file}').then(module => module.default)}`
		)
		.join(',\n');
}
writeFileSync(
	join(output, 'catalog.ts'),
	[
		"import type { DocumentationEntry, ExampleEntry } from '../reference-types.js';",
		`export const helpText = ${JSON.stringify(helpText)};`,
		`export const documentation: DocumentationEntry[] = [${entries(docs)}];`,
		`export const examples: ExampleEntry[] = [${entries(examples)}];`,
	].join('\n')
);
process.stdout.write(
	`Bundled ${docs.length} documentation topics and ${examples.length} examples in ${relative(packageRoot, output)}\n`
);
