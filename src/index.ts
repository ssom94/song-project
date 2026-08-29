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

const R2_TEST_KEY = 'test/hello.txt';
const R2_TEST_VALUE = 'Hello R2';

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const url = new URL(request.url);

		switch (url.pathname) {
			case '/message':
				return new Response('Hello, World!');

			case '/random':
				return new Response(crypto.randomUUID());

			case '/r2-test': {
				if (request.method === 'PUT') {
					await env.song_project_assets.put(R2_TEST_KEY, R2_TEST_VALUE, {
						httpMetadata: {
							contentType: 'text/plain; charset=utf-8',
						},
					});

					return new Response(`Stored ${R2_TEST_KEY}`, { status: 201 });
				}

				if (request.method === 'GET') {
					const object = await env.song_project_assets.get(R2_TEST_KEY);

					if (object === null) {
						return new Response('R2 test object not found', { status: 404 });
					}

					return new Response(object.body, {
						headers: {
							'Content-Type': object.httpMetadata?.contentType ?? 'text/plain; charset=utf-8',
						},
					});
				}

				return new Response('Method Not Allowed', {
					status: 405,
					headers: { Allow: 'GET, PUT' },
				});
			}

			default:
				return new Response('Not Found', { status: 404 });
		}
	},
} satisfies ExportedHandler<Env>;
