import { pbkdf2Sync, randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import readline from 'node:readline/promises';
import process from 'node:process';

const ITERATIONS = 210_000;
const KEY_LENGTH = 32;
const DATABASE = 'song-project-db';

function base64Url(buffer) {
  return Buffer.from(buffer).toString('base64url');
}

function sqlEscape(value) {
  return String(value).replaceAll("'", "''");
}

function setEcho(enabled) {
  const result = spawnSync('stty', [enabled ? 'echo' : '-echo'], {
    stdio: ['inherit', 'ignore', 'ignore'],
  });
  if (result.status !== 0) throw new Error('터미널 입력 모드를 변경하지 못했습니다.');
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
          reject(new Error('비밀번호 입력을 취소했습니다.'));
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

async function askHiddenUnix(rl, prompt) {
  process.stdout.write(prompt);
  setEcho(false);
  try {
    return await rl.question('');
  } finally {
    setEcho(true);
    process.stdout.write('\n');
  }
}

if (!process.stdin.isTTY || !process.stdout.isTTY) {
  console.error('비밀번호 재설정은 대화형 터미널에서 실행해주세요.');
  process.exit(1);
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

try {
  const username = (await rl.question('관리자 아이디: ')).trim();
  if (!username) {
    console.error('관리자 아이디를 입력해야 합니다.');
    process.exitCode = 1;
  } else {
    const password = process.platform === 'win32'
      ? await askHiddenRaw('새 비밀번호: ')
      : await askHiddenUnix(rl, '새 비밀번호: ');
    const confirm = process.platform === 'win32'
      ? await askHiddenRaw('새 비밀번호 확인: ')
      : await askHiddenUnix(rl, '새 비밀번호 확인: ');

    if (password !== confirm) {
      console.error('비밀번호가 일치하지 않습니다.');
      process.exitCode = 1;
    } else if (password.length < 10) {
      console.error('비밀번호는 최소 10자 이상으로 설정해주세요.');
      process.exitCode = 1;
    } else {
      const salt = randomBytes(16);
      const derived = pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, 'sha256');
      const passwordHash = `pbkdf2-sha256$${ITERATIONS}$${base64Url(salt)}$${base64Url(derived)}`;
      const escapedUser = sqlEscape(username);
      const escapedHash = sqlEscape(passwordHash);
      const sql = `UPDATE admins SET password_hash='${escapedHash}', failed_login_count=0, locked_until=NULL, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE username='${escapedUser}' COLLATE NOCASE; DELETE FROM admin_sessions WHERE admin_id=(SELECT id FROM admins WHERE username='${escapedUser}' COLLATE NOCASE); SELECT id, username, status, two_factor_enabled, failed_login_count, locked_until FROM admins WHERE username='${escapedUser}' COLLATE NOCASE LIMIT 1;`;

      console.log('\n원격 D1에서 비밀번호와 계정 잠금 상태를 초기화하고 기존 로그인 세션을 모두 종료합니다...');
      const result = spawnSync('npx', ['wrangler', 'd1', 'execute', DATABASE, '--remote', '--command', sql], {
        stdio: 'inherit',
        shell: process.platform === 'win32',
      });

      if (result.error) {
        console.error(result.error.message);
        process.exitCode = 1;
      } else if (result.status !== 0) {
        console.error('\n비밀번호 변경에 실패했습니다.');
        process.exitCode = result.status ?? 1;
      } else {
        console.log('\n관리자 비밀번호와 잠금 상태를 초기화했습니다. 위 출력의 status / two_factor_enabled 값을 확인해주세요.');
      }
    }
  }
} finally {
  if (process.platform !== 'win32') {
    try { setEcho(true); } catch {}
  } else {
    try { process.stdin.setRawMode(false); } catch {}
  }
  rl.close();
}
