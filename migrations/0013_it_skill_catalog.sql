-- 0013_it_skill_catalog.sql
-- Master IT skill catalog used by the editable skill sheet.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS it_skill_catalog (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    skill_key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    category TEXT NOT NULL,
    skill_type TEXT NOT NULL,
    usage_area TEXT NOT NULL,
    description_ja TEXT NOT NULL DEFAULT '',
    description_ko TEXT NOT NULL DEFAULT '',
    aliases TEXT NOT NULL DEFAULT '',
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_it_skill_catalog_category
    ON it_skill_catalog(is_active, category, skill_type, name);

CREATE INDEX IF NOT EXISTS idx_it_skill_catalog_usage
    ON it_skill_catalog(is_active, usage_area, name);

CREATE TABLE IF NOT EXISTS skill_sheet_section_skills (
    section_id INTEGER NOT NULL,
    skill_id INTEGER NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    PRIMARY KEY (section_id, skill_id),
    FOREIGN KEY (section_id) REFERENCES skill_sheet_summary_sections(id) ON DELETE CASCADE,
    FOREIGN KEY (skill_id) REFERENCES it_skill_catalog(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_skill_sheet_section_skills_order
    ON skill_sheet_section_skills(section_id, display_order, skill_id);

-- category: Programming / Frontend / Backend / Database / Cloud / DevOps / Server / Testing /
--           DataAI / Security / Mobile / Game / Design / Collaboration / Protocol / Architecture / OS / Other
-- skill_type: Language / Framework / Library / Runtime / Database / CloudService / Tool / Platform /
--             Protocol / Standard / Methodology / Engine / OS / Service
-- usage_area is a searchable comma-separated area summary.

INSERT OR IGNORE INTO it_skill_catalog
(skill_key, name, category, skill_type, usage_area, description_ja, description_ko, aliases, display_order)
VALUES
-- Programming languages
('javascript','JavaScript','Programming','Language','Frontend,Backend,Web','WebブラウザとNode.jsで広く利用される汎用スクリプト言語。','웹 브라우저와 Node.js에서 폭넓게 사용하는 범용 스크립트 언어.','JS,ECMAScript',10),
('typescript','TypeScript','Programming','Language','Frontend,Backend,Web','JavaScriptに静的型付けを加えた言語。','JavaScript에 정적 타입을 추가한 언어.','TS',20),
('java','Java','Programming','Language','Backend,Enterprise,Android','業務システム、サーバーサイド、Androidなどで利用される言語。','업무 시스템, 서버사이드, Android 등에 사용되는 언어.','JVM',30),
('kotlin','Kotlin','Programming','Language','Backend,Android,Mobile','JVM上で動作しAndroid開発でも広く利用される言語。','JVM에서 동작하며 Android 개발에도 널리 쓰이는 언어.','JVM',40),
('python','Python','Programming','Language','Backend,DataAI,Automation','Web、データ分析、AI、自動化などで利用される言語。','웹, 데이터 분석, AI, 자동화 등에 사용되는 언어.','Py',50),
('c','C','Programming','Language','System,Embedded,Server','OSや組み込み、低レベル処理で利用される言語。','OS, 임베디드, 저수준 처리에 사용되는 언어.','C language',60),
('cpp','C++','Programming','Language','System,Game,Embedded','高性能アプリ、ゲーム、組み込みなどで利用される言語。','고성능 앱, 게임, 임베디드 등에 사용되는 언어.','C Plus Plus',70),
('csharp','C#','Programming','Language','Backend,Desktop,Game','Microsoft .NET、Web、Unityなどで利用される言語。','Microsoft .NET, 웹, Unity 등에 사용되는 언어.','C Sharp,.NET',80),
('go','Go','Programming','Language','Backend,Cloud,Server','クラウドネイティブや高並行サーバーでよく使われる言語。','클라우드 네이티브와 고동시성 서버에 자주 쓰이는 언어.','Golang',90),
('rust','Rust','Programming','Language','System,Backend,WebAssembly','メモリ安全性を重視した高性能システム言語。','메모리 안전성을 중시한 고성능 시스템 언어.','',100),
('php','PHP','Programming','Language','Backend,Web','Webバックエンドで広く利用される言語。','웹 백엔드에 널리 사용되는 언어.','',110),
('ruby','Ruby','Programming','Language','Backend,Web','Webアプリケーション開発で利用される動的言語。','웹 애플리케이션 개발에 사용되는 동적 언어.','',120),
('swift','Swift','Programming','Language','Mobile,iOS','Appleプラットフォーム向けアプリ開発言語。','Apple 플랫폼용 앱 개발 언어.','iOS',130),
('dart','Dart','Programming','Language','Mobile,Frontend','Flutterの主要開発言語。','Flutter의 주요 개발 언어.','',140),
('scala','Scala','Programming','Language','Backend,DataAI','JVM上で動作し分散処理にも使われる言語。','JVM에서 동작하며 분산 처리에도 사용되는 언어.','JVM',150),
('r','R','Programming','Language','DataAI,Statistics','統計解析とデータサイエンスで利用される言語。','통계 분석과 데이터 사이언스에 사용되는 언어.','R language',160),
('shell','Shell Script','Programming','Language','Server,DevOps,Automation','Linux運用や自動化で利用されるシェルスクリプト。','Linux 운영과 자동화에 사용되는 셸 스크립트.','Bash,sh',170),
('powershell','PowerShell','Programming','Language','Windows,Server,Automation','Windows管理や自動化に利用されるシェル。','Windows 관리와 자동화에 사용하는 셸.','pwsh',180),
('sql','SQL','Programming','Language','Database,Backend,Data','RDBの検索・更新・定義に利用する標準言語。','RDB 조회·갱신·정의에 사용하는 표준 언어.','Structured Query Language',190),
('groovy','Groovy','Programming','Language','Backend,DevOps','JVMベースでJenkins Pipelineなどにも利用される言語。','JVM 기반이며 Jenkins Pipeline 등에도 사용되는 언어.','JVM',200),
('lua','Lua','Programming','Language','Game,Embedded,Scripting','ゲームや組み込みのスクリプト用途で利用される言語。','게임과 임베디드 스크립팅에 사용되는 언어.','',210),
('perl','Perl','Programming','Language','Server,Automation','テキスト処理や運用スクリプトで利用される言語。','텍스트 처리와 운영 스크립트에 사용되는 언어.','',220),
('objective-c','Objective-C','Programming','Language','Mobile,iOS','旧来のiOS/macOSアプリ開発で利用される言語。','기존 iOS/macOS 앱 개발에 사용되는 언어.','ObjC',230),
('visual-basic','Visual Basic','Programming','Language','Desktop,Enterprise','Windows業務アプリなどで利用される言語。','Windows 업무 앱 등에 사용되는 언어.','VB,VB.NET',240),

-- Web standards and frontend
('html','HTML','Frontend','Standard','Frontend,Web','Webページ構造を定義するマークアップ標準。','웹 페이지 구조를 정의하는 마크업 표준.','HTML5',300),
('css','CSS','Frontend','Standard','Frontend,Web','Webページの見た目やレイアウトを定義するスタイル標準。','웹 페이지의 스타일과 레이아웃을 정의하는 표준.','CSS3',310),
('sass','Sass / SCSS','Frontend','Language','Frontend,Web','CSSを拡張するプリプロセッサ。','CSS를 확장하는 전처리기.','SCSS',320),
('react','React','Frontend','Library','Frontend,Web,SPA','コンポーネント指向のUIライブラリ。','컴포넌트 기반 UI 라이브러리.','React.js',330),
('nextjs','Next.js','Frontend','Framework','Frontend,Backend,Web,SSR','ReactベースのフルスタックWebフレームワーク。','React 기반 풀스택 웹 프레임워크.','Next',340),
('vue','Vue.js','Frontend','Framework','Frontend,Web,SPA','軽量なコンポーネント指向Webフレームワーク。','경량 컴포넌트 기반 웹 프레임워크.','Vue',350),
('nuxt','Nuxt','Frontend','Framework','Frontend,Backend,Web,SSR','VueベースのフルスタックWebフレームワーク。','Vue 기반 풀스택 웹 프레임워크.','Nuxt.js',360),
('angular','Angular','Frontend','Framework','Frontend,Web,SPA','TypeScript中心の大規模SPA向けフレームワーク。','TypeScript 중심의 대규모 SPA 프레임워크.','AngularJS',370),
('svelte','Svelte','Frontend','Framework','Frontend,Web','コンパイル方式を採用するUIフレームワーク。','컴파일 방식을 사용하는 UI 프레임워크.','',380),
('sveltekit','SvelteKit','Frontend','Framework','Frontend,Backend,Web,SSR','Svelte向けフルスタックWebフレームワーク。','Svelte용 풀스택 웹 프레임워크.','',390),
('jquery','jQuery','Frontend','Library','Frontend,Web','DOM操作やAjaxを簡略化するJavaScriptライブラリ。','DOM 조작과 Ajax를 단순화하는 JavaScript 라이브러리.','',400),
('bootstrap','Bootstrap','Frontend','Framework','Frontend,UI','レスポンシブUI構築用CSSフレームワーク。','반응형 UI 구축용 CSS 프레임워크.','',410),
('tailwindcss','Tailwind CSS','Frontend','Framework','Frontend,UI','ユーティリティファーストのCSSフレームワーク。','유틸리티 퍼스트 CSS 프레임워크.','Tailwind',420),
('material-ui','Material UI','Frontend','Library','Frontend,UI,React','React向けUIコンポーネントライブラリ。','React용 UI 컴포넌트 라이브러리.','MUI',430),
('chakra-ui','Chakra UI','Frontend','Library','Frontend,UI,React','React向けアクセシブルUIコンポーネントライブラリ。','React용 접근성 UI 컴포넌트 라이브러리.','',440),
('antd','Ant Design','Frontend','Library','Frontend,UI,React','業務系画面で使われるReact UIライブラリ。','업무 화면에 자주 쓰이는 React UI 라이브러리.','AntD',450),
('redux','Redux','Frontend','Library','Frontend,StateManagement','JavaScriptアプリの状態管理ライブラリ。','JavaScript 앱 상태 관리 라이브러리.','Redux Toolkit,RTK',460),
('zustand','Zustand','Frontend','Library','Frontend,StateManagement','React向け軽量状態管理ライブラリ。','React용 경량 상태 관리 라이브러리.','',470),
('pinia','Pinia','Frontend','Library','Frontend,StateManagement,Vue','Vue公式系の状態管理ライブラリ。','Vue 계열 상태 관리 라이브러리.','',480),
('rxjs','RxJS','Frontend','Library','Frontend,Reactive','リアクティブプログラミング用ライブラリ。','리액티브 프로그래밍 라이브러리.','ReactiveX',490),
('webpack','Webpack','Frontend','Tool','Frontend,Build','JavaScriptモジュールバンドラ。','JavaScript 모듈 번들러.','',500),
('vite','Vite','Frontend','Tool','Frontend,Build','高速なフロントエンド開発・ビルドツール。','빠른 프론트엔드 개발·빌드 도구.','',510),
('babel','Babel','Frontend','Tool','Frontend,Build','JavaScriptトランスパイラ。','JavaScript 트랜스파일러.','',520),
('eslint','ESLint','Frontend','Tool','Frontend,Quality','JavaScript/TypeScript静的解析ツール。','JavaScript/TypeScript 정적 분석 도구.','',530),
('prettier','Prettier','Frontend','Tool','Frontend,Quality','コードフォーマッター。','코드 포매터.','',540),
('storybook','Storybook','Frontend','Tool','Frontend,UI,Testing','UIコンポーネントの開発・確認環境。','UI 컴포넌트 개발·확인 환경.','',550),
('web-components','Web Components','Frontend','Standard','Frontend,Web','ブラウザ標準の再利用可能コンポーネント技術。','브라우저 표준 재사용 컴포넌트 기술.','Custom Elements,Shadow DOM',560),

-- Backend / runtimes / frameworks
('nodejs','Node.js','Backend','Runtime','Backend,Server,Web','JavaScriptサーバーサイド実行環境。','JavaScript 서버사이드 런타임.','Node',600),
('deno','Deno','Backend','Runtime','Backend,Server','JavaScript/TypeScriptランタイム。','JavaScript/TypeScript 런타임.','',610),
('bun','Bun','Backend','Runtime','Backend,Server,Build','JavaScriptランタイム兼ツールチェーン。','JavaScript 런타임 겸 툴체인.','',620),
('express','Express','Backend','Framework','Backend,Web,API','Node.js向けWeb/APIフレームワーク。','Node.js용 Web/API 프레임워크.','Express.js',630),
('nestjs','NestJS','Backend','Framework','Backend,Web,API','TypeScript向け構造化サーバーフレームワーク。','TypeScript용 구조화 서버 프레임워크.','Nest',640),
('fastify','Fastify','Backend','Framework','Backend,Web,API','Node.js向け高速Webフレームワーク。','Node.js용 고성능 웹 프레임워크.','',650),
('spring','Spring Framework','Backend','Framework','Backend,Enterprise,Web','Javaエンタープライズ向け主要フレームワーク。','Java 엔터프라이즈 주요 프레임워크.','Spring',660),
('spring-boot','Spring Boot','Backend','Framework','Backend,Enterprise,Web,API','Springアプリの構築を簡略化するフレームワーク。','Spring 앱 구축을 단순화하는 프레임워크.','SpringBoot',670),
('spring-security','Spring Security','Backend','Framework','Backend,Security,Auth','Spring向け認証・認可フレームワーク。','Spring용 인증·인가 프레임워크.','',680),
('spring-batch','Spring Batch','Backend','Framework','Backend,Batch','大規模バッチ処理向けSpringフレームワーク。','대규모 배치 처리용 Spring 프레임워크.','',690),
('hibernate','Hibernate','Backend','Framework','Backend,ORM,Database','Java向けORMフレームワーク。','Java용 ORM 프레임워크.','JPA',700),
('jpa','JPA','Backend','Standard','Backend,ORM,Database','Java Persistence API標準。','Java Persistence API 표준.','Jakarta Persistence',710),
('mybatis','MyBatis','Backend','Framework','Backend,Database,SQL','SQLマッピング中心のJava永続化フレームワーク。','SQL 매핑 중심 Java 영속성 프레임워크.','iBATIS',720),
('django','Django','Backend','Framework','Backend,Web,Python','Python向けフルスタックWebフレームワーク。','Python용 풀스택 웹 프레임워크.','',730),
('flask','Flask','Backend','Framework','Backend,Web,Python','Python向け軽量Webフレームワーク。','Python용 경량 웹 프레임워크.','',740),
('fastapi','FastAPI','Backend','Framework','Backend,API,Python','Python向け高速APIフレームワーク。','Python용 고성능 API 프레임워크.','',750),
('rails','Ruby on Rails','Backend','Framework','Backend,Web,Ruby','Ruby向けフルスタックWebフレームワーク。','Ruby용 풀스택 웹 프레임워크.','Rails',760),
('laravel','Laravel','Backend','Framework','Backend,Web,PHP','PHP向けWebフレームワーク。','PHP용 웹 프레임워크.','',770),
('symfony','Symfony','Backend','Framework','Backend,Web,PHP','PHP向けエンタープライズWebフレームワーク。','PHP용 엔터프라이즈 웹 프레임워크.','',780),
('dotnet','.NET','Backend','Platform','Backend,Enterprise,Desktop','Microsoftのアプリケーションプラットフォーム。','Microsoft 애플리케이션 플랫폼.','.NET Core,ASP.NET',790),
('aspnet-core','ASP.NET Core','Backend','Framework','Backend,Web,API','C#/.NET向けWeb/APIフレームワーク。','C#/.NET용 Web/API 프레임워크.','ASP.NET',800),
('gin','Gin','Backend','Framework','Backend,API,Go','Go向けWeb/APIフレームワーク。','Go용 Web/API 프레임워크.','Gin Gonic',810),
('fiber','Fiber','Backend','Framework','Backend,API,Go','Go向け高速Webフレームワーク。','Go용 고성능 웹 프레임워크.','',820),
('actix-web','Actix Web','Backend','Framework','Backend,API,Rust','Rust向け高性能Webフレームワーク。','Rust용 고성능 웹 프레임워크.','',830),
('rocket','Rocket','Backend','Framework','Backend,API,Rust','Rust向けWebフレームワーク。','Rust용 웹 프레임워크.','',840),
('graphql','GraphQL','Backend','Protocol','Backend,API,Frontend','クライアントが必要なデータ構造を指定できるAPI方式。','클라이언트가 필요한 데이터 구조를 지정하는 API 방식.','',850),
('grpc','gRPC','Backend','Protocol','Backend,Microservices,RPC','Protocol Buffersベースの高性能RPC。','Protocol Buffers 기반 고성능 RPC.','RPC',860),
('websocket','WebSocket','Backend','Protocol','Backend,Realtime,Frontend','双方向リアルタイム通信プロトコル。','양방향 실시간 통신 프로토콜.','WS,WSS',870),

-- Databases / data stores
('postgresql','PostgreSQL','Database','Database','Database,Backend,RDBMS','高機能なオープンソースRDBMS。','고기능 오픈소스 RDBMS.','Postgres,psql',900),
('mysql','MySQL','Database','Database','Database,Backend,RDBMS','広く利用されるオープンソースRDBMS。','널리 사용되는 오픈소스 RDBMS.','',910),
('mariadb','MariaDB','Database','Database','Database,Backend,RDBMS','MySQL互換系のオープンソースRDBMS。','MySQL 호환 계열 오픈소스 RDBMS.','',920),
('oracle-db','Oracle Database','Database','Database','Database,Enterprise,RDBMS','企業システムで広く利用される商用RDBMS。','기업 시스템에 널리 쓰이는 상용 RDBMS.','Oracle',930),
('db2','IBM Db2','Database','Database','Database,Enterprise,RDBMS','IBMのエンタープライズRDBMS。','IBM 엔터프라이즈 RDBMS.','Db2',940),
('sql-server','Microsoft SQL Server','Database','Database','Database,Enterprise,RDBMS','MicrosoftのRDBMS。','Microsoft RDBMS.','MSSQL,SQL Server',950),
('sqlite','SQLite','Database','Database','Database,Embedded,Mobile','組み込み型の軽量RDBMS。','임베디드형 경량 RDBMS.','',960),
('mongodb','MongoDB','Database','Database','Database,NoSQL,Backend','ドキュメント指向NoSQLデータベース。','문서 지향 NoSQL 데이터베이스.','',970),
('redis','Redis','Database','Database','Database,Cache,NoSQL','インメモリKVS。キャッシュやセッションに利用。','인메모리 KVS. 캐시와 세션 등에 사용.','',980),
('memcached','Memcached','Database','Database','Database,Cache','分散メモリキャッシュ。','분산 메모리 캐시.','',990),
('cassandra','Apache Cassandra','Database','Database','Database,NoSQL,Distributed','分散ワイドカラム型NoSQL DB。','분산 와이드 컬럼형 NoSQL DB.','',1000),
('dynamodb','Amazon DynamoDB','Database','CloudService','Database,NoSQL,AWS','AWSのマネージドNoSQLデータベース。','AWS 관리형 NoSQL 데이터베이스.','DynamoDB',1010),
('firestore','Cloud Firestore','Database','CloudService','Database,NoSQL,GCP','Google Cloud/FirebaseのドキュメントDB。','Google Cloud/Firebase 문서형 DB.','Firebase Firestore',1020),
('firebase-realtime-db','Firebase Realtime Database','Database','CloudService','Database,Realtime,Mobile','FirebaseのリアルタイムNoSQL DB。','Firebase 실시간 NoSQL DB.','',1030),
('elasticsearch','Elasticsearch','Database','Database','Search,Logging,Data','全文検索・ログ分析向け分散検索エンジン。','전문 검색·로그 분석용 분산 검색 엔진.','Elastic',1040),
('opensearch','OpenSearch','Database','Database','Search,Logging,Data','オープンソースの検索・分析エンジン。','오픈소스 검색·분석 엔진.','',1050),
('neo4j','Neo4j','Database','Database','Database,Graph','グラフデータベース。','그래프 데이터베이스.','',1060),
('couchbase','Couchbase','Database','Database','Database,NoSQL','分散ドキュメント/KVデータベース。','분산 문서/KV 데이터베이스.','',1070),
('snowflake','Snowflake','Database','CloudService','Data,Warehouse,Cloud','クラウドデータウェアハウス。','클라우드 데이터 웨어하우스.','',1080),
('bigquery','Google BigQuery','Database','CloudService','Data,Warehouse,GCP','Google Cloudのサーバーレス分析DWH。','Google Cloud 서버리스 분석 DWH.','BigQuery',1090),
('redshift','Amazon Redshift','Database','CloudService','Data,Warehouse,AWS','AWSのマネージドDWH。','AWS 관리형 DWH.','Redshift',1100),

-- Cloud
('aws','Amazon Web Services','Cloud','Platform','Cloud,Infrastructure','Amazonのクラウドプラットフォーム。','Amazon 클라우드 플랫폼.','AWS',1200),
('aws-ec2','Amazon EC2','Cloud','CloudService','Cloud,Server,AWS','AWSの仮想サーバーサービス。','AWS 가상 서버 서비스.','EC2',1210),
('aws-s3','Amazon S3','Cloud','CloudService','Cloud,Storage,AWS','AWSのオブジェクトストレージ。','AWS 오브젝트 스토리지.','S3',1220),
('aws-rds','Amazon RDS','Cloud','CloudService','Cloud,Database,AWS','AWSのマネージドRDBサービス。','AWS 관리형 RDB 서비스.','RDS',1230),
('aws-lambda','AWS Lambda','Cloud','CloudService','Cloud,Serverless,AWS','AWSのサーバーレス関数実行環境。','AWS 서버리스 함수 실행 환경.','Lambda',1240),
('aws-ecs','Amazon ECS','Cloud','CloudService','Cloud,Container,AWS','AWSのコンテナオーケストレーションサービス。','AWS 컨테이너 오케스트레이션 서비스.','ECS',1250),
('aws-eks','Amazon EKS','Cloud','CloudService','Cloud,Kubernetes,AWS','AWSのマネージドKubernetes。','AWS 관리형 Kubernetes.','EKS',1260),
('aws-cloudfront','Amazon CloudFront','Cloud','CloudService','Cloud,CDN,AWS','AWSのCDNサービス。','AWS CDN 서비스.','CloudFront',1270),
('aws-route53','Amazon Route 53','Cloud','CloudService','Cloud,DNS,AWS','AWSのDNS・ドメインサービス。','AWS DNS·도메인 서비스.','Route53',1280),
('aws-iam','AWS IAM','Cloud','CloudService','Cloud,Security,AWS','AWSのID・権限管理。','AWS ID·권한 관리.','IAM',1290),
('aws-cloudwatch','Amazon CloudWatch','Cloud','CloudService','Cloud,Monitoring,AWS','AWS監視・ログサービス。','AWS 모니터링·로그 서비스.','CloudWatch',1300),
('aws-sqs','Amazon SQS','Cloud','CloudService','Cloud,Messaging,AWS','AWSのマネージドメッセージキュー。','AWS 관리형 메시지 큐.','SQS',1310),
('aws-sns','Amazon SNS','Cloud','CloudService','Cloud,Messaging,AWS','AWSのPub/Sub通知サービス。','AWS Pub/Sub 알림 서비스.','SNS',1320),
('aws-api-gateway','Amazon API Gateway','Cloud','CloudService','Cloud,API,AWS','AWSのAPI公開・管理サービス。','AWS API 공개·관리 서비스.','API Gateway',1330),
('aws-vpc','Amazon VPC','Cloud','CloudService','Cloud,Network,AWS','AWS仮想ネットワーク。','AWS 가상 네트워크.','VPC',1340),
('azure','Microsoft Azure','Cloud','Platform','Cloud,Infrastructure','Microsoftのクラウドプラットフォーム。','Microsoft 클라우드 플랫폼.','Azure',1350),
('azure-vm','Azure Virtual Machines','Cloud','CloudService','Cloud,Server,Azure','Azureの仮想サーバー。','Azure 가상 서버.','Azure VM',1360),
('azure-functions','Azure Functions','Cloud','CloudService','Cloud,Serverless,Azure','Azureのサーバーレス関数サービス。','Azure 서버리스 함수 서비스.','',1370),
('azure-app-service','Azure App Service','Cloud','CloudService','Cloud,Web,Azure','AzureのマネージドWebアプリ実行環境。','Azure 관리형 웹 앱 실행 환경.','',1380),
('azure-devops','Azure DevOps','Cloud','Service','Cloud,DevOps,CI/CD','Microsoftの開発・CI/CDサービス群。','Microsoft 개발·CI/CD 서비스.','ADO',1390),
('gcp','Google Cloud','Cloud','Platform','Cloud,Infrastructure','Googleのクラウドプラットフォーム。','Google 클라우드 플랫폼.','GCP,Google Cloud Platform',1400),
('gce','Google Compute Engine','Cloud','CloudService','Cloud,Server,GCP','Google Cloudの仮想サーバー。','Google Cloud 가상 서버.','Compute Engine',1410),
('cloud-run','Google Cloud Run','Cloud','CloudService','Cloud,Container,Serverless,GCP','コンテナをサーバーレス実行するGoogle Cloudサービス。','컨테이너를 서버리스로 실행하는 Google Cloud 서비스.','Cloud Run',1420),
('cloud-functions','Google Cloud Functions','Cloud','CloudService','Cloud,Serverless,GCP','Google Cloudのサーバーレス関数。','Google Cloud 서버리스 함수.','GCF',1430),
('cloudflare','Cloudflare','Cloud','Platform','Cloud,CDN,Security,Edge','CDN、DNS、セキュリティ、Edge実行基盤。','CDN, DNS, 보안, Edge 실행 플랫폼.','CF',1440),
('cloudflare-workers','Cloudflare Workers','Cloud','CloudService','Cloud,Edge,Serverless','CloudflareのEdgeサーバーレス実行環境。','Cloudflare Edge 서버리스 실행 환경.','Workers',1450),
('cloudflare-d1','Cloudflare D1','Cloud','CloudService','Cloud,Database,Edge','CloudflareのSQLite系サーバーレスDB。','Cloudflare SQLite 계열 서버리스 DB.','D1',1460),
('cloudflare-r2','Cloudflare R2','Cloud','CloudService','Cloud,Storage,Edge','CloudflareのS3互換オブジェクトストレージ。','Cloudflare S3 호환 오브젝트 스토리지.','R2',1470),
('vercel','Vercel','Cloud','Platform','Cloud,Frontend,Deployment','フロントエンド向けクラウドデプロイプラットフォーム。','프론트엔드용 클라우드 배포 플랫폼.','',1480),
('netlify','Netlify','Cloud','Platform','Cloud,Frontend,Deployment','Webサイト向けビルド・ホスティングプラットフォーム。','웹 사이트 빌드·호스팅 플랫폼.','',1490),
('heroku','Heroku','Cloud','Platform','Cloud,PaaS,Deployment','アプリケーション向けPaaS。','애플리케이션용 PaaS.','',1500),

-- DevOps / containers / IaC / CI
('git','Git','DevOps','Tool','VersionControl,Development','分散型バージョン管理システム。','분산 버전 관리 시스템.','',1600),
('github','GitHub','DevOps','Service','VersionControl,Collaboration,CI/CD','Gitホスティング・開発コラボレーションサービス。','Git 호스팅·개발 협업 서비스.','',1610),
('gitlab','GitLab','DevOps','Service','VersionControl,Collaboration,CI/CD','GitホスティングとDevOpsプラットフォーム。','Git 호스팅 및 DevOps 플랫폼.','',1620),
('bitbucket','Bitbucket','DevOps','Service','VersionControl,Collaboration','AtlassianのGitホスティングサービス。','Atlassian Git 호스팅 서비스.','',1630),
('docker','Docker','DevOps','Platform','Container,DevOps,Server','コンテナのビルド・実行プラットフォーム。','컨테이너 빌드·실행 플랫폼.','',1640),
('docker-compose','Docker Compose','DevOps','Tool','Container,DevOps,Local','複数Dockerコンテナを定義・起動するツール。','여러 Docker 컨테이너를 정의·실행하는 도구.','Compose',1650),
('kubernetes','Kubernetes','DevOps','Platform','Container,Orchestration,Cloud','コンテナオーケストレーション基盤。','컨테이너 오케스트레이션 플랫폼.','K8s',1660),
('helm','Helm','DevOps','Tool','Kubernetes,Deployment','Kubernetes向けパッケージ管理ツール。','Kubernetes 패키지 관리 도구.','',1670),
('terraform','Terraform','DevOps','Tool','IaC,Cloud,Infrastructure','Infrastructure as Codeツール。','Infrastructure as Code 도구.','IaC,OpenTofu',1680),
('ansible','Ansible','DevOps','Tool','ConfigurationManagement,Server,Automation','構成管理・自動化ツール。','구성 관리·자동화 도구.','',1690),
('puppet','Puppet','DevOps','Tool','ConfigurationManagement,Server','構成管理ツール。','구성 관리 도구.','',1700),
('chef','Chef','DevOps','Tool','ConfigurationManagement,Server','構成管理自動化ツール。','구성 관리 자동화 도구.','',1710),
('jenkins','Jenkins','DevOps','Tool','CI/CD,Automation','CI/CD自動化サーバー。','CI/CD 자동화 서버.','',1720),
('github-actions','GitHub Actions','DevOps','Service','CI/CD,Automation,GitHub','GitHub統合CI/CDサービス。','GitHub 통합 CI/CD 서비스.','Actions',1730),
('gitlab-ci','GitLab CI/CD','DevOps','Service','CI/CD,Automation,GitLab','GitLab統合CI/CD機能。','GitLab 통합 CI/CD 기능.','GitLab CI',1740),
('circleci','CircleCI','DevOps','Service','CI/CD,Automation','クラウドCI/CDサービス。','클라우드 CI/CD 서비스.','',1750),
('travis-ci','Travis CI','DevOps','Service','CI/CD,Automation','CIサービス。','CI 서비스.','',1760),
('argo-cd','Argo CD','DevOps','Tool','GitOps,Kubernetes,Deployment','Kubernetes向けGitOps継続的デリバリーツール。','Kubernetes용 GitOps 지속적 배포 도구.','ArgoCD',1770),
('flux','Flux CD','DevOps','Tool','GitOps,Kubernetes,Deployment','Kubernetes向けGitOpsツール。','Kubernetes용 GitOps 도구.','FluxCD',1780),
('maven','Apache Maven','DevOps','Tool','Build,Java','Java向けビルド・依存関係管理ツール。','Java 빌드·의존성 관리 도구.','Maven',1790),
('gradle','Gradle','DevOps','Tool','Build,Java,Android','Java/Kotlin/Android向けビルドツール。','Java/Kotlin/Android 빌드 도구.','',1800),
('npm','npm','DevOps','Tool','PackageManagement,JavaScript','Node.js標準系パッケージマネージャ。','Node.js 계열 패키지 매니저.','Node Package Manager',1810),
('yarn','Yarn','DevOps','Tool','PackageManagement,JavaScript','JavaScriptパッケージマネージャ。','JavaScript 패키지 매니저.','',1820),
('pnpm','pnpm','DevOps','Tool','PackageManagement,JavaScript','高速・省ディスクのJavaScriptパッケージマネージャ。','빠르고 디스크 효율적인 JavaScript 패키지 매니저.','',1830),
('sonarqube','SonarQube','DevOps','Tool','Quality,StaticAnalysis,CI/CD','コード品質・静的解析プラットフォーム。','코드 품질·정적 분석 플랫폼.','Sonar',1840),
('nexus','Sonatype Nexus','DevOps','Tool','ArtifactRepository,DevOps','アーティファクトリポジトリ。','아티팩트 저장소.','Nexus Repository',1850),
('artifactory','JFrog Artifactory','DevOps','Tool','ArtifactRepository,DevOps','パッケージ・アーティファクト管理基盤。','패키지·아티팩트 관리 플랫폼.','JFrog',1860),

-- Server / middleware / OS
('linux','Linux','OS','OS','Server,DevOps,Infrastructure','サーバーで広く利用されるオープンソースOS。','서버에 널리 사용되는 오픈소스 OS.','Ubuntu,RHEL,CentOS,Debian',1900),
('windows-server','Windows Server','OS','OS','Server,Enterprise,Infrastructure','MicrosoftのサーバーOS。','Microsoft 서버 OS.','',1910),
('macos','macOS','OS','OS','Development,Desktop','AppleのデスクトップOS。','Apple 데스크톱 OS.','Mac',1920),
('nginx','Nginx','Server','Tool','WebServer,ReverseProxy,LoadBalancing','Webサーバー・リバースプロキシ。','웹 서버·리버스 프록시.','',1930),
('apache-httpd','Apache HTTP Server','Server','Tool','WebServer,ReverseProxy','代表的なWebサーバー。','대표적인 웹 서버.','Apache,httpd',1940),
('tomcat','Apache Tomcat','Server','Platform','ApplicationServer,Java,Web','Java Servlet/JSPコンテナ。','Java Servlet/JSP 컨테이너.','Tomcat',1950),
('weblogic','Oracle WebLogic Server','Server','Platform','ApplicationServer,Java,Enterprise','Java EE/Jakarta EEアプリケーションサーバー。','Java EE/Jakarta EE 애플리케이션 서버.','WebLogic',1960),
('websphere','IBM WebSphere','Server','Platform','ApplicationServer,Java,Enterprise','IBMのJavaアプリケーションサーバー。','IBM Java 애플리케이션 서버.','WAS',1970),
('open-liberty','Open Liberty','Server','Platform','ApplicationServer,Java,Enterprise','軽量なJava/Jakarta EEランタイム。','경량 Java/Jakarta EE 런타임.','Liberty',1980),
('iis','Microsoft IIS','Server','Platform','WebServer,Windows,Enterprise','Windows向けWebサーバー。','Windows용 웹 서버.','IIS',1990),
('haproxy','HAProxy','Server','Tool','LoadBalancing,ReverseProxy','高性能ロードバランサー・プロキシ。','고성능 로드밸런서·프록시.','',2000),
('traefik','Traefik','Server','Tool','ReverseProxy,Container,Cloud','クラウドネイティブ向けリバースプロキシ。','클라우드 네이티브용 리버스 프록시.','',2010),
('rabbitmq','RabbitMQ','Server','Platform','Messaging,Backend,Queue','AMQP系メッセージブローカー。','AMQP 계열 메시지 브로커.','',2020),
('apache-kafka','Apache Kafka','Server','Platform','Messaging,Streaming,Data','分散イベントストリーミング基盤。','분산 이벤트 스트리밍 플랫폼.','Kafka',2030),
('activemq','Apache ActiveMQ','Server','Platform','Messaging,Queue,Enterprise','JMS対応メッセージブローカー。','JMS 대응 메시지 브로커.','ActiveMQ',2040),
('zookeeper','Apache ZooKeeper','Server','Platform','Distributed,Coordination','分散システム調整サービス。','분산 시스템 조정 서비스.','ZooKeeper',2050),
('consul','HashiCorp Consul','Server','Platform','ServiceDiscovery,Configuration','サービスディスカバリ・設定管理。','서비스 디스커버리·설정 관리.','Consul',2060),
('vault','HashiCorp Vault','Security','Platform','Secrets,Security,Infrastructure','シークレット・認証情報管理。','시크릿·인증정보 관리.','Vault',2070),

-- Testing / QA
('junit','JUnit','Testing','Framework','Testing,Java,UnitTest','Java向けユニットテストフレームワーク。','Java 유닛 테스트 프레임워크.','',2200),
('testng','TestNG','Testing','Framework','Testing,Java','Java向けテストフレームワーク。','Java 테스트 프레임워크.','',2210),
('jest','Jest','Testing','Framework','Testing,JavaScript,Frontend','JavaScript/TypeScriptテストフレームワーク。','JavaScript/TypeScript 테스트 프레임워크.','',2220),
('vitest','Vitest','Testing','Framework','Testing,JavaScript,Frontend','Vite親和性の高いJavaScriptテストフレームワーク。','Vite 친화적인 JavaScript 테스트 프레임워크.','',2230),
('mocha','Mocha','Testing','Framework','Testing,JavaScript','JavaScriptテストフレームワーク。','JavaScript 테스트 프레임워크.','',2240),
('pytest','pytest','Testing','Framework','Testing,Python','Python向けテストフレームワーク。','Python 테스트 프레임워크.','',2250),
('selenium','Selenium','Testing','Tool','Testing,E2E,Browser','ブラウザ自動化・E2Eテストツール。','브라우저 자동화·E2E 테스트 도구.','WebDriver',2260),
('playwright','Playwright','Testing','Tool','Testing,E2E,Browser','モダンブラウザ向けE2E自動テストツール。','모던 브라우저 E2E 자동 테스트 도구.','',2270),
('cypress','Cypress','Testing','Tool','Testing,E2E,Frontend','WebフロントエンドE2Eテストツール。','웹 프론트엔드 E2E 테스트 도구.','',2280),
('postman','Postman','Testing','Tool','API,Testing,Development','API設計・実行・テストツール。','API 설계·실행·테스트 도구.','',2290),
('insomnia','Insomnia','Testing','Tool','API,Testing,Development','APIクライアント・テストツール。','API 클라이언트·테스트 도구.','',2300),
('jmeter','Apache JMeter','Testing','Tool','Testing,Performance,Load','負荷・性能試験ツール。','부하·성능 테스트 도구.','JMeter',2310),
('k6','Grafana k6','Testing','Tool','Testing,Performance,Load','スクリプト型負荷試験ツール。','스크립트형 부하 테스트 도구.','k6',2320),
('gatling','Gatling','Testing','Tool','Testing,Performance,Load','高負荷性能テストツール。','고부하 성능 테스트 도구.','',2330),
('cucumber','Cucumber','Testing','Framework','Testing,BDD','BDDシナリオベースのテストフレームワーク。','BDD 시나리오 기반 테스트 프레임워크.','Gherkin',2340),

-- Monitoring / observability
('prometheus','Prometheus','DevOps','Tool','Monitoring,Metrics,Cloud','メトリクス収集・監視システム。','메트릭 수집·모니터링 시스템.','',2400),
('grafana','Grafana','DevOps','Tool','Monitoring,Visualization,Observability','監視ダッシュボード・可視化ツール。','모니터링 대시보드·시각화 도구.','',2410),
('datadog','Datadog','DevOps','Service','Monitoring,APM,Observability','クラウド監視・APMプラットフォーム。','클라우드 모니터링·APM 플랫폼.','',2420),
('new-relic','New Relic','DevOps','Service','Monitoring,APM,Observability','APM・監視プラットフォーム。','APM·모니터링 플랫폼.','NewRelic',2430),
('splunk','Splunk','DevOps','Platform','Logging,SIEM,Monitoring','ログ分析・監視・SIEMプラットフォーム。','로그 분석·모니터링·SIEM 플랫폼.','',2440),
('elastic-stack','Elastic Stack','DevOps','Platform','Logging,Monitoring,Search','Elasticsearch中心のログ分析スタック。','Elasticsearch 중심 로그 분석 스택.','ELK,ELK Stack',2450),
('opentelemetry','OpenTelemetry','DevOps','Standard','Observability,Tracing,Metrics','トレース・メトリクス・ログの計装標準。','트레이스·메트릭·로그 계측 표준.','OTel',2460),
('jaeger','Jaeger','DevOps','Tool','Tracing,Observability,Microservices','分散トレーシングシステム。','분산 트레이싱 시스템.','',2470),
('sentry','Sentry','DevOps','Service','ErrorTracking,Monitoring,Frontend','アプリケーションエラー監視サービス。','애플리케이션 오류 모니터링 서비스.','',2480),

-- Data / AI / ML
('pandas','pandas','DataAI','Library','Data,Python,Analytics','Pythonデータ分析ライブラリ。','Python 데이터 분석 라이브러리.','',2600),
('numpy','NumPy','DataAI','Library','Data,Python,Scientific','Python数値計算ライブラリ。','Python 수치 계산 라이브러리.','',2610),
('scikit-learn','scikit-learn','DataAI','Library','MachineLearning,Python,Data','Python機械学習ライブラリ。','Python 머신러닝 라이브러리.','sklearn',2620),
('tensorflow','TensorFlow','DataAI','Framework','MachineLearning,DeepLearning,AI','機械学習・深層学習フレームワーク。','머신러닝·딥러닝 프레임워크.','TF',2630),
('pytorch','PyTorch','DataAI','Framework','MachineLearning,DeepLearning,AI','深層学習フレームワーク。','딥러닝 프레임워크.','Torch',2640),
('keras','Keras','DataAI','Framework','MachineLearning,DeepLearning,AI','高レベル深層学習API。','고수준 딥러닝 API.','',2650),
('hugging-face','Hugging Face','DataAI','Platform','AI,NLP,LLM','モデル・データセット・AIツールのプラットフォーム。','모델·데이터셋·AI 도구 플랫폼.','Transformers',2660),
('openai-api','OpenAI API','DataAI','Service','AI,LLM,Backend','生成AIモデルをアプリから利用するAPI。','생성형 AI 모델을 앱에서 사용하는 API.','GPT',2670),
('langchain','LangChain','DataAI','Framework','AI,LLM,RAG','LLMアプリ・RAG構築向けフレームワーク。','LLM 앱·RAG 구축 프레임워크.','',2680),
('llamaindex','LlamaIndex','DataAI','Framework','AI,LLM,RAG','LLM向けデータ接続・RAGフレームワーク。','LLM 데이터 연결·RAG 프레임워크.','',2690),
('apache-spark','Apache Spark','DataAI','Platform','BigData,Distributed,Data','分散データ処理エンジン。','분산 데이터 처리 엔진.','Spark',2700),
('apache-hadoop','Apache Hadoop','DataAI','Platform','BigData,Distributed,Data','分散ストレージ・バッチ処理基盤。','분산 저장·배치 처리 플랫폼.','Hadoop,HDFS',2710),
('apache-airflow','Apache Airflow','DataAI','Platform','Workflow,Data,ETL','データワークフロー・ジョブオーケストレーション。','데이터 워크플로·잡 오케스트레이션.','Airflow',2720),
('dbt','dbt','DataAI','Tool','Data,Transformation,Analytics','SQL中心のデータ変換・分析エンジニアリングツール。','SQL 중심 데이터 변환·분석 엔지니어링 도구.','data build tool',2730),
('tableau','Tableau','DataAI','Tool','BI,Visualization,Analytics','BI・データ可視化ツール。','BI·데이터 시각화 도구.','',2740),
('power-bi','Microsoft Power BI','DataAI','Tool','BI,Visualization,Analytics','MicrosoftのBI・可視化ツール。','Microsoft BI·시각화 도구.','PowerBI',2750),

-- Security / auth
('oauth2','OAuth 2.0','Security','Protocol','Security,Auth,API','認可のための標準プロトコル。','인가를 위한 표준 프로토콜.','OAuth',2900),
('openid-connect','OpenID Connect','Security','Protocol','Security,Auth,SSO','OAuth 2.0上の認証プロトコル。','OAuth 2.0 기반 인증 프로토콜.','OIDC',2910),
('saml','SAML','Security','Protocol','Security,Auth,SSO','企業SSOで利用される認証連携標準。','기업 SSO에 사용되는 인증 연동 표준.','SAML2',2920),
('jwt','JWT','Security','Standard','Security,Auth,API','JSONベースの署名付きトークン標準。','JSON 기반 서명 토큰 표준.','JSON Web Token',2930),
('keycloak','Keycloak','Security','Platform','Security,Auth,SSO','OSSのID・アクセス管理基盤。','오픈소스 ID·접근 관리 플랫폼.','IAM',2940),
('owasp','OWASP','Security','Standard','Security,Web,BestPractice','Webアプリケーションセキュリティの知識体系。','웹 애플리케이션 보안 지식 체계.','OWASP Top 10',2950),
('sonarqube-security','SonarQube Security','Security','Tool','Security,StaticAnalysis,CodeQuality','静的解析による脆弱性検知。','정적 분석 기반 취약점 탐지.','SAST',2960),
('trivy','Trivy','Security','Tool','Security,Container,DevOps','コンテナ・依存関係の脆弱性スキャナ。','컨테이너·의존성 취약점 스캐너.','',2970),
('snyk','Snyk','Security','Service','Security,Dependency,DevOps','依存関係・コード脆弱性管理サービス。','의존성·코드 취약점 관리 서비스.','',2980),

-- Mobile / desktop / game
('android-sdk','Android SDK','Mobile','Platform','Mobile,Android','Androidアプリ開発SDK。','Android 앱 개발 SDK.','Android',3100),
('jetpack-compose','Jetpack Compose','Mobile','Framework','Mobile,Android,UI','AndroidネイティブUIフレームワーク。','Android 네이티브 UI 프레임워크.','Compose',3110),
('ios-sdk','iOS SDK','Mobile','Platform','Mobile,iOS','iOSアプリ開発SDK。','iOS 앱 개발 SDK.','',3120),
('swiftui','SwiftUI','Mobile','Framework','Mobile,iOS,UI','Apple向け宣言的UIフレームワーク。','Apple용 선언형 UI 프레임워크.','',3130),
('flutter','Flutter','Mobile','Framework','Mobile,CrossPlatform,Frontend','DartベースのクロスプラットフォームUIフレームワーク。','Dart 기반 크로스플랫폼 UI 프레임워크.','',3140),
('react-native','React Native','Mobile','Framework','Mobile,CrossPlatform,React','Reactベースのクロスプラットフォームモバイルフレームワーク。','React 기반 크로스플랫폼 모바일 프레임워크.','RN',3150),
('electron','Electron','Other','Framework','Desktop,JavaScript','Web技術でデスクトップアプリを作るフレームワーク。','웹 기술로 데스크톱 앱을 만드는 프레임워크.','',3160),
('unity','Unity','Game','Engine','Game,3D,Mobile','C#中心のゲームエンジン。','C# 중심 게임 엔진.','Unity Engine',3170),
('unreal-engine','Unreal Engine','Game','Engine','Game,3D','高機能ゲームエンジン。','고기능 게임 엔진.','UE,UE5',3180),
('godot','Godot Engine','Game','Engine','Game,2D,3D','オープンソースゲームエンジン。','오픈소스 게임 엔진.','Godot',3190),

-- Design / documentation / collaboration
('figma','Figma','Design','Tool','Design,UI,UX,Collaboration','UI/UXデザイン・プロトタイピングツール。','UI/UX 디자인·프로토타이핑 도구.','',3300),
('adobe-xd','Adobe XD','Design','Tool','Design,UI,UX','UI/UXデザインツール。','UI/UX 디자인 도구.','XD',3310),
('photoshop','Adobe Photoshop','Design','Tool','Design,Image','画像編集ツール。','이미지 편집 도구.','Photoshop,PS',3320),
('illustrator','Adobe Illustrator','Design','Tool','Design,Vector','ベクターグラフィック編集ツール。','벡터 그래픽 편집 도구.','Illustrator,AI',3330),
('jira','Jira','Collaboration','Tool','ProjectManagement,Agile,IssueTracking','課題・プロジェクト管理ツール。','이슈·프로젝트 관리 도구.','',3340),
('confluence','Confluence','Collaboration','Tool','Documentation,Collaboration','チーム向けWiki・文書管理ツール。','팀용 위키·문서 관리 도구.','',3350),
('slack','Slack','Collaboration','Service','Communication,Collaboration','チームコミュニケーションサービス。','팀 커뮤니케이션 서비스.','',3360),
('microsoft-teams','Microsoft Teams','Collaboration','Service','Communication,Collaboration','Microsoftのチームコミュニケーションサービス。','Microsoft 팀 커뮤니케이션 서비스.','Teams',3370),
('notion','Notion','Collaboration','Tool','Documentation,ProjectManagement','文書・Wiki・タスク管理ツール。','문서·위키·태스크 관리 도구.','',3380),
('redmine','Redmine','Collaboration','Tool','ProjectManagement,IssueTracking','OSSの課題・プロジェクト管理ツール。','오픈소스 이슈·프로젝트 관리 도구.','',3390),
('trello','Trello','Collaboration','Tool','ProjectManagement,Kanban','カンバン型タスク管理ツール。','칸반형 태스크 관리 도구.','',3400),
('backlog','Backlog','Collaboration','Service','ProjectManagement,IssueTracking','日本で広く利用されるプロジェクト管理サービス。','일본에서 널리 사용되는 프로젝트 관리 서비스.','Nulab Backlog',3410),

-- API / protocols / architecture / practices
('rest','REST','Protocol','Standard','API,Backend,Web','HTTPリソース指向のAPI設計スタイル。','HTTP 리소스 중심 API 설계 스타일.','RESTful,REST API',3500),
('http','HTTP / HTTPS','Protocol','Protocol','Web,Network,API','Web通信の基盤プロトコル。','웹 통신 기반 프로토콜.','HTTP2,HTTP3,TLS',3510),
('tcp-ip','TCP/IP','Protocol','Protocol','Network,Server,Infrastructure','インターネット通信の基本プロトコル群。','인터넷 통신 기본 프로토콜 집합.','TCP,IP',3520),
('dns','DNS','Protocol','Protocol','Network,Infrastructure,Web','ドメイン名をIPへ解決する仕組み。','도메인명을 IP로 해석하는 시스템.','Domain Name System',3530),
('ssh','SSH','Protocol','Protocol','Server,Security,RemoteAccess','安全なリモート接続プロトコル。','안전한 원격 접속 프로토콜.','Secure Shell',3540),
('ftp','FTP / SFTP','Protocol','Protocol','FileTransfer,Server','ファイル転送プロトコル。','파일 전송 프로토콜.','FTPS,SFTP',3550),
('smtp','SMTP','Protocol','Protocol','Email,Backend','メール送信プロトコル。','메일 송신 프로토콜.','',3560),
('soap','SOAP','Protocol','Protocol','API,Enterprise,Integration','XMLベースのWebサービスプロトコル。','XML 기반 웹 서비스 프로토콜.','WSDL',3570),
('microservices','Microservices','Architecture','Methodology','Architecture,Backend,Cloud','サービスを小さく分割するシステム設計方式。','서비스를 작게 분리하는 시스템 설계 방식.','MSA',3580),
('monolith','Monolithic Architecture','Architecture','Methodology','Architecture,Backend','単一アプリケーションとして構築する設計方式。','단일 애플리케이션으로 구축하는 설계 방식.','Monolith',3590),
('event-driven','Event-Driven Architecture','Architecture','Methodology','Architecture,Messaging,Backend','イベントを中心に連携するアーキテクチャ。','이벤트 중심으로 연동하는 아키텍처.','EDA',3600),
('domain-driven-design','Domain-Driven Design','Architecture','Methodology','Architecture,Design,Backend','業務ドメインを中心に設計する手法。','업무 도메인을 중심으로 설계하는 방법론.','DDD',3610),
('clean-architecture','Clean Architecture','Architecture','Methodology','Architecture,Design','依存方向を整理し保守性を高める設計思想。','의존 방향을 정리해 유지보수성을 높이는 설계 사상.','',3620),
('hexagonal-architecture','Hexagonal Architecture','Architecture','Methodology','Architecture,Design','ポートとアダプタで外部依存を分離する設計。','포트와 어댑터로 외부 의존성을 분리하는 설계.','Ports and Adapters',3630),
('mvc','MVC','Architecture','Pattern','Architecture,Frontend,Backend','Model/View/Controllerに責務を分ける設計パターン。','Model/View/Controller로 책임을 분리하는 패턴.','Model View Controller',3640),
('mvvm','MVVM','Architecture','Pattern','Architecture,Frontend,Mobile','Model/View/ViewModel構成のUI設計パターン。','Model/View/ViewModel 구조 UI 설계 패턴.','',3650),
('cqrs','CQRS','Architecture','Pattern','Architecture,Backend,Data','コマンドとクエリを分離する設計パターン。','명령과 조회를 분리하는 설계 패턴.','',3660),
('solid','SOLID Principles','Architecture','Methodology','Design,OOP,Architecture','オブジェクト指向設計の代表的原則群。','객체지향 설계 대표 원칙 모음.','SOLID',3670),
('design-patterns','Design Patterns','Architecture','Methodology','Design,OOP,Architecture','再利用可能な代表的ソフトウェア設計パターン。','재사용 가능한 대표 소프트웨어 설계 패턴.','GoF',3680),
('agile','Agile','Architecture','Methodology','ProjectManagement,Development','反復的に価値を届ける開発アプローチ。','반복적으로 가치를 전달하는 개발 접근법.','Agile Development',3690),
('scrum','Scrum','Architecture','Methodology','ProjectManagement,Agile','スプリント中心のアジャイルフレームワーク。','스프린트 중심 애자일 프레임워크.','',3700),
('kanban','Kanban','Architecture','Methodology','ProjectManagement,Agile','作業フローを可視化する管理方式。','작업 흐름을 시각화하는 관리 방식.','',3710),
('ci-cd','CI/CD','DevOps','Methodology','DevOps,Automation,Deployment','継続的インテグレーションと継続的デリバリー/デプロイ。','지속적 통합과 지속적 전달/배포.','CICD',3720),
('devops','DevOps','DevOps','Methodology','Development,Operations,Automation','開発と運用の連携・自動化を重視する文化と実践。','개발과 운영의 협업·자동화를 중시하는 문화와 실천.','',3730),
('sre','Site Reliability Engineering','DevOps','Methodology','Operations,Reliability,Cloud','ソフトウェア工学で運用品質を高める実践。','소프트웨어 공학으로 운영 신뢰성을 높이는 실천.','SRE',3740),

-- IDE / DB / general tools
('vscode','Visual Studio Code','Other','Tool','Development,IDE','軽量で拡張性の高いコードエディタ。','가볍고 확장성 높은 코드 에디터.','VS Code',3900),
('intellij','IntelliJ IDEA','Other','Tool','Development,IDE,Java','JetBrainsのJava/JVM向けIDE。','JetBrains Java/JVM IDE.','IDEA',3910),
('eclipse','Eclipse IDE','Other','Tool','Development,IDE,Java','Java開発で広く使われるIDE。','Java 개발에 널리 쓰이는 IDE.','Eclipse',3920),
('visual-studio','Visual Studio','Other','Tool','Development,IDE,.NET','Microsoftの統合開発環境。','Microsoft 통합 개발 환경.','VS',3930),
('android-studio','Android Studio','Other','Tool','Development,IDE,Android','Android公式IDE。','Android 공식 IDE.','',3940),
('xcode','Xcode','Other','Tool','Development,IDE,iOS','Appleプラットフォーム公式IDE。','Apple 플랫폼 공식 IDE.','',3950),
('dbeaver','DBeaver','Other','Tool','Database,Development','汎用DBクライアント。','범용 DB 클라이언트.','',3960),
('a5sql','A5:SQL Mk-2','Other','Tool','Database,Development','日本でよく利用されるDB設計・SQLクライアント。','일본에서 자주 쓰이는 DB 설계·SQL 클라이언트.','A5M2,A5:SQL',3970),
('pgadmin','pgAdmin','Other','Tool','Database,PostgreSQL','PostgreSQL管理GUI。','PostgreSQL 관리 GUI.','',3980),
('sql-developer','Oracle SQL Developer','Other','Tool','Database,Oracle','Oracle DB向け開発・管理ツール。','Oracle DB 개발·관리 도구.','SQL Developer',3990),
('teraterm','Tera Term','Other','Tool','Server,SSH,Terminal','Windows向けターミナル・SSHクライアント。','Windows용 터미널·SSH 클라이언트.','TeraTerm',4000),
('putty','PuTTY','Other','Tool','Server,SSH,Terminal','SSH/Telnetクライアント。','SSH/Telnet 클라이언트.','',4010),
('winscp','WinSCP','Other','Tool','FileTransfer,SFTP,Server','Windows向けSFTP/SCPクライアント。','Windows용 SFTP/SCP 클라이언트.','',4020),
('filezilla','FileZilla','Other','Tool','FileTransfer,FTP','FTP/SFTPクライアント。','FTP/SFTP 클라이언트.','',4030),
('wireshark','Wireshark','Other','Tool','Network,Debugging,Security','ネットワークパケット解析ツール。','네트워크 패킷 분석 도구.','',4040),
('curl','curl','Other','Tool','Network,API,CLI','HTTP等の通信確認に使うCLIツール。','HTTP 등 통신 확인에 사용하는 CLI 도구.','',4050),
('swagger','Swagger / OpenAPI','Other','Standard','API,Documentation,Backend','REST API仕様記述・ドキュメント標準/ツール群。','REST API 명세·문서화 표준/도구군.','OpenAPI',4060),
('jp1','JP1','Other','Platform','Operations,JobScheduler,Enterprise','日立の統合運用管理・ジョブ管理製品群。','Hitachi 통합 운영관리·잡 관리 제품군.','JP1/AJS',4070),
('jobcenter','NEC JobCenter','Other','Platform','Operations,JobScheduler,Enterprise','NECのジョブ管理製品。','NEC 잡 관리 제품.','JobCenter',4080),
('servicenow','ServiceNow','Other','Service','ITSM,Operations,Workflow','ITサービス管理・ワークフロープラットフォーム。','IT 서비스 관리·워크플로 플랫폼.','ITSM',4090),
('salesforce','Salesforce','Other','Platform','CRM,Enterprise,Cloud','クラウドCRM・業務アプリプラットフォーム。','클라우드 CRM·업무 앱 플랫폼.','SFDC',4100),
('sap','SAP','Other','Platform','ERP,Enterprise','企業向けERP製品群。','기업용 ERP 제품군.','SAP ERP,S/4HANA',4110);

-- Seed the existing summary selections from the old string-based defaults.
INSERT OR IGNORE INTO skill_sheet_section_skills (section_id, skill_id, display_order)
SELECT s.id, c.id, x.display_order
FROM skill_sheet_summary_sections AS s
JOIN (
    SELECT 'frontend' section_key, 'angular' skill_key, 10 display_order UNION ALL
    SELECT 'frontend', 'typescript', 20 UNION ALL
    SELECT 'frontend', 'javascript', 30 UNION ALL
    SELECT 'frontend', 'html', 40 UNION ALL
    SELECT 'frontend', 'css', 50 UNION ALL
    SELECT 'frontend', 'vue', 60 UNION ALL
    SELECT 'backend', 'java', 10 UNION ALL
    SELECT 'backend', 'spring', 20 UNION ALL
    SELECT 'backend', 'rest', 30 UNION ALL
    SELECT 'backend', 'open-liberty', 40 UNION ALL
    SELECT 'backend', 'websphere', 50 UNION ALL
    SELECT 'database-migration', 'postgresql', 10 UNION ALL
    SELECT 'database-migration', 'db2', 20 UNION ALL
    SELECT 'database-migration', 'oracle-db', 30 UNION ALL
    SELECT 'database-migration', 'sql', 40 UNION ALL
    SELECT 'database-migration', 'shell', 50 UNION ALL
    SELECT 'delivery-operations', 'git', 10 UNION ALL
    SELECT 'delivery-operations', 'jenkins', 20 UNION ALL
    SELECT 'delivery-operations', 'jp1', 30 UNION ALL
    SELECT 'delivery-operations', 'jobcenter', 40 UNION ALL
    SELECT 'delivery-operations', 'aws', 50
) AS x ON x.section_key = s.section_key
JOIN it_skill_catalog AS c ON c.skill_key = x.skill_key;
