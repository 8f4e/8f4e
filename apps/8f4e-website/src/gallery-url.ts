export function getProjectId(url: URL, mobile: boolean, projects: ReadonlyArray<{ id: string }>): string | null {
	const fallback = mobile ? null : (projects[0]?.id ?? null);
	let id: string;
	try {
		id = decodeURIComponent(url.hash.slice(1));
	} catch {
		return fallback;
	}
	return projects.some(project => project.id === id) ? id : fallback;
}

export function withProjectId(url: URL, id: string | null): URL {
	const nextUrl = new URL(url);
	nextUrl.hash = id ?? '';
	return nextUrl;
}
