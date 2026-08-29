/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { handleAdminLogin } from './auth/login';
import { handleAdminLogout } from './auth/logout';
import { handleAdminSessionStatus } from './auth/session';
import { handleCreateAdminPost } from './admin/posts/create';
import { handleGetAdminPost } from './admin/posts/detail';
import { handleListAdminPosts } from './admin/posts/list';

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const url = new URL(request.url);
		switch (url.pathname) {
			case '/message':
				return new Response('Hello, World!');
			case '/random':
				return new Response(crypto.randomUUID());
			case '/api/admin/auth/login':
				if (request.method !== 'POST') {
					return new Response('Method Not Allowed', {
						status: 405,
						headers: { Allow: 'POST' },
					});
				}
				return handleAdminLogin(request, env);
			case '/api/admin/auth/logout':
				if (request.method !== 'POST') {
					return new Response('Method Not Allowed', {
						status: 405,
						headers: { Allow: 'POST' },
					});
				}
				return handleAdminLogout(request, env);
			case '/api/admin/auth/session':
				if (request.method !== 'GET') {
					return new Response('Method Not Allowed', {
						status: 405,
						headers: { Allow: 'GET' },
					});
				}
				return handleAdminSessionStatus(request, env);
			case '/api/admin/posts':
				if (request.method === 'GET') {
					return handleListAdminPosts(request, env);
				}
				if (request.method === 'POST') {
					return handleCreateAdminPost(request, env);
				}
				return new Response('Method Not Allowed', {
					status: 405,
					headers: { Allow: 'GET, POST' },
				});
			case '/api/admin/posts/detail':
				if (request.method !== 'GET') {
					return new Response('Method Not Allowed', {
						status: 405,
						headers: { Allow: 'GET' },
					});
				}
				return handleGetAdminPost(request, env);
			default:
				return new Response('Not Found', { status: 404 });
		}
	},
} satisfies ExportedHandler<Env>;
