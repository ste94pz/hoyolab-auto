# Notifications and integrations

[Documentation index](README.md) · [HoYoUtils](../README.md)

For setting up Discord or Telegram notifications, refer to the [setup guides](../setup/README.md).

[Gotify notifications](../setup/GOTIFY.md) are also supported. Configure a
`gotify`
platform with your server URL and application token to receive check-in results,
reminders, redemption results, and cookie alerts. The setup generator can import
and export these settings. Per-account `allowedPlatforms` routing applies to
Gotify.

- [Telegram bot and commands](../setup/TELEGRAM.md)
- [Discord webhooks](../setup/DISCORD_WEBHOOK.md)
- [Gotify](../setup/GOTIFY.md)
- [Per-account routing](ALLOWED_PLATFORMS.md)
- [Startup and manual notification tests](TEST_NOTIFICATION.md)

Telegram polling prevents overlapping poll loops; temporary polling failures
retain its existing retry behavior. Test commands send real notifications when
run in the application; the offline regression suite does not deliver messages.

Default project avatars reference the approved local asset through the planned
GitHub raw URL on main. They become available once the renamed repository's
main branch exposes assets/HoYoUtils.png publicly; until then those remote
avatars may be absent. Custom account/game icons retain their existing behavior.
