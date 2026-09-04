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
    throw new Error('Password reset must be run in an interactive terminal.');
  }

  process.stdout.write(prompt);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');

  let value = '';
  try {
    for await (const chunk of process.stdin) {
      for (const char of chunk) {
        if (char === '\r' || char === '\n') {
          process.stdout.write('\n');
          return value;
        }
        if (char === '\u0003') {
          process.stdout.write('\n');
          process.exit(130);
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
    }
  } finally {
    process.stdin.setRawMode(false);
    process.stdin.pause();
  }

  return value;
}

const username = await askVisible('관리자 아이디: ');
if (!username) {
  console.error('관리자 아이디를 입력해야 합니다.');
  process.exit(1);
}

const password = await askHidden('새 비밀번호: ');
const confirm = await askHidden('새 비밀번호 확인: ');

if (password !== confirm) {
  console.error('비밀번호가 일치하지 않습니다.');
  process.exit(1);
}
if (password.length < 10) {
  console.error('비밀번호는 최소 10자 이상으로 설정해주세요.');
  process.exit(1);
}

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
  process.exit(1);
}
if (result.status !== 0) {
  console.error('\n비밀번호 변경에 실패했습니다. D1 한도 초과 상태라면 한도 초기화 후 다시 실행해주세요.');
  process.exit(result.status ?? 1);
}

console.log('\n관리자 비밀번호를 변경했습니다. 새 비밀번호로 다시 로그인해주세요.');
