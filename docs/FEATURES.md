# Games and features

[Documentation index](README.md) · [HoYoUtils](../README.md)

| Game | Check-in | Notes and reminders | Monthly diary | Code redemption | Events |
| --- | --- | --- | --- | --- | --- |
| Honkai Impact 3rd | Yes | — | — | Manual outside the bot | — |
| Tears of Themis | Yes | — | — | Automatic opt-in and commands | — |
| Genshin Impact | Yes | Yes | Yes | Automatic and commands | Hilichurl Workshop |
| Honkai: Star Rail | Yes | Yes | Yes | Automatic and commands | Traveling Mimo |
| Zenless Zone Zero | Yes | Yes | — | Automatic and commands | Traveling Mimo |

Availability describes implemented support, not guaranteed backend eligibility.
Events, rewards and account requirements can change. Check-in defaults to local
midnight; configurable schedules are described in [scheduling](SCHEDULING.md).

Daily reminders use game server time by default. Set
`crons.dailiesReminderTimeZone`
to an IANA timezone such as `America/New_York` to use local time with
daylight-saving changes.

- **Honkai Impact 3rd**:
  - **Daily check-in**: Runs every midnight local time.

- **Tears of Themis**:
  - **Daily check-in**: Runs every midnight local time.
  - **Code Redeems**: Automatically redeem new public codes when the account's
    `redeemCode` is `true` (default: `false`), or submit a code with `/redeem`
    in Telegram or Discord. The account selector shows the Global server, ToT
    character UID and nickname loaded at login. In Telegram, select the ToT
    account and enter the code. Requires a linked game character and redemption
    cookies. Uses the [official gift website](https://tot.hoyoverse.com/gift/);
    no HoYoLAB app redemption is needed.

- **Genshin Impact**:
  - **Daily check-in**: Runs every midnight local time.
  - **Dailies**: Reminds you to do your dailies at the configured time (21:00
    game server time by default).
  - **Weeklies**: Reminds you to do your weekly bosses/discounted resin if you
    haven't done them at 21:00 game server time.
  - **Stamina check**: Reminds you to spend your resin if you're at your set
    threshold or capped.
  - **Expedition check**: Check your expeditions and sends a notification if
    they're done.
  - **Realm currency**: Sends a notification if your realm currency is capped.
  - **Code Redeems**: Search for codes and redeem them automatically.
  - **Traveler's Diary**: Check current and previous monthly currency totals and
    official category breakdowns in your configured language. Results are cached
    for two hours. A percentage comparison is unavailable when the previous
    month has no Primogem income.
- **Honkai: Star Rail**:
  - **Daily check-in**: Runs every midnight local time.
  - **Dailies**: Reminds you to do your dailies at the configured time (21:00
    game server time by default).
  - **Stamina check**: Reminds you to spend your stamina if you're at your set
    threshold or capped.
  - **Expedition check**: Check your expeditions and sends a notification if
    they're done.
  - **Code Redeems**: Search for codes and redeem them automatically.
  - **Trailblazer Monthly Calendar**: Check current and previous monthly
    Jade/Pass totals and official category breakdowns in your configured
    language. Results are cached for two hours. A percentage comparison is
    unavailable when the previous month has no Jade income.
  - **Traveling Mimo**: Automatically complete Mimo tasks, claim points, and
    exchange for Stellar Jade.
- **Zenless Zone Zero**:
  - **Daily check-in**: Runs every midnight local time.
  - **Dailies**: Reminds you to do your dailies at the configured time (21:00
    game server time by default).
  - **Stamina check**: Reminds you to spend your stamina if you're at your set
    threshold or capped.
  - **Daily Lottery**: Notifies you at 21:00 game server time if you haven't
    claimed the daily lottery reward. Set `dailyLotteryCheck` to `false` on a
    ZZZ account to disable it.
  - **Shop Status**: Notifies you if the shop has finished selling videos.
  - **Code Redeems**: Search for codes and redeem them automatically.
  - **Traveling Mimo**: Automatically complete Mimo tasks, claim points, and
    exchange for Polychrome.

Weekly reminders only run for Genshin Impact, Honkai: Star Rail, and Zenless
Zone Zero.
