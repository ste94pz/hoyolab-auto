const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { test } = require("node:test");
const { createHttpHarness } = require("./helpers/http.js");
const { signPassportBody } = require("../hoyolab-modules/passport-request.js");
const HoyoLab = require("../hoyolab-modules/template.js");

const cookie = "stoken=synthetic-no-prefix; mid=synthetic-mid";
const tokens = [{ token_type: 2, token: "new-ltoken" }, { token_type: 4, token: "new-cookie-token" }];
const setup = async t => {
	const harness = await createHttpHarness(t, { language: "it-it" });
	app.Logger.log = (...args) => harness.logs.push(args);
	app.Logger.warn = (...args) => harness.logs.push(args);
	const saved = new Map();
	app.Cache = { set: async ({ key, value }) => saved.set(key, value) };
	return { ...harness, saved };
};
const platform = { webAPI: HoyoLab.webAPI, fullName: "Synthetic Game", name: "test" };
const update = (account = { refreshCookie: cookie }) => HoyoLab.prototype.updateCookie.call(platform, account);

// Fixed synthetic vector computed independently with Python hashlib, no capture credentials.
test("Passport body-aware signature fixed vector and nonce alphabet", t => {
	assert.equal(signPassportBody("{\"dst_token_types\":[2,4]}", { timestamp: 1700000000, nonce: "aZ190x" }),
		"1700000000,aZ190x,5593753f1b415a11fd2540616bf4ba48");
	assert.equal(signPassportBody("{}", { timestamp: 1, nonce: "abc123" }), "1,abc123,7cf3ea8c65a7bc1fa3c8b73dc143db27");
	t.mock.method(Date, "now", () => 1700000000123);
	t.mock.method(crypto, "randomInt", max => max - 1);
	assert.match(signPassportBody("{}"), /^1700000000,000000,[a-f0-9]{32}$/);
	assert.notEqual(signPassportBody("{}", { timestamp: 1, nonce: "aA1230" }), signPassportBody("{ }", { timestamp: 1, nonce: "aA1230" }));
});

test("refresh signs exact wire body using Passport identity and SG fallback", async t => {
	const { requests, replies } = await setup(t);
	t.mock.method(Date, "now", () => 1700000000000);
	replies.push({ body: { retcode: 0, data: { tokens } } });
	assert.deepEqual(await update(), { success: true, data: { ltoken_v2: "new-ltoken", cookie_token_v2: "new-cookie-token" } });
	const [request] = requests;
	assert.equal(request.url.href, "https://sg-public-api.hoyoverse.com/account/ma-passport/token/getBySToken");
	assert.equal(request.method, "POST");
	assert.equal(request.body, "{\"dst_token_types\":[2,4]}");
	const [timestamp, nonce, hash] = request.headers.ds.split(",");
	assert.match(nonce, /^[a-zA-Z0-9]{6}$/);
	assert.equal(timestamp, "1700000000");
	assert.equal(hash, crypto.createHash("md5").update(`salt=IZPgfb0dRPtBeLuFkdDznSZ6f4wWt6y2&t=${timestamp}&r=${nonce}&b=${request.body}&q=`).digest("hex"));
	assert.equal(request.headers.cookie, cookie);
	assert.equal(request.headers["x-rpc-app_id"], "c9oqaq3s3gu8");
	assert.equal(request.headers["x-rpc-client_type"], 2);
	assert.equal(request.headers["x-rpc-language"], "it-it");
	assert.equal(request.headers["x-rpc-sdk_version"], "2.3.0");
	assert.equal(request.headers["x-rpc-game_biz"], "bbs_oversea");
	assert.equal(request.headers["x-rpc-package_name"], "com.mihoyo.hoyolab");
	assert.equal(request.headers["user-agent"], "okhttp/4.12.0");
	assert.equal(request.headers["content-type"], "application/json");
	assert.equal(Number(request.headers["content-length"]), Buffer.byteLength(request.body));
	for (const name of ["origin", "referer", "x-requested-with", "x-rpc-device_id", "x-rpc-device_fp", "x-rpc-age_gate", "x-rpc-aigis_v4", "x-rpc-aigis", "x-rpc-platform", "x-rpc-lang", "x-rpc-env"]) {
		assert.equal(request.headers[name], undefined);
	}
});

test("query middleware cannot change Passport's empty signed q", async t => {
	const { Got, requests } = await setup(t);
	await Got("HoYoLabPassport", {
		url: `${HoyoLab.webAPI}?lrsag=synthetic`,
		method: "POST",
		body: "{\"dst_token_types\":[2,4]}",
		hooks: { beforeRequest: [(options) => {
			options.headers.ds = signPassportBody(options.body, { timestamp: 1, nonce: "abc123" });
			options.url.searchParams.set("other", "synthetic");
		}]}
	});
	assert.equal(requests[0].headers.ds, signPassportBody(requests[0].body, { timestamp: 1, nonce: "abc123" }));
});

