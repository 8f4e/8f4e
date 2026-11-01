import type { Position, ProjectLevel, Viewport } from '@8f4e/editor-state-types';
import centerViewportOnCodeBlock from './centerViewportOnCodeBlock';

/** Remembered browser-memory positions take precedence over first-visit home placement. */
export default function getProjectViewportPosition(project: ProjectLevel, viewport: Viewport): Position {
	if (project.viewport) return project.viewport;
	const home = project.blocks.find(block => block.isHome);
	return home ? centerViewportOnCodeBlock(viewport, home, { alignment: home.homeAlignment }) : { x: 0, y: 0 };
}
