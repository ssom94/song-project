import app from './index';
import { handleCompleteAdminApItem, handleGetAdminApToday, handleStartAdminApToday } from './admin/ap';
import { handleGetPublicApDashboard } from './public/ap';

function methodNotAllowed(allow: string): Response {
	return new Response('Method Not Allowed', {
		status: 405,
		headers: { Allow: allow },
	});
}

export default {
	async fetch(request, env): Promise<Response> {
		const pathname = new URL(request.url).pathname;
		switch (pathname) {
			case '/api/public/ap/dashboard':
				return request.method === 'GET' ? handleGetPublicApDashboard(request, env) : methodNotAllowed('GET');
			case '/api/admin/ap/today':
				return request.method === 'GET' ? handleGetAdminApToday(request, env) : methodNotAllowed('GET');
			case '/api/admin/ap/today/start':
				return request.method === 'POST' ? handleStartAdminApToday(request, env) : methodNotAllowed('POST');
			case '/api/admin/ap/item/complete':
				return request.method === 'PATCH' ? handleCompleteAdminApItem(request, env) : methodNotAllowed('PATCH');
			default:
				return app.fetch(request, env);
		}
	},
} satisfies ExportedHandler<Env>;
