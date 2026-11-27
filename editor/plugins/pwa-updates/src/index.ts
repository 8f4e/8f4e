import type { EditorPlugin } from '@8f4e/editor-core';

const DIALOG_ID = 'pwa-update';
const SHOW_UPDATE = 'showPwaUpdate';
const POSTPONE_UPDATE = 'postponePwaUpdate';
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
			let ready = false;
			let postponed = false;
			let applying = false;
			const showUpdate = () => {
				if (!announced) return;
				postponed = false;
				const later = { title: 'Later', action: POSTPONE_UPDATE };
				events.dispatch('addDialog', {
					id: DIALOG_ID,
					title: 'Update available',
					text: ready
						? 'An update is ready. Reload to update all open 8f4e windows.'
						: 'Downloading the update. Choose Later to keep working.',
					buttons: ready ? [{ title: 'Reload', action: APPLY_UPDATE }, later] : [later],
				});
			};
			const postponeUpdate = () => {
				postponed = true;
			};
			const notifyUpdate = () => {
				const waiting = registration?.waiting;
				const worker = waiting ?? (registration?.active && installing?.state === 'installing' ? installing : null);
				if (worker === announced && ready === Boolean(waiting)) return;
				if (worker !== announced) {
					postponed = false;
					applying = false;
				}
				announced = worker;
				ready = Boolean(waiting);
				if (!worker) {
					events.dispatch('removeDialog', { id: DIALOG_ID });
				} else if (!postponed) {
					showUpdate();
				}
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
				announced
					? { title: ready ? 'Reload to update' : 'Update status', action: SHOW_UPDATE, close: true }
					: undefined
			);
			events.on(SHOW_UPDATE, showUpdate);
			events.on(POSTPONE_UPDATE, postponeUpdate);
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
				events.off(POSTPONE_UPDATE, postponeUpdate);
				events.off(APPLY_UPDATE, applyUpdate);
				removeMenu();
				events.dispatch('removeDialog', { id: DIALOG_ID });
			};
		},
	};
}
