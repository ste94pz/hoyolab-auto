const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

const source = fs.readFileSync(path.join(__dirname, "../services/google-script/index.js"), "utf8");
const cookie = "ltuid_v2=123; ltoken_v2=synthetic; cookie_token_v2=synthetic-cookie; _MHYUUID=synthetic-browser";
const games = [
	{ name: "genshin", id: 2, route: "sol", signgame: "hk4e", region: "os_euro", biz: "hk4e_global", origin: "https://genshin.hoyoverse.com" },
	{ name: "starrail", id: 6, route: "luna/hkrpg/os", signgame: "hkrpg", region: "prod_official_eur", biz: "hkrpg_global", origin: "https://hsr.hoyoverse.com" },
	{ name: "zenless", id: 8, route: "luna/zzz/os", signgame: "zzz", region: "prod_gf_eu", biz: "nap_global", origin: "https://zenless.hoyoverse.com" },
	{ name: "honkai", id: 1, route: "mani", signgame: "bh3", region: "eur01" }
];
const plain = value => JSON.parse(JSON.stringify(value));
const signInfo = (isSigned = false, extra = {}) => ({ retcode: 0, data: { is_sign: isSigned, total_sign_day: isSigned ? 1 : 0, today: "2026-10-21", ...extra } });
const home = { retcode: 0, data: { awards: [{ name: "Synthetic reward", cnt: 5, icon: "https://example.invalid/icon" }]} };
const card = game => ({ retcode: 0, data: { list: [{ game_id: game.id, game_role_id: "456", nickname: "Synthetic player", level: 20, region: game.region }]} });

// Execute the standalone Apps Script in its own realm with no network API.
const setup = (game, language = undefined, configuredCookie = cookie) => {
	const requests = [];
	const replies = [];
	const properties = new Map();
	const logs = [];
	const context = vm.createContext({
		console: Object.fromEntries(["log", "info", "warn", "error"].map(level => [level, (...args) => logs.push(args)])),
		PropertiesService: { getScriptProperties: () => ({
			getProperty: key => properties.get(key) ?? null,
			setProperty: (key, value) => properties.set(key, value),
			deleteProperty: key => properties.delete(key)
		}) },
		Utilities: {
			DigestAlgorithm: { MD5: "md5", SHA_256: "sha256" },
			computeDigest: (algorithm, input) => [...crypto.createHash(algorithm).update(input).digest()],
			sleep: () => {}
		},
		UrlFetchApp: { fetch: (url, options = {}) => {
			requests.push({ url: new URL(url), options: plain(options) });
			assert.ok(replies.length, "Unexpected Apps Script HTTP request");
			const { body = { retcode: 0 }, status = 200, text, error } = replies.shift();
			if (error) {
				throw error;
			}
			return { getResponseCode: () => status, getContentText: () => text ?? JSON.stringify(body) };
		} }
	});
	vm.runInContext(source, context);
	context.testLanguage = language;
	vm.runInContext("config.language = testLanguage; Date.now = () => 1700000000123; Math.random = () => 0;", context);
	const Game = vm.runInContext("Game", context);
	return { game: new Game(game.name, { data: [configuredCookie]}), context, requests, replies, properties, logs };
};

