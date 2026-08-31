(() => {
	const SETUP_KEY = 'song_public_japanese_quiz_setup';
	const nativeFetch = window.fetch.bind(window);

	function scopeWords() {
		try {
			const setup = JSON.parse(sessionStorage.getItem(SETUP_KEY) || 'null');
			return Array.isArray(setup?.scopeWords)
				? [...new Set(setup.scopeWords.map((value) => String(value || '').normalize('NFKC').trim()).filter(Boolean))].slice(0, 60)
				: [];
		} catch {
			return [];
		}
	}

	window.fetch = (input, init) => {
		try {
			const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input || '');
			if (url.includes('/api/public/japanese/quiz-pool')) {
				const words = scopeWords();
				if (words.length) {
					const parsed = new URL(url, window.location.origin);
					parsed.searchParams.delete('word');
					for (const word of words) parsed.searchParams.append('word', word);
					const nextUrl = url.startsWith('http') ? parsed.toString() : `${parsed.pathname}${parsed.search}`;
					if (input instanceof Request) return nativeFetch(new Request(nextUrl, input), init);
					return nativeFetch(nextUrl, init);
				}
			}
		} catch (error) {
			console.warn('Failed to apply scoped Japanese quiz words', error);
		}
		return nativeFetch(input, init);
	};
})();
