import type { GalleryCategory } from '../gallery';

const fixtureRoot = '../../../compiler/tests/';
const fixtureUrls = import.meta.glob<string>('../../../compiler/tests/**/*.test.8f4e', {
	query: '?url&no-inline',
	import: 'default',
	eager: true,
});
const previewUrls = import.meta.glob<string>('../project-previews/compiler-test.gif', {
	query: '?url&no-inline',
	import: 'default',
	eager: true,
});
const compilerTestPreviewUrl = previewUrls['../project-previews/compiler-test.gif'];
if (!compilerTestPreviewUrl) {
	throw new Error('Compiler test preview not found');
}

function humanize(name: string): string {
	const words = name.replaceAll('-', ' ');
	return words.charAt(0).toUpperCase() + words.slice(1);
}

const categoryTitles: Record<string, string> = {
	'': 'General',
	stdlib: 'Standard library',
	'intermodular-references': 'Intermodular references',
};

const categories = new Map<string, GalleryCategory>();
for (const [file, projectUrl] of Object.entries(fixtureUrls).sort(([left], [right]) => left.localeCompare(right))) {
	const path = file.slice(fixtureRoot.length);
	const directory = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
	let category = categories.get(directory);
	if (!category) {
		category = { path: directory || 'general', title: categoryTitles[directory] ?? humanize(directory), projects: [] };
		categories.set(directory, category);
	}
	category.projects.push({
		id: path.replace(/\.test\.8f4e$/, ''),
		title: humanize(path.slice(path.lastIndexOf('/') + 1).replace(/\.test\.8f4e$/, '')),
		description: path,
		projectUrl,
		previewUrl: compilerTestPreviewUrl,
		githubUrl: `https://github.com/8f4e/8f4e/blob/main/packages/compiler/tests/${path}`,
	});
}

export const projectCategories = [...categories.entries()]
	.sort(([left], [right]) => left.localeCompare(right))
	.map(([, category]) => category);