for (const game of games) {
	for (const language of [undefined, "it-it", "ja-jp"]) {
		test(`Apps Script ${game.name}: discovery and confirmed check-in (${language ?? "default"})`, async () => {
			const { game: instance, replies, requests, context } = setup(game, language);
			replies.push({ body: card(game) }, { body: signInfo() }, { body: home }, { body: { retcode: 0 } }, { body: signInfo(true) });
			const results = await instance.checkAndExecute();
			assert.equal(results.length, 1);
			assert.equal(results[0].total, 1);
			assert.equal(results[0].account.uid, "456");
			assert.equal(instance.redemptionAccounts.length, 1);
			assert.equal(vm.runInContext("config.language", context), language);
			assert.equal(requests.length, 5);
			const [discovery, info, awards, sign, confirmation] = requests;
			const locale = language || "en-us";
			assert.equal(discovery.url.origin, "https://sg-act-public-api.hoyolab.com");
			assert.equal(discovery.url.pathname, `${["honkai", "zenless"].includes(game.name) ? "" : "/event"}/game_record/card/wapi/getGameRecordCard`);
			assert.deepEqual(Object.fromEntries(discovery.url.searchParams), { uid: "123" });
			const rpc = discovery.options.headers;
			assert.equal(rpc["x-rpc-language"], locale);
			assert.equal(rpc["x-rpc-client_type"], game.name === "zenless" ? undefined : "5");
			assert.equal(rpc["x-rpc-app_version"], game.name === "zenless" ? "4.21.0" : "1.5.0");
			assert.equal(rpc["x-rpc-platform"], game.name === "honkai" ? undefined : (game.name === "zenless" ? "2" : "4"));
			assert.equal(rpc["x-rpc-lang"], ["genshin", "zenless"].includes(game.name) ? locale : undefined);
			assert.equal(rpc["x-rpc-env"], game.name === "genshin" ? "default" : undefined);
			assert.equal(rpc["x-requested-with"], game.name === "zenless" ? "com.mihoyo.hoyolab" : undefined);
			if (["starrail", "honkai"].includes(game.name)) {
				const expected = crypto.createHash("md5").update("salt=6s25p5ox5y14umn1p61aqyyvbvvl3lrt&t=1700000000&r=aaaaaa").digest("hex");
				assert.equal(rpc.DS, `1700000000,aaaaaa,${expected}`);
			}
			else {
				assert.equal(rpc.DS, undefined);
			}
			for (const [request, operation] of [[info, "info"], [awards, "home"], [sign, "sign"], [confirmation, "info"]]) {
				assert.equal(request.url.origin, "https://sg-act-public-api.hoyolab.com");
				assert.equal(request.url.pathname, `/event/${game.route}/${operation}`);
				const headers = request.options.headers;
				assert.equal(headers.Cookie, cookie);
				assert.equal(headers.Origin, "https://act.hoyolab.com");
				assert.equal(headers.Referer, "https://act.hoyolab.com/");
				assert.equal(headers["x-rpc-signgame"], game.signgame);
				assert.equal(headers.DS, undefined);
				assert.equal(headers["x-rpc-language"], undefined);
				assert.equal(headers["x-requested-with"], game.name === "genshin" ? undefined : "com.mihoyo.hoyolab");
				assert.match(headers["User-Agent"], game.name === "genshin" ? /Windows/ : /Android.*wv.*miHoYoBBSOversea\/4\.21\.0/);
				const post = operation === "sign";
				const bodyLanguage = ["starrail", "zenless"].includes(game.name);
				assert.deepEqual(Object.fromEntries(request.url.searchParams), post
					? (bodyLanguage ? {} : { lang: locale })
					: { act_id: instance.config.ACT_ID, lang: locale });
				if (post) {
					assert.equal(request.options.method, "POST");
					assert.equal(request.options.contentType, "application/json");
					assert.deepEqual(JSON.parse(request.options.payload), { act_id: instance.config.ACT_ID, ...(bodyLanguage ? { lang: locale } : {}) });
					assert.equal(headers["x-rpc-platform"], bodyLanguage ? "2" : (game.name === "genshin" ? "4" : undefined));
					assert.equal(headers["x-rpc-client_type"], bodyLanguage ? "5" : undefined);
					assert.equal(headers["x-rpc-app_version"], bodyLanguage ? "4.21.0" : undefined);
				}
			}
		});
	}

	for (const failure of [signInfo(false), signInfo(true, { today: "2026-10-22" }), signInfo(true, { today: undefined }), { retcode: -1 }]) {
		test(`Apps Script ${game.name}: unconfirmed claim produces no success (${JSON.stringify(failure)})`, async () => {
			const { game: instance, replies, requests } = setup(game);
			replies.push({ body: card(game) }, { body: signInfo() }, { body: home }, { body: { retcode: 0 } }, { body: failure });
			assert.deepEqual(plain(await instance.checkAndExecute()), []);
			assert.equal(requests.length, 5);
		});
	}

	test(`Apps Script ${game.name}: already signed skips claim and keeps redemption account`, async () => {
		const { game: instance, replies, requests } = setup(game);
		replies.push({ body: card(game) }, { body: signInfo(true) });
		assert.deepEqual(plain(await instance.checkAndExecute()), []);
		assert.equal(requests.length, 2);
		assert.equal(instance.redemptionAccounts.length, 1);
	});

	for (const response of [{ status: 403 }, { body: { retcode: -5003 } }]) {
		test(`Apps Script ${game.name}: failed sign is not confirmed or reported as success (${JSON.stringify(response)})`, async () => {
			const { game: instance, replies, requests } = setup(game);
			replies.push({ body: card(game) }, { body: signInfo() }, { body: home }, response);
			assert.deepEqual(plain(await instance.checkAndExecute()), []);
			assert.equal(requests.length, 4);
		});
	}
}

