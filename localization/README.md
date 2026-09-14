# Software translations

`language` selects the software locale as well as the existing HoYoLAB API locale.
English is the built-in default. A configured locale uses the catalog named after
its primary language: `it`, `it-it`, and `it-ch` all load `it.js`. If a catalog or
individual message is unavailable, that text falls back to English. Locale matching
ignores case and accepts underscores without modifying the API setting.

## Add a language

Adding a software language requires one new file only. Copy `it.js` to the primary
language code, such as `fr.js`, and change its metadata:

```js
(function (root) {
	const catalog = {
		language: "fr",
		locale: "fr-FR",
		messages: {
			"Today's Reward": "Récompense du jour"
		}
	};
	if (typeof module === "object" && module.exports) {
		module.exports = catalog;
	}
	else {
		root.HoyoLabLocales = root.HoyoLabLocales ?? {};
		root.HoyoLabLocales[catalog.language] = catalog;
		root.HoyoLabI18n?.registerCatalog(catalog);
	}
})(globalThis);
```

Do not edit `index.js`, the setup generator, or application modules. Node.js loads
the catalog by filename. The setup generator loads the same file when its language
field changes. Google Apps Script cannot load repository files dynamically, so copy
the shared formatter and the desired catalog into the Apps Script project once.

Use `t("An English message")` for static text or a tagged template:

```js
const { t } = require("../localization/index.js");
const message = t `Loaded ${count} configuration entries`;
```

The English source is the fallback message. Add the corresponding entry to each catalog,
using numbered placeholders, for example `Loaded {0} configuration entries`.
Translate complete messages, preserve every placeholder and platform markup, and
escape Telegram Markdown at the existing rendering boundary. Values interpolated
into a message are never translated automatically. Keep protocol identifiers,
cache states, configuration keys and matching strings unchanged; translate known
states and categories only when displaying them.

The configuration page shares this catalog. Mark text-only elements with
`data-i18n="English source"`; dynamic labels use `setLocalizedText`. Translation
uses `textContent`, never HTML, and leaves form values unchanged. Keep English
fallback text in the HTML. Public documentation remains in English.

Run `npm test` and `npm run lint` after changing messages. The tests discover every
language file automatically and check its metadata and placeholder parity. They also
check full Italian coverage, language fallback, notification rendering, command
metadata and API locale independence.
