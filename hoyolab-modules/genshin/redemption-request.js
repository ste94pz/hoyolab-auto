const { getLanguageOnly } = require("../../gots/hoyolab-contexts/language.js");

const REDEMPTION_URL = "https://public-operation-hk4e.hoyoverse.com/common/apicdkey/api/webExchangeCdkey";

const requestRedemption = (accountData, code, url = REDEMPTION_URL) => app.Got("HoYoLabDesktopWeb", {
	url,
	method: "GET",
	responseType: "json",
	throwHttpErrors: false,
	searchParams: {
		uid: accountData.uid,
		region: accountData.region,
		lang: getLanguageOnly(),
		cdkey: code,
		game_biz: "hk4e_global",
		// The gift page sends this separately from its selected short language.
		sLangKey: "en-us"
	},
	headers: {
		Origin: "https://genshin.hoyoverse.com",
		Referer: "https://genshin.hoyoverse.com/",
		// Preserve the controller's auth cookies; a smaller subset is unverified.
		Cookie: accountData.cookie
	}
});

module.exports = { REDEMPTION_URL, requestRedemption };
