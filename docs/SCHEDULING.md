# Randomized scheduling and request jitter

[Documentation index](README.md) · [HoYoUtils](../README.md)

Each job has one schedule under `crons`: choose `cron`, `interval`, or
`daily-window`. Fixed cron schedules remain the default; existing string values
such as `checkIn: '0 0 0 * * *'` are still supported. Omitted jobs keep their
built-in schedules.

The internal polling jobs `dailiesReminder`, `howlScratchCard`, and
`weekliesReminder` retain their built-in fixed schedules. Schedule objects for
these jobs are rejected; legacy string overrides remain ignored.
Whitelist/blacklist filters apply before schedule validation.

These three reminder jobs automatically select a random time per account within
the remaining part of their existing five-minute window, using the account's
server time or the configured dailies timezone. Choices and attempt markers
persist in the cache; each account receives at most one attempt per reminder and
local date, including failed requests. Polling schedules stay fixed, but
one-shot timers invoke the API at the selected time. A restart reuses the choice
while the window is open; expired windows are skipped.

Mimo/Hilichurl operation pauses (including Hilichurl browse/watch read times)
and shared code redemption cooldown waits automatically add a fresh random delay
of 0–2 seconds to their required minimum waits. Public codes, reward codes,
permanent gift codes and manual redemptions use the same per-account redemption
queue. This also applies when these operations are invoked manually.
Server-requested redemption cooldowns remain a lower bound. Mimo/Hilichurl
rate-limit retry delays, Telegram polling, Diary, and the separate Google Apps
Script implementation are not controlled by these scheduling options.

```json5
crons: {
    stamina: { mode: 'cron', expression: '0 */30 * * * *' },
    expedition: { mode: 'interval', min: '30m', max: '1h' },
    checkIn: { mode: 'daily-window', start: '00:30', end: '02:00' },
},
```

Interval bounds accept one or more number/unit pairs: `ms`, `s`, `m`, `h`, `d`,
or `w` (for example `30m`, `1.5h`, `1h30m`, or `1d 2h`). Components are added
together. Days and weeks mean fixed durations of 24 hours and 7 days. Interval
mode enforces a minimum delay of **5 minutes** after completion: both bounds
must be at least `5m`, with `max >= min`. Shorter durations are rejected at
startup, including equivalent values in seconds or milliseconds.

The example selects a new 30–60 minute delay after each execution **completes**,
preventing overlap; an expired interval at startup gets a fresh delay. Daily
windows use local process time (`HH:mm`; equal start/end is rejected) and invoke
a job at most once per local date. A saved choice due earlier today runs once on
restart; starting after the window without a saved choice waits until tomorrow.
Timers may run late if the process is busy or suspended.

An end earlier than the start crosses midnight: `checkIn: { mode:
'daily-window', start: '23:00', end: '01:00' }`. Each window permits one attempt
and retains its identity across midnight and restarts. Startup after midnight
uses the remaining part of the active window. A choice due before midnight can
still run until that window ends. To preserve the one-attempt-per-local-date
limit, an attempt after midnight restricts the following window to its next-day
portion.

Schedules and daily attempt markers persist in `data/cache.json`. Keep this file
across restarts and run only one application process per cache; deleting it
resets these protections. Failed daily attempts wait for the next day. Disable
`mimoJitter`/`hilichurlJitter` (set to `0`) before randomizing that job;
combining them is rejected. Whitelist/blacklist rules still apply. Mimo restock
runs keep their fixed upstream times in every schedule mode; set `mimoRestock:
false` to disable these extra runs.

The setup generator offers all three modes and exports the unified object
format, while preserving imported cron options it does not expose. This feature
provides scheduling variability, not account-safety guarantees.
