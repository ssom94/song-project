const PASSWORD_HASH_ALGORITHM = 'pbkdf2-sha256';
const PBKDF2_HASH = 'SHA-256';

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

export async function verifyPassword(password: string, encodedHash: string): Promise<boolean> {
	const [algorithm, rawIterations, rawSalt, rawExpectedHash] = encodedHash.split('$');
	const iterations = Number.parseInt(rawIterations ?? '', 10);

	if (
		algorithm !== PASSWORD_HASH_ALGORITHM ||
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