test("Apps Script keep-alive uses updated status reads only and deduplicates cookies", async () => {
	const { context, replies, requests } = setup(games[0], "it-it");
	context.testCookie = cookie;
	vm.runInContext("for (const name of ['genshin', 'honkai', 'starrail', 'zenless']) config[name].data = [testCookie, testCookie];", context);
	replies.push(...games.map(() => ({ body: signInfo() })));
	await vm.runInContext("keepAliveCookies()", context);
	assert.equal(requests.length, 4);
	assert.deepEqual(requests.map(({ url }) => url.pathname).sort(), games.map(game => `/event/${game.route}/info`).sort());
	for (const { url, options } of requests) {
		assert.equal(url.origin, "https://sg-act-public-api.hoyolab.com");
		assert.equal(url.searchParams.get("lang"), "it-it");
		assert.equal(options.payload, undefined);
		assert.equal(options.headers.DS, undefined);
	}
});

for (const game of games.filter(game => game.biz)) {
	for (const language of [undefined, "it-it"]) {
		test(`Apps Script ${game.name}: browser redemption (${language ?? "default"})`, async () => {
			const { game: instance, replies, requests } = setup(game, language);
			replies.push({ body: { retcode: 0 } });
			assert.equal((await instance.redeemCode({ uid: "456", region: "EU", cookie }, "CODE&+?")).success, true);
			const [{ url, options }] = requests;
			const headers = options.headers;
			const genshin = game.name === "genshin";
			assert.equal(url.origin, `https://public-operation-${{ genshin: "hk4e", starrail: "hkrpg", zenless: "nap" }[game.name]}.hoyoverse.com`);
			assert.equal(url.pathname, `/common/apicdkey/api/webExchangeCdkey${genshin ? "" : "Risk"}`);
			assert.equal(headers.Origin, game.origin);
			assert.equal(headers.Referer, `${game.origin}/`);
			assert.equal(headers.Cookie, cookie);
			assert.equal(headers.DS, undefined);
			assert.equal(headers["x-requested-with"], undefined);
			assert.deepEqual(Object.keys(headers).filter(key => key.startsWith("x-rpc-")), []);
			const params = { uid: "456", region: game.region, cdkey: "CODE&+?", game_biz: game.biz, lang: language ? "it" : "en" };
			if (genshin) {
				assert.equal(options.method, "GET");
				assert.equal(options.payload, undefined);
				assert.deepEqual(Object.fromEntries(url.searchParams), { ...params, sLangKey: "en-us" });
			}
			else {
				assert.equal(url.search, "");
				assert.equal(options.method, "POST");
				assert.equal(options.contentType, "application/json");
				assert.deepEqual(JSON.parse(options.payload), { t: 1700000000123, ...params, platform: "4", device_uuid: "synthetic-browser" });
			}
		});
	}

	for (const [retcode, retryable, authenticationFailed] of [[-2001, false, false], [-2017, false, false], [-2016, true, false], [-1071, true, true]]) {
		test(`Apps Script ${game.name}: redemption outcome ${retcode} preserves retry policy`, async () => {
			const { game: instance, replies } = setup(game);
			replies.push({ body: { retcode, message: "Synthetic failure" } });
			const result = await instance.redeemCode({ uid: "456", region: "EU", cookie }, "CODE");
			assert.equal(result.success, false);
			assert.equal(result.retryable, retryable);
			assert.equal(result.authenticationFailed, authenticationFailed);
		});
	}
}

