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
import {
	handleCreateAdminCategoryWithAppearance,
	handleUpdateAdminCategoryWithAppearance,
} from './admin/categories/appearance-manage';
import { handleUploadAdminCategoryIcon } from './admin/categories/icon-upload';
import { handleListAdminJapaneseWordsWithProvenance } from './admin/japanese/words-provenance';
import { handleExportStudyXlsx } from './admin/study-export';
import {
	handleGetPublicJapaneseJlptPractice,
	handleGradeAdminJapaneseJlptPractice,
	handleGradePublicJapaneseJlptPractice,
	handleListAdminJapaneseJlptWrongNotes,
} from './jlpt-practice';
import { handleGetPublicApDashboard } from './public/ap';
import { handleGetPublicCategoryIcon } from './public/category-icon';
import { handleGetPublicJapaneseKanjiKorean } from './public/japanese/kanji-korean';
import { handleGetPublicPostWithAppearance } from './public/posts/appearance-detail';
import { handleListPublicPostsWithAppearance } from './public/posts/appearance-list';
import {
	handleGetAdminSiteVisuals,
	handleGetPublicSiteVisuals,
	handleUpdateAdminSiteVisuals,
} from './site-visuals';

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
			case '/api/public/posts':
				return request.method === 'GET' ? handleListPublicPostsWithAppearance(request, env) : methodNotAllowed('GET');
			case '/api/public/posts/detail':
				return request.method === 'GET' ? handleGetPublicPostWithAppearance(request, env) : methodNotAllowed('GET');
			case '/api/public/category-icon':
				return request.method === 'GET' ? handleGetPublicCategoryIcon(request, env) : methodNotAllowed('GET');
			case '/api/public/site-visuals':
				return request.method === 'GET' ? handleGetPublicSiteVisuals(request, env) : methodNotAllowed('GET');
			case '/api/public/ap/dashboard':
				return request.method === 'GET' ? handleGetPublicApDashboard(request, env) : methodNotAllowed('GET');
			case '/api/public/japanese/kanji-korean':
				return request.method === 'GET' ? handleGetPublicJapaneseKanjiKorean(request, env) : methodNotAllowed('GET');
			case '/api/public/japanese/jlpt/practice':
				return request.method === 'GET' ? handleGetPublicJapaneseJlptPractice(request, env) : methodNotAllowed('GET');
			case '/api/public/japanese/jlpt/practice/grade':
				return request.method === 'POST' ? handleGradePublicJapaneseJlptPractice(request, env) : methodNotAllowed('POST');
			case '/api/admin/categories':
				if (request.method === 'POST') return handleCreateAdminCategoryWithAppearance(request, env);
				return app.fetch(request, env);
			case '/api/admin/categories/detail':
				if (request.method === 'PATCH') return handleUpdateAdminCategoryWithAppearance(request, env);
				return app.fetch(request, env);
			case '/api/admin/categories/icon':
				return request.method === 'POST' ? handleUploadAdminCategoryIcon(request, env) : methodNotAllowed('POST');
			case '/api/admin/site-visuals':
				if (request.method === 'GET') return handleGetAdminSiteVisuals(request, env);
				if (request.method === 'PATCH') return handleUpdateAdminSiteVisuals(request, env);
				return methodNotAllowed('GET, PATCH');
			case '/api/admin/japanese/jlpt/practice/grade':
				return request.method === 'POST' ? handleGradeAdminJapaneseJlptPractice(request, env) : methodNotAllowed('POST');
			case '/api/admin/japanese/jlpt/wrong-notes':
				return request.method === 'GET' ? handleListAdminJapaneseJlptWrongNotes(request, env) : methodNotAllowed('GET');
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
