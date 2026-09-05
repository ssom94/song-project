(() => {
	const nativeFetch = window.fetch.bind(window);
	let flushingSubmit = false;

	function clean(value) {
		return String(value ?? '').trim();
	}

	function endpointOf(input) {
		try {
			const raw = input instanceof Request ? input.url : String(input);
			return new URL(raw, location.href).pathname;
		} catch {
			return '';
		}
	}

	function methodOf(input, init) {
		return String(init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
	}

	function parseBody(init) {
		if (!init || typeof init.body !== 'string') return null;
		try {
			const parsed = JSON.parse(init.body);
			return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
		} catch {
			return null;
		}
	}

	function normalizedAnswerInit(init) {
		const body = parseBody(init);
		if (!body || !body.answerJson || typeof body.answerJson !== 'object' || Array.isArray(body.answerJson)) return init;
		const hasValue = Object.values(body.answerJson).some((value) => clean(value));
		if (hasValue) return init;
		return { ...init, body: JSON.stringify({ ...body, answerJson: null }) };
	}

	async function saveCurrentWrittenAnswers(subject, examNo) {
		const groups = new Map();
		document.querySelectorAll('textarea[data-question-id]').forEach((textarea) => {
			const questionId = Number(textarea.dataset.questionId);
			if (!Number.isInteger(questionId) || questionId <= 0) return;
			let group = groups.get(questionId);
			if (!group) {
				group = { questionId, answerText: null, answerJson: null };
				groups.set(questionId, group);
			}
			const key = textarea.dataset.answerKey;
			if (key) {
				if (!group.answerJson) group.answerJson = {};
				group.answerJson[key] = textarea.value;
			} else {
				group.answerText = textarea.value;
			}
		});

		for (const group of groups.values()) {
			const payload = { subject, examNo, questionId: group.questionId };
			if (group.answerJson) {
				const hasValue = Object.values(group.answerJson).some((value) => clean(value));
				payload.answerJson = hasValue ? group.answerJson : null;
			} else {
				payload.answerText = group.answerText ?? '';
			}
			const response = await nativeFetch('/api/admin/ap/mock-exams/answer', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'same-origin',
				body: JSON.stringify(payload),
			});
			const data = await response.json().catch(() => ({}));
			if (!response.ok || !data.ok) throw new Error(data.error || `HTTP_${response.status}`);
		}
	}

	window.fetch = async function guardedFetch(input, init) {
		const endpoint = endpointOf(input);
		const method = methodOf(input, init);

		if (method === 'POST' && endpoint === '/api/admin/ap/mock-exams/answer') {
			return nativeFetch(input, normalizedAnswerInit(init));
		}

		if (method === 'POST' && endpoint === '/api/admin/ap/mock-exams/submit' && !flushingSubmit) {
			const body = parseBody(init);
			if (body && body.force !== true && (body.subject === 'A' || body.subject === 'B')) {
				flushingSubmit = true;
				try {
					await saveCurrentWrittenAnswers(body.subject, Number(body.examNo));
					return await nativeFetch(input, init);
				} finally {
					flushingSubmit = false;
				}
			}
		}

		return nativeFetch(input, init);
	};
})();
