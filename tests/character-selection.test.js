const assert = require("node:assert/strict");
const { test } = require("node:test");
const { createRedemptionHarness } = require("./helpers/http.js");
const { ROLE_URL, normalizeCharacter, selectCharacter } = require("../hoyolab-modules/character-selection.js");
const HoyoLab = require("../hoyolab-modules/template.js");
const games = [
	{ path: "genshin", id: 2, name: "genshin", biz: "hk4e_global", region: "os_euro" },
	{ path: "starrail", id: 6, name: "starrail", biz: "hkrpg_global", region: "prod_official_eur" },
	{ path: "zenless", id: 8, name: "nap", biz: "nap_global", region: "prod_gf_eu" }
];
const cookie = "ltoken_v2=synthetic-token; ltuid_v2=123; ltmid_v2=synthetic-mid; cookie_token_v2=synthetic-cookie; account_mid_v2=synthetic-account-mid; account_id_v2=123; _MHYUUID=synthetic-device";
const setup = async t => {
	const h = await createRedemptionHarness(t, { language: "it-it" });
	app.Error = class extends Error {
		constructor ({ message }) {
			super(message);
		}
	};
	for (const name of ["info", "warn", "log"]) {
		app.Logger[name] = (...args) => h.logs.push(args);
	}
	app.Date = { now: () => Date.now() };
	app.HoyoLab = { getRegion: () => "EU", parseCookie: HoyoLab.parseCookie, errorMessage: () => "Synthetic error", isExpiredLogin: () => false };
	const list = [...HoyoLab.list];
	t.after(() => {
		HoyoLab.list = list;
	});
	return h;
};
const entry = character => ({ cookie,
	character,
	redeemCode: true,
	stamina: { check: false, threshold: 100, persistent: false },
	realm: { check: false, persistent: false } });
const card = game => ({ body: { retcode: 0, data: { list: [{ game_id: game.id, game_role_id: "111", region: "other_region", nickname: "First card", level: 10, logo: "https://example.invalid/logo.png" }]} } });
const role = game => ({ game_biz: game.biz, game_uid: "222", region: game.region, nickname: "Selected character", level: 30 });
const roles = list => ({ body: { retcode: 0, data: { list } } });

for (const game of games) {
	test(`${game.name} selects a verified character absent from the card and redeems for that character`, async t => {
		const { replies, requests } = await setup(t);
		const Game = require(`../hoyolab-modules/${game.path}/index.js`);
		const character = { uid: "222", region: game.region };
		const controller = new Game({ id: 1, data: [entry(character)]});
		replies.push(card(game), roles([{ ...role(game), game_uid: "333" }, role(game)]), { body: { retcode: 0 } });
		await controller.login();
		const [account] = controller.accounts;
		assert.equal(account.uid, "222");
		assert.equal(account.region, game.region);
		assert.equal(account.nickname, "Selected character");
		assert.equal(account.level, 30);
		assert.equal(account.assets.logo, "https://example.invalid/logo.png");
		assert.deepEqual(account.character, character);
		assert.equal(requests[1].url.origin + requests[1].url.pathname, ROLE_URL);
		assert.deepEqual(Object.fromEntries(requests[1].url.searchParams), { game_biz: game.biz, region: game.region });
		assert.equal(requests[1].headers.ds, undefined);
		assert.equal(requests[1].headers.origin, "https://act.hoyolab.com");
		assert.equal((await controller.redeemCode(account, "SYNTHETICCODE")).success, true);
		const sent = game.name === "genshin" ? Object.fromEntries(requests[2].url.searchParams) : JSON.parse(requests[2].body);
		assert.equal(sent.uid, "222");
		assert.equal(sent.region, game.region);
	});

	test(`${game.name} preserves legacy selection without an extra request`, async t => {
		const { replies, requests } = await setup(t);
		const Game = require(`../hoyolab-modules/${game.path}/index.js`);
		const controller = new Game({ id: 1, data: [entry(undefined)]});
		replies.push(card(game));
		await controller.login();
		assert.equal(controller.accounts[0].uid, "111");
		assert.equal(requests.length, 1);
	});

	test(`${game.name} rejects a missing selected character without fallback`, async t => {
		const { replies, requests } = await setup(t);
		const Game = require(`../hoyolab-modules/${game.path}/index.js`);
		const controller = new Game({ id: 1, data: [entry({ uid: "222", region: game.region })]});
		replies.push(card(game), roles([{ ...role(game), region: "wrong_region" }]));
		await assert.rejects(controller.login(), /selected character was not found/);
		assert.equal(controller.accounts.length, 0);
		assert.equal(requests.length, 2);
	});
}

for (const value of [{}, [], "222", { uid: 222, region: "os_euro" }, { uid: "222" }, { uid: "222", region: "" }, { uid: "222", region: "os_euro&uid=1" }, { uid: "0", region: "os_euro" }]) {
	test(`invalid character configuration is rejected: ${JSON.stringify(value)}`, async t => {
		const { requests } = await setup(t);
		assert.throws(() => normalizeCharacter(value, "genshin"), /Invalid character selection/);
		assert.equal(requests.length, 0);
	});
}

test("explicit selection is rejected for unsupported games", async t => {
	await setup(t);
	assert.throws(() => normalizeCharacter({ uid: "222", region: "os_euro" }, "tot"), /Invalid character selection/);
});

for (const reply of [{ statusCode: 503 }, { body: { retcode: -100, message: cookie } }, { body: { retcode: 0, data: null } }, roles([role(games[0]), role(games[0])])]) {
	test("role verification failures do not leak responses or fall back to the card", async t => {
		const { replies, logs } = await setup(t);
		replies.push(reply);
		await assert.rejects(selectCharacter({ cookie, character: { uid: "222", region: "os_euro" } }, "genshin", {}), error => {
			assert.doesNotMatch(error.message, /synthetic-token|synthetic-cookie/);
			return true;
		});
		assert.doesNotMatch(JSON.stringify(logs), /synthetic-token|synthetic-cookie/);
	});
}


for (const hilichurl of [{ bindCharacter: true }, { bindCharacter: "true" }]) {
	test(`invalid Hilichurl binding settings are rejected: ${JSON.stringify(hilichurl)}`, async t => {
		const { requests } = await setup(t);
		const Genshin = require("../hoyolab-modules/genshin/index.js");
		assert.throws(() => new Genshin({ id: 1, data: [{ ...entry(undefined), hilichurl }]}), /binding requires|must be a boolean/);
		assert.equal(requests.length, 0);
	});
}
