(() => {
	async function loadMessage() {
		try {
			const response = await fetch('/message');
			const text = await response.text();
			const heading = document.getElementById('heading');
			if (heading) heading.textContent = text;
		} catch (error) {
			console.error('Failed to load message', error);
		}
	}

	function bindRandomButton() {
		const button = document.getElementById('button');
		const output = document.getElementById('random');
		if (!button || !output) return;

		button.addEventListener('click', async () => {
			try {
				const response = await fetch('/random');
				output.textContent = await response.text();
			} catch (error) {
				console.error('Failed to load random value', error);
			}
		});
	}

	function initialize() {
		loadMessage();
		bindRandomButton();
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', initialize, { once: true });
	} else {
		initialize();
	}
})();
