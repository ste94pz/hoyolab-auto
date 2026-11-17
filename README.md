<!-- markdownlint-disable MD033 MD013 -->
<h1 align="center">
  <img width="200" src="assets/HoYoUtils.png" alt="HoYoUtils logo"><br>
  HoYoUtils
</h1>

<p align="center">
  <a href="https://github.com/ste94pz/hoyoutils/actions/workflows/ci.yaml"><img src="https://github.com/ste94pz/hoyoutils/actions/workflows/ci.yaml/badge.svg" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/ste94pz/hoyoutils" alt="AGPL-3.0 license"></a>
  <a href="https://github.com/ste94pz/hoyoutils"><img src="https://img.shields.io/github/stars/ste94pz/hoyoutils" alt="GitHub stars"></a>
  <img src="https://img.shields.io/badge/Node.js-22%20%7C%2024%20%7C%2026-green" alt="Node.js CI matrix">
</p>
<!-- markdownlint-enable MD033 MD013 -->

Unofficial automation and utility toolkit for HoYoverse games.
Daily check-ins, reminders, code redemption and event utilities, maintained by
[ste94pz](https://github.com/ste94pz).

HoYoUtils is an independent, community-maintained fork of HoyoLab Auto,
originally developed by [torikushiii](https://github.com/torikushiii/hoyolab-auto).
It is not affiliated with, endorsed by, or officially supported by HoYoverse or
the original project's maintainer.

Development uses `main` in `ste94pz/hoyoutils`. Use local Docker builds until
versioned release images are published.

## Improvements over the original project

- Operation-specific browser, WebView and Passport HTTP profiles.
- Body-aware cookie refresh, concurrent refresh protection and success timestamps.
- Tears of Themis redemption and explicit character/server selection in both the
  Node bot and Google Apps Script.
- Hilichurl binding with explicit consent and accurate partial/failure reporting.
- Updated diaries/events, shared redemption cooldowns, randomized scheduling
  and request jitter.
- Telegram polling concurrency protection, HTTP credential redaction and
  expanded offline regression coverage.

See [FORK.md](FORK.md) for the exact upstream comparison baseline, inherited
features and compatibility details.

## Games and availability

| Game | Check-in | Notes/reminders | Diary | Redemption | Events |
| --- | --- | --- | --- | --- | --- |
| Honkai Impact 3rd | Yes | — | — | Outside the bot | — |
| Tears of Themis | Yes | — | — | Opt-in/commands | — |
| Genshin Impact | Yes | Yes | Yes | Yes | Hilichurl |
| Honkai: Star Rail | Yes | Yes | Yes | Yes | Mimo |
| Zenless Zone Zero | Yes | Yes | — | Yes | Mimo |

See [feature details and limitations](docs/FEATURES.md). Availability depends on
account eligibility and the current HoYoLAB services; automation is unofficial.

## Installation

Use Git and Node.js **24 LTS** (CI also covers 22 and 26), or Docker with Compose
v2. Keep your account cookies private:

```bash
git clone https://github.com/ste94pz/hoyoutils.git
cd hoyoutils
npm ci
cp default.config.json5 config.json5
```

Edit `config.json5` using [the defaults](default.config.json5), or use
`npm run setup:windows` / `npm run setup:linux` to open the local generator.
Configure cookies, games and notification platforms, then run `npm start`.
Existing configurations and `data/cache.json` remain compatible. Stop the old
worker before switching to HoYoUtils.

[Full installation and upgrades](docs/INSTALLATION.md) ·
[Cookies and refresh](docs/AUTHENTICATION.md) ·
[Character selection](docs/CHARACTERS.md)

## Docker

Configure `config.json5`, prepare writable `data/` and `logs/` directories, then
run `make build` and `make up`. The default builds this checkout locally as
`ghcr.io/ste94pz/hoyoutils:local`. Published versioned images can be selected
explicitly after release publication.

Read [Docker deployment and migration](docs/DOCKER.md) for permissions, persistent
paths, image selection and stopping an existing installation safely.

## Documentation

Start at the [documentation index](docs/README.md): installation, Docker,
games, character selection, scheduling/jitter, authentication, redemption,
HTTP profiles, Mimo/Hilichurl, notifications and troubleshooting.

For a serverless alternative, see [Google Apps Script](services/google-script/README.md).
For translations, see [localization maintenance](localization/README.md).

## Testing and contributions

```bash
npm ci
npm test
npm run lint
```

The suite uses synthetic data and mocked transports without account credentials
or authenticated network calls. CI checks Node 22/24/26. The pre-transition
implementation was also reported tested on Node 20; it remains accepted by
package metadata, but is end-of-life and is not recommended for deployment.
Offline tests do not prove complete live backend, Google transport or notification
delivery coverage. See [validation limits](docs/HTTP_API.md).

Issues and pull requests for HoYoUtils are welcome. Discuss substantial changes
in an issue first; branch from `main`. Include focused changes, compatibility
notes and checks.
See [development and testing](docs/DEVELOPMENT.md).

## License and credits

Software is licensed under [AGPL-3.0](LICENSE). Original authorship, contributors
and Git history are preserved; see [notices](NOTICE.md) and [fork history](FORK.md).
The configuration generator credits [Capoouo](https://github.com/Capoouo).
The logo is [AI-generated fan artwork inspired by Mimo](assets/README.md), with
artwork terms separate from the software license. No rights in HoYoverse's
characters or trademarks are claimed.

## Support

Support HoYoUtils development through issues, contributions, sharing the project,
or [Ko-fi](https://ko-fi.com/ste94pz5361).

[![Support HoYoUtils on Ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/ste94pz5361)
