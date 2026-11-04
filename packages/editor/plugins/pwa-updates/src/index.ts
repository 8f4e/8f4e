import type { EditorPlugin } from '@8f4e/editor-core';

const DIALOG_ID = 'pwa-update';
const SHOW_UPDATE = 'showPwaUpdate';
const APPLY_UPDATE = 'applyPwaUpdate';

/** Observe the page-owned service worker without registering or activating it on startup. */
export function createPwaUpdatesPlugin({
	serviceWorker,
}: {
	serviceWorker: Pick<ServiceWorkerContainer, 'ready'>;
}): EditorPlugin {
	return {
		id: 'pwa-updates',
		setup: ({ events, menus }) => {
			let disposed = false;
			let registration: ServiceWorkerRegistration | undefined;
			let installing: ServiceWorker | null = null;
			let announced: ServiceWorker | null = null;
			let applying = false;
			const showUpdate = () => {
				if (!registration?.waiting) return;
				events.dispatch('addDialog', {
					id: DIALOG_ID,
					title: 'Update available',
					text: 'An update is ready. Reload to update all open 8f4e windows.',
					buttons: [{ title: 'Reload', action: APPLY_UPDATE }, { title: 'Later' }],
				});
			};
			const notifyUpdate = () => {
				const waiting = registration?.waiting;
				if (!waiting || waiting === announced) return;
				announced = waiting;
				applying = false;
				showUpdate();
			};
			const watchInstallation = () => {
				installing?.removeEventListener('statechange', notifyUpdate);
				installing = registration?.installing ?? null;
				installing?.addEventListener('statechange', notifyUpdate);
				notifyUpdate();
			};
			const applyUpdate = () => {
				const waiting = registration?.waiting;
				if (!waiting || applying) return;
				applying = true;
				waiting.postMessage({ type: 'SKIP_WAITING' });
			};
			const removeMenu = menus.registerItem('mainMenu', () =>
				registration?.waiting ? { title: 'Reload to update', action: SHOW_UPDATE, close: true } : undefined
			);
			events.on(SHOW_UPDATE, showUpdate);
			events.on(APPLY_UPDATE, applyUpdate);
			void serviceWorker.ready.then(readyRegistration => {
				if (disposed) return;
				registration = readyRegistration;
				registration.addEventListener('updatefound', watchInstallation);
				watchInstallation();
			});
			return () => {
				disposed = true;
				registration?.removeEventListener('updatefound', watchInstallation);
				installing?.removeEventListener('statechange', notifyUpdate);
				events.off(SHOW_UPDATE, showUpdate);
				events.off(APPLY_UPDATE, applyUpdate);
				removeMenu();
				events.dispatch('removeDialog', { id: DIALOG_ID });
			};
		},
	};
}
