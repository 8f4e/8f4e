import fixtureSource from '@8f4e/compiler/test-fixtures/argument-continuation.test.8f4e?raw';
import exampleSource from '@8f4e/examples/projects/misc/landingPageDemo1.8f4e?raw';
import { expect, test } from 'vitest';
import { getExampleProjectUrl } from './example-projects';
import { getHomepageProjectUrl } from './homepage-projects';
import { projectCategories } from './tests/projects';

test('serves the exact example source as an external asset in both homepage and gallery', async () => {
	const path = 'misc/landingPageDemo1.8f4e';
	for (const url of [getHomepageProjectUrl(path), getExampleProjectUrl(path)]) {
		expect(new URL(url, window.location.href).protocol).toMatch(/^https?:$/);
		const response = await fetch(url);
		expect(response.ok).toBe(true);
		expect(await response.text()).toBe(exampleSource);
	}
	expect(() => getExampleProjectUrl('not-a-project.8f4e')).toThrow('Example project not found');
});

test('keeps compiler gallery fixture IDs, source links, and external source assets', async () => {
	const projects = projectCategories.flatMap(category => category.projects);
	expect(projects.every(project => project.description.endsWith('.test.8f4e'))).toBe(true);
	const fixture = projects.find(project => project.id === 'argument-continuation')!;
	expect(fixture).toMatchObject({
		description: 'argument-continuation.test.8f4e',
		githubUrl: 'https://github.com/8f4e/8f4e/blob/main/compiler/tests/argument-continuation.test.8f4e',
	});
	expect(new URL(fixture.projectUrl, window.location.href).protocol).toMatch(/^https?:$/);
	const response = await fetch(fixture.projectUrl);
	expect(response.ok).toBe(true);
	expect(await response.text()).toBe(fixtureSource);
});
