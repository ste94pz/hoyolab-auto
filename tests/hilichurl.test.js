const assert = require("node:assert/strict");
const { test } = require("node:test");
const { createRedemptionHarness } = require("./helpers/http.js");
const HoyoLab = require("../hoyolab-modules/template.js");
const Genshin = require("../hoyolab-modules/genshin/index.js");
const { REDEMPTION_URL } = require("../hoyolab-modules/genshin/redemption-request.js");

const cookie = "ltoken_v2=synthetic-token; ltmid_v2=synthetic-mid; ltuid_v2=synthetic-id; cookie_token_v2=synthetic-cookie; account_mid_v2=synthetic-account-mid; account_id_v2=synthetic-account-id";
const account = { uid: "synthetic-role", region: "os_euro", cookie: `${cookie}; unrelated=synthetic`, redeemCode: true };
const ok = (data = {}) => ({ body: { retcode: 0, data } });
const info = (point = 20) => ok({ act_list: [{ act_info: { game_id: 2, version_id: 999, point } }]});
const task = (task_id, task_type, status = 2) => ({ task_id, task_type, status, task_name: `Synthetic task ${task_id}`, point: 5 });
const shop = (items = []) => ok({ exchange_award_list: items });

const setup = async (t, language) => {
	const harness = await createRedemptionHarness(t, { language });
	for (const name of ["info", "warn", "log"]) {
		app.Logger[name] = (...args) => harness.logs.push(args);
	}
	app.HoyoLab = { parseCookie: HoyoLab.parseCookie, isExpiredLogin: () => false };
	const { delays } = harness;
	const path = require.resolve("../hoyolab-modules/hilichurl.js");
	delete require.cache[path];
	t.after(() => {
		delete require.cache[path];
	});
	const Workshop = require(path);
	const instance = { fullName: "Genshin Impact", config: { assets: {}, url: { redemption: REDEMPTION_URL } } };
	instance.redeemCode = (data, code) => Genshin.prototype.redeemCode.call(instance, data, code);
	return { ...harness, delays, workshop: new Workshop(instance) };
};

for (const language of [undefined, "it-it"]) {
	test(`event GET and POST contracts (${language ?? "default"})`, async (t) => {
		const { workshop, replies, requests } = await setup(t, language);
		replies.push(info(), ok({ task_list: []}), shop(), ok(), ok(), ok({ exchange_code: "", type: 2, award_id: 77 }));
		await workshop.getGameInfo(account);
		await workshop.getTasks(account, 999);
		await workshop.getShopItems(account, 999);
		assert.deepEqual(await workshop.finishTask(account, 88, 999), { success: true });
		assert.deepEqual(await workshop.claimTaskReward(account, 88, 999), { success: true });
		assert.deepEqual(await workshop.exchangeItem(account, 77, 999), { success: true, data: { code: "", type: 2, awardId: 77 } });
		assert.equal(requests.length, 6);
		const paths = ["index", "task_list", "exchange_list", "finish_task", "receive_point", "exchange"];
		for (const [i, request] of requests.entries()) {
			assert.equal(request.url.origin, "https://sg-public-api.hoyolab.com");
			assert.equal(request.url.pathname, `/event/e2023mimotravel/qiuqiu/${paths[i]}`);
			assert.equal(request.method, i < 3 ? "GET" : "POST");
			assert.deepEqual(Object.fromEntries(request.url.searchParams), {
				lang: language ?? "en-us", ...(i === 1 || i === 2 ? { game_id: "2", version_id: "999" } : {})
			});
			assert.deepEqual(request.body && JSON.parse(request.body), i < 3
				? undefined
				: {
					[i === 5 ? "award_id" : "task_id"]: i === 5 ? 77 : 88, game_id: 2, version_id: 999
				});
			assert.equal(request.headers.cookie, cookie);
			assert.equal(request.headers.origin, "https://act.hoyolab.com");
			assert.equal(request.headers.referer, "https://act.hoyolab.com/");
			assert.equal(request.headers.accept, "application/json, text/plain, */*");
			assert.match(request.headers["user-agent"], /Android.*wv.*miHoYoBBSOversea\/4\.21\.0/);
			assert.equal(request.headers["x-requested-with"], "com.mihoyo.hoyolab");
			assert.equal(request.headers["x-rpc-client_type"], 2);
			assert.equal(request.headers["x-rpc-language"], language ?? "en-us");
			assert.equal(request.headers.ds, undefined);
			assert.deepEqual(Object.keys(request.headers).filter(key => key.startsWith("x-rpc-")).sort(), ["x-rpc-client_type", "x-rpc-language"]);
		}
	});
}

