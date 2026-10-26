import type { ResolvedPalette } from '@8f4e/editor-palette';
import type { LineColor } from 'glugglugglug';

/** Prepared line colors from the same palette used to build the installed sprite atlas. */
export type WireColors = { wire: LineColor; wireHighlighted: LineColor };

export function resolveWireColors(palette: ResolvedPalette): WireColors {
	return { wire: palette.rgba.strokeBase, wireHighlighted: palette.rgba.strokeStrong };
}
