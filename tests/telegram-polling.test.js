const { test } = require("node:test");
const assert = require("node:assert/strict");
const Telegram = require("../platforms/telegram.js");
const Platform = require("../platforms/template.js");

const harness = t => {
	const previousApp = globalThis.app;
	const previousPlatforms = [...Platform.list];
	const timers = [];
	const requests = [];
	const logs = [];
	const replies = [];
	t.mock.method(globalThis, "setTimeout", (callback, delay) => {
		const timer = { callback, delay, cleared: false };
		timers.push(timer);
		return timer;
	});
	t.mock.method(globalThis, "clearTimeout", timer => {
		if (timer) {
			timer.cleared = true;
		}
	});
	globalThis.app = {
		Error: require("../object/error.js"),
		Logger: {
			warn: (...args) => logs.push(args),
			error: (...args) => logs.push(args)
		},
		Got: async (profile, options) => {
			requests.push({ profile, ...options });
			const reply = replies.shift();
			if (reply instanceof Error) {
				throw reply;
			}
			return reply ?? { statusCode: 200, body: { ok: true, result: []} };
		}
	};
	const telegram = new Telegram({ id: 2, token: "123:synthetic-token", chatId: 42 });
	t.after(() => {
		telegram.destroy();
		Platform.list.splice(0, Platform.list.length, ...previousPlatforms);
		globalThis.app = previousApp;
	});
	return { telegram, timers, requests, replies, logs, pending: () => timers.filter(timer => !timer.cleared) };
};

test("startup and concurrent polls share one request and schedule only after completion", async t => {
	const h = harness(t);
	let resolve;
	h.replies.push(new Promise(done => {
		resolve = done;
	}));
	const first = h.telegram.connect();
	assert.equal(h.telegram.connect(), first);
	assert.equal(h.requests.length, 1);
	assert.equal(h.pending().length, 0);
	resolve({ statusCode: 200, body: { ok: true, result: []} });
	await first;
	assert.equal(h.pending().length, 1);
	assert.equal(h.pending()[0].delay, 5000);
	await h.pending()[0].callback();
	assert.equal(h.requests.length, 2);
	assert.equal(h.pending().length, 1);
	assert.deepEqual(h.requests[0], {
		profile: "API",
		url: "https://api.telegram.org/bot123:synthetic-token/getUpdates",
		method: "POST",
		responseType: "json",
		throwHttpErrors: false,
		json: { offset: 1, allowed_updates: ["message", "callback_query"]}
	});
});

test("server and transport errors are handled, back off to a minute and reset on recovery", async t => {
	const h = harness(t);
	for (const delay of [10000, 20000, 40000, 60000, 60000]) {
		h.replies.push({ statusCode: 502, body: { ok: false, description: "Bad Gateway" } });
		await h.telegram.connect();
		assert.equal(h.pending()[0].delay, delay);
	}
	assert.equal(h.logs.length, 5);
	await h.telegram.connect();
	assert.equal(h.pending()[0].delay, 5000);
	h.replies.push(new Error("Synthetic timeout"));
	await h.telegram.connect();
	assert.equal(h.pending()[0].delay, 10000);
	assert.equal(h.logs.length, 6);
});

test("rate limits honor retry_after, conflicts wait and malformed responses are handled", async t => {
	const h = harness(t);
	h.replies.push({ statusCode: 429, body: { ok: false, parameters: { retry_after: 90 } } });
	await h.telegram.connect();
	assert.equal(h.pending()[0].delay, 90000);
	await h.telegram.connect();
	h.replies.push({ statusCode: 409, body: { ok: false } });
	await h.telegram.connect();
	assert.equal(h.pending()[0].delay, 30000);
	await h.telegram.connect();
	h.replies.push({ statusCode: 502 });
	await h.telegram.connect();
	assert.equal(h.pending()[0].delay, 10000);
	for (const retryAfter of [-1, "90", Infinity]) {
		await h.telegram.connect();
		h.replies.push({ statusCode: 429, body: { ok: false, parameters: { retry_after: retryAfter } } });
		await h.telegram.connect();
		assert.equal(h.pending()[0].delay, 10000);
	}
});

test("destroy cancels polling and ignores an outstanding response", async t => {
	const h = harness(t);
	await h.telegram.connect();
	let resolve;
	h.replies.push(new Promise(done => {
		resolve = done;
	}));
	const poll = h.telegram.connect();
	h.telegram.destroy();
	resolve({ statusCode: 200, body: { ok: true, result: [{ update_id: 99 }]} });
	await poll;
	assert.equal(h.telegram.lastUpdatedId, 0);
	assert.equal(h.pending().length, 0);
	await h.telegram.connect();
	assert.equal(h.requests.length, 2);
});

test("interactive redemption receives the next update without overlapping or replaying callbacks", async t => {
	const h = harness(t);
	const sent = [];
	const redeemed = [];
	h.telegram.send = async message => sent.push(message);
	app.HoyoLab = { redeemCode: async (...args) => {
		redeemed.push(args);
		return { success: true };
	} };
	await h.telegram.connect();
	h.replies.push({ statusCode: 200,
		body: { ok: true,
			result: [
				{ update_id: 10, callback_query: { data: "redeem:tot:123", from: { id: 42 } } }
			]} });
	await h.telegram.connect();
	assert.equal(h.telegram.handlingCallbackQuery, true);
	assert.equal(h.telegram.messageListeners.length, 1);
	assert.equal(h.pending().length, 1);
	h.replies.push({ statusCode: 200,
		body: { ok: true,
			result: [
				{ update_id: 11, message: { from: { id: 42 }, text: "SYNTHETIC-CODE" } }
			]} });
	await h.telegram.connect();
	assert.equal(h.requests.at(-1).json.offset, 11);
	assert.deepEqual(redeemed, [["tot", "123", "SYNTHETIC-CODE"]]);
	assert.equal(h.telegram.handlingCallbackQuery, false);
	assert.equal(h.telegram.messageListeners.length, 0);
	assert.equal(h.telegram.lastUpdatedId, 11);
	assert.equal(sent.length, 2);
	await h.telegram.connect();
	assert.equal(h.requests.at(-1).json.offset, 12);
	assert.equal(redeemed.length, 1);
});

test("callback errors are handled locally without stopping polls or logging raw errors", async t => {
	const h = harness(t);
	await h.telegram.connect();
	h.telegram.handleMessage = async () => {
		throw new Error("synthetic-secret");
	};
	h.replies.push({ statusCode: 200,
		body: { ok: true,
			result: [
				{ update_id: 10, callback_query: {} }
			]} });
	await h.telegram.connect();
	assert.equal(h.logs.length, 1);
	assert.doesNotMatch(JSON.stringify(h.logs), /synthetic-secret/);
	assert.equal(h.pending()[0].delay, 5000);
});
