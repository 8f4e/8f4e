import { getExampleProjectPreviewUrl, getExampleProjectUrl } from '../example-projects';
import { mountGallery } from '../gallery';
import { projectCategories } from './projects';

const dispose = mountGallery({
	title: 'Examples',
	categories: projectCategories.map(category => ({
		...category,
		projects: category.projects.map(project => ({
			...project,
			projectUrl: getExampleProjectUrl(project.path),
			previewUrl: getExampleProjectPreviewUrl(project.path),
			githubUrl: `https://github.com/8f4e/8f4e/blob/main/packages/examples/src/projects/${project.path}`,
		})),
	})),
});

import.meta.hot?.dispose(dispose);