for (const game of games.filter(game => ["starrail", "zenless"].includes(game.name))) {
	test(`Apps Script ${game.name}: missing browser identity makes no request or final code-cache entry`, async () => {
		const noDeviceCookie = cookie.replace(/; _MHYUUID=[^;]+/, "");
		const { game: instance, requests, properties } = setup(game, "it-it", noDeviceCookie);
		instance.fetchCodes = async () => [{ code: "CODE", rewards: []}];
		const [result] = await instance.redeemCodes({ uid: "456", region: "EU", cookie: noDeviceCookie });
		assert.equal(result.success, false);
		assert.equal(result.retryable, true);
		assert.match(result.message, /_MHYUUID/);
		assert.equal(requests.length, 0);
		assert.equal(properties.size, 0);
	});
}

for (const game of games.filter(game => game.biz)) {
	test(`Apps Script ${game.name}: manual redemption completes each account before starting the next`, async () => {
		const { context, replies, requests, logs } = setup(game, "it-it");
		context.testGameName = game.name;
		context.testCookie = cookie;
		vm.runInContext(`
			config[testGameName].data = [testCookie, testCookie];
			let active = 0;
			let maximumActive = 0;
			const events = [];
			Game.prototype.getAccountDetails = async () => {
				active++;
				maximumActive = Math.max(maximumActive, active);
				const uid = String(events.length + 1);
				events.push('start:' + uid);
				await Promise.resolve();
				return { uid, nickname: 'Player ' + uid, region: 'EU' };
			};
			Game.prototype.forceRedeemCodes = async function (account) {
				const result = await this.redeemCode(account, 'CODE');
				events.push('end:' + account.uid);
				active--;
				return [result];
			};
			buildCodeRedeemEmbed = () => null;
			postDiscordEmbeds = () => {};
		`, context);
		replies.push({ body: { retcode: 0 } }, { body: { retcode: 0 } });
		const results = await vm.runInContext("manuallyRedeemCodes(testGameName, true)", context);
		assert.equal(results.length, 2);
		assert.ok(results.every(result => result.success && result.results[0].success));
		assert.equal(vm.runInContext("maximumActive", context), 1);
		assert.deepEqual(plain(vm.runInContext("events", context)), ["start:1", "end:1", "start:3", "end:3"]);
		assert.equal(requests.length, 2);
		for (const uid of ["1", "3"]) {
			assert.ok(logs.flat().filter(value => typeof value === "string").some(value => value.includes(`(Player ${uid} - ${uid})`)));
		}
	});
}


const selectedRole = (game, uid = "999", region = game.region) => ({
	game_biz: game.biz, game_uid: uid, region, nickname: `Selected ${uid}`, level: 30
});
const roleReply = list => ({ body: { retcode: 0, data: { list } } });

