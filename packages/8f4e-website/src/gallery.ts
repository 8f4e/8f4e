import { mountGalleryEditorSession } from './gallery-editor-session';
import { getProjectId, withProjectId } from './gallery-url';

export interface GalleryProject {
	id: string;
	title: string;
	description: string;
	projectUrl: string;
	previewUrl: string;
	githubUrl: string;
}

export interface GalleryCategory {
	path: string;
	title: string;
	projects: GalleryProject[];
}

interface GalleryOptions {
	title: string;
	categories: GalleryCategory[];
	includeKeyboardModeSwitching?: boolean;
}

export function mountGallery({ title, categories, includeKeyboardModeSwitching }: GalleryOptions): () => void {
	const projects = categories.flatMap(category => category.projects);
	const gallery = document.querySelector<HTMLDivElement>('#examples-gallery')!;
	const mobileLayout = window.matchMedia('(max-width: 800px)');
	let activeId: string | null = null;
	let disposeSelection: (() => void) | undefined;
	let disposed = false;

	const items = categories.flatMap(category => {
		const section = document.createElement('section');
		section.className = 'example-category';
		const heading = document.createElement('h2');
		heading.className = 'example-category-heading';
		heading.id = `category-${category.path.replaceAll('/', '-')}`;
		heading.textContent = category.title;
		section.setAttribute('aria-labelledby', heading.id);
		section.append(heading);
		gallery.append(section);

		return category.projects.map(project => {
			const item = document.createElement('section');
			item.className = 'example-item';
			const heading = document.createElement('h3');
			heading.className = 'example-heading';
			const toggle = document.createElement('button');
			toggle.className = 'example-toggle';
			toggle.type = 'button';
			toggle.id = `example-${project.id}`;
			toggle.setAttribute('aria-expanded', 'false');
			toggle.setAttribute('aria-controls', `panel-${project.id}`);
			const title = document.createElement('span');
			title.className = 'example-title';
			title.textContent = project.title;
			const description = document.createElement('span');
			description.className = 'example-description';
			description.textContent = project.description;
			const preview = document.createElement('img');
			preview.className = 'example-preview';
			preview.src = project.previewUrl;
			preview.width = 64;
			preview.height = 64;
			preview.alt = '';
			preview.loading = 'lazy';
			preview.decoding = 'async';
			preview.draggable = false;
			toggle.append(preview, title, description);
			heading.append(toggle);

			const panel = document.createElement('div');
			panel.className = 'example-panel';
			panel.id = `panel-${project.id}`;
			panel.setAttribute('role', 'region');
			panel.setAttribute('aria-labelledby', toggle.id);
			panel.hidden = true;
			const frame = document.createElement('div');
			frame.className = 'editor-frame';
			const status = document.createElement('div');
			status.className = 'example-status';
			status.setAttribute('role', 'status');
			const projectUrl = project.projectUrl;
			const openLink = document.createElement('a');
			openLink.className = 'open-in-editor-button';
			openLink.textContent = 'Open in editor ↗';
			openLink.href = `https://editor.8f4e.com/?projectUrl=${encodeURIComponent(new URL(projectUrl, window.location.href).href)}`;
			const githubLink = document.createElement('a');
			githubLink.className = 'open-in-editor-button';
			githubLink.textContent = 'GitHub ↗';
			githubLink.href = project.githubUrl;
			githubLink.target = '_blank';
			githubLink.rel = 'noopener noreferrer';
			const actions = document.createElement('div');
			actions.className = 'example-actions';
			actions.append(openLink, githubLink);
			frame.append(status);
			panel.append(frame, actions);
			item.append(heading, panel);
			section.append(item);
			toggle.addEventListener('click', () => {
				const id = activeId === project.id && mobileLayout.matches ? null : project.id;
				if (id !== activeId) {
					window.history.pushState(null, '', withProjectId(new URL(window.location.href), id));
					selectExample(id);
				}
			});
			return { project, toggle, panel, frame, status, projectUrl };
		});
	});

	function selectExample(id: string | null, retry = false): void {
		if (disposed || (activeId === id && !retry)) {
			return;
		}
		activeId = id;
		disposeSelection?.();
		disposeSelection = undefined;
		for (const item of items) {
			const selected = item.project.id === id;
			item.toggle.setAttribute('aria-expanded', String(selected));
			item.panel.hidden = !selected;
		}
		const item = items.find(item => item.project.id === id);
		document.title = item ? `${item.project.title} — 8f4e ${title.toLowerCase()}` : `${title} — 8f4e`;
		if (!item) {
			return;
		}
		disposeSelection = mountGalleryEditorSession({
			title: item.project.title,
			projectUrl: item.projectUrl,
			frame: item.frame,
			status: item.status,
			includeKeyboardModeSwitching,
			onRetry: () => selectExample(id, true),
		});
	}

	function onUrlChange(): void {
		const url = new URL(window.location.href);
		const id = getProjectId(url, mobileLayout.matches, projects);
		const nextUrl = withProjectId(url, id);
		if (nextUrl.href !== url.href) {
			window.history.replaceState(window.history.state, '', nextUrl);
		}
		selectExample(id);
	}

	function onLayoutChange(): void {
		if (!mobileLayout.matches && activeId === null) {
			onUrlChange();
		}
	}
	mobileLayout.addEventListener('change', onLayoutChange);
	window.addEventListener('popstate', onUrlChange);
	window.addEventListener('hashchange', onUrlChange);
	onUrlChange();
	if (mobileLayout.matches && activeId !== null) {
		items.find(item => item.project.id === activeId)?.toggle.scrollIntoView({ block: 'start' });
	}

	function dispose(): void {
		disposed = true;
		disposeSelection?.();
		disposeSelection = undefined;
		mobileLayout.removeEventListener('change', onLayoutChange);
		window.removeEventListener('popstate', onUrlChange);
		window.removeEventListener('hashchange', onUrlChange);
	}
	return dispose;
}
