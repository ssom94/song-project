import { addDays, daysBetween } from './jlpt-study';

export const DEFAULT_AP_PLAN_CODE = 'AP_2026_H2';
export const DEFAULT_AP_STUDY_START_DATE = '2026-10-01';
export const DEFAULT_AP_REGISTRATION_START_DATE = '2027-01-27';
export const DEFAULT_AP_REGISTRATION_END_DATE = '2027-02-16';
export const DEFAULT_AP_SUBJECT_A_TARGET_DATE = '2027-02-19';
export const DEFAULT_AP_SUBJECT_B_TARGET_DATE = '2027-03-15';
export const DEFAULT_AP_DAILY_MINUTES = 60;
export const DEFAULT_AP_SUBJECT_B_FOCUS = ['security', 'programming_algorithms', 'database', 'system_development', 'network'] as const;

export type ApLearningState = 'unlearned' | 'learning' | 'uncertain' | 'mastered';
export type ApResult = 'correct' | 'partial' | 'wrong' | 'completed';
export type ApItemKind = 'review' | 'concept' | 'subject_a' | 'subject_b' | 'wrong_answer' | 'weekly_test' | 'monthly_test';

export interface ApStudyPlanRow {
	id: number;
	admin_id: number;
	plan_code: string;
	study_start_date: string;
	registration_start_date: string;
	registration_end_date: string;
	subject_a_target_date: string;
	subject_b_target_date: string;
	daily_minutes: number;
	subject_b_focus_json: string;
	is_active: number;
}

export interface ApTopicDefinition {
	code: string;
	examPart: 'A' | 'B' | 'AB';
	domain: string;
	titleKo: string;
	titleJa: string;
	pointsKo: string;
	pointsJa: string;
	priority: number;
	focusB: boolean;
}

export interface ApDailyBudget {
	mode: 'normal' | 'review_heavy' | 'subject_a_final' | 'subject_b_final' | 'weekly_test' | 'monthly_test';
	reviewMinutes: number;
	conceptMinutes: number;
	subjectAMinutes: number;
	subjectBMinutes: number;
	testMinutes: number;
	reasonKo: string;
	reasonJa: string;
}

