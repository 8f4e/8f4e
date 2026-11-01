import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { generateProjectPreview } from '../../../tools/project-preview/dist/index.js';

import { projects as exampleProjects } from '../src/examples/projects.ts';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workspaceRoot = path.resolve(packageRoot, '../..');
const previewRoot = path.join(packageRoot, 'src', 'project-previews');
const compilerTestRoot = path.join(workspaceRoot, 'packages', 'compiler', 'tests');
const exampleProjectRoot = path.join(workspaceRoot, 'packages', 'examples', 'src', 'projects');
const compilerTestPreviewSource = path.join(compilerTestRoot, 'argument-continuation.test.8f4e');
const featuredProjectIds = [
	'dx7-e-piano',
	'reverb',
	'hymn-to-aurora',
	'lower-intentions',
	'digit-classifier',
	'random-generators',
	'audio-buffer',
	'audio-loopback-with-delay',
	'variable-speed-player',
	'risen',
	'overlay-texture',
	'aftertouch',
];
const featuredProjects = featuredProjectIds.map(id => {
	const project = exampleProjects.find(candidate => candidate.id === id);
	if (!project) {
		throw new Error(`Featured project not found: ${id}`);
	}
	return project;
});
const animatedFeaturedProjectIds = new Set([
	'reverb',
	'hymn-to-aurora',
	'lower-intentions',
	'risen',
	'audio-buffer',
	'aftertouch',
]);
const featuredAnimationOptions = {
	captureIntervalMs: 1000,
	frameCount: 4,
	framesPerSecond: 2,
	startAtMs: 5000,
};
const featuredProjectPositions = new Map([
	['lower-intentions', { x: 3790, y: 16 }],
	['digit-classifier', { x: 16, y: 16 }],
	['risen', { x: 16, y: 16 }],
	['aftertouch', { x: 16, y: 16 }],
]);

const jobs = [
	...exampleProjects.map(project => ({
		inputPath: path.join(exampleProjectRoot, project.path),
		outputPath: path.join(previewRoot, 'examples', project.path.replace(/\.8f4e$/, '.gif')),
	})),
	...featuredProjects.map(project => ({
		inputPath: path.join(exampleProjectRoot, project.path),
		outputPath: path.join(previewRoot, 'featured', `${project.id}.gif`),
		position: featuredProjectPositions.get(project.id),
		...(project.path.startsWith('audio/') ? { startAtMs: 1500 } : {}),
		...(animatedFeaturedProjectIds.has(project.id) ? featuredAnimationOptions : {}),
		size: 256,
	})),
	{
		inputPath: compilerTestPreviewSource,
		outputPath: path.join(previewRoot, 'compiler-test.gif'),
	},
];

jobs.sort((left, right) => left.outputPath.localeCompare(right.outputPath));
await fs.rm(previewRoot, { recursive: true, force: true });

for (const job of jobs) {
	await generateProjectPreview({ format: 'icon', ...job });
	console.log(`Created ${path.relative(packageRoot, job.outputPath)}`);
}

console.log(`Generated ${jobs.length} project previews.`);
