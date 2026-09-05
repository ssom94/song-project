import { pbkdf2Sync, randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import readline from 'node:readline/promises';
import { Writable } from 'node:stream';
import process from 'node:process';

const ITERATIONS = 210_000;
const KEY_LENGTH = 32;
const DATABASE = 'song-project-db';

function base64Url(buffer) {
  return Buffer.from(buffer).toString('base64url');
}

function base64UrlToBuffer(value) {
  const normalized = String(value).replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, 'base64');
}

function verifyPbkdf2Password(password, encodedHash) {
  const [algorithm, rawIterations, rawSalt, rawExpected] = String(encodedHash || '').split('$');
  if (algorithm !== 'pbkdf2-sha256') return false;
  const iterations = Number.parseInt(rawIterations || '', 10);
  if (!Number.isSafeInteger(iterations) || iterations <= 0 || !rawSalt || !rawExpected) return false;

  const salt = base64UrlToBuffer(rawSalt);
  const expected = base64UrlToBuffer(rawExpected);
  if (salt.length < 16 || expected.length < 32) return false;

  const actual = pbkdf2Sync(password, salt, iterations, expected.length, 'sha256');
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i += 1) diff |= actual[i] ^ expected[i];
  return diff === 0;
}

function sqlEscape(value) {
  return String(value).replaceAll("'", "''");
}

function wranglerCommand() {
  return process.platform === 'win32' ? 'npx.cmd' : 'npx';
}

function extractRows(payload) {
  const blocks = Array.isArray(payload) ? payload : [payload];
  const rows = [];
  for (const block of blocks) {
    if (Array.isArray(block?.results)) rows.push(...block.results);
    else if (Array.isArray(block?.result?.results)) rows.push(...block.result.results);
  }
  return rows;
}