test("missing stoken and HTTP, retcode, malformed or partial token responses fail", async t => {
	const { replies, requests } = await setup(t);
	assert.equal((await update({})).success, false);
	assert.equal(requests.length, 0);
	for (const reply of [
		{ statusCode: 503 },
		{ body: { retcode: -1, message: "Synthetic refusal" } },
		{ body: { retcode: 0 } },
		{ body: { retcode: 0, data: { tokens: [tokens[0]]} } },
		{ body: { retcode: 0, data: { tokens: [tokens[1]]} } }
	]) {
		replies.push(reply);
		assert.equal((await update()).success, false);
	}
});

test("refresh deduplicates accounts and updates all cookies only after both tokens arrive", async t => {
	const { requests, replies, saved } = await setup(t);
	const previousList = HoyoLab.list;
	t.after(() => {
		HoyoLab.list = previousList;
	});
	const oldCookie = "ltuid_v2=123; ltmid_v2=mid; ltoken_v2=old; cookie_token_v2=old; _MHYUUID=synthetic-browser; stoken=synthetic";
	const makeAccount = preference => ({ ltuid: "123", refreshCookie: cookie, cookie: oldCookie, redeemCode: false, redeemCodeConfigured: preference });
	const first = makeAccount(true);
	const second = makeAccount(false);
	const selected = makeAccount(true);
	HoyoLab.list = [
		{ data: [first], accounts: [selected], updateCookie: update },
		{ data: [second], accounts: [], updateCookie: update }
	];
	replies.push({ body: { retcode: 0, data: { tokens: [tokens[0]]} } });
	assert.equal((await HoyoLab.refreshCookieAccounts())[0].success, false);
	assert.equal(saved.size, 0);
	for (const account of [first, second, selected]) {
		assert.equal(account.cookie, oldCookie);
		assert.equal(account.redeemCode, false);
	}
	replies.push({ body: { retcode: 0, data: { tokens } } });
	assert.equal((await HoyoLab.refreshCookieAccounts())[0].success, true);
	assert.equal(requests.length, 2);
	for (const account of [first, second, selected]) {
		assert.match(account.cookie, /ltoken_v2=new-ltoken/);
		assert.match(account.cookie, /cookie_token_v2=new-cookie-token/);
		assert.match(account.cookie, /stoken=synthetic/);
		assert.match(account.cookie, /_MHYUUID=synthetic-browser/);
		assert.equal(account.redeemCode, account.redeemCodeConfigured);
	}
});

const deferred = () => {
	let resolve;
	const promise = new Promise(done => {
		resolve = done;
	});
	return { promise, resolve };
};

const registerAccounts = (t, updateCookie, ids = ["123"]) => {
	const previousList = HoyoLab.list;
	t.after(() => {
		HoyoLab.list = previousList;
	});
	const data = ids.map(ltuid => ({
		ltuid,
		refreshCookie: cookie,
		cookie: `ltuid_v2=${ltuid}; ltmid_v2=mid; ltoken_v2=old; cookie_token_v2=old`
	}));
	const selected = { ...data[0] };
	HoyoLab.list = [{ data, accounts: [selected], updateCookie }];
	return { data, selected };
};

