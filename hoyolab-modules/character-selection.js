const { t } = require("../localization/index.js");

const ROLE_URL = "https://api-account-os.hoyolab.com/binding/api/getUserGameRolesByLtoken";
const games = {
	genshin: { biz: "hk4e_global" },
	starrail: { biz: "hkrpg_global" },
	nap: { biz: "nap_global" }
};

const normalizeCharacter = (character, game) => {
	if (character === undefined || character === null) {
		return undefined;
	}
	if (!games[game] || typeof character !== "object" || Array.isArray(character)
		|| typeof character.uid !== "string" || !/^[1-9]\d*$/.test(character.uid)
		|| typeof character.region !== "string" || !/^[a-z][a-z0-9_]*$/.test(character.region)) {
		throw new app.Error({ message: t("Invalid character selection. Configure both character.uid and character.region for a supported game.") });
	}
	return { uid: character.uid, region: character.region };
};

// Game Record cards may describe only one of the account's characters.
// An explicit selection must be verified against the binding API, not a card.
const selectCharacter = async (account, game, card) => {
	if (!account.character) {
		return card;
	}
	const selected = normalizeCharacter(account.character, game);
	const { biz } = games[game];
	const res = await app.Got("HoYoLabDesktopWeb", {
		url: ROLE_URL,
		method: "GET",
		responseType: "json",
		throwHttpErrors: false,
		searchParams: { game_biz: biz, region: selected.region },
		headers: { Cookie: account.cookie }
	});
	if (res.statusCode !== 200 || res.body?.retcode !== 0 || !Array.isArray(res.body?.data?.list)) {
		throw new app.Error({ message: t("Could not verify the selected character. Check the account cookie and try again.") });
	}
	const matches = res.body.data.list.filter(role => role?.game_biz === biz
		&& String(role.game_uid) === selected.uid && role.region === selected.region);
	if (matches.length !== 1 || typeof matches[0].nickname !== "string" || !matches[0].nickname.trim()) {
		throw new app.Error({ message: t("The selected character was not found for this account and server.") });
	}
	const role = matches[0];
	return { ...card, game_role_id: selected.uid, region: selected.region, nickname: role.nickname, level: role.level };
};

module.exports = { normalizeCharacter, selectCharacter, ROLE_URL };
