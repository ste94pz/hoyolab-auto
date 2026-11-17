const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const util = require("node:util");
const redactHttp = require("../object/redact-http.js");
const { createHttpHarness } = require("./helpers/http.js");

const telegramUrl = "https://api.telegram.org/bot123:synthetic-secret/getUpdates";

test("diagnostic URL redaction preserves routing while removing credentials", () => {
	const cases = [
		[telegramUrl, "api.telegram.org/botREDACTED/getUpdates", "synthetic-secret"],
		["https://discord.com/api/webhooks/123/webhook-secret", "/webhooks/123/REDACTED", "webhook-secret"],
		["https://discord.com/api/v10/webhooks/123/versioned-secret", "/webhooks/123/REDACTED", "versioned-secret"],
		["https://user-secret:password-secret@example.invalid/path?token=query-secret&token=other-secret#fragment-secret", "example.invalid/path", "secret"],
		["https://example.invalid/path?unusual_key=opaque-value", "unusual_key=REDACTED", "opaque-value"],
		["https://[malformed/secret", "[REDACTED URL]", "secret"]
	];
	for (const [url, preserved, secret] of cases) {
		const text = redactHttp(`Request failed (${url})\nError: ${url}`);
		assert.ok(text.includes(preserved));
		assert.ok(!text.includes(secret));
	}
	assert.equal(redactHttp("ordinary message"), "ordinary message");
	assert.equal(redactHttp("https://example.invalid/event/contract"), "https://example.invalid/event/contract");
});

test("real Got keeps the token on the wire while both error log levels redact it", async t => {
	const { Got, requests, logs } = await createHttpHarness(t);
	await Got("API", { url: telegramUrl, method: "POST", json: { offset: 1 } });
	assert.equal(requests[0].url.toString(), telegramUrl);
	const error = new Error(`Timeout requesting ${telegramUrl}`);
	error.code = "ETIMEDOUT";
	error.options = { method: "POST", url: new URL(telegramUrl) };
	const hook = requests[0].transport.beforeError[0];
	assert.equal(await hook(error), error);
	assert.equal(error.options.url.toString(), telegramUrl);
	assert.equal(error.message, `Timeout requesting ${telegramUrl}`);
	assert.equal(logs.length, 2);
	for (const log of logs) {
		assert.doesNotMatch(JSON.stringify(log), /synthetic-secret/);
		assert.match(JSON.stringify(log), /botREDACTED\/getUpdates/);
	}
});

test("console and file formatters redact URL credentials in error stacks and inspected objects", t => {
	const directory = fs.mkdtempSync(path.join(os.tmpdir(), "hoyolab-log-redaction-"));
	const previousDirectory = process.cwd();
	let logger;
	try {
		process.chdir(directory);
		const Logger = require("../singleton/logger.js");
		logger = new Logger("error");
	}
	finally {
		process.chdir(previousDirectory);
	}
	t.after(() => logger.winstonLogger.close());
	// Transport streams close asynchronously; the directory remains in the OS temp area.
	const error = new Error(`Request failed: ${telegramUrl}`);
	const text = util.inspect({ reason: error, url: telegramUrl });
	const formats = [logger.winstonLogger.format, ...logger.winstonLogger.transports.map(transport => transport.format).filter(Boolean)];
	assert.equal(formats.length, 3);
	for (const format of formats) {
		const result = format.transform({ level: "error", [Symbol.for("level")]: "error", message: { type: "Client", text } }, format.options);
		assert.doesNotMatch(result[Symbol.for("message")], /synthetic-secret/);
		assert.match(result[Symbol.for("message")], /botREDACTED\/getUpdates/);
	}
});