test("upstream task coverage waits before timed desktop completion and claims finished tasks", async (t) => {
	const { workshop, replies, requests, delays } = await setup(t, "it-it");
	const tasks = [
		{ ...task(1, 101), read_seconds: 3 },
		{ ...task(2, 102), read_seconds: 8 },
		task(3, 101, 1),
		task(4, 102, 1),
		task(5, 1),
		task(6, 2),
		task(7, 999),
		task(8, 1, 3),
		task(9, 4),
		task(10, 10),
		task(11, 6)
	];
	replies.push(info(), ok({ task_list: tasks }), ...Array.from({ length: 14 }, () => ok()), info(60), shop());
	const finish = workshop.finishTask.bind(workshop);
	const waitsAtFinish = [];
	workshop.finishTask = async (...args) => {
		waitsAtFinish.push([...delays]);
		return finish(...args);
	};
	const result = await workshop.run(account);
	assert.equal(result.success, true);
	assert.deepEqual(result.data.tasksFinished, [1, 2, 5, 6, 9, 10].map(id => `Synthetic task ${id}`));
	assert.deepEqual(result.data.tasksClaimed.map(item => item.name), [1, 2, 3, 4, 5, 6, 9, 10].map(id => `Synthetic task ${id}`));
	assert.equal(result.data.points, 60);
	assert.deepEqual(waitsAtFinish[0], [4000]);
	assert.deepEqual(waitsAtFinish[1], [4000, 1000, 1000, 9000]);
	const posts = requests.filter(r => r.method === "POST");
	assert.deepEqual(posts.map(r => [r.url.pathname.split("/").pop(), JSON.parse(r.body).task_id]), [
		["finish_task", 1],
		["receive_point", 1],
		["finish_task", 2],
		["receive_point", 2],
		["receive_point", 3],
		["receive_point", 4],
		["finish_task", 5],
		["receive_point", 5],
		["finish_task", 6],
		["receive_point", 6],
		["finish_task", 9],
		["receive_point", 9],
		["finish_task", 10],
		["receive_point", 10]
	]);
	for (const request of posts) {
		const timedFinish = request.url.pathname.endsWith("/finish_task") && [1, 2].includes(JSON.parse(request.body).task_id);
		assert.equal(request.url.search, timedFinish ? "" : "?lang=it-it");
		assert.equal(request.headers.origin, timedFinish ? "https://www.hoyolab.com" : "https://act.hoyolab.com");
		assert.equal(request.headers["x-rpc-client_type"], timedFinish ? 4 : 2);
		assert.equal(request.headers["x-requested-with"], timedFinish ? undefined : "com.mihoyo.hoyolab");
		assert.equal(request.headers.ds, undefined);
	}
	assert.deepEqual(delays, [4000, 1000, 1000, 9000, ...new Array(12).fill(1000)]);
});

for (const language of [undefined, "it-it"]) {
	for (const taskType of [101, 102]) {
		test(`timed completion uses dedicated desktop headers (${taskType}, ${language ?? "default"})`, async t => {
			const { workshop, replies, requests } = await setup(t, language);
			replies.push(ok());
			assert.deepEqual(await workshop.finishTask(account, 88, 999, taskType), { success: true });
			const [request] = requests;
			assert.equal(request.url.href, "https://sg-public-api.hoyolab.com/event/e2023mimotravel/qiuqiu/finish_task");
			assert.deepEqual(JSON.parse(request.body), { task_id: 88, game_id: 2, version_id: 999 });
			assert.equal(request.headers.origin, "https://www.hoyolab.com");
			assert.equal(request.headers.referer, "https://www.hoyolab.com/");
			assert.equal(request.headers["x-rpc-client_type"], 4);
			assert.equal(request.headers["x-rpc-app_version"], "4.21.0");
			assert.equal(request.headers["x-rpc-language"], language ?? "en-us");
			assert.match(request.headers["user-agent"], /Windows NT/);
			for (const name of ["ds", "x-requested-with", "x-rpc-platform", "x-rpc-device_id", "x-rpc-device_fp"]) {
				assert.equal(request.headers[name], undefined);
			}
		});
	}
}

