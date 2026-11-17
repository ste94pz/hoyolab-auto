# Code redemption

[Documentation index](README.md) · [HoYoUtils](../README.md)

Genshin code redemption uses the browser gift endpoint for both commands and
automatic redemption, without DS or native-app headers. The configured language
is sent as a short language code; `sLangKey` remains `en-us`, matching the
observed gift-page requests. Existing account eligibility and code-cache
behavior are preserved.

Public codes, event rewards, and manual redemptions share a per-account cooldown
queue. Temporary failures leave reward and manual codes pending for the
code-redemption job to retry while `redeemCode` is enabled, including when no
new public codes are available.

Already-redeemed and usage-limit notifications show the result without
suggesting manual redemption.

Tears of Themis automatic and command redemption share its browser GET endpoint
after looking up the linked character with the account's cookie. Its setup
option is `redeemCode` inside the `termis` account's `data` entry: `true`
enables automatic and command redemption, `false` disables code handling, and
existing configurations without the option keep manual-code notifications and
allow command redemption. The existing public-code baseline/cache is preserved,
so enabling it does not replay previously seen codes. Temporary redemption
failures remain pending for subsequent runs while automatic redemption is
enabled. Honkai Impact 3rd still requires redemption outside the bot; `/redeem`
supports Genshin, HSR, ZZZ and ToT.

If the ToT character cannot be loaded, daily check-in remains available, but the
account is omitted from redemption selectors. Restore the linked
character/redemption cookie, then restart the bot and reopen `/redeem` to load
its identity.

Honkai: Star Rail and Zenless Zone Zero redemption also use their captured
browser gift endpoints. Their POST requests require the configured cookie's
`_MHYUUID` value as both the browser identity cookie and `device_uuid`; if it is
missing, redemption is skipped and the account needs a newly acquired cookie.
Other account features remain available.

See [authentication](AUTHENTICATION.md) and [character selection](CHARACTERS.md).
Automatic retries respect the existing cache, per-account queue and server
cooldown. Keep data/cache.json when upgrading. Do not assume every catalog code
is valid for your account or that a successful API response proves in-game mail
delivery. Apps Script has its [own history and retry rules](../services/google-script/README.md).
