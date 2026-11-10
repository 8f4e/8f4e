import type { DialogButton, DialogContent, Position, Size } from '@8f4e/editor-state-types';
import type { GlyphIds } from '@8f4e/web-ui';

export type DialogButtonLayout = Omit<DialogButton, 'title'> & Position & Size & { title: GlyphIds };

/** Derived presentation data, kept private to each installed plugin. */
export interface DialogLayout extends Omit<DialogContent, 'buttons' | 'title'>, Position, Size {
	title: GlyphIds;
	wrappedText: GlyphIds[];
	buttons: DialogButtonLayout[];
}
