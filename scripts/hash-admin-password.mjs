import { randomBytes, scryptSync } from 'node:crypto';

const COST = 16_384;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 5;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;
const MAX_MEMORY = 64 * 1024 * 1024;

function toBase64Url(buffer) {
	return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function readHidden(prompt) {
	return new Promise((resolve, reject) => {
		if (!process.stdin.isTTY) {
			reject(new Error('This script must be run in an interactive terminal.'));
			return;
		}

		process.stdout.write(prompt);
		process.stdin.setRawMode(true);
		process.stdin.resume();
		process.stdin.setEncoding('utf8');

		let value = '';
		const onData = (key) => {
			if (key === '\u0003') {
				cleanup();
				process.stdout.write('\n');
				reject(new Error('Cancelled.'));
				return;
			}

			if (key === '\r' || key === '\n') {
				cleanup();
				process.stdout.write('\n');
				resolve(value);
				return;
			}

			if (key === '\u007f' || key === '\b') {
				value = value.slice(0, -1);
				return;
			}

			value += key;
		};

		const cleanup = () => {
			process.stdin.off('data', onData);
			process.stdin.setRawMode(false);
			process.stdin.pause();
		};

		process.stdin.on('data', onData);
	});
}

try {
	const password = await readHidden('Admin password (hidden): ');
	if (password.length < 12) {
		throw new Error('Use at least 12 characters.');
	}
	if (password.length > 1024) {
		throw new Error('Password is too long.');
	}

	const confirmation = await readHidden('Confirm password (hidden): ');
	if (password !== confirmation) {
		throw new Error('Passwords do not match.');
	}

	const salt = randomBytes(SALT_LENGTH);
	const hash = scryptSync(password, salt, KEY_LENGTH, {
		N: COST,
		r: BLOCK_SIZE,
		p: PARALLELIZATION,
		maxmem: MAX_MEMORY,
	});
	const encoded = `scrypt$${COST}$${BLOCK_SIZE}$${PARALLELIZATION}$${toBase64Url(salt)}$${toBase64Url(hash)}`;

	console.log('\nPassword hash (safe to store in D1):');
	console.log(encoded);
} catch (error) {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
}
