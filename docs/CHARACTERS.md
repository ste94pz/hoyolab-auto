# Character selection and multiple servers

[Documentation index](README.md) · [HoYoUtils](../README.md)

For Genshin Impact, Honkai: Star Rail, and Zenless Zone Zero, select a character
explicitly in each `accounts[].data[]` entry when the account has characters on
multiple servers:

```json5
character: { uid: '123456789', region: 'os_euro' },
```

Use the in-game character UID as a string, not the HoYoLAB account ID. The bot
verifies that UID and server against the characters linked to the account at
login. An invalid or unavailable selection stops that account's login rather
than selecting another character. The selected identity is used for code
redemption, Notes, diaries, and other character-specific operations. Cookie-only
check-in APIs keep their existing account-wide behavior. Omit `character` or use
`null` to retain the previous automatic selection. The setup page can import,
edit, and export the selection without accessing your account.

| Game | Server codes |
| --- | --- |
| Genshin Impact | `os_usa`, `os_euro`, `os_asia`, `os_cht` |
| Honkai: Star Rail | `prod_official_usa`, `prod_official_eur`, `prod_official_asia`, `prod_official_cht` |
| Zenless Zone Zero | `prod_gf_us`, `prod_gf_eu`, `prod_gf_jp`, `prod_gf_sg` |

## Multiple entries and event ownership

Each entry selects one character. Separate game UIDs and server codes are used
for character-specific Notes, diaries and redemption. One shared login still has
account-wide check-in and event state; selecting multiple characters does not
create independent event balances or daily claims. Avoid duplicate event jobs for
the same login/game. Use [cookieKey](AUTHENTICATION.md#sharing-one-cookie-across-games)
to share credentials without duplicating their configuration.

[Hilichurl binding](EVENTS.md) needs separate explicit consent. Traveling Mimo
uses its existing account/event identifiers; selected characters control the
redemption of returned codes. ToT uses its existing Global role discovery;
HI3 and ToT do not accept the Node character option.

The [Google Apps Script](../services/google-script/README.md) has a separate,
backward-compatible cookie-string/object configuration; Node config is not
interchangeable with it.
