import { pbkdf2Sync, scryptSync } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import readline from 'node:readline/promises';
import process from 'node:process';

const DATABASE = 'song-project-db';
const LIVE_LOGIN_URL = 'https://song-project.song-project.workers.dev/api/admin/auth/login';

function base64UrlToBuffer(value) {
  const normalized = String(value).replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, 'base64');
}

function timingSafeEqualSimple(left, right) {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left[i] ^ right[i];
  return diff === 0;
}

function sqlEscape(value) {
  return String(value).replaceAll("'", "''");
}

function runWranglerJson(sql) {
  const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const result = spawnSync(
    command,
    ['wrangler', 'd1', 'execute', DATABASE, '--remote', '--json', '--command', sql],
    { encoding: 'utf8', stdio: ['inherit', 'pipe', 'pipe'] },
  );

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || 'wrangler 실행 실패').trim());
  }

  let parsed;
  try {
    parsed = JSON.parse(result.stdout);
  } catch {
    throw new Error(`Wrangler JSON 응답을 해석하지 못했습니다.\n${result.stdout}`);
  }

  const blocks = Array.isArray(parsed) ? parsed : [parsed];
  const rows = [];
  for (const block of blocks) {
    if (Array.isArray(block?.results)) rows.push(...block.results);
    else if (Array.isArray(block?.result?.results)) rows.push(...block.result.results);
  }
  return rows;
}

function askHiddenRaw(prompt) {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
    throw new Error('이 터미널에서는 숨김 입력을 사용할 수 없습니다.');
  }

  process.stdout.write(prompt);
  process.stdin.setEncoding('utf8');
  process.stdin.setRawMode(true);
  process.stdin.resume();

  return new Promise((resolve, reject) => {
    let value = '';
    const cleanup = () => {
      process.stdin.off('data', onData);
      try { process.stdin.setRawMode(false); } catch {}
      process.stdout.write('\n');
    };
    const onData = (chunk) => {
      for (const char of chunk) {
        if (char === '\r' || char === '\n') {
          cleanup();
          resolve(value);
          return;
        }
        if (char === '\u0003') {
          cleanup();
          reject(new Error('입력을 취소했습니다.'));
          return;
        }
        if (char === '\u007f' || char === '\b') {
          if (value.length) {
            value = value.slice(0, -1);
            process.stdout.write('\b \b');
          }
          continue;
        }
        if (char >= ' ') {
          value += char;
          process.stdout.write('*');
        }
      }
    };
    process.stdin.on('data', onData);
  });
}

async function askHidden(rl, prompt) {
  if (process.platform === 'win32') return askHiddenRaw(prompt);
  process.stdout.write(prompt);
  const result = spawnSync('stty', ['-echo'], { stdio: ['inherit', 'ignore', 'ignore'] });
  if (result.status !== 0) throw new Error('터미널 echo를 끄지 못했습니다.');
  try {
    return await rl.question('');
  } finally {
    spawnSync('stty', ['echo'], { stdio: ['inherit', 'ignore', 'ignore'] });
    process.stdout.write('\n');
  }
}

function verifyEncodedPassword(password, encodedHash) {
  const parts = String(encodedHash || '').split('$');
  const algorithm = parts[0] || 'unknown';

  try {
    if (algorithm === 'pbkdf2-sha256') {
      const iterations = Number.parseInt(parts[1] || '', 10);
      const salt = base64UrlToBuffer(parts[2] || '');
      const expected = base64UrlToBuffer(parts[3] || '');
      if (!Number.isSafeInteger(iterations) || iterations <= 0 || salt.length < 16 || expected.length < 32) {
        return { algorithm, validFormat: false, matches: false };
      }
      const actual = pbkdf2Sync(password, salt, iterations, expected.length, 'sha256');
      return { algorithm, validFormat: true, matches: timingSafeEqualSimple(actual, expected) };
    }

    if (algorithm === 'scrypt') {
      const cost = Number.parseInt(parts[1] || '', 10);
      const blockSize = Number.parseInt(parts[2] || '', 10);
      const parallelization = Number.parseInt(parts[3] || '', 10);
      const salt = base64UrlToBuffer(parts[4] || '');
      const expected = base64UrlToBuffer(parts[5] || '');
      if (!Number.isSafeInteger(cost) || !Number.isSafeInteger(blockSize) || !Number.isSafeInteger(parallelization) || salt.length < 16 || expected.length < 32) {
        return { algorithm, validFormat: false, matches: false };
      }
      const actual = scryptSync(password, salt, expected.length, {
        N: cost,
        r: blockSize,
        p: parallelization,
        maxmem: 64 * 1024 * 1024,
      });
      return { algorithm, validFormat: true, matches: timingSafeEqualSimple(actual, expected) };
    }
  } catch (error) {
    return { algorithm, validFormat: false, matches: false, error: error instanceof Error ? error.message : String(error) };
  }

  return { algorithm, validFormat: false, matches: false };
}

