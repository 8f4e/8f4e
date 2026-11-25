import { AsciiRenderer } from '@8f4e/web-ui-testing';
import { expect, test } from 'vitest';
import { referenceTooltipViewport, withReferenceTooltipFrame } from './referenceTooltipFrame';

test.each([
	{ name: 'fixed-reference', declaration: 'float&' },
	{ name: 'allocated-pointer', declaration: 'float*' },
] as const)('snapshots the $name tooltip beside the other declaration', async ({ name, declaration }) => {
	const renderer = new AsciiRenderer(referenceTooltipViewport.width, referenceTooltipViewport.height);
	await withReferenceTooltipFrame(
		declaration,
		() => renderer,
		async () => {
			const frame = renderer.toText();
			expect(frame).toContain('deref: 1.5000');
			await expect(`${frame}\n`).toMatchFileSnapshot(`./__snapshots__/${name}-tooltip.viewport.snap`);
		}
	);
});
