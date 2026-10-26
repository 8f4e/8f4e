function getCanvasPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
	return new Promise((resolve, reject) => {
		canvas.toBlob(blob => {
			if (blob) resolve(blob);
			else reject(new Error('Failed to encode canvas as PNG'));
		}, 'image/png');
	});
}

export async function saveScreenshot(canvas: HTMLCanvasElement, fileName: string): Promise<void> {
	const document = canvas.ownerDocument;
	const browserWindow = document.defaultView as Window &
		typeof globalThis & {
			showSaveFilePicker?: (options: {
				suggestedName: string;
				types: Array<{ description: string; accept: Record<string, string[]> }>;
			}) => Promise<FileSystemFileHandle>;
		};
	// Start the picker in the menu's user gesture, before asynchronous PNG encoding.
	const destination = browserWindow.showSaveFilePicker?.({
		suggestedName: fileName,
		types: [{ description: 'PNG Image', accept: { 'image/png': ['.png'] } }],
	});
	const [handle, blob] = await Promise.all([destination, getCanvasPngBlob(canvas)]);
	if (handle) {
		const writable = await handle.createWritable();
		await writable.write(blob);
		await writable.close();
		return;
	}

	const url = browserWindow.URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = fileName;
	link.style.display = 'none';
	document.body.appendChild(link);
	try {
		link.click();
	} finally {
		link.remove();
		browserWindow.URL.revokeObjectURL(url);
	}
}
