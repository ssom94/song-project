import app from './index';
import { handleCompleteAdminApItem, handleGetAdminApToday, handleStartAdminApToday } from './admin/ap';
import {
	handleCreateAdminApVocabulary,
	handleDeleteAdminApVocabulary,
	handleGetAdminApVocabularyQuiz,
	handleGradeAdminApVocabularyQuiz,
	handleListAdminApVocabulary,
} from './admin/ap-vocabulary';
import { handleListAdminApVocabularyWrongNotes } from './admin/ap-vocabulary-wrong';
import { handleListAdminJapaneseWordsWithProvenance } from './admin/japanese/words-provenance';
import { handleExportStudyXlsx } from './admin/study-export';
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
			case '/favicon.ico':
				if (request.method !== 'GET' && request.method !== 'HEAD') return methodNotAllowed('GET, HEAD');
				return new Response(null, {
					status: 302,
					headers: {
						Location: new URL('/favicon.svg', request.url).toString(),
						'Cache-Control': 'public, max-age=86400',
					},
				});
			case '/api/public/ap/dashboard':
				return request.method === 'GET' ? handleGetPublicApDashboard(request, env) : methodNotAllowed('GET');
			case '/api/admin/study/export.xlsx':
				return request.method === 'GET' ? handleExportStudyXlsx(request, env) : methodNotAllowed('GET');
			case '/api/admin/japanese/words':
				if (request.method === 'GET') return handleListAdminJapaneseWordsWithProvenance(request, env);
				return app.fetch(request, env);
			case '/api/admin/ap/today':
				return request.method === 'GET' ? handleGetAdminApToday(request, env) : methodNotAllowed('GET');
			case '/api/admin/ap/today/start':
				return request.method === 'POST' ? handleStartAdminApToday(request, env) : methodNotAllowed('POST');
			case '/api/admin/ap/item/complete':
				return request.method === 'PATCH' ? handleCompleteAdminApItem(request, env) : methodNotAllowed('PATCH');
			case '/api/admin/ap/vocabulary':
				if (request.method === 'GET') return handleListAdminApVocabulary(request, env);
				if (request.method === 'POST') return handleCreateAdminApVocabulary(request, env);
				if (request.method === 'DELETE') return handleDeleteAdminApVocabulary(request, env);
				return methodNotAllowed('GET, POST, DELETE');
			case '/api/admin/ap/vocabulary/wrong-notes':
				return request.method === 'GET' ? handleListAdminApVocabularyWrongNotes(request, env) : methodNotAllowed('GET');
			case '/api/admin/ap/vocabulary/quiz':
				return request.method === 'GET' ? handleGetAdminApVocabularyQuiz(request, env) : methodNotAllowed('GET');
			case '/api/admin/ap/vocabulary/quiz/grade':
				return request.method === 'POST' ? handleGradeAdminApVocabularyQuiz(request, env) : methodNotAllowed('POST');
			default:
				return app.fetch(request, env);
		}
	},
} satisfies ExportedHandler<Env>;