test("cron and on-demand refresh share one request through propagation and timestamp recording", async t => {
	const { requests, replies, logs, saved } = await setup(t);
	const started = deferred();
	const response = deferred();
	const saving = deferred();
	const finishSaving = deferred();
	const { data, selected } = registerAccounts(t, async account => {
		const result = await update(account);
		started.resolve();
		await response.promise;
		return result;
	});
	const duplicate = { ...data[0] };
	HoyoLab.list.push({ data: [duplicate], accounts: [], updateCookie: HoyoLab.list[0].updateCookie });
	app.HoyoLab = HoyoLab;
	app.Platform = { getForAccount: () => []};
	const save = app.Cache.set;
	app.Cache.set = async entry => {
		saving.resolve();
		await finishSaving.promise;
		return save(entry);
	};
	replies.push({ body: { retcode: 0, data: { tokens } } });
	const oldCookie = data[0].cookie;
	const cronRun = require("../crons/update-cookie/index.js").code();
	const onDemand = HoyoLab.refreshStoredCookies(oldCookie);
	await started.promise;
	assert.equal(requests.length, 1);
	assert.equal(selected.cookie, oldCookie);
	response.resolve();
	await saving.promise;
	const duringSave = HoyoLab.refreshCookieAccounts(oldCookie);
	assert.equal(requests.length, 1);
	finishSaving.resolve();
	const [, success, results] = await Promise.all([cronRun, onDemand, duringSave]);
	assert.equal(success, true);
	assert.equal(results[0].success, true);
	assert.equal(requests.length, 1);
	for (const account of [...data, selected, duplicate]) {
		assert.match(account.cookie, /ltoken_v2=new-ltoken/);
		assert.match(account.cookie, /cookie_token_v2=new-cookie-token/);
	}
	assert.equal(saved.size, 1);
	const timestamp = saved.get("hoyolab:cookie-refresh:123:last-success");
	assert.equal(new Date(timestamp).toISOString(), timestamp);
	const successes = logs.filter(([, message]) => typeof message === "string" && message.includes(timestamp));
	assert.equal(successes.length, 1);
	assert.match(successes[0][1], /123/);
	assert.doesNotMatch(JSON.stringify([...logs, ...saved]), /synthetic|new-ltoken|new-cookie-token|ltoken_v2=|stoken=/);

	// A later call starts a new refresh rather than reusing a settled promise.
	replies.push({ body: { retcode: 0, data: { tokens } } });
	assert.equal(await HoyoLab.refreshStoredCookies(oldCookie), true);
	assert.equal(requests.length, 2);
});

test("different accounts can refresh independently while one request is pending", async t => {
	const { saved } = await setup(t);
	const started = deferred();
	const release = deferred();
	const calls = [];
	const { data } = registerAccounts(t, async account => {
		calls.push(account.ltuid);
		if (account.ltuid === "123") {
			started.resolve();
			await release.promise;
		}
		return { success: true, data: { ltoken_v2: "new-ltoken", cookie_token_v2: "new-cookie-token" } };
	}, ["123", "456"]);
	const first = HoyoLab.refreshStoredCookies(data[0].cookie);
	await started.promise;
	assert.equal(await HoyoLab.refreshStoredCookies(data[1].cookie), true);
	assert.deepEqual(calls, ["123", "456"]);
	assert.equal(saved.has("hoyolab:cookie-refresh:123:last-success"), false);
	assert.equal(saved.has("hoyolab:cookie-refresh:456:last-success"), true);
	release.resolve();
	assert.equal(await first, true);
});

for (const throws of [false, true]) {
	test(`Concurrent refresh ${throws ? "exceptions" : "refusals"} preserve the last success and allow retry`, async t => {
		const { saved } = await setup(t);
		const started = deferred();
		const release = deferred();
		let calls = 0;
		const { data, selected } = registerAccounts(t, async () => {
			calls++;
			if (calls === 1) {
				started.resolve();
				await release.promise;
				if (throws) {
					throw new Error("Synthetic transport failure");
				}
				return { success: false, reason: "Synthetic refusal" };
			}
			return { success: true, data: { ltoken_v2: "new-ltoken", cookie_token_v2: "new-cookie-token" } };
		});
		const key = "hoyolab:cookie-refresh:123:last-success";
		saved.set(key, "2026-01-01T00:00:00.000Z");
		const oldCookie = data[0].cookie;
		const first = HoyoLab.refreshStoredCookies(oldCookie);
		await started.promise;
		const second = HoyoLab.refreshStoredCookies(oldCookie);
		release.resolve();
		assert.deepEqual(await Promise.all([first, second]), [false, false]);
		assert.equal(calls, 1);
		assert.equal(selected.cookie, oldCookie);
		assert.equal(data[0].cookie, oldCookie);
		assert.equal(saved.get(key), "2026-01-01T00:00:00.000Z");
		assert.equal(await HoyoLab.refreshStoredCookies(oldCookie), true);
		assert.equal(calls, 2);
		assert.notEqual(saved.get(key), "2026-01-01T00:00:00.000Z");
	});
}

test("timestamp storage failure preserves successful refresh and releases the account", async t => {
	const { requests, replies, logs } = await setup(t);
	const { data } = registerAccounts(t, update);
	app.Cache.set = async () => {
		throw new Error("synthetic-sensitive-cache-error");
	};
	for (let i = 0; i < 2; i++) {
		replies.push({ body: { retcode: 0, data: { tokens } } });
		assert.equal(await HoyoLab.refreshStoredCookies(data[0].cookie), true);
	}
	assert.equal(requests.length, 2);
	assert.match(data[0].cookie, /ltoken_v2=new-ltoken/);
	assert.equal(logs.filter(([, message]) => /Could not save/.test(message)).length, 2);
	assert.doesNotMatch(JSON.stringify(logs), /synthetic-sensitive-cache-error/);
});
