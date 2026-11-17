const { t } = require("../localization/index.js");

/**
 * Hilichurl Machine Workshop - Genshin Impact exclusive web event
 * Handles mission completion, point management, and reward exchange
 *
 * This is separate from the Traveling Mimo system as Genshin uses
 * a different API structure (/qiuqiu/ endpoint prefix with underscores)
 * and has no lottery feature.
 */

const { setTimeout: sleep } = require("node:timers/promises");
const { getLanguage } = require("../gots/hoyolab-contexts/language.js");
const { APP_VERSION } = require("../gots/hoyolab-contexts/constants.js");
const HILICHURL_BASE_URL = "https://sg-public-api.hoyolab.com/event/e2023mimotravel/qiuqiu";

// Task status enum matching HoYoLab API
const TaskStatus = {
	FINISHED: 1, // Completed, ready to claim
	ONGOING: 2, // Not yet completed
	CLAIMED: 3 // Already claimed
};

// Preserve upstream's task coverage; timed completion uses the desktop contract.
const FinishableTaskTypes = [1, 2, 4, 10, 101, 102];
const TimedTaskTypes = [101, 102];

// Shop item status
const ShopItemStatus = {
	EXCHANGEABLE: 1, // Available to buy
	NOT_EXCHANGEABLE: 2 // Can't buy (out of stock, etc.)
};

