/* eslint-env browser */
/* global HoyoLabI18n */
const catalogLoads = new Map();
let languageUpdate = 0;

function loadCatalogScript (name) {
	if (!catalogLoads.has(name)) {
		catalogLoads.set(name, new Promise((resolve) => {
			const script = document.createElement("script");
			script.src = new URL(`../../localization/${name}.js`, document.baseURI);
			script.onload = () => resolve(true);
			script.onerror = () => {
				script.remove();
				resolve(false);
			};
			document.head.appendChild(script);
		}));
	}
	return catalogLoads.get(name);
}

async function ensureCatalog (language) {
	if (HoyoLabI18n.hasCatalog(language)) {
		return;
	}
	for (const candidate of HoyoLabI18n.getCatalogCandidates(language)) {
		if (candidate === "en" || HoyoLabI18n.hasCatalog(candidate)) {
			return;
		}
		if (await loadCatalogScript(candidate)) {
			return;
		}
	}
}

globalThis.setLocalizedText = function (element, message, ...values) {
	element.dataset.i18n = message;
	element.dataset.i18nValues = JSON.stringify(values);
	element.textContent = HoyoLabI18n.t(message, ...values);
};

function localizeForm (root = document) {
	for (const element of root.querySelectorAll("[data-i18n]")) {
		const values = JSON.parse(element.dataset.i18nValues || "[]");
		element.textContent = HoyoLabI18n.t(element.dataset.i18n, ...values);
	}
}

globalThis.updateLanguage = async function () {
	const sequence = ++languageUpdate;
	const language = document.getElementById("language").value;
	HoyoLabI18n.setLanguage(language);
	await ensureCatalog(language);
	if (sequence !== languageUpdate) {
		return;
	}
	HoyoLabI18n.setLanguage(language);
	document.documentElement.lang = HoyoLabI18n.getLocale();
	localizeForm();
};
