import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Read the npm workspace links without scanning standalone tools or third-party source trees.
 * @param {string} workspaceRoot
 * @returns {Promise<string[]>}
 */
export async function getWorkspacePackageRoots(workspaceRoot) {
	const { packages } = JSON.parse(await fs.readFile(path.join(workspaceRoot, 'package-lock.json'), 'utf8'));
	const roots = Object.entries(packages)
		.filter(
			([name, entry]) => /^node_modules\/(?:@[^/]+\/)?[^/]+$/.test(name) && entry.link && packages[entry.resolved]
		)
		.map(([, entry]) => path.resolve(workspaceRoot, entry.resolved));
	return [...new Set(roots)].sort();
}

/**
 * Accept both package-relative and workspace-relative sourceRoot values in project.json.
 * @param {string} workspaceRoot
 * @param {string} packageRoot
 * @param {string} [configuredSourceRoot]
 * @returns {Promise<string | null>}
 */
export async function resolveWorkspaceSourceRoot(workspaceRoot, packageRoot, configuredSourceRoot) {
	const localRoot = path.resolve(packageRoot, configuredSourceRoot || 'src');
	if (await isDirectory(localRoot)) {
		return localRoot;
	}
	if (configuredSourceRoot) {
		const workspacePath = path.resolve(workspaceRoot, configuredSourceRoot);
		if (await isDirectory(workspacePath)) {
			return workspacePath;
		}
	}
	return null;
}

async function isDirectory(directory) {
	try {
		return (await fs.stat(directory)).isDirectory();
	} catch {
		return false;
	}
}
