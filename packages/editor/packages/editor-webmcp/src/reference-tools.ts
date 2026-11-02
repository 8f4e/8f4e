import { getDocs, getExample, getHelp, searchDocs, searchExamples } from './reference.js';
import { emptyInput, objectInput, type ToolDefinition } from './tool.js';

const query = { type: 'string', description: 'Search words, or an empty string to browse the catalog.' };
const offset = { type: 'integer', minimum: 0, description: 'Pagination offset from the previous nextOffset result.' };
const exampleKind = { type: 'string', enum: ['block', 'project'] };
export const referenceTools: ToolDefinition[] = [
	{
		name: 'get_help',
		title: 'Learn 8f4e and its editor tools',
		description:
			'Start here if you are unfamiliar with 8f4e. Read a language introduction, a complete small example, and how to find documentation, examples, and edit the open project.',
		inputSchema: emptyInput,
		readOnly: true,
		run: () => {
			return getHelp();
		},
	},
	{
		name: 'search_docs',
		title: 'Search bundled 8f4e documentation',
		description:
			'Find language concepts, instructions, compiler directives, and editor directives. Returns up to 20 topic names and summaries with total and nextOffset; use get_docs to read a topic. An empty query browses the catalog. This does not refresh the live-source revision baseline.',
		inputSchema: objectInput({ query, offset }, ['query']),
		readOnly: true,
		run: args => {
			return searchDocs(args.query, args.offset);
		},
	},
	{
		name: 'get_docs',
		title: 'Read bundled 8f4e documentation',
		description:
			'Read a topic returned by search_docs as Markdown, including enclosing context, syntax, restrictions, and examples. This does not refresh the live-source revision baseline.',
		inputSchema: objectInput({ topic: { type: 'string', description: 'Exact topic returned by search_docs.' } }, [
			'topic',
		]),
		readOnly: true,
		run: args => {
			return getDocs(args.topic);
		},
	},
	{
		name: 'search_examples',
		title: 'Search bundled 8f4e example blocks and projects',
		description:
			'Find reusable blocks or complete projects by name, category, or description. An empty query browses the catalog. Returns up to 20 matches with kind, path, title, category, summary, dependency block paths, total, and nextOffset. Use get_example to read source. This does not refresh the live-source revision baseline.',
		inputSchema: objectInput({ query, kind: exampleKind, offset }, ['query']),
		readOnly: true,
		run: args => {
			return searchExamples(args.query, args.kind, args.offset);
		},
	},
	{
		name: 'get_example',
		title: 'Read an 8f4e example block or project',
		description:
			'Return a source string for a kind and path returned by search_examples. Blocks contain their reusable public source without the library-only @public marker; fetch listed dependencies too when needed. Projects contain the entire original source, including nested groups. This does not open or insert content, navigate the editor, or refresh its revision baseline.',
		inputSchema: objectInput(
			{ kind: exampleKind, path: { type: 'string', description: 'Exact path returned by search_examples.' } },
			['kind', 'path']
		),
		readOnly: true,
		run: args => {
			return getExample(args.kind, args.path);
		},
	},
];
