import { pbkdf2Sync, randomBytes, scrypt as nodeScrypt } from 'node:crypto';

const SCRYPT_ALGORITHM = 'scrypt';
const SCRYPT_COST = 16_384;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELIZATION = 1;
const SCRYPT_KEY_LENGTH = 32;
const SCRYPT_MAX_MEMORY = 64 * 1024 * 1024;
const PBKDF2_ALGORITHM = 'pbkdf2-sha256';
const PBKDF2_DIGEST = 'sha256';
const AUTH_VERIFIER_BUILD = 'scrypt-v3';

export interface PasswordVerificationResult {
	matches: boolean;
	algorithm: string;
	nodeCrypto?: 'match' | 'mismatch' | 'error';
	webCrypto?: 'match' | 'mismatch' | 'error' | 'not-run';
	formatValid: boolean;
}

function bytesToBase64Url(bytes: Uint8Array): string {
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value: string): Uint8Array {
	const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4);
	const binary = atob(padded);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
	return bytes;
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
	if (left.length !== right.length) return false;
	let difference = 0;
	for (let i = 0; i < left.length; i += 1) difference |= left[i] ^ right[i];
	return difference === 0;
}

async function encodedHashFingerprint(encodedHash: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(encodedHash));
	return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('').slice(0, 12);
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
			{ N: cost, r: blockSize, p: parallelization, maxmem: SCRYPT_MAX_MEMORY },
			(error, derivedKey) => {
				if (error) return reject(error);
				resolve(new Uint8Array(derivedKey));
			},
		);
	});
}

async function verifyScrypt(password: string, encodedHash: string): Promise<PasswordVerificationResult> {
	const [algorithm, rawCost, rawBlockSize, rawParallelization, rawSalt, rawExpectedHash] = encodedHash.split('$');
	const cost = Number.parseInt(rawCost ?? '', 10);
	const blockSize = Number.parseInt(rawBlockSize ?? '', 10);
	const parallelization = Number.parseInt(rawParallelization ?? '', 10);
	if (
		algorithm !== SCRYPT_ALGORITHM ||
		!Number.isSafeInteger(cost) || !isPowerOfTwo(cost) || cost < 16_384 || cost > 262_144 ||
		!Number.isSafeInteger(blockSize) || blockSize < 1 || blockSize > 16 ||
		!Number.isSafeInteger(parallelization) || parallelization < 1 || parallelization > 8 ||
		!rawSalt || !rawExpectedHash
	) return { matches: false, algorithm: SCRYPT_ALGORITHM, formatValid: false };

	try {
		const salt = base64UrlToBytes(rawSalt);
		const expectedHash = base64UrlToBytes(rawExpectedHash);
		if (salt.length < 16 || expectedHash.length < 32) return { matches: false, algorithm, formatValid: false };
		const derivedHash = await deriveScrypt(password, salt, expectedHash.length, cost, blockSize, parallelization);
		return { matches: constantTimeEqual(derivedHash, expectedHash), algorithm, formatValid: true };
	} catch (error) {
		console.warn('[auth-password] scrypt_error', {
			build: AUTH_VERIFIER_BUILD,
			cost,
			blockSize,
			parallelization,
			hashFingerprint: await encodedHashFingerprint(encodedHash),
			message: error instanceof Error ? error.message : String(error),
		});
		return { matches: false, algorithm, formatValid: true };
	}
}

async function verifyPbkdf2(password: string, encodedHash: string): Promise<PasswordVerificationResult> {
	const [algorithm, rawIterations, rawSalt, rawExpectedHash] = encodedHash.split('$');
	const iterations = Number.parseInt(rawIterations ?? '', 10);
	if (
		algorithm !== PBKDF2_ALGORITHM ||
		!Number.isSafeInteger(iterations) || iterations <= 0 ||
		!rawSalt || !rawExpectedHash
	) return { matches: false, algorithm: PBKDF2_ALGORITHM, formatValid: false };

	let salt: Uint8Array;
	let expectedHash: Uint8Array;
	try {
		salt = base64UrlToBytes(rawSalt);
		expectedHash = base64UrlToBytes(rawExpectedHash);
	} catch {
		return { matches: false, algorithm, formatValid: false };
	}
	if (salt.length < 16 || expectedHash.length < 32) return { matches: false, algorithm, formatValid: false };

	let nodeCrypto: 'match' | 'mismatch' | 'error' = 'error';
	try {
		const derived = pbkdf2Sync(password, salt, iterations, expectedHash.length, PBKDF2_DIGEST);
		nodeCrypto = constantTimeEqual(new Uint8Array(derived), expectedHash) ? 'match' : 'mismatch';
		if (nodeCrypto === 'match') {
			return { matches: true, algorithm, nodeCrypto, webCrypto: 'not-run', formatValid: true };
		}
	} catch {
		nodeCrypto = 'error';
	}

	let webCrypto: 'match' | 'mismatch' | 'error' = 'error';
	try {
		const keyMaterial = await crypto.subtle.importKey(
			'raw',
			new TextEncoder().encode(password),
			'PBKDF2',
			false,
			['deriveBits'],
		);
		const derivedBits = await crypto.subtle.deriveBits(
			{ name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
			keyMaterial,
			expectedHash.length * 8,
		);
		webCrypto = constantTimeEqual(new Uint8Array(derivedBits), expectedHash) ? 'match' : 'mismatch';
	} catch {
		webCrypto = 'error';
	}

	if (webCrypto !== 'match') {
		console.warn('[auth-password] pbkdf2_mismatch', {
			build: AUTH_VERIFIER_BUILD,
			nodeCrypto,
			webCrypto,
			iterations,
			saltBytes: salt.length,
			expectedHashBytes: expectedHash.length,
			encodedHashLength: encodedHash.length,
			hashFingerprint: await encodedHashFingerprint(encodedHash),
		});
	}

	return {
		matches: webCrypto === 'match',
		algorithm,
		nodeCrypto,
		webCrypto,
		formatValid: true,
	};
}

export async function hashPassword(password: string): Promise<string> {
	const salt = new Uint8Array(randomBytes(16));
	const derivedHash = await deriveScrypt(
		password,
		salt,
		SCRYPT_KEY_LENGTH,
		SCRYPT_COST,
		SCRYPT_BLOCK_SIZE,
		SCRYPT_PARALLELIZATION,
	);
	return `${SCRYPT_ALGORITHM}$${SCRYPT_COST}$${SCRYPT_BLOCK_SIZE}$${SCRYPT_PARALLELIZATION}$${bytesToBase64Url(salt)}$${bytesToBase64Url(derivedHash)}`;
}

export async function verifyPasswordDetailed(password: string, encodedHash: string): Promise<PasswordVerificationResult> {
	if (encodedHash.startsWith(`${SCRYPT_ALGORITHM}$`)) return verifyScrypt(password, encodedHash);
	if (encodedHash.startsWith(`${PBKDF2_ALGORITHM}$`)) return verifyPbkdf2(password, encodedHash);
	return { matches: false, algorithm: 'unknown', formatValid: false };
}

export async function verifyPassword(password: string, encodedHash: string): Promise<boolean> {
	return (await verifyPasswordDetailed(password, encodedHash)).matches;
}
