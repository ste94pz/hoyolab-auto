# Docker deployment and migration

[Documentation index](README.md) · [HoYoUtils](../README.md)

Install Docker with the Compose v2 plugin. Use a checkout of this repository and
create `config.json5` as described in [installation](INSTALLATION.md).
The Compose service is `instance`. Host configuration, cache and logs retain
their paths: `./config.json5`, `./data`, `./logs` mounted under `/app`.
Create config.json5 as a file before starting; a missing bind source can become
a directory. Set `CONFIG_PATH` only for custom deployments and adjust its mount.

## Local build (available before repository/GHCR migration)

```bash
mkdir -p data logs
make build
make up
```

Compose builds locally by default, tagged `ghcr.io/ste94pz/hoyoutils:local`.
No upstream image is pulled. `make up` builds and starts; `make update` refreshes
the base image, rebuilds and recreates the service in sequence. Docker uses Node
24 LTS and `npm ci --omit=dev` with the committed lockfile. Dependency versions
are locked; the `node:24-alpine` base tag receives updates when rebuilt with pull.
Node's [release schedule](https://github.com/nodejs/Release#release-schedule)
lists 22, 24 and 26 as supported LTS lines at the November 2026 migration;
20 is end-of-life. The runtime remains compatible with existing configuration.

Equivalent commands:

```bash
docker compose build
docker compose up -d --build --pull never
docker compose logs -f instance
docker compose exec instance sh
docker compose down
```

`make logs`, `make exec`, `make restart` and `make down` provide shortcuts.
Restart restarts the existing container; use update/up to apply rebuilt code.
Down removes containers/networks and leaves bind-mounted data in place. Run
`make help` for the command list. The image's Alpine shell is `sh`, not Bash.

## Bind-mount permissions

The image retains the existing non-root `hoyolab` user/group. Determine the
numeric identity from your locally built image without starting the bot:

```bash
docker compose run --rm --no-deps --entrypoint id instance
```

Grant that UID/GID access to `data` and `logs` using ownership or an appropriate
ACL, and read access to config.json5 (including traversal of its parent folder).
For example, replace the placeholders below with the reported numeric values:

```bash
sudo chown -R <container-uid>:<container-gid> data logs
sudo chmod -R u+rwX,go-rwx data logs
sudo chown <container-uid>:<container-gid> config.json5
sudo chmod 600 config.json5
```

Choose an ACL instead if the host user also needs access. Avoid world-writable
permissions. Use your installation's Docker access policy; Docker-group access
is privileged and is not required when rootless Docker is configured.

## Published images (after manual publication)

The intended registry is `ghcr.io/ste94pz/hoyoutils`. No image availability is
assumed before migration. Once a tested release image exists, select its exact
version; replace `vX.Y.Z` with the published tag:

```bash
HOYOUTILS_IMAGE=ghcr.io/ste94pz/hoyoutils:vX.Y.Z docker compose up -d --no-build --pull always
```

This explicit command overrides the local-build policy. Keep the variable in
your private deployment environment when updating. `make up`/`make update` are
local-build commands; do not use them to update a registry-only installation.
There is deliberately no automatic `latest` publication. Images are prepared
for linux/amd64 and linux/arm64.

## Migration

1. Identify the existing Compose project, container and host bind paths. From
   its original directory, stop the old deployment (`docker compose down`) or
   stop the existing non-Docker worker. Also disable any external supervisor
   that would restart that worker during migration.
2. Back up config.json5, data/ (including cache.json) and logs/ privately while
   stopped. Retain them in the original directory, or copy them with permissions
   preserved into the new checkout. Do not use `down -v` or delete the cache.
3. Review configuration and permissions, then build HoYoUtils locally or choose
   an actually published version. Start only one worker for the same accounts
   and cache. Verify logs and effective image before removing backups.
4. For rollback, stop HoYoUtils before restoring the previous image/source and
   backup. Never operate both workers simultaneously.

`container_name: hoyolab-auto`, the Makefile's default Compose project name,
internal user/group and volume paths are intentionally retained for
compatibility. They do not select the upstream image. If your previous Compose
project used another name, pass `COMPOSE_PROJECT_NAME=...` to make or `-p ...`
to Compose consistently; stop that old project explicitly before migration.
Renaming the checkout directory must not create a second worker accidentally.

Docker Compose defaults to Asia/Shanghai for backward compatibility. Set the TZ
environment variable to override it, for example TZ=Europe/Rome. Local-time
schedules and daily windows follow the configured timezone.

See [development and publication controls](DEVELOPMENT.md#release-preparation).
