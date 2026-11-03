export interface DialogButton {
	title: string;
	action?: string;
	payload?: unknown;
	close?: boolean;
}

export interface DialogContent {
	id: string;
	text: string;
	title: string;
	buttons: DialogButton[];
}

/** Content of the top dialog, independent of its presentation. */
export type DialogState = DialogContent;

export interface ActivateDialogButtonEvent {
	id: string;
	buttonIndex: number;
}