for (const readSeconds of [undefined, 0, -1]) {
	test(`timed task preserves upstream behavior without a positive read duration (${readSeconds})`, async t => {
		const { workshop, replies, requests, delays } = await setup(t);
		replies.push(info(), ok({ task_list: [{ ...task(1, 101), read_seconds: readSeconds }]}), ok(), ok(), info(), shop());
		const result = await workshop.run(account);
		assert.equal(result.data.tasksFinished.length, 1);
		assert.deepEqual(delays, [1000, 1000]);
		assert.equal(requests[2].headers["x-rpc-client_type"], 4);
	});
}

test("timed completion failure does not claim a reward and retries preserve desktop context", async t => {
	const { workshop, replies, requests, delays } = await setup(t);
	t.mock.method(Math, "random", () => 0.5);
	replies.push(info(), ok({ task_list: [{ ...task(1, 102), read_seconds: 2 }]}), { statusCode: 429 }, { body: { retcode: -1, message: "Synthetic failure" } }, info(), shop());
	const result = await workshop.run(account);
	assert.deepEqual(result.data.tasksFinished, []);
	assert.deepEqual(result.data.tasksClaimed, []);
	const posts = requests.filter(request => request.method === "POST");
	assert.equal(posts.length, 2);
	assert.equal(posts[0].url.href, posts[1].url.href);
	assert.equal(posts[0].body, posts[1].body);
	assert.deepEqual(posts[0].headers, posts[1].headers);
	assert.deepEqual(delays, [3000, 750, 1000]);
});

for (const failure of [{ body: { retcode: -500004 } }, { statusCode: 429 }, { body: "Too Many Requests" }]) {
	test(`rate limit retry preserves request and jitter (${JSON.stringify(failure)})`, async (t) => {
		const { workshop, replies, requests, delays } = await setup(t);
		t.mock.method(Math, "random", () => 0.5);
		replies.push(failure, ok());
		assert.deepEqual(await workshop.finishTask(account, 88, 999), { success: true });
		assert.equal(requests.length, 2);
		assert.equal(requests[0].url.href, requests[1].url.href);
		assert.equal(requests[0].body, requests[1].body);
		assert.deepEqual(delays, [750]);
	});
}

test("rate limit stops after ten attempts with capped exponential jitter", async (t) => {
	const { workshop, replies, requests, delays } = await setup(t);
	t.mock.method(Math, "random", () => 0.5);
	replies.push(...Array.from({ length: 10 }, () => ({ body: { retcode: -500004 } })));
	assert.equal((await workshop.claimTaskReward(account, 88, 999)).success, false);
	assert.equal(requests.length, 10);
	assert.deepEqual(delays, [750, 1250, 2250, 4250, 8250, 15250, 15250, 15250, 15250]);
});

for (const method of ["finishTask", "claimTaskReward", "exchangeItem"]) {
	for (const failure of [{ body: { retcode: -1, message: "Synthetic error" } }, { statusCode: 503, body: { message: "Synthetic error" } }]) {
		test(`${method} preserves API/HTTP failure ${failure.statusCode ?? -1}`, async (t) => {
			const { workshop, replies, requests, delays } = await setup(t);
			replies.push(failure);
			assert.deepEqual(await workshop[method](account, 88, 999), { success: false, message: "Synthetic error" });
			assert.equal(requests.length, 1);
			assert.deepEqual(delays, []);
		});
	}
}

test("zero-cost cosmetic with empty code is claimed without redemption", async (t) => {
	const { workshop, replies, requests, delays } = await setup(t);
	replies.push(info(), ok({ task_list: []}), info(), shop([{ award_id: 77, name: "Synthetic frame", cost: 0, status: 1 }]), ok({ type: 2, exchange_code: "", award_id: 77 }));
	const { data } = await workshop.run(account);
	assert.deepEqual(data.freeItemsClaimed, ["Synthetic frame"]);
	assert.deepEqual(data.codesRedeemed, []);
	assert.deepEqual(data.codesObtained, []);
	assert.equal(data.points, 20);
	assert.equal(requests.length, 5);
	assert.deepEqual(delays, [1000]);
});