async function verifyAgainstLiveApi(username, password) {
  const response = await fetch(LIVE_LOGIN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, rememberMe: false }),
  });
  const requestId = response.headers.get('x-request-id');
  const data = await response.json().catch(() => ({}));
  return {
    status: response.status,
    requestId,
    authenticated: data?.authenticated === true,
    error: data?.error ?? null,
  };
}

if (!process.stdin.isTTY || !process.stdout.isTTY) {
  console.error('로그인 진단은 대화형 터미널에서 실행해주세요.');
  process.exit(1);
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

try {
  console.log('원격 D1 관리자 계정을 조회합니다...');
  const accounts = runWranglerJson(`SELECT id, username, status, two_factor_enabled, failed_login_count, locked_until, last_login_at FROM admins ORDER BY id;`);
  if (!accounts.length) {
    console.error('원격 D1에 관리자 계정이 없습니다.');
    process.exitCode = 1;
  } else {
    console.table(accounts);
    const username = (await rl.question('진단할 관리자 아이디: ')).trim();
    if (!username) {
      console.error('관리자 아이디를 입력해야 합니다.');
      process.exitCode = 1;
    } else {
      const rows = runWranglerJson(`SELECT id, username, password_hash, status, two_factor_enabled, failed_login_count, locked_until FROM admins WHERE username='${sqlEscape(username)}' COLLATE NOCASE LIMIT 1;`);
      const admin = rows[0];
      if (!admin) {
        console.error('❌ 원격 D1에서 해당 username을 찾지 못했습니다.');
        process.exitCode = 1;
      } else {
        const password = await askHidden(rl, '현재 로그인에 사용할 비밀번호: ');
        const verification = verifyEncodedPassword(password, admin.password_hash);
        const now = Date.now();
        const lockedUntil = admin.locked_until ? Date.parse(admin.locked_until) : Number.NaN;
        const currentlyLocked = Number.isFinite(lockedUntil) && lockedUntil > now;
        const passwordShape = {
          charLength: password.length,
          utf8Bytes: Buffer.byteLength(password, 'utf8'),
        };

        console.log('\n=== 로그인 진단 결과 ===');
        console.log(`계정 조회: ✅ id=${admin.id}, username=${admin.username}`);
        console.log(`상태: ${admin.status === 'active' ? '✅ active' : `❌ ${admin.status}`}`);
        console.log(`2단계 인증: ${Number(admin.two_factor_enabled) === 1 ? '⚠️ enabled' : '✅ disabled'}`);
        console.log(`로그인 잠금: ${currentlyLocked ? `❌ locked until ${admin.locked_until}` : '✅ not locked'}`);
        console.log(`입력 비밀번호 길이: ${passwordShape.charLength}자 / UTF-8 ${passwordShape.utf8Bytes}바이트`);
        console.log(`저장 해시 형식: ${verification.validFormat ? '✅' : '❌'} ${verification.algorithm}`);
        console.log(`입력 비밀번호 ↔ 원격 D1 해시: ${verification.matches ? '✅ MATCH' : '❌ MISMATCH'}`);
        if (verification.error) console.log(`해시 검증 오류: ${verification.error}`);

        if (admin.status === 'active' && !currentlyLocked && Number(admin.two_factor_enabled) !== 1 && verification.matches) {
          console.log('\n동일한 비밀번호 문자열을 운영 로그인 API에 1회 전송해 비교합니다...');
          const live = await verifyAgainstLiveApi(String(admin.username), password);
          console.log('=== 운영 API 동일 문자열 검증 ===');
          console.log(`HTTP 상태: ${live.status}`);
          console.log(`authenticated: ${live.authenticated ? '✅ true' : '❌ false'}`);
          console.log(`error: ${live.error ?? '-'}`);
          console.log(`requestId: ${live.requestId ?? '-'}`);

          if (live.authenticated) {
            console.log('\n✅ 동일 문자열로 운영 API 로그인까지 성공했습니다.');
            console.log('브라우저에서만 실패한다면 브라우저 자동완성/입력값이 다른 것이 원인입니다.');
          } else if (live.status === 401 && live.error === 'INVALID_CREDENTIALS') {
            console.log('\n❌ 같은 문자열이 D1에서는 MATCH인데 운영 Worker에서만 불일치합니다.');
            console.log('브라우저 문제는 배제됐습니다. Worker 비밀번호 검증 런타임을 계속 점검해야 합니다.');
            process.exitCode = 2;
          } else {
            console.log('\n⚠️ 운영 API가 비밀번호 불일치 외의 응답을 반환했습니다. 위 HTTP/error/requestId를 확인하세요.');
            process.exitCode = 3;
          }
        } else {
          console.log('\n⚠️ 위 ❌/⚠️ 항목을 먼저 해결해야 하므로 운영 API 호출은 생략합니다.');
        }
      }
    }
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  if (process.platform === 'win32') {
    try { process.stdin.setRawMode(false); } catch {}
  }
  rl.close();
}
