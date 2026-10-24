# Glover Media

Glover Media is a single-owner catalog for a movie and TV collection. Local development uses Nuxt 4, SQLite, and Drizzle. The AWS deployment uses a static Nuxt site, Lambda, DynamoDB, S3, and CloudFront.

## Local development

1. Install Node.js 24 or newer, then run `npm ci`.
2. Run `npm run auth:setup` in an interactive terminal. It prints a scrypt password hash and random signing secret; it does not echo the password.
3. Copy `.env.example` to `.env`, set `TMDB_API_KEY`, and replace the example authentication values with the generated ones. Keep `.env` private.
4. Run `npm run db:push` and then `npm run dev`.

The local SQLite file defaults to `./data/movies.db`; set `DATABASE_URL` to use a different path. When `DYNAMODB_TABLE_NAME` is unset, the API uses SQLite and does not publish AWS events.

## AWS architecture

- **Nuxt static site:** generated HTML and assets are hosted in a private S3 bucket and served by CloudFront.
- **API:** a Nuxt/Nitro Lambda behind an API Gateway HTTP API handles public catalog reads, owner login, catalog changes, and TMDB requests.
- **Storage:** one on-demand DynamoDB table stores movie records, unique TMDB-ID mappings, login sessions, and expiring login-attempt counters.
- **Publishing:** successful add, edit, and delete requests emit an EventBridge event. EventBridge starts CodeBuild, which reads the current public API, regenerates the homepage, collection, and movie detail pages, uploads them to S3, and invalidates CloudFront.
- **Build cost control:** the publisher uses CodeBuild's on-demand Lambda compute (2 GiB) with a 15-minute timeout and one concurrent build. It uses the provided Node.js 24 runtime. There is no reserved or always-running build capacity; AWS bills only while each build runs. Don't enable reserved capacity or persistent build services for this project.
- **Region:** `us-east-1`. CloudFront certificates must also be in `us-east-1`.

Catalog changes are saved immediately in DynamoDB. The public static pages update after CodeBuild completes; this normally takes a few minutes. There is no live server render on public page requests.

**The catalog is public.** The generated HTML and public read API include titles, notes, watched status, ratings, and “would watch again” values. Login protects editing and TMDB add-flow endpoints; it does not hide personal catalog details.

## First AWS deployment

You need an AWS account configured for the AWS CLI in `us-east-1`, Docker, and the AWS SAM CLI. The GitHub repository used by CodeBuild must be publicly cloneable; the default in `template.yaml` points at this project's public repository.

1. Generate or choose the owner credentials with `npm run auth:setup`. Keep the password, hash, and signing secret available for the deployment prompts.
2. Build the Lambda artifact and deploy the stack:

   ```sh
   npm run build:lambda
   sam build --use-container --template-file template.yaml
   sam deploy --guided --template-file .aws-sam/build/template.yaml
   ```

   Use region `us-east-1`, stack name `glover-media`, and enter the owner username, password hash, signing secret, TMDB key, and domain when prompted. `AuthPasswordHash`, `AuthSecret`, and `TmdbApiKey` are CloudFormation `NoEcho` parameters. **Do not save guided parameter values into `samconfig.toml` or commit them.** You may initially leave the certificate ARN empty to use the CloudFront hostname while setting up the domain.

3. Get the table name from the stack outputs and import the local catalog. The import is safe to repeat for rows already imported:

   ```powershell
   $env:DYNAMODB_TABLE_NAME = "value-from-DynamoDBTableName-output"
   npm run data:import:dynamodb
   Remove-Item Env:\DYNAMODB_TABLE_NAME
   ```

   The script reads the current `DATABASE_URL` (or `./data/movies.db`) and leaves that database unchanged.

4. Start the initial static-site publish from the stack output:

   ```sh
   aws codebuild start-build --project-name glover-media-static-publish
   ```

   Check the CodeBuild build logs and wait for the distribution deployment before using the CloudFront hostname.

5. To use `glovermedia.ca`, request an ACM certificate for the domain **in `us-east-1`**, add ACM's DNS validation CNAME record(s) in Namecheap, and wait until the certificate is issued. Update the stack with that certificate ARN and `SiteDomainName=glovermedia.ca`; do not save secret parameter overrides in `samconfig.toml`. Then add a Namecheap **ALIAS** record for host `@` pointing to the CloudFront hostname from the stack outputs. Namecheap BasicDNS supports ALIAS records at the root; remove conflicting root A, AAAA, CNAME, or URL-redirect records first. See [Namecheap's ALIAS record instructions](https://www.namecheap.com/support/knowledgebase/article.aspx/10128/2237/how-to-create-an-alias-record/).

## Updating and operating the AWS version

- For API, schema, or Lambda changes, run `npm run build:lambda`, `sam build --use-container`, and `sam deploy`. AWS SDK credentials and the selected stack region are used by SAM.
- The static publisher clones the repository's default branch. Commit/push frontend changes before starting a build. Catalog edits automatically start a build from the latest default-branch revision.
- To manually regenerate the public pages, start the CodeBuild project again. The build needs the API to be available and reads the current catalog through its public GET endpoint.
- The S3 bucket blocks public access; CloudFront uses Origin Access Control. API requests are not cached. Lambda sessions and login-attempt counters expire through DynamoDB TTL.
- Configure an AWS Budget or billing alerts before public launch. Request volume, data transfer, CloudFront invalidations, and AWS pricing/free-tier eligibility vary.

## Database and migration commands

- `npm run db:push` applies the Drizzle schema to the local SQLite database.
- `npm run db:generate` generates Drizzle migration files.
- `npm run data:import:dynamodb` copies the local SQLite catalog into the configured DynamoDB table without modifying SQLite.

## Docker

Docker Compose remains available for a self-hosted local/server deployment using SQLite:

```sh
docker compose up --build
```

The Compose setup persists the local database under `./data`.

## Design

The interface follows the supplied Figma reference: canvas `#101217`, raised surfaces `#1a1d24` and `#242832`, warm text `#f4ead5`, coral action `#ff6b42`, and Inter / Bebas Neue / IBM Plex Mono typography.