// Point exchanges remain synthetic regression coverage, not captured success evidence.
for (const redeem of [true, false]) {
	test(`point exchange preserves optional browser redemption (${redeem})`, async (t) => {
		const { workshop, replies, requests, delays } = await setup(t, "it-it");
		replies.push(info(), ok({ task_list: []}), info(), shop([{ award_id: 77, name: "Synthetic Primogems", cost: 10, status: 1 }]), ok({ type: 1, exchange_code: "SYNTHETICCODE", award_id: 77 }), ok());
		const { data } = await workshop.run({ ...account, hilichurl: { redeem } });
		assert.equal(data.points, 10);
		assert.deepEqual(data.codesRedeemed, redeem ? ["SYNTHETICCODE"] : []);
		assert.deepEqual(data.codesObtained, redeem ? [] : ["SYNTHETICCODE"]);
		assert.deepEqual(delays, [1500]);
		assert.equal(requests.length, redeem ? 6 : 5);
		if (redeem) {
			assert.equal(requests[5].url.origin + requests[5].url.pathname, REDEMPTION_URL);
			assert.equal(requests[5].url.searchParams.get("lang"), "it");
			assert.equal(requests[5].headers.ds, undefined);
		}
	});
}

const rejected = () => ({ body: { retcode: -510001, message: "Errore parametro", data: null } });

for (const [taskFailure, shopFailure, status] of [[true, true, "failed"], [true, false, "partial"], [false, true, "partial"], [false, false, "no_activity"]]) {
	test(`run propagates list failures (${taskFailure}, ${shopFailure})`, async t => {
		const { workshop, replies, requests, logs } = await setup(t);
		replies.push(info(0), taskFailure ? rejected() : ok({ task_list: []}), info(0), shopFailure ? rejected() : shop());
		const result = await workshop.run(account);
		assert.equal(result.status, status);
		assert.equal(result.success, !taskFailure && !shopFailure);
		assert.equal(result.data.errors.length, Number(taskFailure) + Number(shopFailure));
		assert.equal(result.data.points, 0);
		assert.ok(requests.every(r => r.method === "GET"));
		if (taskFailure || shopFailure) {
			assert.match(JSON.stringify(logs), /Hilichurl operation failed/);
			assert.match(result.message, /task_list|exchange_list/);
		}
	});
}

for (const version of [undefined, null, "", 0, -1, "oops", 1.5, Number.MAX_SAFE_INTEGER + 1]) {
	test(`invalid version stops before list or mutation requests (${version})`, async t => {
		const { workshop, replies, requests } = await setup(t);
		replies.push(ok({ act_list: [{ act_info: { game_id: 2, version_id: version, point: 0 } }]}));
		const result = await workshop.run(account);
		assert.equal(result.success, false);
		assert.equal(result.status, "failed");
		assert.equal(result.data.errors.length, 1);
		assert.equal(requests.length, 1);
	});
}

for (const phase of ["future", "expired", "active"]) {
	test(`advertised event window (${phase})`, async t => {
		const { workshop, replies, requests } = await setup(t);
		const now = Math.floor(Date.now() / 1000);
		replies.push(ok({ act_list: [{ act_info: { game_id: 2,
			version_id: "72",
			point: 0,
			start_time: String(now + (phase === "future" ? 60 : -60)),
			end_time: String(now + (phase === "expired" ? -1 : 120)) } }]}));
		const result = await workshop.getGameInfo(account);
		assert.equal(result.success, phase === "active");
		assert.equal(requests.length, 1);
		if (result.success) {
			assert.equal(result.data.versionId, "72");
		}
	});
}

for (const method of ["getTasks", "getShopItems"]) {
	for (const data of [null, {}, { task_list: null, exchange_award_list: {} }]) {
		test(`${method} rejects malformed successful response ${JSON.stringify(data)}`, async t => {
			const { workshop, replies } = await setup(t);
			replies.push(ok(data));
			assert.equal((await workshop[method](account, 72)).success, false);
		});
	}
}

test("partial results preserve completed work and hide sensitive response/error details", async t => {
	const { workshop, replies, logs } = await setup(t);
	replies.push(info(), ok({ task_list: [task(1, 1, 1)]}), ok(), info(25));
	workshop.getShopItems = async () => {
		throw new Error(`cookie=${cookie}`);
	};
	const result = await workshop.run(account);
	assert.equal(result.status, "partial");
	assert.equal(result.success, false);
	assert.equal(result.data.tasksClaimed.length, 1);
	assert.equal(result.data.points, 25);
	assert.equal(result.data.errors.length, 1);
	assert.doesNotMatch(JSON.stringify([logs, result]), /synthetic-token|synthetic-cookie/);
});

test("API diagnostics whitelist HTTP status and numeric retcode", async t => {
	const { workshop, replies, logs } = await setup(t);
	replies.push({ body: { retcode: -510001, message: cookie, data: { cookie } } });
	await workshop.getTasks(account, 72);
	assert.match(JSON.stringify(logs), /-510001/);
	assert.doesNotMatch(JSON.stringify(logs), /synthetic-token|synthetic-cookie/);
});

