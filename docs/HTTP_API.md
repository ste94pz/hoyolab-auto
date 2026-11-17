# HoYoLAB HTTP profiles and limitations

[Documentation index](README.md) · [HoYoUtils](../README.md)

Genshin daily check-in uses the desktop web event API and reports a new claim as
successful only after a follow-up status request confirms today’s check-in.

HSR, ZZZ, Honkai Impact 3rd, and Tears of Themis check-in use game-specific
WebView requests without DS. The configured locale is sent in GET queries and in
sign JSON for HSR/ZZZ/Themis, or the sign query for Honkai Impact 3rd.
The application confirms HSR, ZZZ and Honkai Impact 3rd status after claiming.
Tears of Themis does not perform that internal follow-up confirmation.

Genshin account discovery and Realtime Notes use the current Game Record APIs.
If Notes reports error `10102`, enable Realtime Notes in HoYoLAB's Genshin
Impact Battle Chronicle settings. The application does not change your privacy
settings.

In Genshin Notes, "Refresh in" refers to stored Encounter Points. Missing,
invalid, or implausible countdowns (over 366 days) are displayed as "Not
available" on Telegram and Discord.

HSR account discovery and Realtime Notes, and Honkai Impact 3rd account
discovery, use signed desktop Game Record APIs while preserving the configured
language. Their request and result/cache contracts are tested offline. Test
success
alone does not prove live authentication for a particular account.

ZZZ account discovery and Realtime Notes use the current Game Record WebView
APIs without DS, preserving the configured locale and existing Notes/cache
output.

## Profiles and authentication boundaries

See the [maintainer request-context reference](../gots/hoyolab-contexts/README.md)
for DesktopWeb, AppWebView, Game Record and Passport profiles. Cookie and DS
requirements differ per API; a successful check-in does not validate redemption
authentication. Do not interchange HoYoLAB IDs, game UIDs or device identities.
Do not change default User-Agent values solely for project branding: the legacy
`Custom fork of HoyoLabAuto` default and the code-catalog `HoyoLabAuto@<hash>`
User-Agent are retained for wire compatibility.

Tests cover request construction, serialization, signatures, locale mapping and
synthetic response handling. They do not establish universal minimum backend
metadata, token lifetime, challenge handling or every game's eligibility. Official
client observations, historical bot runs and offline tests have different scopes;
none guarantees current success for every account. ToT headless redemption and
the deployed Google Apps Script transport have no live acceptance claim here.
The internal qiuqiu lottery methods remain unsupported and unverified.
