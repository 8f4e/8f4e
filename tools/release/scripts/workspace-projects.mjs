import fs from 'node:fs/promises';
import path from 'node:path';
import { createProjectGraphAsync } from '@nx/devkit';

/**
 * @typedef {object} WorkspaceMetricProject
 * @property {string} name Package name used by metric logs and bundle-size configuration.
 * @property {string} projectName Nx project name used for release tags.
 * @property {string | null} version Package version, if the project is versioned.
 * @property {string} root Absolute project directory.
 * @property {string} relativeRoot Workspace-relative project directory.
 * @property {string | null} sourceRoot Absolute source directory, or null for source-less projects.
 * @property {boolean} hasTestTarget Whether Nx exposes a test target for the project.
 */

/**
 * Discover release-metric packages from Nx's current project graph.
 * @param {string} workspaceRoot
 * @param {string[]} [packageRoots]
 * @returns {Promise<WorkspaceMetricProject[]>}
 */
export async function getWorkspaceProjects(workspaceRoot, packageRoots = []) {
	const graph = await createProjectGraphAsync({ exitOnError: false });
	return projectsFromGraph(workspaceRoot, graph, packageRoots);
}

/**
 * Select the same package-manager workspaces as the former lockfile scan. Explicit roots restrict
 * selection to Nx package projects below those directories, without scanning their contents.
 * @param {string} workspaceRoot
 * @param {import('@nx/devkit').ProjectGraph} graph
 * @param {string[]} [packageRoots]
 * @returns {Promise<WorkspaceMetricProject[]>}
 */
export async function projectsFromGraph(workspaceRoot, graph, packageRoots = []) {
	const selectedRoots = packageRoots.map(root => path.resolve(workspaceRoot, root));
	const projects = [];
	for (const node of Object.values(graph.nodes)) {
		const metadata = node.data.metadata?.js;
		if (!metadata?.packageName) continue;
		const root = path.resolve(workspaceRoot, node.data.root);
		if (
			selectedRoots.length
				? !selectedRoots.some(selected => containsPath(selected, root))
				: !metadata.isInPackageManagerWorkspaces
		) {
			continue;
		}

		projects.push({
			name: metadata.packageName,
			projectName: node.name,
			version: metadata.packageVersion ?? null,
			root,
			relativeRoot: node.data.root,
			sourceRoot: await resolveProjectSourceRoot(root, node.data.metadata?.metrics?.sourceDirectory ?? 'src'),
			hasTestTarget: Boolean(node.data.targets?.test),
		});
	}
	return projects.sort((left, right) => left.root.localeCompare(right.root));
}

/** Resolve a conventional or explicitly configured source directory relative to its Nx project root. */
async function resolveProjectSourceRoot(projectRoot, sourceDirectory) {
	const absolute = path.resolve(projectRoot, sourceDirectory);
	if (path.isAbsolute(sourceDirectory) || !containsPath(projectRoot, absolute)) {
		throw new Error(`Metrics sourceDirectory ${sourceDirectory} must be project-relative and inside ${projectRoot}`);
	}
	try {
		return (await fs.stat(absolute)).isDirectory() ? absolute : null;
	} catch (error) {
		if (error.code === 'ENOENT') return null;
		throw error;
	}
}

function containsPath(root, candidate) {
	const relative = path.relative(root, candidate);
	return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

/** Read repeated command-line options, supporting both --option value and --option=value. */
export function getOptionValues(args, name) {
	const values = [];
	for (let index = 0; index < args.length; index += 1) {
		const arg = args[index];
		if (arg === name) {
			const value = args[++index];
			if (!value || value.startsWith('--')) throw new Error(`${name} requires a value`);
			values.push(value);
		} else if (arg.startsWith(`${name}=`)) {
			const value = arg.slice(name.length + 1);
			if (!value) throw new Error(`${name} requires a value`);
			values.push(value);
		}
	}
	return values;
}