module.exports = class HilichurlWorkshop {
	/** @type {import("./template")} */
	#instance;
	#logo;
	#color;

	constructor (instance, options = {}) {
		this.#instance = instance;
		this.#logo = options.logo;
		this.#color = options.color;
	}

	#buildEndpoint (endpoint) {
		// Genshin uses underscores instead of hyphens
		return `${HILICHURL_BASE_URL}/${endpoint.replace(/-/g, "_")}`;
	}

	async #request (endpoint, options = {}) {
		const { method = "GET", params = {}, data = null, cookie, desktopTask = false } = options;

		const url = this.#buildEndpoint(endpoint);

		const requestOptions = {
			url,
			responseType: "json",
			throwHttpErrors: false,
			searchParams: desktopTask ? undefined : { lang: getLanguage(), ...params },
			headers: {
				Cookie: cookie,
				"x-rpc-client_type": desktopTask ? 4 : 2,
				"x-rpc-language": getLanguage(),
				...(desktopTask
					? {
						Origin: "https://www.hoyolab.com",
						Referer: "https://www.hoyolab.com/",
						"x-rpc-app_version": APP_VERSION
					}
					: {})
			}
		};

		if (method !== "GET") {
			requestOptions.method = "POST";
			requestOptions.json = data || params;
		}

		// Retry logic with exponential backoff for rate limits
		const maxRetries = 10;
		const baseDelay = 500; // 500ms initial delay
		const maxDelay = 30000; // 30s max delay

		for (let attempt = 1; attempt <= maxRetries; attempt++) {
			// Timed desktop completion and ordinary event WebView calls both omit DS.
			const res = await app.Got(desktopTask ? "HoYoLabDesktopWeb" : "HoYoLabAppWebView", requestOptions);

			// Check for rate limit errors:
			// - retcode -500004 = VisitsTooFrequently (JSON response)
			// - HTTP 429 = Too Many Requests
			// - Body contains "Too Many Requests" string
			const isRateLimited = res.body?.retcode === -500004
				|| res.statusCode === 429
				|| (typeof res.body === "string" && res.body.includes("Too Many Requests"));

			if (isRateLimited) {
				if (attempt === maxRetries) {
					app.Logger.warn(`${this.#instance.fullName}:Hilichurl`, t `Rate limited after ${maxRetries} attempts, giving up`);
					return res;
				}

				const maxWait = Math.min(baseDelay * (2 ** attempt), maxDelay);
				const totalDelay = Math.floor(baseDelay + Math.random() * (maxWait - baseDelay));

				app.Logger.info(`${this.#instance.fullName}:Hilichurl`, t `Rate limited, retrying in ${totalDelay}ms (attempt ${attempt}/${maxRetries})`);
				await sleep(totalDelay);
				continue;
			}

			return res;
		}
	}

	async getGameInfo (accountData) {
		const cookieData = this.#getCookieData(accountData);

		const res = await this.#request("index", {
			params: { lang: app.Config.get("language") || "en-us" },
			cookie: cookieData
		});

		if (res.statusCode !== 200 || res.body?.retcode !== 0) {
			app.Logger.warn(`${this.#instance.fullName}:Hilichurl`, {
				message: t("Failed to fetch Hilichurl Workshop info"),
				args: { httpStatus: res.statusCode, retcode: Number.isInteger(res.body?.retcode) ? res.body.retcode : undefined }
			});
			return { success: false };
		}

		// Genshin uses act_list[].act_info structure
		const gameList = Array.isArray(res.body?.data?.act_list)
			? res.body.data.act_list.map(item => item?.act_info).filter(Boolean)
			: [];
		const game = gameList.find(g => g.game_id === 2); // Genshin = game_id 2

		if (!game) {
			const message = t("Hilichurl Workshop event not active for Genshin Impact");
			app.Logger.warn(`${this.#instance.fullName}:Hilichurl`, message);
			return { success: false, message };
		}

		if (!/^[1-9]\d*$/.test(String(game.version_id)) || !Number.isSafeInteger(Number(game.version_id))) {
			const message = t("Invalid Hilichurl Workshop version");
			app.Logger.warn(`${this.#instance.fullName}:Hilichurl`, message);
			return { success: false, message };
		}
		const now = Date.now() / 1000;
		if ((Number(game.start_time) > 0 && now < Number(game.start_time))
			|| (Number(game.end_time) > 0 && now > Number(game.end_time))) {
			const message = t("Hilichurl Workshop event not active for Genshin Impact");
			app.Logger.warn(`${this.#instance.fullName}:Hilichurl`, message);
			return { success: false, message };
		}

		return {
			success: true,
			data: {
				gameId: game.game_id,
				versionId: game.version_id,
				points: game.point,
				startTime: game.start_time,
				endTime: game.end_time,
				hasExchange: game.exchange_exist,
				hasLottery: game.lottery_exist
			}
		};
	}

	async getTasks (accountData, versionId) {
		const cookieData = this.#getCookieData(accountData);

		const res = await this.#request("task-list", {
			params: {
				lang: app.Config.get("language") || "en-us",
				game_id: 2,
				version_id: versionId
			},
			cookie: cookieData
		});

		if (res.statusCode !== 200 || res.body?.retcode !== 0 || !Array.isArray(res.body?.data?.task_list)) {
			app.Logger.warn(`${this.#instance.fullName}:Hilichurl`, {
				message: t("Failed to fetch Hilichurl tasks"),
				args: { httpStatus: res.statusCode, retcode: Number.isInteger(res.body?.retcode) ? res.body.retcode : undefined }
			});
			return { success: false };
		}

		return {
			success: true,
			data: res.body.data.task_list.map(task => ({
				id: task.task_id,
				name: task.task_name,
				timeType: task.time_type, // 0=permanent, 1=daily, 2=weekly
				point: task.point,
				progress: task.progress,
				totalProgress: task.total_progress,
				status: task.status,
				taskType: task.task_type,
				jumpUrl: task.jump_url,
				afUrl: task.af_url,
				readSeconds: task.read_seconds ?? 0
			}))
		};
	}

	async finishTask (accountData, taskId, versionId, taskType) {
		const cookieData = this.#getCookieData(accountData);

		const res = await this.#request("finish-task", {
			method: "POST",
			desktopTask: TimedTaskTypes.includes(taskType),
			data: {
				task_id: taskId,
				game_id: 2,
				version_id: versionId
			},
			cookie: cookieData
		});

		if (res.statusCode !== 200 || res.body?.retcode !== 0) {
			app.Logger.warn(`${this.#instance.fullName}:Hilichurl`, {
				message: t("Failed to finish Hilichurl task"),
				args: { taskId, httpStatus: res.statusCode, retcode: Number.isInteger(res.body?.retcode) ? res.body.retcode : undefined }
			});
			return { success: false, message: res.body?.message };
		}

		return { success: true };
	}

	async claimTaskReward (accountData, taskId, versionId) {
		const cookieData = this.#getCookieData(accountData);

		// Genshin uses POST for receive-point
		const res = await this.#request("receive-point", {
			method: "POST",
			data: {
				task_id: taskId,
				game_id: 2,
				version_id: versionId
			},
			cookie: cookieData
		});

		if (res.statusCode !== 200 || res.body?.retcode !== 0) {
			app.Logger.warn(`${this.#instance.fullName}:Hilichurl`, {
				message: t("Failed to claim Hilichurl task reward"),
				args: { taskId, httpStatus: res.statusCode, retcode: Number.isInteger(res.body?.retcode) ? res.body.retcode : undefined }
			});
			return { success: false, message: res.body?.message };
		}

		return { success: true };
	}

	async getShopItems (accountData, versionId) {
		const cookieData = this.#getCookieData(accountData);

		const res = await this.#request("exchange-list", {
			params: {
				lang: app.Config.get("language") || "en-us",
				game_id: 2,
				version_id: versionId
			},
			cookie: cookieData
		});

		if (res.statusCode !== 200 || res.body?.retcode !== 0 || !Array.isArray(res.body?.data?.exchange_award_list)) {
			app.Logger.warn(`${this.#instance.fullName}:Hilichurl`, {
				message: t("Failed to fetch Hilichurl shop items"),
				args: { httpStatus: res.statusCode, retcode: Number.isInteger(res.body?.retcode) ? res.body.retcode : undefined }
			});
			return { success: false };
		}

		return {
			success: true,
			data: res.body.data.exchange_award_list.map(item => ({
				id: item.award_id,
				name: item.name,
				icon: item.icon,
				cost: item.cost,
				stock: item.stock,
				status: item.status,
				userCount: item.user_count,
				nextRefreshTime: item.next_refresh_time, // seconds until restock
				expireDay: item.expire_day
			}))
		};
	}

	async exchangeItem (accountData, awardId, versionId) {
		const cookieData = this.#getCookieData(accountData);

		const res = await this.#request("exchange", {
			method: "POST",
			data: {
				award_id: awardId,
				game_id: 2,
				version_id: versionId
			},
			cookie: cookieData
		});

		if (res.statusCode !== 200 || res.body?.retcode !== 0) {
			app.Logger.warn(`${this.#instance.fullName}:Hilichurl`, {
				message: t("Failed to exchange Hilichurl item"),
				args: { awardId, httpStatus: res.statusCode, retcode: Number.isInteger(res.body?.retcode) ? res.body.retcode : undefined }
			});
			return { success: false, message: res.body?.message };
		}

		return {
			success: true,
			data: {
				code: res.body.data.exchange_code,
				type: res.body.data.type,
				awardId: res.body.data.award_id
			}
		};
	}

	async run (accountData) {
		const results = {
			tasksFinished: [],
			tasksClaimed: [],
			freeItemsClaimed: [],
			itemsExchanged: [],
			codesRedeemed: [],
			codesObtained: [],
			errors: [],
			points: 0,
			shopStatus: []
		};

		const attempt = async (stage, operation) => {
			try {
				const result = await operation();
				if (result.success) {
					return result;
				}
			}
			catch {
				// Transport errors may contain authenticated request options.
			}
			const message = t `Hilichurl operation failed: ${stage}`;
			results.errors.push(message);
			app.Logger.warn(`${this.#instance.fullName}:Hilichurl`, message);
			return { success: false, message };
		};

		const gameInfo = await attempt("index", () => this.getGameInfo(accountData));
		if (!gameInfo.success) {
			return { success: false, status: "failed", message: gameInfo.message, data: results };
		}

		const { versionId } = gameInfo.data;
		results.points = gameInfo.data.points;

		app.Logger.info(`${this.#instance.fullName}:Hilichurl`, t `(${accountData.uid}) Starting Hilichurl Workshop automation - Current points: ${results.points}`);

		// Process tasks
		const tasks = await attempt("task_list", () => this.getTasks(accountData, versionId));
		if (tasks.success) {
			for (const task of tasks.data) {
				// Try to auto-complete finishable tasks
				if (task.status === TaskStatus.ONGOING && FinishableTaskTypes.includes(task.taskType)) {
					if (TimedTaskTypes.includes(task.taskType) && task.readSeconds > 0) {
						await app.Utils.waitWithJitter((task.readSeconds + 1) * 1000);
					}

					const finishResult = await attempt("finish_task", () => this.finishTask(accountData, task.id, versionId, task.taskType));
					if (finishResult.success) {
						results.tasksFinished.push(task.name);
						task.status = TaskStatus.FINISHED;
						app.Logger.info(`${this.#instance.fullName}:Hilichurl`, t `(${accountData.uid}) Finished task: ${task.name}`);
					}
					await app.Utils.waitWithJitter(1000);
				}

				// Claim completed tasks
				if (task.status === TaskStatus.FINISHED) {
					const claimResult = await attempt("receive_point", () => this.claimTaskReward(accountData, task.id, versionId));
					if (claimResult.success) {
						results.tasksClaimed.push({ name: task.name, points: task.point });
						results.points += task.point;
						app.Logger.info(`${this.#instance.fullName}:Hilichurl`, t `(${accountData.uid}) Claimed ${task.point} points for: ${task.name}`);
					}
					await app.Utils.waitWithJitter(1000);
				}
			}
		}

		// Refresh points after claiming tasks
		const updatedGameInfo = await attempt("refresh_index", () => this.getGameInfo(accountData));
		if (updatedGameInfo.success) {
			results.points = updatedGameInfo.data.points;
		}

		// Process shop exchanges
		const shopItems = await attempt("exchange_list", () => this.getShopItems(accountData, versionId));
		if (shopItems.success) {
			results.shopStatus = shopItems.data.map(item => ({
				name: item.name,
				cost: item.cost,
				stock: item.stock,
				status: item.status,
				nextRefreshTime: item.nextRefreshTime
			}));

			const freeItems = shopItems.data.filter(item => item.cost === 0 && item.status === ShopItemStatus.EXCHANGEABLE);
			for (const item of freeItems) {
				const exchangeResult = await attempt("exchange", () => this.exchangeItem(accountData, item.id, versionId));
				if (exchangeResult.success) {
					results.freeItemsClaimed.push(item.name);
					app.Logger.info(`${this.#instance.fullName}:Hilichurl`, t `(${accountData.uid}) Claimed free item: ${item.name}`);
				}
				await app.Utils.waitWithJitter(1000);
			}

			const currencyItems = shopItems.data
				.filter(item => item.name.toLowerCase().includes("primogem"))
				.sort((a, b) => b.cost - a.cost);

			for (const item of currencyItems) {
				if (item.status !== ShopItemStatus.EXCHANGEABLE) {
					continue;
				}

				if (results.points < item.cost) {
					continue;
				}

				const exchangeResult = await attempt("exchange", () => this.exchangeItem(accountData, item.id, versionId));
				if (exchangeResult.success) {
					const code = exchangeResult.data.code;
					results.itemsExchanged.push({ name: item.name, cost: item.cost, code });
					results.points -= item.cost;

					app.Logger.info(`${this.#instance.fullName}:Hilichurl`, t `(${accountData.uid}) Exchanged ${item.name}${code ? t ` for code: ${code}` : ""}`);

					// Check if auto-redeem is enabled (hilichurl.redeem defaults to true for backward compatibility)
					const shouldRedeem = accountData.redeemCode && (accountData.hilichurl?.redeem !== false);

					if (code && shouldRedeem) {
						const redeemResult = await attempt("redeem_code", () => this.#instance.redeemCode(accountData, code));
						if (redeemResult.success) {
							results.codesRedeemed.push(code);
							app.Logger.info(`${this.#instance.fullName}:Hilichurl`, t `(${accountData.uid}) Redeemed code: ${code}`);
						}
					}
					else if (code) {
						// Code obtained but not auto-redeemed
						results.codesObtained.push(code);
						app.Logger.info(`${this.#instance.fullName}:Hilichurl`, t `(${accountData.uid}) Code obtained (not auto-redeemed): ${code}`);
					}
				}

				await app.Utils.waitWithJitter(1500);
			}
		}

		const hasActivity = [results.tasksFinished,
			results.tasksClaimed,
			results.freeItemsClaimed,
			results.itemsExchanged,
			results.codesRedeemed,
			results.codesObtained].some(items => items.length > 0);
		const status = results.errors.length > 0
			? (tasks.success || shopItems.success || hasActivity ? "partial" : "failed")
			: (hasActivity ? "success" : "no_activity");
		return {
			success: results.errors.length === 0,
			status,
			message: results.errors.length > 0 ? results.errors.join("; ") : undefined,
			data: {
				...results,
				assets: {
					...this.#instance.config.assets,
					logo: this.#logo,
					color: this.#color
				}
			}
		};
	}

	async getNextRestockTime (accountData) {
		const gameInfo = await this.getGameInfo(accountData);
		if (!gameInfo.success) {
			return { success: false };
		}

		const shopItems = await this.getShopItems(accountData, gameInfo.data.versionId);
		if (!shopItems.success) {
			return { success: false };
		}

		const currencyItem = shopItems.data.find(i => i.name.toLowerCase().includes("primogem"));
		if (!currencyItem) {
			return { success: false, message: t("No primogem items found") };
		}

		return {
			success: true,
			data: {
				nextRefreshTime: currencyItem.nextRefreshTime,
				nextRefreshDate: currencyItem.nextRefreshTime > 0
					? new Date(Date.now() + (currencyItem.nextRefreshTime * 1000))
					: null
			}
		};
	}

	#getCookieData (accountData) {
		return app.HoyoLab.parseCookie(accountData.cookie, {
			whitelist: [
				"ltoken_v2",
				"ltmid_v2",
				"ltuid_v2",
				"cookie_token_v2",
				"account_mid_v2",
				"account_id_v2"
			]
		});
	}
};
