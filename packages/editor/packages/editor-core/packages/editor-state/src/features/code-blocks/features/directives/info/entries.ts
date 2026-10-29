import type { InfoRecord, State } from '@8f4e/editor-state-types';
import { formatInfoValue, isRenderableInfoValue } from '~/shared/formatInfoValue';

export interface InfoLayout {
	rowCount: number;
	keyColumnWidth: number;
	maxEntryWidth: number;
}

function getInfoRecord(state: Pick<State, 'info'> | undefined, id: string): InfoRecord | undefined {
	const record = state?.info[id];

	if (!record || typeof record !== 'object' || Array.isArray(record)) {
		return undefined;
	}

	return record;
}

export function getInfoLayout(state: Pick<State, 'info'> | undefined, id: string): InfoLayout {
	const record = getInfoRecord(state, id);
	const layout: InfoLayout = {
		rowCount: 0,
		keyColumnWidth: 0,
		maxEntryWidth: 0,
	};

	if (!record) {
		return layout;
	}

	for (const key in record) {
		if (Object.hasOwn(record, key) && isRenderableInfoValue(record[key])) {
			layout.rowCount += 1;
			layout.keyColumnWidth = Math.max(layout.keyColumnWidth, key.length);
			layout.maxEntryWidth = Math.max(layout.maxEntryWidth, key.length + 2 + formatInfoValue(record[key]).length);
		}
	}

	return layout;
}
