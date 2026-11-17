# Cache Directory

This directory contains the application's cache file and related data.

## Cache File

The script will auto-generate a `cache.json` file in this directory once it has
been run for the first time.

### What is cached?

- Game account data (stamina, expeditions, etc.)
- API response data to reduce server load
- Temporary data to improve application performance
- Reward and manually entered codes waiting for redemption after a temporary
  failure. The code redemption job retries these while `redeemCode` is enabled
  for the account, even if no new public codes are available.
- Persistent randomized schedules and daily attempt markers (when enabled)

### Cache File Location

- **Standard Installation**: `./data/cache.json`
- **Docker Installation**: `/app/data/cache.json` (inside container)

### Important Notes

- **Do not manually edit** the cache file - it's managed automatically
- The cache file will be **recreated if deleted**
- Temporary cache data expires automatically; scheduler state does not
- Deleting the cache also resets schedules and daily attempt markers,
  potentially allowing another attempt that day
- Deleting the cache also removes pending reward codes. Redeem any failed reward
  codes first if you want to keep their rewards.
- Ensure this directory has **write permissions** for the application

### Troubleshooting

If you encounter cache-related issues:

1. Stop the application and back up `cache.json` privately.
2. Check logs and configuration before resetting state.
3. Only if an intentional full reset is needed, remove `cache.json` and restart.

The cache will be rebuilt from fresh API data, but pending codes and attempt
protections cannot be reconstructed from those reads. Keep the backup for recovery.