for (const game of games.filter(game => game.biz)) {
	test(`Apps Script ${game.name}: verified selection reaches saved identity and redemption`, async () => {
		const character = { uid: "999", region: game.region };
		const { game: instance, replies, requests, properties } = setup(game, "it-it", { cookie, character });
		replies.push({ body: card(game) }, roleReply([selectedRole(game, "888"), selectedRole(game)]), { body: signInfo(true) }, { body: { retcode: 0 } });
		await instance.checkAndExecute();
		const [account] = instance.redemptionAccounts;
		assert.equal(account.uid, "999");
		assert.equal(account.server, game.region);
		assert.equal(account.region, "EU");
		assert.equal(account.nickname, "Selected 999");
		assert.equal(account.rank, 30);
		assert.deepEqual(JSON.parse(properties.get(`${game.name}_123_account_details`)), { uid: "999", nickname: "Selected 999", region: "EU", server: game.region });
		const roleRequest = requests[1];
		assert.equal(roleRequest.url.origin, "https://api-account-os.hoyolab.com");
		assert.equal(roleRequest.url.pathname, "/binding/api/getUserGameRolesByLtoken");
		assert.deepEqual(Object.fromEntries(roleRequest.url.searchParams), { game_biz: game.biz, region: game.region });
		assert.equal(roleRequest.options.method, "GET");
		assert.equal(roleRequest.options.headers.Cookie, cookie);
		assert.equal(roleRequest.options.headers.Origin, "https://act.hoyolab.com");
		assert.equal(roleRequest.options.headers.DS, undefined);
		assert.equal(roleRequest.options.payload, undefined);
		assert.equal((await instance.redeemCode(account, "CODE")).success, true);
		const request = requests[3];
		const sent = game.name === "genshin" ? Object.fromEntries(request.url.searchParams) : JSON.parse(request.options.payload);
		assert.equal(sent.uid, "999");
		assert.equal(sent.region, game.region);
		assert.equal(requests[2].url.searchParams.has("uid"), false);
		assert.doesNotMatch(JSON.stringify([...properties]), /synthetic-cookie|ltoken_v2/);
	});

	test(`Apps Script ${game.name}: scheduled redemption uses the configured character`, async () => {
		const { context, requests, replies, properties } = setup(game);
		context.testName = game.name;
		context.testEntry = { cookie, character: { uid: "999", region: game.region } };
		vm.runInContext("config[testName].data = [testEntry]; config.enableCodeRedemption = true;", context);
		replies.push({ body: card(game) }, roleReply([selectedRole(game)]), { body: signInfo(true) }, { body: { active: [{ code: "CODE", rewards: []}]} }, { body: { retcode: 0 } });
		await vm.runInContext("checkInGame(testName)", context);
		const request = requests[4];
		const sent = game.name === "genshin" ? Object.fromEntries(request.url.searchParams) : JSON.parse(request.options.payload);
		assert.equal(sent.uid, "999");
		assert.equal(sent.region, game.region);
		assert.equal(properties.get(`${game.name}_EU_999_redeemed_codes`), "[\"CODE\"]");
		assert.equal(properties.has(`${game.name}_EU_456_redeemed_codes`), false);
	});

	test(`Apps Script ${game.name}: manual redemption isolates two characters sharing a cookie`, async () => {
		const { context, requests, replies, properties } = setup(game);
		context.testName = game.name;
		context.testEntries = ["888", "999"].map(uid => ({ cookie, character: { uid, region: game.region } }));
		vm.runInContext("config[testName].data = testEntries; config.enableCodeRedemption = true;", context);
		const catalog = { body: { active: [{ code: "CODE", rewards: []}]} };
		replies.push({ body: card(game) }, roleReply([selectedRole(game, "888"), selectedRole(game)]), catalog, { body: { retcode: 0 } }, { body: card(game) }, roleReply([selectedRole(game, "888"), selectedRole(game)]), catalog, { body: { retcode: 0 } });
		const results = await vm.runInContext("manuallyRedeemCodes(testName)", context);
		assert.ok(results.every(result => result.success && result.results[0].success));
		assert.deepEqual(plain(results.map(result => result.account.uid)), ["888", "999"]);
		assert.equal(requests.length, 8);
		for (const [index, uid] of [[3, "888"], [7, "999"]]) {
			const sent = game.name === "genshin" ? Object.fromEntries(requests[index].url.searchParams) : JSON.parse(requests[index].options.payload);
			assert.equal(sent.uid, uid);
			assert.equal(sent.region, game.region);
			assert.equal(properties.get(`${game.name}_EU_${uid}_redeemed_codes`), "[\"CODE\"]");
		}
	});

	test(`Apps Script ${game.name}: selecting the legacy character preserves completed-code keys`, async () => {
		const { game: instance, replies, requests, properties } = setup(game, undefined, { cookie, character: { uid: "456", region: game.region } });
		properties.set(`${game.name}_EU_456_redeemed_codes`, "[\"CODE\"]");
		replies.push({ body: card(game) }, roleReply([selectedRole(game, "456")]), { body: signInfo(true) }, { body: { active: [{ code: "CODE", rewards: []}]} });
		await instance.checkAndExecute();
		assert.deepEqual(plain(await instance.redeemCodes(instance.redemptionAccounts[0])), []);
		assert.equal(requests.length, 4);
		assert.equal(properties.get(`${game.name}_EU_456_redeemed_codes`), "[\"CODE\"]");
	});
}

