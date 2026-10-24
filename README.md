# Glover Media

Glover Media is a movie and TV collection catalog, built with Nuxt 4, Tailwind CSS 4, SQLite, Drizzle ORM, and TMDB.

## Local development

1. Install Node.js 26 or newer and run `npm install`.
2. Run `npm run auth:setup` in an interactive terminal. Choose the owner username and password; the command prints a scrypt password hash and random signing secret without echoing your password.
3. Copy `.env.example` to `.env`, set `TMDB_API_KEY`, and replace the three generated authentication values with those printed in step 2. Keep `.env` private and out of source control.
4. Create/update the SQLite schema with `npm run db:push`.
5. Start Nuxt with `npm run dev`.

The default database file is `./data/movies.db`. Set `DATABASE_URL` to change its path. TMDB credentials and login secrets are only used by server routes and are never sent to the browser.

## Internet deployment and account security

This is a single-owner login, not public account registration. Collection pages, film/show details, and read-only catalog APIs are public so the archive can be shared. The configured username and scrypt password hash are the only credentials accepted. Adding, editing, and deleting collection entries, as well as TMDB search/details for the add flow, require the owner session. Login sessions are signed, expire after seven days, and are stored in `HttpOnly`, `SameSite=Strict` cookies (`Secure` in production). Mutating API requests also require a same-origin check and a session CSRF token. Failed logins are rate limited.

Set `ARCHIVE_USERNAME`, `AUTH_PASSWORD_HASH`, and `AUTH_SECRET` as deployment secrets. Before first launch, apply the schema to the same persistent database file (`npm run db:push`, with `DATABASE_URL` pointing at that file). Serve the app only behind HTTPS with a trusted reverse proxy; do not expose the unencrypted application port to the public internet. Back up the persistent SQLite volume securely.

The add dialog supports both films and TV shows using TMDB's movie and TV metadata endpoints. Film/show metadata and catalog entries remain private behind the login.

Before exposing a deployment, review `npm audit --omit=dev`. The current latest Nuxt/Nitro dependency tree reports a high-severity transitive `node-forge` advisory through `listhen`; npm currently suggests downgrading Nuxt to 4.1.3 to clear it, so the latest Nuxt version is retained rather than silently applying that downgrade.

## Docker

Set `TMDB_API_KEY` in the environment or in a `.env` file, then run:

```sh
docker compose up --build
```

The container stores its SQLite database at `/app/data/movies.db`; Compose persists it in the local `./data` directory.

## Database commands

- `npm run db:push` applies the Drizzle schema to the configured SQLite database.
- `npm run db:generate` generates Drizzle migration files in `server/database/migrations`.

## Design

The interface follows the supplied Figma reference: canvas `#101217`, raised surfaces `#1a1d24` and `#242832`, warm text `#f4ead5`, coral action `#ff6b42`, and Inter / Bebas Neue / IBM Plex Mono typography. Movie and TV metadata are loaded from TMDB; the collection is stored locally in SQLite.
