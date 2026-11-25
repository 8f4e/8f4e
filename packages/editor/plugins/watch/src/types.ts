import type { PreparedAddressBinding, PreparedNumericRead } from '@8f4e/editor-state/memory';
import type { PlannedMemoryDeclaration } from '@8f4e/language-spec';

export type WatchDisplay =
	| { kind: 'address'; address: PreparedAddressBinding }
	| { kind: 'value'; read: PreparedNumericRead }
	| {
			kind: 'endAddress';
			address: PreparedAddressBinding;
			declarations: ReadonlyMap<number, PlannedMemoryDeclaration>;
	  };

export interface WatchValue {
	x: number;
	y: number;
	display: WatchDisplay;
	displayFormat: 'decimal' | 'binary' | 'hex';
}
