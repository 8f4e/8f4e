export function registerEditorPwa() {
	if (!('serviceWorker' in navigator)) return;
	let controlled = navigator.serviceWorker.controller !== null;
	navigator.serviceWorker.addEventListener('controllerchange', () => {
		// First installation claims the page without interrupting it. An explicitly activated update reloads all tabs.
		if (controlled) window.location.reload();
		controlled = true;
	});
	void navigator.serviceWorker
		.register('/sw.js', { updateViaCache: 'none' })
		.catch(error => console.error('Failed to prepare offline support:', error));
}
