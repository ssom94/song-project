import { scrypt as nodeScrypt } from 'node:crypto';

const SCRYPT_ALGORITHM = 'scrypt';
const PBKDF2_ALGORITHM = 'pbkdf2-sha256';
const PBKDF2_HASH = 'SHA-256';
const SCRYPT_MAX_MEMORY = 64 * 1024 * 1024;

function base64UrlToBytes(value: string): Uint8Array {
	const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4);
	const binary = atob(padded);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i += 1) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
	if (left.length !== right.length) {
		return false;
	}

	let difference = 0;
	for (let i = 0; i < left.length; i += 1) {
		difference |= left[i] ^ right[i];
	}
	return difference === 0;
}

function isPowerOfTwo(value: number): boolean {
	return value > 1 && (value & (value - 1)) === 0;
}

function deriveScrypt(
	password: string,
	salt: Uint8Array,
	keyLength: number,
	cost: number,
	blockSize: number,
	parallelization: number,
): Promise<Uint8Array> {
	return new Promise((resolve, reject) => {
		nodeScrypt(
			password,
			salt,
			keyLength,
			{
				N: cost,
				r: blockSize,
				p: parallelization,
				maxmem: SCRYPT_MAX_MEMORY,
			},
			(error, derivedKey) => {
				if (error) {
					reject(error);
					return;
				}
				resolve(new Uint8Array(derivedKey));
			},
		);
	});
}

async function verifyScrypt(password: string, encodedHash: string): Promise<boolean> {
	const [algorithm, rawCost, rawBlockSize, rawParallelization, rawSalt, rawExpectedHash] = encodedHash.split('$');
	const cost = Number.parseInt(rawCost ?? '', 10);
	const blockSize = Number.parseInt(rawBlockSize ?? '', 10);
	const parallelization = Number.parseInt(rawParallelization ?? '', 10);

	if (
		algorithm !== SCRYPT_ALGORITHM ||
		!Number.isSafeInteger(cost) ||
		!isPowerOfTwo(cost) ||
		cost < 16_384 ||
		cost > 262_144 ||
		!Number.isSafeInteger(blockSize) ||
		blockSize < 1 ||
		blockSize > 16 ||
		!Number.isSafeInteger(parallelization) ||
		parallelization < 1 ||
		parallelization > 8 ||
		!rawSalt ||
		!rawExpectedHash
	) {
		return false;
	}

	try {
		const salt = base64UrlToBytes(rawSalt);
		const expectedHash = base64UrlToBytes(rawExpectedHash);
		if (salt.length < 16 || expectedHash.length < 32) {
			return false;
		}

		const derivedHash = await deriveScrypt(password, salt, expectedHash.length, cost, blockSize, parallelization);
		return constantTimeEqual(derivedHash, expectedHash);
	} catch {
		return false;
	}
}

async function verifyPbkdf2(password: string, encodedHash: string): Promise<boolean> {
	const [algorithm, rawIterations, rawSalt, rawExpectedHash] = encodedHash.split('$');
	const iterations = Number.parseInt(rawIterations ?? '', 10);

	if (
		algorithm !== PBKDF2_ALGORITHM ||
		!Number.isSafeInteger(iterations) ||
		iterations <= 0 ||
		!rawSalt ||
		!rawExpectedHash
	) {
		return false;
	}

	try {
		const salt = base64UrlToBytes(rawSalt);
		const expectedHash = base64UrlToBytes(rawExpectedHash);
		if (salt.length < 16 || expectedHash.length < 32) {
			return false;
		}

		const keyMaterial = await crypto.subtle.importKey(
			'raw',
			new TextEncoder().encode(password),
			'PBKDF2',
			false,
			['deriveBits'],
		);

		const derivedBits = await crypto.subtle.deriveBits(
			{
				name: 'PBKDF2',
				hash: PBKDF2_HASH,
				salt,
				iterations,
			},
			keyMaterial,
			expectedHash.length * 8,
		);

		return constantTimeEqual(new Uint8Array(derivedBits), expectedHash);
	} catch {
		return false;
	}
}

export async function verifyPassword(password: string, encodedHash: string): Promise<boolean> {
	if (encodedHash.startsWith(`${SCRYPT_ALGORITHM}$`)) {
		return verifyScrypt(password, encodedHash);
	}

	if (encodedHash.startsWith(`${PBKDF2_ALGORITHM}$`)) {
		return verifyPbkdf2(password, encodedHash);
	}

	return false;
}
