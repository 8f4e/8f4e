const projectUrls = import.meta.glob<string>('../../examples/src/projects/**/*.8f4e', {
	query: '?url&no-inline',
	import: 'default',
	eager: true,
});

const projectPreviewUrls = import.meta.glob<string>('./project-previews/examples/**/*.gif', {
	query: '?url&no-inline',
	import: 'default',
	eager: true,
});

export function getExampleProjectUrl(path: string): string {
	const url = projectUrls[`../../examples/src/projects/${path}`];
	if (!url) {
		throw new Error(`Example project not found: ${path}`);
	}
	return url;
}

export function getExampleProjectPreviewUrl(path: string): string {
	const previewPath = path.replace(/\.8f4e$/, '.gif');
	const url = projectPreviewUrls[`./project-previews/examples/${previewPath}`];
	if (!url) {
		throw new Error(`Example project preview not found: ${path}`);
	}
	return url;
}
