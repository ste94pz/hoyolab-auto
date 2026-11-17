// Redact diagnostic text only; never use this on outgoing requests.
const redactHttp = text => String(text).replace(/https?:\/\/[^\s<>"']+/gi, value => {
	try {
		const url = new URL(value);
		if (url.username) {
			url.username = "REDACTED";
		}
		if (url.password) {
			url.password = "REDACTED";
		}
		if (url.hostname.toLowerCase() === "api.telegram.org") {
			url.pathname = url.pathname.replace(/^\/bot[^/]+/i, "/botREDACTED");
		}
		url.pathname = url.pathname.replace(/(\/api(?:\/v\d+)?\/webhooks\/[^/]+\/)[^/]+/i, "$1REDACTED");
		for (const key of new Set(url.searchParams.keys())) {
			url.searchParams.set(key, "REDACTED");
		}
		if (url.hash) {
			url.hash = "REDACTED";
		}
		return url.toString();
	}
	catch {
		return "[REDACTED URL]";
	}
});

module.exports = redactHttp;
