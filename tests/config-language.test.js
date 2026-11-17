const assert = require("node:assert/strict");
const { readFileSync, mkdtempSync, writeFileSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { runInNewContext } = require("node:vm");
const { test } = require("node:test");
const cheerio = require("cheerio");
const JSON5 = require("json5");
const Config = require("../classes/config.js");
const { getLanguage, getLanguageOnly } = require("../gots/hoyolab-contexts/language.js");

// Execute the actual setup script against its HTML using the existing parser.
// Only DOM operations used by a single-account import/export are adapted here;
// browser file selection, rendering and download UI are not exercised.
const createSetup = () => {
	const html = readFileSync(join(__dirname, "../setup/config/index.html"), "utf8");
	const $ = cheerio.load(html);
	let download;
	const alerts = [];
	const wrap = (element) => {
		if (!element.length) {
			return null;
		}
		return {
			_element: element,
			get innerHTML () { return element.html(); },
			get onclick () { return element[0]._onclick; },
			set onclick (value) { element[0]._onclick = value; },
			click () { element[0]._onclick?.(); },
			appendChild: child => element.append(child._element),
			remove: () => element.remove(),
			get value () { return element.val(); },
			set value (value) { element.val(value); },
			get placeholder () { return element.attr("placeholder"); },
			set textContent (value) { element.text(value); },
			set innerHTML (value) { element.html(value); },
			classList: {
				add: (...names) => element.addClass(names.join(" ")),
				remove: (...names) => element.removeClass(names.join(" "))
			},
			addEventListener: () => {},
			querySelector: (selector) => wrap(element.find(selector).first()),
			querySelectorAll: (selector) => element.find(selector).toArray().map(node => wrap($(node)))
		};
	};
	const context = {
		alert: message => alerts.push(message),
		HoyoLabI18n: require("../localization/index.js"),
		// This adapter tests values and import/export; rendering is covered separately.
		updateLanguage: () => {},
		localizeForm: () => {},
		setLocalizedText: (element, source, ...values) => {
			element.textContent = require("../localization/index.js").t(source, ...values);
		},
		JSON5,
		Blob,
		URL: { createObjectURL: (blob) => {
			download = blob;
			return "blob:synthetic-config";
		} },
		document: {
			getElementById: (id) => wrap($(`[id="${id}"]`).first()),
			querySelector: (selector) => wrap($(selector).first()),
			querySelectorAll: (selector) => $(selector).toArray().map(node => wrap($(node))),
			body: { appendChild: () => {}, removeChild: () => {} },
			createElement: (tag) => {
				if (tag !== "a") {
					return wrap($(`<${tag}></${tag}>`));
				}
				return {
					click () { assert.equal(this.download, "config.json5"); }
				};
			}
		}
	};
	runInNewContext($("script:not([src])").text(), context);
	return { context, alerts, exportedText: () => download.text() };
};

test("setup preserves Tears of Themis redemption opt-in across import/export", async () => {
	const setup = createSetup();
	for (const value of [true, false, undefined]) {
		setup.context.importConfigFromText(JSON5.stringify({
			accounts: [{ type: "termis", active: true, data: [{ cookie: "synthetic-cookie", ...(value !== undefined && { redeemCode: value }) }]}]
		}));
		setup.context.generateConfig();
		const result = JSON5.parse(await setup.exportedText()).accounts.find(item => item.type === "termis");
		assert.equal(result.active, true);
		assert.equal(result.data[0].cookie, "synthetic-cookie");
		assert.equal(result.data[0].redeemCode, value);
	}
});

for (const [language, expected, short] of [
	[undefined, "en-us", "en"],
	["it-it", "it-it", "it"],
	["future-region", "future-region", "future"]
]) {
	test(`setup and Config preserve canonical locale: ${String(language)}`, async (t) => {
		const previousApp = global.app;
		const previousData = Config.data;
		const previousPath = process.env.CONFIG_PATH;
		const configModule = require.resolve("../config.js");
		const previousModule = require.cache[configModule];
		const directory = mkdtempSync(join(tmpdir(), "hoyolab-locale-"));
		t.after(() => {
			global.app = previousApp;
			Config.data = previousData;
			if (previousPath === undefined) {
				delete process.env.CONFIG_PATH;
			}
			else {
				process.env.CONFIG_PATH = previousPath;
			}
			delete require.cache[configModule];
			if (previousModule) {
				require.cache[configModule] = previousModule;
			}
			rmSync(directory, { recursive: true });
		});
		global.app = { Config };
		const setup = createSetup();
		let text = JSON5.stringify(language === undefined ? {} : { language });
		process.env.CONFIG_PATH = join(directory, "config.json5");
		// Check initial config loading, then two complete setup import/export cycles.
		for (let cycle = 0; cycle < 3; cycle++) {
			writeFileSync(process.env.CONFIG_PATH, text);
			delete require.cache[configModule];
			Config.data = new Map();
			await Config.load(require(configModule));
			assert.equal(Config.get("language"), cycle === 0 ? language : expected);
			assert.equal(getLanguage(), expected);
			assert.equal(getLanguageOnly(), short);
			assert.equal(Config.get("language"), cycle === 0 ? language : expected);
			if (cycle < 2) {
				setup.context.importConfigFromText(text);
				assert.equal(setup.context.document.getElementById("language").value, expected);
				setup.context.generateConfig();
				text = await setup.exportedText();
				assert.equal(JSON5.parse(text).language, expected);
			}
		}
	});
}

for (const [game, region] of [["genshin", "os_euro"], ["starrail", "prod_official_eur"], ["zenless", "prod_gf_eu"]]) {
	test(`setup preserves and clears explicit character selection for ${game}`, async () => {
		const setup = createSetup();
		const character = { uid: "222222222", region };
		setup.context.importConfigFromText(JSON5.stringify({ accounts: [{ type: game,
			active: true,
			data: [{ cookie: "synthetic",
				character,
				...(game === "genshin" && { hilichurl: { check: true, redeem: false, bindCharacter: true } }) }]}]}));
		setup.context.generateConfig();
		let result = JSON5.parse(await setup.exportedText()).accounts.find(a => a.type === game).data[0];
		assert.deepEqual(result.character, character);
		if (game === "genshin") {
			assert.deepEqual(result.hilichurl, { check: true, redeem: false, bindCharacter: true });
		}
		setup.context.importConfigFromText(JSON5.stringify({ accounts: [{ type: game, active: true, data: [{ cookie: "synthetic" }]}]}));
		setup.context.generateConfig();
		result = JSON5.parse(await setup.exportedText()).accounts.find(a => a.type === game).data[0];
		assert.equal(Object.hasOwn(result, "character"), false);
		if (game === "genshin") {
			assert.equal(result.hilichurl.bindCharacter, false);
		}
	});
}


test("setup keeps separate selections and binding consent when copying account forms", async () => {
	const setup = createSetup();
	const data = [
		{ cookie: "synthetic-a", character: { uid: "222", region: "os_euro" }, hilichurl: { check: true, redeem: false, bindCharacter: true } },
		{ cookie: "synthetic-b", character: { uid: "333", region: "os_usa" }, hilichurl: { check: false, redeem: true, bindCharacter: false } }
	];
	setup.context.importConfigFromText(JSON5.stringify({ accounts: [{ type: "genshin", active: true, data }]}));
	setup.context.generateConfig();
	assert.deepEqual(setup.alerts, []);
	const result = JSON5.parse(await setup.exportedText()).accounts.find(a => a.type === "genshin").data;
	assert.equal(result.length, 2);
	for (const [i, account] of result.entries()) {
		assert.deepEqual(account.character, data[i].character);
		assert.deepEqual(account.hilichurl, data[i].hilichurl);
	}
});

for (const entry of [{ character: { uid: "222" } }, { character: { uid: "oops", region: "os_euro" } }, { hilichurl: { bindCharacter: true } }]) {
	test(`setup refuses an incomplete selection or binding consent without selection: ${JSON.stringify(entry)}`, () => {
		const setup = createSetup();
		setup.context.importConfigFromText(JSON5.stringify({ accounts: [{ type: "genshin", active: true, data: [{ cookie: "synthetic", ...entry }]}]}));
		setup.context.generateConfig();
		assert.equal(setup.alerts.length, 1);
	});
}