for (const stage of ["finishTask", "claimTaskReward", "exchangeItem", "getGameInfo"]) {
	test(`run records failed ${stage} and retains successful reads`, async t => {
		const { workshop } = await setup(t);
		let infoCalls = 0;
		workshop.getGameInfo = async () => ++infoCalls > 1 && stage === "getGameInfo"
			? { success: false }
			: { success: true, data: { versionId: 72, points: 20 } };
		workshop.getTasks = async () => ({ success: true, data: [{ id: 1, name: "task", status: stage === "claimTaskReward" ? 1 : 2, taskType: 1, point: 5 }]});
		workshop.finishTask = async () => ({ success: stage !== "finishTask" });
		workshop.claimTaskReward = async () => ({ success: stage !== "claimTaskReward" });
		workshop.getShopItems = async () => ({ success: true, data: [{ id: 2, name: "Frame", cost: 0, status: 1 }]});
		workshop.exchangeItem = async () => ({ success: stage !== "exchangeItem", data: {} });
		const result = await workshop.run(account);
		assert.equal(result.success, false);
		assert.equal(result.status, "partial");
		assert.equal(result.data.errors.length, 1);
	});
}

const loadConsumer = (relativePath) => {
	const fs = require("node:fs");
	const vm = require("node:vm");
	const filename = require.resolve(relativePath);
	const localRequire = require("node:module").createRequire(filename);
	const context = {
		module: { exports: {} },
		app,
		require: name => name === "../../config.js" ? { crons: {} } : localRequire(name)
	};
	vm.runInNewContext(fs.readFileSync(filename, "utf8"), context, { filename });
	return context.module.exports;
};

for (const status of ["failed", "partial", "no_activity"]) {
	test(`cron and manual command interpret ${status} without false success`, async t => {
		const { workshop, replies } = await setup(t);
		replies.push(info(0), status === "no_activity" ? ok({ task_list: []}) : rejected(), info(0), status === "failed" ? rejected() : shop());
		const result = await workshop.run(account);
		assert.equal(result.status, status);
		const warnings = [];
		const debug = [];
		app.Logger.warn = (...args) => warnings.push(args);
		app.Logger.debug = (...args) => debug.push(args);
		app.HoyoLab.getActiveAccounts = () => [account];
		app.HoyoLab.get = () => ({ hilichurl: async () => result });
		await loadConsumer("../crons/hilichurl/index.js").code();
		assert.equal(warnings.length, status === "no_activity" ? 0 : 1);
		assert.equal(JSON.stringify(debug).includes("No new Hilichurl activity"), status === "no_activity");
		const command = loadConsumer("../commands/hilichurl/index.js");
		const text = await command.run({});
		assert.equal(text.success, status === "no_activity");
		assert.equal(text.reply.includes("operation failed"), status !== "no_activity");
		let response;
		await command.run({ interaction: { deferReply: async () => {},
			editReply: async value => {
				response = value;
			} } });
		assert.equal(response.embeds.length, status === "partial" ? 2 : 1);
		if (status === "partial") {
			assert.match(response.embeds[0].description, /partially completed/);
		}
	});
}

test("successful task activity returns success status", async t => {
	const { workshop, replies } = await setup(t);
	replies.push(info(), ok({ task_list: [task(1, 1, 1)]}), ok(), info(25), shop());
	const result = await workshop.run(account);
	assert.equal(result.success, true);
	assert.equal(result.status, "success");
	assert.deepEqual(result.data.errors, []);
});

const selectedAccount = (bindCharacter = false) => ({ ...account, uid: "222", character: { uid: "222", region: "os_euro" }, hilichurl: { bindCharacter } });
const eventInfo = (bound, overrides = {}, version = 72) => ok({ is_login: true,
	act_list: [{
		act_info: { game_id: 2, version_id: version, point: 0 },
		bind_uid: bound,
		uid: bound ? "222" : "0",
		region: bound ? "os_euro" : "",
		...overrides
	}]});