function runRemoteD1(sql) {
  const result = spawnSync(
    wranglerCommand(),
    ['wrangler', 'd1', 'execute', DATABASE, '--remote', '--json', '--command', sql],
    {
      encoding: 'utf8',
      stdio: ['inherit', 'pipe', 'pipe'],
      shell: false,
    },
  );

  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = String(result.stderr || result.stdout || '').trim();
    throw new Error(detail || `wrangler d1 execute failed (${result.status})`);
  }

  try {
    return extractRows(JSON.parse(String(result.stdout || '').trim() || '[]'));
  } catch (error) {
    throw new Error(`D1 JSON 결과를 해석하지 못했습니다: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function askVisible(prompt) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await rl.question(prompt)).trim();
  } finally {
    rl.close();
  }
}

async function askHidden(prompt) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error('이 터미널에서는 숨김 입력을 사용할 수 없습니다. PowerShell 또는 일반 터미널에서 실행해주세요.');
  }

  let muted = true;
  const hiddenOutput = new Writable({
    write(chunk, encoding, callback) {
      if (!muted) process.stdout.write(chunk, encoding);
      callback();
    },
  });
  const rl = readline.createInterface({ input: process.stdin, output: hiddenOutput, terminal: true });

  process.stdout.write(prompt);
  try {
    const value = await rl.question('');
    process.stdout.write('\n');
    return value;
  } finally {
    muted = false;
    rl.close();
  }
}

function printAccounts(accounts) {
  console.log('\n원격 D1 관리자 계정');
  console.table(accounts.map((account) => ({
    id: account.id,
    username: account.username,
    display_name: account.display_name,
    status: account.status,
    two_factor_enabled: account.two_factor_enabled,
    failed_login_count: account.failed_login_count,
    locked_until: account.locked_until,
    last_login_at: account.last_login_at,
  })));
}

if (!process.stdin.isTTY || !process.stdout.isTTY) {
  console.error('관리자 비밀번호 재설정은 대화형 PowerShell/터미널에서 실행해주세요.');
  process.exit(1);
}

try {
  console.log(`원격 D1(${DATABASE})에서 실제 관리자 계정을 먼저 확인합니다...`);
  const accounts = runRemoteD1(`
    SELECT id, username, display_name, status, two_factor_enabled,
           failed_login_count, locked_until, last_login_at
    FROM admins
    ORDER BY id;
  `);

  if (!accounts.length) {
    throw new Error('원격 D1에 관리자 계정이 없습니다. 비밀번호 문제가 아니라 관리자 계정 생성 여부를 먼저 확인해야 합니다.');
  }

  printAccounts(accounts);

  const username = await askVisible('\n비밀번호를 변경할 관리자 아이디(username): ');
  if (!username) throw new Error('관리자 아이디를 입력해야 합니다.');

  const selected = accounts.find(
    (account) => String(account.username ?? '').toLocaleLowerCase() === username.toLocaleLowerCase(),
  );
  if (!selected) {
    throw new Error(`원격 D1 관리자 목록에 '${username}' 계정이 없습니다. 위 표의 username을 그대로 입력해주세요.`);
  }

  console.log(`선택 계정: id=${selected.id}, username=${selected.username}, status=${selected.status}, 2FA=${selected.two_factor_enabled}`);

  const password = await askHidden('새 비밀번호: ');
  const confirm = await askHidden('새 비밀번호 확인: ');

  if (password !== confirm) throw new Error('비밀번호가 일치하지 않습니다.');
  if (password.length < 10) throw new Error('비밀번호는 최소 10자 이상으로 설정해주세요.');

  const salt = randomBytes(16);
  const derived = pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, 'sha256');
  const passwordHash = `pbkdf2-sha256$${ITERATIONS}$${base64Url(salt)}$${base64Url(derived)}`;
  const escapedUser = sqlEscape(String(selected.username));
  const escapedHash = sqlEscape(passwordHash);

  console.log('\n비밀번호 변경 + 계정 잠금 해제 + 기존 세션 종료를 적용합니다...');
  const rows = runRemoteD1(`
    UPDATE admins
    SET password_hash='${escapedHash}',
        failed_login_count=0,
        locked_until=NULL,
        updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
    WHERE username='${escapedUser}' COLLATE NOCASE;

    DELETE FROM admin_sessions
    WHERE admin_id=(SELECT id FROM admins WHERE username='${escapedUser}' COLLATE NOCASE);

    SELECT id, username, display_name, status, two_factor_enabled,
           failed_login_count, locked_until, last_login_at, password_hash
    FROM admins
    WHERE username='${escapedUser}' COLLATE NOCASE
    LIMIT 1;
  `);

  const updated = rows.find(
    (row) => String(row.username ?? '').toLocaleLowerCase() === String(selected.username).toLocaleLowerCase(),
  );
  if (!updated) {
    throw new Error('비밀번호 UPDATE 후 계정을 다시 조회하지 못했습니다. 변경 성공으로 처리하지 않습니다.');
  }

  if (!verifyPbkdf2Password(password, updated.password_hash)) {
    throw new Error('원격 D1에 저장된 새 password_hash가 방금 입력한 비밀번호와 일치하지 않습니다. 변경 성공으로 처리하지 않습니다.');
  }

  console.log('\n관리자 비밀번호 변경 완료');
  console.table([{
    id: updated.id,
    username: updated.username,
    display_name: updated.display_name,
    status: updated.status,
    two_factor_enabled: updated.two_factor_enabled,
    failed_login_count: updated.failed_login_count,
    locked_until: updated.locked_until,
    last_login_at: updated.last_login_at,
  }]);
  console.log('원격 D1 저장 해시 재검증: ✅ MATCH');
  console.log('failed_login_count=0, locked_until=null이면 잠금도 해제된 상태입니다.');
  if (Number(updated.two_factor_enabled) === 1) {
    console.warn('주의: two_factor_enabled=1 입니다. 비밀번호가 맞아도 로그인 API는 2FA 인증을 추가로 요구합니다.');
  }
  if (String(updated.status) !== 'active') {
    console.warn(`주의: status=${updated.status} 입니다. 로그인 코드상 active 계정만 로그인할 수 있습니다.`);
  }
} catch (error) {
  console.error(`\n[실패] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
