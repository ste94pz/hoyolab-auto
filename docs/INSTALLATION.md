# Installation and configuration

[Documentation index](README.md) · [HoYoUtils](../README.md)

## Requirements

- [Git](https://git-scm.com/downloads)
- [Node.js](https://nodejs.org/en/) 24 LTS recommended; CI covers 22, 24 and 26.
  Node 20 retains configuration/runtime compatibility but is end-of-life.

## Installation

1. Clone `https://github.com/ste94pz/hoyoutils.git` and enter its directory.
   Development uses `main`.
2. Run `npm ci` to install the dependencies.
3. You can configure your config using one of the following methods:

    1. **Using the Setup Script:**
      - For Windows, run the following npm script from the project root:

        ```bash
        npm run setup:windows
        ```

      - For Linux, use this command:

        ```bash
        npm run setup:linux
        ```

      - These commands will automatically open your default web browser to help
        you configure your settings through a web-based interface.

    1. **Manual Configuration:**
      - Copy the `default.config.json5` file to create a `config.json5` file:

        ```bash
        cp default.config.json5 config.json5
        ```

      - Open `config.json5` and update it with your application's configuration
        settings.

4. Follow the instructions in the `default.config.json5` or `config.json5` file.
5. Run the application:

   ```bash
   npm start
   ```

### Language

The Node.js application defaults to `en-us`. Set the top-level `language` option
in
`config.json5` to another lowercase HoYoLAB locale, for example:

```json5
language: 'it-it',
```

This sets the existing HoYoLAB language headers and locale fields used by
diaries, Genshin code redemption, Mimo, and Hilichurl. Genshin daily check-in
requests (`info`, `home`, and `sign`) also use this locale in their `lang` query
parameter. The same option selects the software language for commands,
notifications, logs, errors, and the setup generator. An exact regional catalog
(such as `it-ch.js`) takes precedence over the generic language catalog
(`it.js`). English and Italian are included; unsupported software locales and
missing translations fall back to English without changing the configured API
locale. For example, `language: 'ja-jp'` still requests Japanese from HoYoLAB
while the software uses English. Restart the application after changing its
language. Game names, command names, configuration keys, and API-provided text
are not translated by the software.

The setup generator switches language when this field changes or a configuration
is imported, and preserves the locale when exporting. Startup errors before a
configuration can be read remain in English. See [translation
maintenance](../localization/README.md) for adding or updating a language through
one catalog file.

### Cache File Location

After running the application for the first time, a cache file will be
automatically created at:

```text
./data/cache.json
```

This file stores temporary data to improve performance and reduce API calls. The
`data/` directory structure will look like this:

```text
project-root/
├── data/
│   ├── cache.json    # Auto-generated cache file
│   └── README.md     # Cache documentation
├── logs/             # Application logs (if logging is enabled)
├── config.json5      # Your configuration file
└── ...
```

**Important Notes:**

- The cache file is automatically managed by the application
- Do not manually edit the cache file
- The cache file will be recreated if deleted
- Deleting the cache resets pending-code history, schedule choices and attempt
  protections; back it up and stop the application first
- The `data/` directory must be writable by the application

## Migration

> [!NOTE]
> If you're using this project since the `config.js` file or `config.jsonc` and
you're updating to the latest version, please run the following command to
migrate your configuration to the new format.

```bash
npm run migrate
```

or

```bash
node convert.js
```

## Upgrading to HoYoUtils

Existing config keys, account types (including `termis`), cookieKey references,
API identifiers and cache keys are preserved. Keep config.json5, data/ and logs/;
stop the old process before starting HoYoUtils with the same accounts/cache.
Back up those files privately before upgrading. Use `npm ci` after updating the
source. No cache reset or config rename is required for this rebranding.

See [cookie authentication](AUTHENTICATION.md), [character selection](CHARACTERS.md),
[notifications](NOTIFICATIONS.md) and [Docker migration](DOCKER.md#migration).
