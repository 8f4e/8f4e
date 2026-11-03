import type { DialogButton } from '@8f4e/editor-state-types';
import type { DialogButtonLayout } from './types';

const BUTTON_HORIZONTAL_PADDING_GRID_CELLS = 4;
const BUTTON_HEIGHT_GRID_CELLS = 3;
const BUTTON_GAP_GRID_CELLS = 1;

interface ButtonLayout {
	buttons: DialogButtonLayout[];
	heightInGridRows: number;
}

interface MeasuredButton extends DialogButton {
	width: number;
}

export default function layoutButtons(
	buttons: DialogButton[],
	dialogWidth: number,
	textLineCount: number,
	vGrid: number,
	hGrid: number
): ButtonLayout {
	if (buttons.length === 0) {
		return { buttons: [], heightInGridRows: 0 };
	}

	const availableWidth = dialogWidth - 2 * vGrid;
	const buttonGap = BUTTON_GAP_GRID_CELLS * vGrid;
	const maximumTitleLength = Math.max(0, Math.floor(availableWidth / vGrid) - 2 * BUTTON_HORIZONTAL_PADDING_GRID_CELLS);
	const measuredButtons: MeasuredButton[] = buttons.map(button => {
		const title = button.title.slice(0, maximumTitleLength);
		return {
			...button,
			title,
			width: (title.length + 2 * BUTTON_HORIZONTAL_PADDING_GRID_CELLS) * vGrid,
		};
	});
	const rows: MeasuredButton[][] = [];

	for (const button of measuredButtons) {
		const row = rows[rows.length - 1];
		const occupiedWidth = row?.reduce((width, item) => width + item.width, 0) ?? 0;
		const gapsWidth = row ? row.length * buttonGap : 0;

		if (!row || (row.length > 0 && occupiedWidth + gapsWidth + button.width > availableWidth)) {
			rows.push([button]);
			continue;
		}

		row.push(button);
	}

	const laidOutButtons = rows.flatMap((row, rowIndex) => {
		const rowWidth = row.reduce((width, button) => width + button.width, 0) + (row.length - 1) * buttonGap;
		let x = dialogWidth - vGrid - rowWidth;
		const y = (textLineCount + 4 + rowIndex * BUTTON_HEIGHT_GRID_CELLS) * hGrid;

		return row.map(button => {
			const layout: DialogButtonLayout = {
				...button,
				x,
				y,
				height: BUTTON_HEIGHT_GRID_CELLS * hGrid,
			};
			x += button.width + buttonGap;
			return layout;
		});
	});

	return { buttons: laidOutButtons, heightInGridRows: rows.length * BUTTON_HEIGHT_GRID_CELLS };
}
