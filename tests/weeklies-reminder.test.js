const assert = require("node:assert/strict");
const test = require("node:test");
const RegionalTaskManager = require("../object/regional-task-manager.js");

test("weekly reminders skip unsupported games and continue through supported accounts", async (t) => {
	const previousApp = global.app;
	const cronPath = require.resolve("../crons/weeklies-reminder/index.js");
	t.after(() => {
		global.app = previousApp;
		delete require.cache[cronPath];
	});
	const accounts = ["tot", "honkai", "genshin", "starrail", "nap"].map(platform => ({
		platform, uid: platform, timezone: 0
	}));
	const notesCalls = [];
	const updated = [];
	let now = Date.parse("2026-11-08T21:00:00Z");
	const timers = [];
	const cache = new Map();
	const fireTimers = async () => {
		for (const callback of timers.splice(0)) {
			await callback();
		}
	};
	global.app = {
		RegionalTaskManager: class extends RegionalTaskManager {
			constructor () {
				super({ now: () => now, random: () => 0, setTimer: callback => timers.push(callback) });
			}
		},
		Cache: {
			get: async key => structuredClone(cache.get(key)),
			set: async ({ key, value }) => cache.set(key, structuredClone(value))
		},
		Date: class extends Date {
			constructor (value = "2026-11-08T21:00:00Z") { super(value); }
			get hours () { return 21; }
			setTimezoneOffset () {}
		},
		Logger: { debug () {}, error: assert.fail },
		HoyoLab: {
			getActiveAccounts: ({ blacklist = []} = {}) => accounts.filter(account => !blacklist.includes(account.platform)),
			get: platform => ({
				notes: async () => {
					assert.ok(!["tot", "honkai"].includes(platform), "unsupported Notes must not be called");
					notesCalls.push(platform);
					return { success: false };
				},
				update: account => updated.push(account.platform)
			})
		}
	};
	delete require.cache[cronPath];
	const cron = require(cronPath);
	await cron.code();
	assert.equal(notesCalls.length, 0);
	assert.equal(timers.length, 3);
	await fireTimers();
	assert.deepEqual(notesCalls, ["genshin", "starrail", "nap"]);
	assert.deepEqual(updated, ["genshin", "starrail", "nap"]);
	assert.equal(accounts[0].lastWeekliesReminderExecution, undefined);
	assert.equal(accounts[1].lastWeekliesReminderExecution, undefined);

	// Preserve the existing per-day deduplication and disabled-account behavior.
	await cron.code();
	await fireTimers();
	assert.equal(notesCalls.length, 3);
	now += 7 * 86400000;
	for (const account of accounts) {
		delete account.lastWeekliesReminderExecution;
		account.weekliesCheck = false;
	}
	await cron.code();
	await fireTimers();
	assert.equal(notesCalls.length, 3);
});
