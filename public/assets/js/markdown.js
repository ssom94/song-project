(() => {
	function normalizeSource(value) {
		return String(value ?? '').replace(/\r\n?/g, '\n');
	}

	function safeLinkUrl(value) {
		const raw = String(value ?? '').trim();
		if (!raw) return null;
		if (raw.startsWith('#') || raw.startsWith('/') || raw.startsWith('./') || raw.startsWith('../')) return raw;

		try {
			const url = new URL(raw, window.location.origin);
			if (url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'mailto:') return raw;
		} catch {
			return null;
		}
		return null;
	}

	function appendPlainText(parent, value) {
		const pieces = String(value).split('\n');
		pieces.forEach((piece, index) => {
			if (index > 0) parent.appendChild(document.createElement('br'));
			if (piece) parent.appendChild(document.createTextNode(piece));
		});
	}

	function appendInline(parent, source) {
		const text = String(source ?? '');
		const tokenPattern = /`[^`\n]+`|\[[^\]\n]+\]\([^\)\n]+\)|\*\*[^*\n]+\*\*|__[^_\n]+__|~~[^~\n]+~~|\+\+[^+\n]+\+\+|\*[^*\n]+\*|_[^_\n]+_/g;
		let cursor = 0;

		for (const match of text.matchAll(tokenPattern)) {
			const index = match.index ?? 0;
			if (index > cursor) appendPlainText(parent, text.slice(cursor, index));

			const token = match[0];
			if (token.startsWith('`')) {
				const code = document.createElement('code');
				code.textContent = token.slice(1, -1);
				parent.appendChild(code);
			} else if (token.startsWith('[')) {
				const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
				if (!linkMatch) {
					appendPlainText(parent, token);
				} else {
					const label = linkMatch[1];
					const rawTarget = linkMatch[2].trim().replace(/^<|>$/g, '');
					const target = safeLinkUrl(rawTarget);
					if (!target) {
						appendPlainText(parent, label);
					} else {
						const link = document.createElement('a');
						link.href = target;
						appendInline(link, label);
						if (/^https?:/i.test(target)) {
							link.target = '_blank';
							link.rel = 'noopener noreferrer';
						}
						parent.appendChild(link);
					}
				}
			} else if (token.startsWith('**') || token.startsWith('__')) {
				const strong = document.createElement('strong');
				appendInline(strong, token.slice(2, -2));
				parent.appendChild(strong);
			} else if (token.startsWith('~~')) {
				const del = document.createElement('del');
				appendInline(del, token.slice(2, -2));
				parent.appendChild(del);
			} else if (token.startsWith('++')) {
				const underline = document.createElement('u');
				appendInline(underline, token.slice(2, -2));
				parent.appendChild(underline);
			} else {
				const emphasis = document.createElement('em');
				appendInline(emphasis, token.slice(1, -1));
				parent.appendChild(emphasis);
			}

			cursor = index + token.length;
		}

		if (cursor < text.length) appendPlainText(parent, text.slice(cursor));
	}

	function isFence(line) {
		return /^\s*```/.test(line);
	}

	function isHeading(line) {
		return /^\s{0,3}#{1,6}\s+/.test(line);
	}

	function isHorizontalRule(line) {
		return /^\s{0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line);
	}

	function isQuote(line) {
		return /^\s{0,3}>\s?/.test(line);
	}

	function unorderedMatch(line) {
		return line.match(/^\s{0,3}[-+*]\s+(.+)$/);
	}

	function orderedMatch(line) {
		return line.match(/^\s{0,3}\d+[.)]\s+(.+)$/);
	}

	function isTableSeparator(line) {
		const value = line.trim().replace(/^\||\|$/g, '');
		if (!value.includes('|')) return false;
		return value.split('|').every((cell) => /^\s*:?-{3,}:?\s*$/.test(cell));
	}

	function tableCells(line) {
		return line.trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim());
	}

	function startsBlock(lines, index) {
		const line = lines[index] ?? '';
		const next = lines[index + 1] ?? '';
		return !line.trim()
			|| isFence(line)
			|| isHeading(line)
			|| isHorizontalRule(line)
			|| isQuote(line)
			|| Boolean(unorderedMatch(line))
			|| Boolean(orderedMatch(line))
			|| (line.includes('|') && isTableSeparator(next));
	}

	function render(source, container) {
		if (!(container instanceof Element)) return false;
		const lines = normalizeSource(source).split('\n');
		const fragment = document.createDocumentFragment();
		let index = 0;

		while (index < lines.length) {
			const line = lines[index];
			if (!line.trim()) {
				index += 1;
				continue;
			}

			if (isFence(line)) {
				const fence = line.match(/^\s*```\s*([^\s`]*)\s*$/);
				const language = fence?.[1] ?? '';
				const codeLines = [];
				index += 1;
				while (index < lines.length && !/^\s*```\s*$/.test(lines[index])) {
					codeLines.push(lines[index]);
					index += 1;
				}
				if (index < lines.length) index += 1;

				const pre = document.createElement('pre');
				const code = document.createElement('code');
				if (language) {
					code.className = `language-${language.replace(/[^a-z0-9_-]/gi, '')}`;
					code.dataset.language = language;
				}
				code.textContent = codeLines.join('\n');
				pre.appendChild(code);
				fragment.appendChild(pre);
				continue;
			}

			const headingMatch = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
			if (headingMatch) {
				const heading = document.createElement(`h${headingMatch[1].length}`);
				appendInline(heading, headingMatch[2]);
				fragment.appendChild(heading);
				index += 1;
				continue;
			}

			if (isHorizontalRule(line)) {
				fragment.appendChild(document.createElement('hr'));
				index += 1;
				continue;
			}

			if (isQuote(line)) {
				const quoteLines = [];
				while (index < lines.length && isQuote(lines[index])) {
					quoteLines.push(lines[index].replace(/^\s{0,3}>\s?/, ''));
					index += 1;
				}
				const blockquote = document.createElement('blockquote');
				render(quoteLines.join('\n'), blockquote);
				fragment.appendChild(blockquote);
				continue;
			}

			const unordered = unorderedMatch(line);
			const ordered = orderedMatch(line);
			if (unordered || ordered) {
				const list = document.createElement(unordered ? 'ul' : 'ol');
				while (index < lines.length) {
					const match = unordered ? unorderedMatch(lines[index]) : orderedMatch(lines[index]);
					if (!match) break;
					const item = document.createElement('li');
					appendInline(item, match[1]);
					list.appendChild(item);
					index += 1;
				}
				fragment.appendChild(list);
				continue;
			}

			if (line.includes('|') && isTableSeparator(lines[index + 1] ?? '')) {
				const headers = tableCells(line);
				const table = document.createElement('table');
				const thead = document.createElement('thead');
				const headerRow = document.createElement('tr');
				for (const value of headers) {
					const cell = document.createElement('th');
					appendInline(cell, value);
					headerRow.appendChild(cell);
				}
				thead.appendChild(headerRow);
				table.appendChild(thead);
				index += 2;

				const tbody = document.createElement('tbody');
				while (index < lines.length && lines[index].trim() && lines[index].includes('|')) {
					const row = document.createElement('tr');
					const cells = tableCells(lines[index]);
					for (let column = 0; column < headers.length; column += 1) {
						const cell = document.createElement('td');
						appendInline(cell, cells[column] ?? '');
						row.appendChild(cell);
					}
					tbody.appendChild(row);
					index += 1;
				}
				table.appendChild(tbody);
				const wrapper = document.createElement('div');
				wrapper.className = 'song-markdown-table-wrap';
				wrapper.appendChild(table);
				fragment.appendChild(wrapper);
				continue;
			}

			const paragraphLines = [line];
			index += 1;
			while (index < lines.length && !startsBlock(lines, index)) {
				paragraphLines.push(lines[index]);
				index += 1;
			}
			const paragraph = document.createElement('p');
			appendInline(paragraph, paragraphLines.join('\n'));
			fragment.appendChild(paragraph);
		}

		container.replaceChildren(fragment);
		container.classList.add('song-markdown');
		return true;
	}

	window.SongMarkdown = { render };
})();
