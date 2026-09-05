import { spawnSync } from 'node:child_process';
import process from 'node:process';

const DATABASE = 'song-project-db';
const username = process.argv[2] || 'sym94091';

function sqlEscape(value) {
  return String(value).replaceAll("'", "''");
}

const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const escaped = sqlEscape(username);
const sql = `
UPDATE admins
SET failed_login_count=0,
    locked_until=NULL,
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE username='${escaped}' COLLATE NOCASE;

SELECT id, username, status, two_factor_enabled, failed_login_count, locked_until
FROM admins
WHERE username='${escaped}' COLLATE NOCASE
LIMIT 1;
`;

const result = spawnSync(
  command,
  ['wrangler', 'd1', 'execute', DATABASE, '--remote', '--json', '--command', sql],
  { encoding: 'utf8', stdio: ['inherit', 'pipe', 'pipe'] },
);

if (result.error) throw result.error;
if (result.status !== 0) {
  console.error(result.stderr || result.stdout || 'unlock failed');
  process.exit(result.status ?? 1);
}

let rows = [];
try {
  const parsed = JSON.parse(result.stdout || '[]');
  for (const block of (Array.isArray(parsed) ? parsed : [parsed])) {
    if (Array.isArray(block?.results)) rows.push(...block.results);
    else if (Array.isArray(block?.result?.results)) rows.push(...block.result.results);
  }
} catch {
  console.log(result.stdout);
  process.exit(0);
}

const account = rows.find((row) => String(row.username ?? '').toLowerCase() === username.toLowerCase());
if (!account) {
  console.error(`❌ 관리자 계정 '${username}'을 찾지 못했습니다.`);
  process.exit(1);
}

console.log('✅ 관리자 계정 잠금 해제 완료');
console.table([account]);
