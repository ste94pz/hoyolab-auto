# Cookie authentication and automatic refresh

[Documentation index](README.md) · [HoYoUtils](../README.md)

For a detailed usage guide, refer to this gist: [Cookie
Guide](https://gist.github.com/torikushiii/59eff33fc8ea89dbc0b2e7652db9d3fd).

The configured cookie must contain `ltoken_v2`, `ltuid_v2` and `ltmid_v2`, even
when `stoken` is present. Redemption also uses `cookie_token_v2`,
`account_id_v2` and `account_mid_v2`.

If your cookie also contains `stoken`, HoYoUtils uses it with the account's
`ltmid_v2` to refresh `ltoken_v2` and `cookie_token_v2` before game login at
startup, every two hours by default, and after recognized redemption login
errors before retrying. Normal requests reuse the current tokens; `stoken` is
only sent to Passport for refresh. Without `stoken`, the configured tokens are
used until they need replacing manually.

A successful refresh updates both tokens in memory across games sharing the
HoYoLAB account. A failed refresh leaves the current cookies unchanged. Neither
`config.json5` nor `stoken` is updated, so each restart loads the configured
cookies again. Only one game entry needs `stoken` for a shared HoYoLAB account.
Concurrent refresh attempts for that account share one request within one
process. Successful refreshes log the account ID and UTC timestamp; the latest
success time is also saved in `data/cache.json` under
`hoyolab:cookie-refresh:<account-id>:last-success`, without cookies or tokens.
A cache-write failure is logged and does not undo a successful refresh.

Keep the configured cookie private. Cookies copied from normal HoYoLAB website
requests usually do not include `stoken`. The optional [HoYoLAB cookie
helper](https://github.com/Smexhy/hoyolab-cookie-helper) obtains it through an
app login flow on Windows, macOS, or Linux. It is a third-party helper and is
only needed for automatic cookie refresh.

### Sharing one cookie across games

If several games use the same HoYoLAB login, you can define the cookie once in a
top-level `cookies` list and point each account entry at it with `cookieKey`:

```json5
cookies: {
    main: 'your cookie here',
},
accounts: [
    {
        id: 3,
        active: true,
        type: 'genshin',
        data: [
            {
                cookieKey: 'main',
                // ...other options
            },
        ],
    },
],
```

A `cookie` set directly on an entry always takes priority over `cookieKey`, so
existing configs keep working unchanged. If `cookieKey` does not match any entry
in `cookies`, a warning is logged and that account is skipped.
