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

function askHiddenWindows(prompt) {
  const ps = [
    `$p = Read-Host '${prompt.replaceAll("'", "''")}' -AsSecureString`,
    `$b = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($p)`,
    `try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($b) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) }`,
  ].join('; ');
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], {
    encoding: 'utf8',
    stdio: ['inherit', 'pipe', 'inherit'],
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error('비밀번호 입력을 취소했습니다.');
  return String(result.stdout ?? '').replace(/\r?\n$/, '');
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
    // Windows PowerShell uses Read-Host -AsSecureString so the password is never echoed.
    // Unix/Termux keeps one readline instance and temporarily disables terminal echo.
    const password = process.platform === 'win32'
      ? askHiddenWindows('새 비밀번호')
      : await askHiddenUnix(rl, '새 비밀번호: ');
    const confirm = process.platform === 'win32'
      ? askHiddenWindows('새 비밀번호 확인')
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
      const sql = `UPDATE admins SET password_hash='${escapedHash}', updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE username='${escapedUser}'; DELETE FROM admin_sessions WHERE admin_id=(SELECT id FROM admins WHERE username='${escapedUser}');`;

      console.log('\n원격 D1에서 비밀번호를 변경하고 기존 로그인 세션을 모두 종료합니다...');
      const result = spawnSync('npx', ['wrangler', 'd1', 'execute', DATABASE, '--remote', '--command', sql], {
        stdio: 'inherit',
        shell: process.platform === 'win32',
      });

      if (result.error) {
        console.error(result.error.message);
        process.exitCode = 1;
      } else if (result.status !== 0) {
        console.error('\n비밀번호 변경에 실패했습니다. D1 한도 초과 상태라면 한도 초기화 후 다시 실행해주세요.');
        process.exitCode = result.status ?? 1;
      } else {
        console.log('\n관리자 비밀번호를 변경했습니다. 새 비밀번호로 다시 로그인해주세요.');
      }
    }
  }
} finally {
  if (process.platform !== 'win32') {
    try { setEcho(true); } catch {}
  }
  rl.close();
}