export const AP_TOPICS: readonly ApTopicDefinition[] = [
	{
		code: 'fundamentals_math', examPart: 'A', domain: 'technology', titleKo: '기초이론·수학·논리', titleJa: '基礎理論・数学・論理',
		pointsKo: '진법, 논리연산, 확률·통계, 정보량, 그래프와 기본 계산 문제',
		pointsJa: '進数、論理演算、確率・統計、情報量、グラフと基本計算問題', priority: 3, focusB: false,
	},
	{
		code: 'computer_architecture', examPart: 'A', domain: 'technology', titleKo: '컴퓨터 구조·하드웨어', titleJa: 'コンピュータ構成・ハードウェア',
		pointsKo: 'CPU, 캐시, 메모리, 저장장치, 입출력, 성능 계산',
		pointsJa: 'CPU、キャッシュ、メモリ、記憶装置、入出力、性能計算', priority: 3, focusB: false,
	},
	{
		code: 'operating_system', examPart: 'A', domain: 'technology', titleKo: 'OS·프로세스·메모리', titleJa: 'OS・プロセス・メモリ',
		pointsKo: '프로세스·스레드, 스케줄링, 가상메모리, 파일시스템, 동기화',
		pointsJa: 'プロセス・スレッド、スケジューリング、仮想記憶、ファイルシステム、同期', priority: 4, focusB: false,
	},
	{
		code: 'programming_algorithms', examPart: 'AB', domain: 'technology', titleKo: '프로그래밍·알고리즘', titleJa: 'プログラミング・アルゴリズム',
		pointsKo: '자료구조, 탐색·정렬, 재귀, 시간복잡도, 의사코드 추적과 알고리즘 설명',
		pointsJa: 'データ構造、探索・整列、再帰、計算量、疑似コード追跡とアルゴリズム説明', priority: 5, focusB: true,
	},
	{
		code: 'database', examPart: 'AB', domain: 'technology', titleKo: '데이터베이스', titleJa: 'データベース',
		pointsKo: 'ER, 정규화, SQL, 트랜잭션, 잠금, 인덱스, 실행계획·성능',
		pointsJa: 'ER、正規化、SQL、トランザクション、ロック、インデックス、実行計画・性能', priority: 5, focusB: true,
	},
	{
		code: 'network', examPart: 'AB', domain: 'technology', titleKo: '네트워크', titleJa: 'ネットワーク',
		pointsKo: 'TCP/IP, 서브넷, DNS, HTTP/HTTPS, NAT, VLAN, 라우팅, VPN, 방화벽, 장애분석',
		pointsJa: 'TCP/IP、サブネット、DNS、HTTP/HTTPS、NAT、VLAN、ルーティング、VPN、FW、障害分析', priority: 5, focusB: true,
	},
	{
		code: 'security', examPart: 'AB', domain: 'technology', titleKo: '정보보안', titleJa: '情報セキュリティ',
		pointsKo: '암호, 인증, 접근제어, 공격·취약점, 로그, 네트워크 보안, 사고대응. 科目B 필수',
		pointsJa: '暗号、認証、アクセス制御、攻撃・脆弱性、ログ、ネットワークセキュリティ、インシデント対応。科目B必須', priority: 5, focusB: true,
	},
	{
		code: 'system_development', examPart: 'AB', domain: 'technology', titleKo: '정보시스템 개발', titleJa: '情報システム開発',
		pointsKo: '요구사항, UML, 설계, 테스트, 리뷰, 형상관리, CI/CD, 개발 프로세스',
		pointsJa: '要件定義、UML、設計、テスト、レビュー、構成管理、CI/CD、開発プロセス', priority: 5, focusB: true,
	},
	{
		code: 'software_engineering', examPart: 'A', domain: 'technology', titleKo: '소프트웨어·개발기술', titleJa: 'ソフトウェア・開発技術',
		pointsKo: '언어·미들웨어, 객체지향, 개발도구, 품질특성, 테스트 기법',
		pointsJa: '言語・ミドルウェア、オブジェクト指向、開発ツール、品質特性、テスト技法', priority: 3, focusB: false,
	},
	{
		code: 'system_performance', examPart: 'A', domain: 'technology', titleKo: '시스템 성능·신뢰성', titleJa: 'システム性能・信頼性',
		pointsKo: '가동률, MTBF/MTTR, 처리량, 응답시간, 이중화, 용량·성능 계산',
		pointsJa: '稼働率、MTBF/MTTR、スループット、応答時間、冗長化、容量・性能計算', priority: 3, focusB: false,
	},
	{
		code: 'project_management', examPart: 'A', domain: 'management', titleKo: '프로젝트 관리', titleJa: 'プロジェクトマネジメント',
		pointsKo: '일정·비용·품질·리스크·조달·이해관계자 관리와 EVM',
		pointsJa: 'スケジュール・コスト・品質・リスク・調達・ステークホルダ管理とEVM', priority: 3, focusB: false,
	},
	{
		code: 'service_management', examPart: 'A', domain: 'management', titleKo: '서비스 관리', titleJa: 'サービスマネジメント',
		pointsKo: 'IT서비스 운영, SLA, 인시던트·문제·변경관리, 가용성·용량관리',
		pointsJa: 'ITサービス運用、SLA、インシデント・問題・変更管理、可用性・キャパシティ管理', priority: 2, focusB: false,
	},
	{
		code: 'system_audit', examPart: 'A', domain: 'management', titleKo: '시스템 감사', titleJa: 'システム監査',
		pointsKo: '감사 절차, 내부통제, 증거, 리스크 평가, 개선 권고',
		pointsJa: '監査手続、内部統制、監査証拠、リスク評価、改善勧告', priority: 2, focusB: false,
	},
	{
		code: 'system_strategy', examPart: 'A', domain: 'strategy', titleKo: '시스템 전략·기획', titleJa: 'システム戦略・企画',
		pointsKo: '정보전략, 업무분석, 시스템기획, 조달, 요구사항과 투자평가',
		pointsJa: '情報戦略、業務分析、システム企画、調達、要件と投資評価', priority: 3, focusB: false,
	},
	{
		code: 'business_strategy', examPart: 'A', domain: 'strategy', titleKo: '경영전략·마케팅', titleJa: '経営戦略・マーケティング',
		pointsKo: 'SWOT, 3C, 포터, 마케팅, 기술전략, 비즈니스 모델',
		pointsJa: 'SWOT、3C、ポーター、マーケティング、技術戦略、ビジネスモデル', priority: 2, focusB: false,
	},
	{
		code: 'accounting_legal', examPart: 'A', domain: 'strategy', titleKo: '회계·법무·표준', titleJa: '会計・法務・標準',
		pointsKo: '손익분기점, 재무지표, 계약·지식재산·개인정보·노동·표준화',
		pointsJa: '損益分岐点、財務指標、契約・知財・個人情報・労務・標準化', priority: 2, focusB: false,
	},
] as const;

