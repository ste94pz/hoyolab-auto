# Development, testing and troubleshooting

[Documentation index](README.md) · [HoYoUtils](../README.md)

## Local development

Use Node 24 LTS and the committed npm lockfile. Run `npm ci`, `npm test`,
`npm run lint` and `git diff --check`. CI uses Node 22, 24 and 26 with the same
lockfile and checks that localization index generation leaves no changes.
The pre-transition implementation was reported tested on Node 20 as well;
package engines retain >=20 compatibility, but Node 20 is end-of-life.

Tests use Node's built-in test runner and synthetic credentials/transports.
Google Apps Script services are simulated. Tests do not start the bot, redeem
real codes or deliver notifications. `npm start` and startup/manual notification
tests operate against configured accounts and services. Distinguish offline
regression checks from any separately scoped live validation.

The lockfile records the versions already installed at migration, without a
requested dependency upgrade. Update dependencies deliberately in a separate
change. Production Docker uses `npm ci --omit=dev`; dev dependencies are needed
for lint. `npm run localization:index` regenerates the setup catalog index.

## Contributions

Open issues and PRs against HoYoUtils; discuss large changes first. Use focused
commits, CommonJS conventions and existing configuration/cache/logging helpers.
Branch from `main`. Preserve existing config behavior and explain any intentional
compatibility changes.
Include documentation and proportionate tests for changed behavior. If you are
new to GitHub, see this [first pull request guide](https://www.freecodecamp.org/news/how-to-make-your-first-pull-request-on-github-3#let-s-make-our-first-pull-request-).

Keep account cookies, tokens, exported config, logs and captures out of issues,
PRs and commits. Retain original and third-party credits. Upstream updates are
selected after compatibility review, rather than merged automatically.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Missing configuration | Create config.json5 or set CONFIG_PATH; for Docker verify a file is mounted at /app/config.json5 |
| Authentication alert | Replace the affected cookie; successful check-in does not validate redemption tokens |
| Missing _MHYUUID | Acquire a fresh browser cookie for HSR/ZZZ redemption; other operations may still work |
| Notes error 10102 | Enable Realtime Notes in the Genshin Battle Chronicle privacy settings yourself |
| Invalid selected character | Verify game UID and exact server; no automatic fallback is used for an explicit mismatch |
| Unbound/mismatched Hilichurl event | Review the selected character and explicit binding consent; the bot will not replace an existing different association |
| Failed or partial event run | Inspect controlled warnings and retained completed work; failure is not “no new activity” |
| Container permission error | Match the container UID/GID and bind permissions; see Docker guide |
| Missing notifications | Check platform setup and allowedPlatforms, then use the explicit notification tests |
| Scheduling after restart | Preserve data/cache.json and use one worker; inspect timezone/window rules before deleting state |
| Missing Genshin Encounter Point countdown | Invalid/missing values or values over 366 days display “Not available” |

Do not delete cache casually: it contains pending reward codes, history and daily
attempt protections. Back it up with the process stopped before an intentional
reset. Logs may contain account identifiers even with credential redaction.

## Release preparation

GitHub-side operations are performed separately by the maintainer:

1. Review links, branch protection, CI checks, review permissions, description
   and homepage for ste94pz/hoyoutils, with main as the default branch.
2. Create a tested vMAJOR.MINOR.PATCH Git tag and GitHub Release, preserving
   attribution and supplying the corresponding source under AGPL-3.0.
3. Enable Actions, inspect GHCR package access/visibility and grant GITHUB_TOKEN
   package-write access as needed. The image workflow uses no personal token.
4. Dispatch Docker image with the existing release tag and publish=false first.
   It validates the tag, runs tests/lint, then builds amd64/arm64 without pushing.
5. Only when ready, set repository variable HOYOUTILS_PUBLISH_ENABLED=true and
   dispatch that same tag with publish=true. Publication also requires the exact
   ste94pz/hoyoutils repository identity. Review the resulting package and source
   link before sharing deployment instructions.

No push or release event automatically publishes an image.
Only exact version tags are published; no latest alias is assigned. Reproducible
npm dependencies do not make the entire image byte-identical: the base tag and
system package repositories can change. See [Docker](DOCKER.md).
