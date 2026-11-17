# HoYoUtils documentation

[Project overview](../README.md) · [Fork relationship](../FORK.md) · [Credits](../NOTICE.md)

| Guide | Contents |
| --- | --- |
| [Installation and configuration](INSTALLATION.md) | Requirements, local setup, locale, cache and upgrades |
| [Docker](DOCKER.md) | Local/versioned images, permissions, volumes and migration |
| [Games and features](FEATURES.md) | Support matrix, reminders and monthly diaries |
| [Character selection](CHARACTERS.md) | UIDs, servers, shared logins and compatibility |
| [Scheduling](SCHEDULING.md) | Cron, random intervals/windows, persistence and jitter |
| [Authentication](AUTHENTICATION.md) | Cookies, stoken refresh and cookieKey sharing |
| [Redemption](REDEMPTION.md) | Supported games, credentials, cooldowns and retries |
| [HTTP/API](HTTP_API.md) | Request families, locale and validation limits |
| [Mimo and Hilichurl](EVENTS.md) | Tasks, rewards, character binding and failures |
| [Notifications](NOTIFICATIONS.md) | Telegram, Discord and Gotify setup |
| [Platform routing](ALLOWED_PLATFORMS.md) | Per-account notification selection |
| [Notification tests](TEST_NOTIFICATION.md) | Startup and manual delivery checks |
| [Google Apps Script](../services/google-script/README.md) | Standalone setup, triggers and limitations |
| [Development and troubleshooting](DEVELOPMENT.md) | Offline checks, contributions and releases |
| [Localization](../localization/README.md) | Catalog maintenance and fallback contracts |

Detailed request-profile internals remain in the [context reference](../gots/hoyolab-contexts/README.md).
The [setup directory](../setup/README.md) keeps platform guides and their original
screenshot credits. Existing configurations remain supported; stop previous
workers before migrating shared accounts or cache.
