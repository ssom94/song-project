import {
	handleCreateAdminAccount,
	handleListAdminAccounts,
	handleUpdateAdminAccount,
} from './admin/accounts/manage';
import { handleListAdminCategories } from './admin/categories/list';
import {
	handleCreateAdminCategory,
	handleDeleteAdminCategory,
	handleReorderAdminCategories,
	handleUpdateAdminCategory,
} from './admin/categories/manage';
import {
	handleDeleteAdminComment,
	handleListAdminComments,
	handleUpdateAdminCommentStatus,
} from './admin/comments/manage';
import { handleGetAdminDashboard, handleUpdateAdminDashboard } from './admin/dashboard/manage';
import {
	handleCreateAdminDashboardSchedule,
	handleDeleteAdminDashboardSchedule,
	handleListAdminDashboardSchedules,
	handleUpdateAdminDashboardSchedule,
} from './admin/dashboard/schedules';
import { handleCreateAdminPost } from './admin/posts/create';
import { handleDeleteAdminPost } from './admin/posts/delete';
import { handleGetAdminPost } from './admin/posts/detail';
import { handleListAdminPosts } from './admin/posts/list';
import { handleUpdateAdminPost } from './admin/posts/update';
import { handleUpdateAdminPostVisibility } from './admin/posts/visibility';
import { handleListAdminTags } from './admin/tags/list';
import {
	handleCreateAdminTag,
	handleDeleteAdminTag,
	handleUpdateAdminTag,
} from './admin/tags/manage';
import { handleBulkUpdateAdminJapaneseWords } from './admin/japanese/bulk';
import { handleImportAdminJapaneseWords } from './admin/japanese/import';
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
	handleReorderAdminJapaneseCategories,
	handleUpdateAdminJapaneseCategory,
} from './admin/japanese/categories';
import {
	handleCompleteAdminJapaneseQuiz,
	handleGetAdminJapaneseQuizHistory,
	handleListAdminJapaneseQuizHistory,
} from './admin/japanese/quiz-history';
import {
	handleIssueAdminAccessCode,
	handleListAdminAccessCodes,
	handleRevokeAdminAccessCode,
} from './admin/access-codes/manage';
import {
	handleGetAdminProtectedDocumentPreview,
	handleListAdminProtectedDocuments,
	handleUploadAdminProtectedDocument,
} from './admin/documents/manage';
import {
	handleGetAdminSkillSheetSummary,
	handleUpdateAdminSkillSheetSummary,
} from './admin/skill-sheet/manage';
import { handleAdminLogin } from './auth/login';
import { handleAdminLogout } from './auth/logout';
import { handleAdminSessionStatus } from './auth/session';
import { handleGetPublicCertifications } from './public/certifications';
import { handleCreatePublicComment, handleListPublicComments } from './public/comments';
import { handleGetPublicDashboard } from './public/dashboard';
import { handleGetPublicJapaneseQuizPool } from './public/japanese/quiz-pool';
import { handleGetPublicJapaneseStats } from './public/japanese/stats';
import { handleGetPublicJapaneseTaxonomy } from './public/japanese/taxonomy';
import { handleListPublicJapaneseWords } from './public/japanese/words';
import { handleProtectedAccessLogin } from './public/protected/auth';
import {
	handleDownloadProtectedDocument,
	handleGetProtectedDocument,
} from './public/protected/document';
import { handleGetProtectedDocumentStatus } from './public/protected/status';
import { handleGetPublicPost } from './public/posts/detail';
import { handleListPublicPosts } from './public/posts/list';
import { renderPublicPostPage } from './public/posts/page';
import { handleListPublicDashboardSchedules } from './public/schedules';
import { handleGetPublicSkillSheet } from './public/skill-sheet';

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
			case '/favicon.ico':
				if (request.method !== 'GET' && request.method !== 'HEAD') return methodNotAllowed('GET, HEAD');
				return new Response(null, {
					status: 302,
					headers: {
						Location: new URL('/assets/logo-song-ym.png', request.url).toString(),
						'Cache-Control': 'public, max-age=86400',
					},
				});
			case '/message':
				return new Response('Hello, World!');
			case '/random':
				return new Response(crypto.randomUUID());
			case '/api/public/posts':
				return request.method === 'GET' ? handleListPublicPosts(request, env) : methodNotAllowed('GET');
			case '/api/public/posts/detail':
				return request.method === 'GET' ? handleGetPublicPost(request, env) : methodNotAllowed('GET');
			case '/api/public/comments':
				if (request.method === 'GET') return handleListPublicComments(request, env);
				if (request.method === 'POST') return handleCreatePublicComment(request, env);
				return methodNotAllowed('GET, POST');
			case '/api/public/dashboard':
				return request.method === 'GET' ? handleGetPublicDashboard(request, env) : methodNotAllowed('GET');
			case '/api/public/dashboard/schedules':
				return request.method === 'GET' ? handleListPublicDashboardSchedules(request, env) : methodNotAllowed('GET');
			case '/api/public/certifications':
				return request.method === 'GET' ? handleGetPublicCertifications(request, env) : methodNotAllowed('GET');
			case '/api/public/skill-sheet':
				return request.method === 'GET' ? handleGetPublicSkillSheet(request, env) : methodNotAllowed('GET');
			case '/api/public/protected/status':
				return request.method === 'GET' ? handleGetProtectedDocumentStatus(request, env) : methodNotAllowed('GET');
			case '/api/public/japanese/stats':
				return request.method === 'GET' ? handleGetPublicJapaneseStats(request, env) : methodNotAllowed('GET');
			case '/api/public/japanese/taxonomy':
				return request.method === 'GET' ? handleGetPublicJapaneseTaxonomy(request, env) : methodNotAllowed('GET');
			case '/api/public/japanese/words':
				return request.method === 'GET' ? handleListPublicJapaneseWords(request, env) : methodNotAllowed('GET');
			case '/api/public/japanese/quiz-pool':
				return request.method === 'GET' ? handleGetPublicJapaneseQuizPool(request, env) : methodNotAllowed('GET');
			case '/api/protected/auth':
				return request.method === 'POST' ? handleProtectedAccessLogin(request, env) : methodNotAllowed('POST');
			case '/api/protected/document':
				return request.method === 'GET' ? handleGetProtectedDocument(request, env) : methodNotAllowed('GET');
			case '/api/protected/document/download':
				return request.method === 'GET' ? handleDownloadProtectedDocument(request, env) : methodNotAllowed('GET');
			case '/api/admin/auth/login':
				return request.method === 'POST' ? handleAdminLogin(request, env) : methodNotAllowed('POST');
			case '/api/admin/auth/logout':
				return request.method === 'POST' ? handleAdminLogout(request, env) : methodNotAllowed('POST');
			case '/api/admin/auth/session':
				return request.method === 'GET' ? handleAdminSessionStatus(request, env) : methodNotAllowed('GET');
			case '/api/admin/accounts':
				if (request.method === 'GET') return handleListAdminAccounts(request, env);
				if (request.method === 'POST') return handleCreateAdminAccount(request, env);
				return methodNotAllowed('GET, POST');
			case '/api/admin/accounts/detail':
				return request.method === 'PATCH' ? handleUpdateAdminAccount(request, env) : methodNotAllowed('PATCH');
			case '/api/admin/dashboard':
				if (request.method === 'GET') return handleGetAdminDashboard(request, env);
				if (request.method === 'PATCH') return handleUpdateAdminDashboard(request, env);
				return methodNotAllowed('GET, PATCH');
			case '/api/admin/dashboard/schedules':
				if (request.method === 'GET') return handleListAdminDashboardSchedules(request, env);
				if (request.method === 'POST') return handleCreateAdminDashboardSchedule(request, env);
				return methodNotAllowed('GET, POST');
			case '/api/admin/dashboard/schedules/detail':
				if (request.method === 'PATCH') return handleUpdateAdminDashboardSchedule(request, env);
				if (request.method === 'DELETE') return handleDeleteAdminDashboardSchedule(request, env);
				return methodNotAllowed('PATCH, DELETE');
			case '/api/admin/comments':
				return request.method === 'GET' ? handleListAdminComments(request, env) : methodNotAllowed('GET');
			case '/api/admin/comments/detail':
				if (request.method === 'PATCH') return handleUpdateAdminCommentStatus(request, env);
				if (request.method === 'DELETE') return handleDeleteAdminComment(request, env);
				return methodNotAllowed('PATCH, DELETE');
			case '/api/admin/categories':
				if (request.method === 'GET') return handleListAdminCategories(request, env);
				if (request.method === 'POST') return handleCreateAdminCategory(request, env);
				return methodNotAllowed('GET, POST');
			case '/api/admin/categories/detail':
				if (request.method === 'PATCH') return handleUpdateAdminCategory(request, env);
				if (request.method === 'DELETE') return handleDeleteAdminCategory(request, env);
				return methodNotAllowed('PATCH, DELETE');
			case '/api/admin/categories/reorder':
				return request.method === 'PATCH' ? handleReorderAdminCategories(request, env) : methodNotAllowed('PATCH');
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
				if (request.method === 'DELETE') return handleDeleteAdminPost(request, env);
				return methodNotAllowed('GET, PATCH, DELETE');
			case '/api/admin/posts/visibility':
				return request.method === 'PATCH' ? handleUpdateAdminPostVisibility(request, env) : methodNotAllowed('PATCH');
			case '/api/admin/japanese/words':
				if (request.method === 'GET') return handleListAdminJapaneseWords(request, env);
				if (request.method === 'POST') return handleCreateAdminJapaneseWord(request, env);
				return methodNotAllowed('GET, POST');
			case '/api/admin/japanese/words/import':
				return request.method === 'POST' ? handleImportAdminJapaneseWords(request, env) : methodNotAllowed('POST');
			case '/api/admin/japanese/words/bulk':
				return request.method === 'PATCH' ? handleBulkUpdateAdminJapaneseWords(request, env) : methodNotAllowed('PATCH');
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
			case '/api/admin/japanese/categories/reorder':
				return request.method === 'PATCH' ? handleReorderAdminJapaneseCategories(request, env) : methodNotAllowed('PATCH');
			case '/api/admin/japanese/quiz/complete':
				return request.method === 'POST' ? handleCompleteAdminJapaneseQuiz(request, env) : methodNotAllowed('POST');
			case '/api/admin/japanese/quiz/history':
				return request.method === 'GET' ? handleListAdminJapaneseQuizHistory(request, env) : methodNotAllowed('GET');
			case '/api/admin/japanese/quiz/history/detail':
				return request.method === 'GET' ? handleGetAdminJapaneseQuizHistory(request, env) : methodNotAllowed('GET');
			case '/api/admin/skill-sheet':
				if (request.method === 'GET') return handleGetAdminSkillSheetSummary(request, env);
				if (request.method === 'PATCH') return handleUpdateAdminSkillSheetSummary(request, env);
				return methodNotAllowed('GET, PATCH');
			case '/api/admin/documents':
				if (request.method === 'GET') return handleListAdminProtectedDocuments(request, env);
				if (request.method === 'POST') return handleUploadAdminProtectedDocument(request, env);
				return methodNotAllowed('GET, POST');
			case '/api/admin/documents/preview':
				return request.method === 'GET' ? handleGetAdminProtectedDocumentPreview(request, env) : methodNotAllowed('GET');
			case '/api/admin/access-codes':
				if (request.method === 'GET') return handleListAdminAccessCodes(request, env);
				if (request.method === 'POST') return handleIssueAdminAccessCode(request, env);
				return methodNotAllowed('GET, POST');
			case '/api/admin/access-codes/revoke':
				return request.method === 'POST' ? handleRevokeAdminAccessCode(request, env) : methodNotAllowed('POST');
			default:
				return new Response('Not Found', { status: 404 });
		}
	},
} satisfies ExportedHandler<Env>;
