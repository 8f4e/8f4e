import { promises as fs } from 'node:fs';

import { preview } from 'vite';

const PREVIEW_HOST = '127.0.0.1';
const PREVIEW_HEADERS = {
	'Cache-Control': 'no-store',
	'Cross-Origin-Embedder-Policy': 'require-corp',
	'Cross-Origin-Opener-Policy': 'same-origin',
} as const;

export interface PreviewServer {
	url: string;
	close: () => Promise<void>;
}

interface PreviewServerOptions {
	editorAssetsPath: string;
	projectPath: string;
}

/**
 * Serves the production editor and project from one cross-origin-isolated HTTP origin.
 * A file URL cannot provide the project fetch or COOP/COEP headers the editor needs.
 */
export async function startPreviewServer({
	editorAssetsPath,
	projectPath,
}: PreviewServerOptions): Promise<PreviewServer> {
	const projectSource = await fs.readFile(projectPath);
	const server = await preview({
		appType: 'mpa',
		build: {
			outDir: '.',
		},
		configFile: false,
		logLevel: 'silent',
		plugins: [
			{
				name: '8f4e-project-preview-project',
				configurePreviewServer(viteServer) {
					viteServer.middlewares.use((request, response, next) => {
						const requestUrl = new URL(request.url ?? '/', `http://${PREVIEW_HOST}`);
						if (requestUrl.pathname !== '/project.8f4e') {
							next();
							return;
						}

						for (const [name, value] of Object.entries(PREVIEW_HEADERS)) {
							response.setHeader(name, value);
						}
						response.statusCode = 200;
						response.setHeader('Content-Type', 'text/plain; charset=utf-8');
						response.setHeader('Content-Length', projectSource.byteLength);
						response.end(projectSource);
					});
				},
			},
		],
		preview: {
			headers: PREVIEW_HEADERS,
			host: PREVIEW_HOST,
			port: 0,
			strictPort: true,
		},
		publicDir: false,
		root: editorAssetsPath,
	});

	const address = server.httpServer.address();
	if (!address || typeof address === 'string') {
		await server.close();
		throw new Error('Failed to determine preview server address');
	}

	return {
		url: `http://${PREVIEW_HOST}:${address.port}`,
		close: () => server.close(),
	};
}
