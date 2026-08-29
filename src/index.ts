import { handleListAdminCategories } from './admin/categories/list';
import {
	handleCreateAdminCategory,
	handleDeleteAdminCategory,
	handleUpdateAdminCategory,
} from './admin/categories/manage';
import { handleCreateAdminPost } from './admin/posts/create';
import { handleGetAdminPost } from './admin/posts/detail';
import { handleListAdminPosts } from './admin/posts/list';
import { handleUpdateAdminPost } from './admin/posts/update';
import { handleListAdminTags } from './admin/tags/list';
import {
	handleCreateAdminTag,
	handleDeleteAdminTag,
	handleUpdateAdminTag,
} from './admin/tags/manage';
import {
	handleCreateAdminJapaneseWord,
	handleDeleteAdminJapaneseWord,
	handleListAdminJapaneseWords,
	handleUpdateAdminJapaneseWord,
} from './admin/japanese/words';
import {
	handleCreateAdminJapanesePart,
	handleDeleteAdminJapanesePart,
	handleListAdminJapaneseParts,
	handleUpdateAdminJapanesePart,
} from './admin/japanese/parts';
import {
	handleCreateAdminJapaneseCategory,
	handleDeleteAdminJapaneseCategory,
	handleListAdminJapaneseCategories,
	handleUpdateAdminJapaneseCategory,
} from './admin/japanese/categories';
import {
	handleCompleteAdminJapaneseQuiz,
	handleGetAdminJapaneseQuizHistory,
	handleListAdminJapaneseQuizHistory,
} from './admin/japanese/quiz-history';
import { handleAdminLogin } from './auth/login';
import { handleAdminLogout } from './auth/logout';
import { handleAdminSessionStatus } from './auth/session';
import { handleGetPublicJapaneseQuizPool } from './public/japanese/quiz-pool';
import { handleGetPublicJapaneseStats } from './public/japanese/stats';
import { handleGetPublicJapaneseTaxonomy } from './public/japanese/taxonomy';
import { handleListPublicJapaneseWords } from './public/japanese/words';
import { handleGetPublicPost } from './public/posts/detail';
import { handleListPublicPosts } from './public/posts/list';
import { renderPublicPostPage } from './public/posts/page';

function methodNotAllowed(allow: string): Response {
	return new Response('Method Not Allowed', {
		status: 405,
		headers: { Allow: allow },
	});
}

