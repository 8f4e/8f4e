import stackOperationsUrl from '../../examples/src/projects/misc/landingPageDemo1.8f4e?url&no-inline';
import pointersUrl from '../../examples/src/projects/misc/landingPageDemo2.8f4e?url&no-inline';
import memoryLayoutUrl from '../../examples/src/projects/misc/landingPageDemo3.8f4e?url&no-inline';
import interactiveControlsUrl from '../../examples/src/projects/misc/landingPageDemo4.8f4e?url&no-inline';

const projectUrls = new Map([
	['misc/landingPageDemo1.8f4e', stackOperationsUrl],
	['misc/landingPageDemo2.8f4e', pointersUrl],
	['misc/landingPageDemo3.8f4e', memoryLayoutUrl],
	['misc/landingPageDemo4.8f4e', interactiveControlsUrl],
]);

export function getHomepageProjectUrl(path: string): string {
	const url = projectUrls.get(path);
	if (!url) {
		throw new Error(`Homepage project not found: ${path}`);
	}
	return url;
}
