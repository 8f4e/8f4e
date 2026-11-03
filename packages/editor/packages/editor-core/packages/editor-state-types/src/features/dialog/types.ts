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

export interface ActivateDialogButtonEvent {
	id: string;
	buttonIndex: number;
}