export default {
	async fetch(request, env): Promise<Response> {
		const url = new URL(request.url);
		const publicPostPage = url.pathname.match(/^\/(ja|ko)\/posts\/[^/]+\/?$/);
		if (publicPostPage) {
			if (request.method !== 'GET' && request.method !== 'HEAD') return methodNotAllowed('GET, HEAD');
			return renderPublicPostPage(publicPostPage[1] as 'ja' | 'ko');
		}

		switch (url.pathname) {
			case '/message':
				return new Response('Hello, World!');
			case '/random':
				return new Response(crypto.randomUUID());
			case '/api/public/posts':
				return request.method === 'GET' ? handleListPublicPosts(request, env) : methodNotAllowed('GET');
			case '/api/public/posts/detail':
				return request.method === 'GET' ? handleGetPublicPost(request, env) : methodNotAllowed('GET');
			case '/api/public/japanese/stats':
				return request.method === 'GET' ? handleGetPublicJapaneseStats(request, env) : methodNotAllowed('GET');
			case '/api/public/japanese/taxonomy':
				return request.method === 'GET' ? handleGetPublicJapaneseTaxonomy(request, env) : methodNotAllowed('GET');
			case '/api/public/japanese/words':
				return request.method === 'GET' ? handleListPublicJapaneseWords(request, env) : methodNotAllowed('GET');
			case '/api/public/japanese/quiz-pool':
				return request.method === 'GET' ? handleGetPublicJapaneseQuizPool(request, env) : methodNotAllowed('GET');
			case '/api/admin/auth/login':
				return request.method === 'POST' ? handleAdminLogin(request, env) : methodNotAllowed('POST');
			case '/api/admin/auth/logout':
				return request.method === 'POST' ? handleAdminLogout(request, env) : methodNotAllowed('POST');
			case '/api/admin/auth/session':
				return request.method === 'GET' ? handleAdminSessionStatus(request, env) : methodNotAllowed('GET');
			case '/api/admin/categories':
				if (request.method === 'GET') return handleListAdminCategories(request, env);
				if (request.method === 'POST') return handleCreateAdminCategory(request, env);
				return methodNotAllowed('GET, POST');
			case '/api/admin/categories/detail':
				if (request.method === 'PATCH') return handleUpdateAdminCategory(request, env);
				if (request.method === 'DELETE') return handleDeleteAdminCategory(request, env);
				return methodNotAllowed('PATCH, DELETE');
			case '/api/admin/tags':
				if (request.method === 'GET') return handleListAdminTags(request, env);
				if (request.method === 'POST') return handleCreateAdminTag(request, env);
				return methodNotAllowed('GET, POST');
			case '/api/admin/tags/detail':
				if (request.method === 'PATCH') return handleUpdateAdminTag(request, env);
				if (request.method === 'DELETE') return handleDeleteAdminTag(request, env);
				return methodNotAllowed('PATCH, DELETE');
			case '/api/admin/posts':
				if (request.method === 'GET') return handleListAdminPosts(request, env);
				if (request.method === 'POST') return handleCreateAdminPost(request, env);
				return methodNotAllowed('GET, POST');
			case '/api/admin/posts/detail':
				if (request.method === 'GET') return handleGetAdminPost(request, env);
				if (request.method === 'PATCH') return handleUpdateAdminPost(request, env);
				return methodNotAllowed('GET, PATCH');
			case '/api/admin/japanese/words':
				if (request.method === 'GET') return handleListAdminJapaneseWords(request, env);
				if (request.method === 'POST') return handleCreateAdminJapaneseWord(request, env);
				return methodNotAllowed('GET, POST');
			case '/api/admin/japanese/words/detail':
				if (request.method === 'PATCH') return handleUpdateAdminJapaneseWord(request, env);
				if (request.method === 'DELETE') return handleDeleteAdminJapaneseWord(request, env);
				return methodNotAllowed('PATCH, DELETE');
			case '/api/admin/japanese/parts':
				if (request.method === 'GET') return handleListAdminJapaneseParts(request, env);
				if (request.method === 'POST') return handleCreateAdminJapanesePart(request, env);
				return methodNotAllowed('GET, POST');
			case '/api/admin/japanese/parts/detail':
				if (request.method === 'PATCH') return handleUpdateAdminJapanesePart(request, env);
				if (request.method === 'DELETE') return handleDeleteAdminJapanesePart(request, env);
				return methodNotAllowed('PATCH, DELETE');
			case '/api/admin/japanese/categories':
				if (request.method === 'GET') return handleListAdminJapaneseCategories(request, env);
				if (request.method === 'POST') return handleCreateAdminJapaneseCategory(request, env);
				return methodNotAllowed('GET, POST');
			case '/api/admin/japanese/categories/detail':
				if (request.method === 'PATCH') return handleUpdateAdminJapaneseCategory(request, env);
				if (request.method === 'DELETE') return handleDeleteAdminJapaneseCategory(request, env);
				return methodNotAllowed('PATCH, DELETE');
			case '/api/admin/japanese/quiz/complete':
				return request.method === 'POST' ? handleCompleteAdminJapaneseQuiz(request, env) : methodNotAllowed('POST');
			case '/api/admin/japanese/quiz/history':
				return request.method === 'GET' ? handleListAdminJapaneseQuizHistory(request, env) : methodNotAllowed('GET');
			case '/api/admin/japanese/quiz/history/detail':
				return request.method === 'GET' ? handleGetAdminJapaneseQuizHistory(request, env) : methodNotAllowed('GET');
			default:
				return new Response('Not Found', { status: 404 });
		}
	},
} satisfies ExportedHandler<Env>;