for (const failure of [
	{ status: 503 },
	{ body: { retcode: -100, message: cookie } },
	{ body: { retcode: 0, data: null } },
	roleReply([]),
	roleReply([selectedRole(games[0], "888")]),
	roleReply([selectedRole(games[0], "999", "os_usa")]),
	roleReply([{ ...selectedRole(games[0]), game_biz: "hkrpg_global" }]),
	roleReply([selectedRole(games[0]), selectedRole(games[0])]),
	roleReply([{ ...selectedRole(games[0]), nickname: "" }]),
	{ text: "invalid JSON" },
	{ error: new Error(`Transport failure with ${cookie}`) }
]) {
	test("Apps Script selection failure stops before check-in, catalog or redemption without leaking credentials", async () => {
		const { game: instance, replies, requests, properties, logs } = setup(games[0], undefined, { cookie, character: { uid: "999", region: "os_euro" } });
		const oldDetails = JSON.stringify({ uid: "456", nickname: "Legacy", region: "EU" });
		properties.set("genshin_123_account_details", oldDetails);
		replies.push({ body: card(games[0]) }, failure);
		assert.deepEqual(plain(await instance.checkAndExecute()), []);
		assert.equal(instance.redemptionAccounts.length, 0);
		assert.equal(requests.length, 2);
		assert.equal(properties.get("genshin_123_account_details"), oldDetails);
		assert.doesNotMatch(JSON.stringify([logs, [...properties]]), /synthetic-cookie|ltoken_v2|Transport failure/);
	});
}

for (const character of [undefined, null]) {
	test(`Apps Script account object preserves legacy discovery without a selection (${character})`, async () => {
		const { game: instance, replies, requests } = setup(games[0], undefined, { cookie, character });
		replies.push({ body: card(games[0]) }, { body: signInfo(true) });
		await instance.checkAndExecute();
		assert.equal(requests.length, 2);
		assert.equal(instance.redemptionAccounts[0].uid, "456");
	});
}

for (const entry of [null, [], {}, { cookie: "" }, { cookie, character: {} }, { cookie, character: { uid: 999, region: "os_euro" } }, { cookie, character: { uid: "999", region: "os_euro&uid=1" } }]) {
	test(`Apps Script rejects invalid account entries before requests (${JSON.stringify(entry)})`, () => {
		assert.throws(() => setup(games[0], undefined, entry), /Invalid Apps Script account|Invalid character selection/);
	});
}

test("Apps Script does not advertise character selection for Honkai Impact 3rd", () => {
	assert.throws(() => setup(games[3], undefined, { cookie, character: { uid: "999", region: "eur01" } }), /Invalid character selection/);
});

test("Apps Script keep-alive deduplicates legacy and object entries by cookie without role discovery", async () => {
	const { context, replies, requests } = setup(games[0]);
	context.testEntries = [cookie, { cookie, character: { uid: "999", region: "os_euro" } }, { cookie, character: { uid: "888", region: "os_usa" } }];
	vm.runInContext("config.genshin.data = testEntries;", context);
	replies.push({ body: signInfo(true) });
	await vm.runInContext("keepAliveCookies()", context);
	assert.equal(requests.length, 1);
	assert.equal(requests[0].url.pathname, "/event/sol/info");
	assert.equal(requests[0].options.headers.Cookie, cookie);
});

test("Apps Script keeps the exact verified server separate from display region", async () => {
	const game = games[0];
	const { game: instance, replies, requests } = setup(game, undefined, { cookie, character: { uid: "999", region: "os_future" } });
	replies.push({ body: card(game) }, roleReply([selectedRole(game, "999", "os_future")]), { body: signInfo(true) }, { body: { retcode: 0 } });
	await instance.checkAndExecute();
	const [account] = instance.redemptionAccounts;
	assert.equal(account.region, "Unknown");
	assert.equal(account.server, "os_future");
	assert.equal((await instance.redeemCode(account, "CODE")).success, true);
	assert.equal(requests[3].url.searchParams.get("region"), "os_future");
});


test("Apps Script keeps history and paused-code state distinct for servers without a display mapping", () => {
	const { game: instance, properties } = setup(games[0]);
	const first = { uid: "999", region: "Unknown", server: "os_future_a", cookie };
	const second = { ...first, server: "os_future_b" };
	instance.saveRedeemedCode("CODE", first);
	assert.deepEqual(plain(instance.getRedeemedCodes(second)), []);
	assert.notEqual(instance.getPausedCodesKey(first), instance.getPausedCodesKey(second));
	assert.equal(properties.has("genshin_os_future_a_999_redeemed_codes"), true);
});