test("explicit binding sends the captured contract once and confirms identity before lists", async t => {
	const { workshop, replies, requests } = await setup(t, "it-it");
	replies.push(eventInfo(false), ok(), eventInfo(true), ok({ task_list: []}), eventInfo(true), shop());
	const result = await workshop.run(selectedAccount(true));
	assert.equal(result.success, true);
	assert.equal(result.status, "no_activity");
	const posts = requests.filter(r => r.method === "POST");
	assert.equal(posts.length, 1);
	assert.equal(posts[0].url.href, "https://sg-act-public-api.hoyolab.com/event/e2023mimotravel/qiuqiu/bind_game_info?lang=it-it");
	assert.deepEqual(JSON.parse(posts[0].body), { uid: "222", region: "os_euro", game_id: 2, version_id: 72 });
	assert.equal(posts[0].headers["x-rpc-client_type"], 2);
	assert.equal(posts[0].headers.ds, undefined);
	assert.deepEqual(requests.map(r => r.url.pathname.split("/").pop()), ["index", "bind_game_info", "index", "task_list", "index", "exchange_list"]);
});

for (const acc of [account, selectedAccount(false)]) {
	test("unbound event requires explicit consent and stops before tasks or shop", async t => {
		const { workshop, replies, requests } = await setup(t);
		replies.push(eventInfo(false));
		const result = await workshop.run(acc);
		assert.equal(result.success, false);
		assert.equal(result.status, "failed");
		assert.match(result.message, /requires a linked character/);
		assert.equal(requests.length, 1);
	});
}

for (const changed of [{ uid: "333" }, { region: "os_usa" }, { bind_uid: undefined }]) {
	test(`binding mismatch cannot be silently replaced: ${JSON.stringify(changed)}`, async t => {
		const { workshop, replies, requests } = await setup(t);
		replies.push(eventInfo(true, changed));
		const result = await workshop.run(selectedAccount(true));
		assert.equal(result.success, false);
		assert.match(result.message, /not bound to the selected character/);
		assert.equal(requests.length, 1);
	});
}

for (const failure of [rejected(), { statusCode: 503 }, { statusCode: 429 }]) {
	test(`binding failure stops without automatic retries (${failure.statusCode ?? -510001})`, async t => {
		const { workshop, replies, requests } = await setup(t);
		replies.push(eventInfo(false), failure);
		const result = await workshop.run(selectedAccount(true));
		assert.equal(result.success, false);
		assert.equal(requests.length, 2);
		assert.match(result.message, /Failed to bind/);
	});
}

for (const confirmation of [eventInfo(false), eventInfo(true, { uid: "333" }), eventInfo(true, {}, 73), rejected()]) {
	test("binding must be confirmed for the same version and selected character", async t => {
		const { workshop, replies, requests } = await setup(t);
		replies.push(eventInfo(false), ok(), confirmation);
		assert.equal((await workshop.run(selectedAccount(true))).success, false);
		assert.equal(requests.length, 3);
	});
}

test("restock lookup never binds even with bindCharacter enabled", async t => {
	const { workshop, replies, requests } = await setup(t);
	replies.push(eventInfo(false));
	const result = await workshop.getNextRestockTime(selectedAccount(true));
	assert.equal(result.success, false);
	assert.equal(requests.length, 1);
	assert.equal(requests[0].method, "GET");
});

test("event identity changes after tasks stop all shop exchanges", async t => {
	const { workshop, replies, requests } = await setup(t);
	replies.push(eventInfo(true), ok({ task_list: []}), eventInfo(true, { uid: "333" }));
	const result = await workshop.run(selectedAccount(false));
	assert.equal(result.success, false);
	assert.equal(result.status, "partial");
	assert.equal(requests.length, 3);
	assert.match(result.message, /identity changed/);
});


test("anonymous index never attempts binding", async t => {
	const { workshop, replies, requests } = await setup(t);
	const response = eventInfo(false);
	response.body.data.is_login = false;
	replies.push(response);
	assert.equal((await workshop.run(selectedAccount(true))).success, false);
	assert.equal(requests.length, 1);
});

test("selected identity cannot change between login and Hilichurl", async t => {
	const { workshop, replies, requests } = await setup(t);
	replies.push(eventInfo(true));
	const result = await workshop.run({ ...selectedAccount(true), uid: "333" });
	assert.equal(result.success, false);
	assert.match(result.message, /does not match the logged-in/);
	assert.equal(requests.length, 1);
});

test("selected character refresh failure prevents shop requests", async t => {
	const { workshop, replies, requests } = await setup(t);
	replies.push(eventInfo(true), ok({ task_list: []}), rejected());
	assert.equal((await workshop.run(selectedAccount(false))).success, false);
	assert.equal(requests.length, 3);
});
