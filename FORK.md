# HoYoUtils and HoyoLab Auto

HoYoUtils is independently maintained by [ste94pz](https://github.com/ste94pz).
It derives from [HoyoLab Auto](https://github.com/torikushiii/hoyolab-auto),
originally developed by torikushiii with contributions from its community.
The original [AGPL-3.0 license](LICENSE), notices and Git history are preserved;
fork maintenance does not replace original authorship. See [NOTICE.md](NOTICE.md).

HoYoUtils is an independent, community-maintained fork of HoyoLab Auto, originally
developed by torikushiii. It is not affiliated with, endorsed by, or officially
supported by HoYoverse or the original project's maintainer.

## Comparison baseline

This comparison uses the locally available upstream revision
[`1a93de87e13bf5d4d001153119518bed1aebfa39`](https://github.com/torikushiii/hoyolab-auto/commit/1a93de87e13bf5d4d001153119518bed1aebfa39)
against HoYoUtils `main`. It does not claim to track upstream's latest remote
revision. Individual contributions remain in Git history.

## Architectural and functional differences

| Area | Changes beyond that baseline | Implementation reference |
| --- | --- | --- |
| HTTP identities | Operation-specific DesktopWeb, AppWebView, Game Record and Passport profiles replace shared legacy profiles; locale is serialized per API | [Request contexts](gots/hoyolab-contexts/README.md) |
| Check-in and Notes | Per-game request descriptors; Genshin/HSR/ZZZ/HI3 confirm post-claim state; updated discovery and Notes contracts | [HTTP details](docs/HTTP_API.md) |
| Passport | Body-aware signing, dedicated SDK metadata, shared concurrent refresh per account, last-success log/cache timestamp | [Authentication](docs/AUTHENTICATION.md), [request helper](hoyolab-modules/passport-request.js) |
| Redemption | Browser requests for Genshin/HSR/ZZZ; Tears of Themis automatic and manual redemption with real character identity and legacy cache compatibility | [Redemption](docs/REDEMPTION.md) |
| Character/server selection | Explicit verified character in Genshin/HSR/ZZZ, propagated into character-specific operations; equivalent optional selection in standalone Apps Script | [Character selection](docs/CHARACTERS.md) |
| Hilichurl | Captured operation profiles, explicit-consent event binding, version/window validation and partial/failure reporting | [Events](docs/EVENTS.md) |
| Traveling Mimo | Per-operation task/shop/lottery profiles and request contracts, maintaining existing game eligibility, preferences and reward policies | [Events](docs/EVENTS.md), [request helper](hoyolab-modules/mimo-request.js) |
| Diaries | Genshin/HSR monthly summary parsing, two-month comparisons, existing two-hour cache; HSR month validation | [Features](docs/FEATURES.md) |
| Scheduling | Cron objects, completion-based random intervals, daily execution windows, persisted attempt protection, reminder timing and operation jitter | [Scheduling](docs/SCHEDULING.md) |
| Cooldowns | Public, permanent gift, event-reward and manual codes share per-account redemption waits and jitter | [Queue](crons/code-redeem/utils.js) |
| Reliability and privacy | Telegram polling concurrency protection, HTTP credential redaction, Hilichurl diagnostics and invalid Genshin countdown handling | [Telegram](platforms/telegram.js), [redactor](object/redact-http.js) |
| Tests and localization | Expanded HTTP, configuration, scheduling, selection, failure/concurrency and Google-service regression cases; corresponding Italian messages and warning cleanup | [Tests](tests), [localization](localization/README.md) |

API language selection and software localization were already accepted upstream
(PRs #134 and #147). Shared cookie configuration, Gotify, code queues and portions
of the event/shop functionality also predate this fork's changes; the table
identifies extensions or corrections rather than claiming those entire features
as new authorship. The configuration generator retains its Capoouo credit.

## Compatibility and validation

Existing `config.json5`, game aliases (including `termis`), API identifiers and
cache keys remain valid. Omitting explicit character selection retains automatic
selection; a configured invalid selection fails rather than choosing another
character. Hilichurl binding requires explicit selection and consent. Cookie-only
check-in remains account-wide. ToT's absent/false/true redemption settings retain
their distinct behavior. Cron strings remain accepted alongside schedule objects.

HSR/ZZZ browser redemption requires `_MHYUUID`; refreshed tokens remain in memory
and do not rewrite config.json5. Request contents differ intentionally from the
upstream baseline for the APIs covered by the HTTP refactor. This rebranding
itself changes display identity, documentation and deployment/build metadata;
it preserves request profiles, defaults and data contracts. The legacy default
User-Agent and Docker runtime/container identifiers are retained for compatibility.

Tests validate synthetic requests and application behavior. Historical official
client and bot observations have limited account/operation coverage; no blanket
live-tested claim is made. See [HTTP limitations](docs/HTTP_API.md) and the
[Google Apps Script guide](services/google-script/README.md). Unsupported qiuqiu
lottery remains latent; no new feature is inferred from its internal methods.

## Independent maintenance

HoYoUtils develops on `main`, with optional short-lived feature/fix branches.
Ordinary release branches are unnecessary. Releases use tested Git tags and
GitHub Releases, with separately controlled versioned GHCR publication.

Upstream remains a credited source of useful fixes and reference implementations.
Future updates may be incorporated selectively after reviewing API behavior,
configuration, data compatibility and regressions. There is no commitment to
mirror upstream automatically or structure HoYoUtils work around upstream PRs.
