import { afterEach, expect, test, vi } from 'vitest';
import { mountExampleGallery } from './example-gallery';
import { getExampleProjectUrl } from './example-projects';
import { projects as publicProjects } from './examples/projects';
import { projectCategories, projects } from './unlisted-examples/projects';

const cleanups: Array<() => void> = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
	vi.restoreAllMocks();
});

test('opens and switches unlisted projects with shareable links while keeping them out of the public catalog', async () => {
	const originalUrl = window.location.href;
	const originalTitle = document.title;
	window.history.replaceState(null, '', '#felt-piano');
	const projectUrls = new Set(projects.map(project => getExampleProjectUrl(project.path)));
	const fetch = globalThis.fetch.bind(globalThis);
	vi.spyOn(globalThis, 'fetch').mockImplementation((input, options) =>
		projectUrls.has(String(input))
			? Promise.resolve(new Response('8f4e/v1\nentry main\nmodule unlistedFixture\nint value 1\nmoduleEnd\nentryEnd'))
			: fetch(input, options)
	);
	const gallery = document.createElement('div');
	gallery.id = 'examples-gallery';
	document.body.append(gallery);
	const dispose = mountExampleGallery('Unlisted examples', projectCategories);
	cleanups.push(() => {
		dispose();
		gallery.remove();
		window.history.replaceState(null, '', originalUrl);
		document.title = originalTitle;
	});

	for (const project of projects) {
		expect(publicProjects.some(candidate => candidate.id === project.id)).toBe(false);
		expect(gallery.querySelector(`#example-${project.id}`)?.textContent).toContain(project.title);
	}
	const piano = gallery.querySelector<HTMLElement>('#panel-felt-piano')!;
	await vi.waitFor(() => expect(piano.querySelector('canvas')?.classList.contains('editor-ready')).toBe(true));
	expect(piano.hidden).toBe(false);
	expect(document.title).toBe('Felt piano — 8f4e unlisted examples');
	const editorLink = piano.querySelector<HTMLAnchorElement>('.open-in-editor-button')!;
	expect(new URL(editorLink.href).searchParams.get('projectUrl')).toBe(
		new URL(getExampleProjectUrl('midi/feltPiano.8f4e'), window.location.href).href
	);

	gallery.querySelector<HTMLButtonElement>('#example-granular-sampler')!.click();
	expect(window.location.hash).toBe('#granular-sampler');
	expect(piano.hidden).toBe(true);
	expect(gallery.querySelector<HTMLElement>('#panel-granular-sampler')!.hidden).toBe(false);
	gallery.querySelector<HTMLButtonElement>('#example-cyclic-timestretch')!.click();
	expect(window.location.hash).toBe('#cyclic-timestretch');
	expect(document.title).toBe('Cyclic time stretch — 8f4e unlisted examples');
});