const REVIEW_INTERVALS = [1, 3, 7, 14, 30, 60] as const;

export function nextApReview(currentStage: number, result: ApResult, studyDate: string) {
	const stage = Math.max(0, Math.min(6, Number(currentStage || 0)));
	if (result === 'wrong') return { reviewStage: 0, nextReviewOn: addDays(studyDate, 1), state: 'uncertain' as ApLearningState };
	if (result === 'partial') return { reviewStage: Math.max(0, stage - 1), nextReviewOn: addDays(studyDate, 3), state: 'uncertain' as ApLearningState };
	if (result === 'completed') return { reviewStage: Math.max(1, stage), nextReviewOn: addDays(studyDate, 3), state: 'learning' as ApLearningState };
	const nextStage = Math.min(6, stage + 1);
	const interval = REVIEW_INTERVALS[nextStage - 1] ?? 60;
	return {
		reviewStage: nextStage,
		nextReviewOn: addDays(studyDate, interval),
		state: nextStage >= 4 ? 'mastered' as ApLearningState : 'learning' as ApLearningState,
	};
}

export function buildApDailyBudget(input: {
	dueReviewCount: number;
	daysUntilSubjectA: number;
	completedStudyDays: number;
	dailyMinutes?: number;
}): ApDailyBudget {
	const minutes = Math.max(30, Math.min(120, input.dailyMinutes ?? DEFAULT_AP_DAILY_MINUTES));
	const scale = (value: number) => Math.round((value / 60) * minutes);
	if (input.daysUntilSubjectA < 0) {
		return {
			mode: 'subject_b_final', reviewMinutes: scale(10), conceptMinutes: 0, subjectAMinutes: 0, subjectBMinutes: scale(50), testMinutes: 0,
			reasonKo: '科目A 응시 이후이므로 오늘은 科目B 선택 5분야와 서술 답안에 집중합니다.',
			reasonJa: '科目A受験後のため、今日は科目Bの選択5分野と記述答案に集中します。',
		};
	}
	if (input.completedStudyDays > 0 && input.completedStudyDays % 30 === 0) {
		return {
			mode: 'monthly_test', reviewMinutes: scale(10), conceptMinutes: 0, subjectAMinutes: 0, subjectBMinutes: 0, testMinutes: scale(50),
			reasonKo: '30일 누적 학습 시점이라 월간 누적 테스트를 우선합니다.',
			reasonJa: '30日分の学習が蓄積したため、月次累積テストを優先します。',
		};
	}
	if (input.completedStudyDays > 0 && input.completedStudyDays % 7 === 0) {
		return {
			mode: 'weekly_test', reviewMinutes: scale(10), conceptMinutes: 0, subjectAMinutes: 0, subjectBMinutes: 0, testMinutes: scale(50),
			reasonKo: '7일 학습 주기가 끝나 주간 누적 테스트를 실시합니다.',
			reasonJa: '7日間の学習周期が終わったため、週次累積テストを行います。',
		};
	}
	if (input.daysUntilSubjectA <= 30) {
		return {
			mode: 'subject_a_final', reviewMinutes: scale(10), conceptMinutes: scale(5), subjectAMinutes: scale(35), subjectBMinutes: scale(10), testMinutes: 0,
			reasonKo: '科目A 응시 30일 전이므로 객관식 정확도와 시간 관리 비중을 높입니다.',
			reasonJa: '科目A受験30日前のため、多肢選択の正確さと時間配分を重視します。',
		};
	}
	if (input.dueReviewCount >= 20) {
		return {
			mode: 'review_heavy', reviewMinutes: scale(25), conceptMinutes: scale(10), subjectAMinutes: scale(15), subjectBMinutes: scale(10), testMinutes: 0,
			reasonKo: '복습 대기 개념이 많아 신규 진도보다 기억 회복을 우선합니다.',
			reasonJa: '復習待ちの概念が多いため、新規範囲より記憶の定着を優先します。',
		};
	}
	return {
		mode: 'normal', reviewMinutes: scale(10), conceptMinutes: scale(15), subjectAMinutes: scale(20), subjectBMinutes: scale(15), testMinutes: 0,
		reasonKo: '복습·개념·科目A·科目B를 매일 균형 있게 진행합니다.',
		reasonJa: '復習・概念・科目A・科目Bを毎日バランスよく進めます。',
	};
}
