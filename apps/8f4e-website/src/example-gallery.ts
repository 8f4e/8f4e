import { getExampleProjectPreviewUrl, getExampleProjectUrl } from './example-projects';
import { mountGallery } from './gallery';

export interface ExampleProject {
	id: string;
	title: string;
	description: string;
	path: string;
}

export interface ExampleCategory {
	path: string;
	title: string;
	projects: ExampleProject[];
}

/** Mounts an example catalog with source assets, optional previews, and editor links. */
export function mountExampleGallery(title: string, categories: ExampleCategory[]): () => void {
	return mountGallery({
		title,
		categories: categories.map(category => ({
			...category,
			projects: category.projects.map(project => ({
				...project,
				projectUrl: getExampleProjectUrl(project.path),
				previewUrl: getExampleProjectPreviewUrl(project.path),
				githubUrl: `https://github.com/8f4e/8f4e/blob/main/packages/examples/src/projects/${project.path}`,
			})),
		})),
	});
}
