import projectUrls from 'virtual:8f4e-source-urls/examples';

const projectPreviewUrls = import.meta.glob<string>('./project-previews/examples/**/*.gif', {
	query: '?url&no-inline',
	import: 'default',
	eager: true,
});

export function getExampleProjectUrl(path: string): string {
	const url = projectUrls.get(path);
	if (!url) {
		throw new Error(`Example project not found: ${path}`);
	}
	return url;
}

/** Previews are optional so new examples can load before their icons are generated. */
export function getExampleProjectPreviewUrl(path: string): string | undefined {
	const previewPath = path.replace(/\.8f4e$/, '.gif');
	return projectPreviewUrls[`./project-previews/examples/${previewPath}`];
}
