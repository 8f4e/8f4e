import fixtureUrls from 'virtual:8f4e-source-urls/compiler-fixtures';
import type { GalleryCategory } from '../gallery';

const previewUrls = import.meta.glob<string>('../project-previews/compiler-test.gif', {
	query: '?url&no-inline',
	import: 'default',
	eager: true,
});
const compilerTestPreviewUrl = previewUrls['../project-previews/compiler-test.gif'];

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
for (const [path, projectUrl] of [...fixtureUrls].sort(([left], [right]) => left.localeCompare(right))) {
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
		githubUrl: `https://github.com/8f4e/8f4e/blob/main/compiler/tests/${path}`,
	});
}

export const projectCategories = [...categories.entries()]
	.sort(([left], [right]) => left.localeCompare(right))
	.map(([, category]) => category);
