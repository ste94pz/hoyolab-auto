# Traveling Mimo and Hilichurl Workshop

[Documentation index](README.md) · [HoYoUtils](../README.md)

## Traveling Mimo

HSR and ZZZ support task processing and point collection, shop exchanges,
purchase history and optional lottery. Automatic task completion is limited to
types 1 and 2. Event/version and reward IDs come from server responses.
Configured reward preferences, reservePoints, retry/backoff and lottery opt-in
remain in effect. A reward can return no code; returned codes use the shared
[redemption path](REDEMPTION.md). Eligibility and stock are controlled by the event.

## Hilichurl Workshop

Hilichurl Workshop automatically completes task types `1`, `2`, `4`, `10`,
`101`, and `102`. Reading and video tasks (`101`/`102`) wait for the supplied
`read_seconds` plus one second when positive, then use the desktop event API;
other task operations use the event WebView API. Available rewards from
completed tasks can still be collected regardless of type. Successful cosmetic
exchanges may return no redemption code; successful official point-cost
exchanges have also been observed. The wait is covered by offline tests; those
tests alone do not establish
backend acceptance or a universally sufficient waiting period.

Hilichurl events can require a character association separate from HoYoLAB
login. With an explicit `character` selection, set `hilichurl.bindCharacter: true`
to allow the automation to link that character to an unbound event. This option
is **false by default** and changes the event's account association when enabled.
The bot confirms the resulting UID, server, and event version before processing
tasks or rewards. It refuses an existing association with another character;
it never silently replaces that association. Restock lookups do not create
associations. An unbound event without this opt-in produces an actionable error.

Hilichurl validates the event version and advertised activity dates before
running. Failed reads or operations produce warnings and an unsuccessful result
with errors, retaining any completed work. Results distinguish successful runs,
successful runs without activity, partial runs, and failures; API failures are
never reported as “no new activity”.

See [scheduling and operation jitter](SCHEDULING.md) and
[request profiles and validation limits](HTTP_API.md). Genshin lottery is not a
supported cron, command or configuration option.
