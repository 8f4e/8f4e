export function registerEditorPwa() {
	if (!('serviceWorker' in navigator)) return;
	const notice = document.querySelector<HTMLElement>('#pwa-notice')!;
	const message = document.querySelector<HTMLElement>('#pwa-message')!;
	const reload = document.querySelector<HTMLButtonElement>('#pwa-reload')!;
	const dismiss = document.querySelector<HTMLButtonElement>('#pwa-dismiss')!;
	const show = (text: string, canReload = false) => {
		message.textContent = text;
		reload.hidden = !canReload;
		reload.disabled = false;
		notice.hidden = false;
	};
	let registration: ServiceWorkerRegistration | undefined;
	let controlled = navigator.serviceWorker.controller !== null;
	navigator.serviceWorker.addEventListener('controllerchange', () => {
		// First installation claims the page without interrupting it. An explicitly activated update reloads all tabs.
		if (controlled) window.location.reload();
		controlled = true;
	});
	const showUpdate = () => show('An update is ready. Reload to update open 8f4e windows.', true);
	void navigator.serviceWorker
		.register('/sw.js', { updateViaCache: 'none' })
		.then(registered => {
			registration = registered;
			if (registered.waiting) showUpdate();
			const watchInstallation = () => {
				const worker = registered.installing;
				if (!worker) return;
				const isUpdate = registered.active !== null;
				let activated = false;
				worker.addEventListener('statechange', () => {
					if (worker.state === 'installed' && isUpdate) showUpdate();
					if (worker.state === 'activated') {
						activated = true;
						if (!isUpdate) show('8f4e is available offline.');
					}
					if (worker.state === 'redundant' && !activated) {
						show(
							isUpdate
								? 'The update download did not finish. Your previous version is still available.'
								: 'Offline download did not finish. Connect and reopen 8f4e to try again.'
						);
					}
				});
			};
			registered.addEventListener('updatefound', watchInstallation);
			watchInstallation();
		})
		.catch(error => {
			console.error('Failed to prepare offline support:', error);
			show('Offline setup failed. Connect and reopen 8f4e to try again.');
		});
	reload.addEventListener('click', () => {
		const waiting = registration?.waiting;
		if (!waiting) return;
		reload.disabled = true;
		waiting.postMessage({ type: 'SKIP_WAITING' });
	});
	dismiss.addEventListener('click', () => {
		notice.hidden = true;
		document.querySelector<HTMLCanvasElement>('#glcanvas')?.focus({ preventScroll: true });
	});
}
