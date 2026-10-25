# Glover Media

Glover Media is a single-owner catalog for a movie and TV collection. The application uses a static Nuxt site on S3 and CloudFront, a Nuxt/Nitro Lambda behind API Gateway, and DynamoDB for all catalog and session data.

## AWS architecture

- **Nuxt static site:** generated HTML and assets are hosted in a private S3 bucket and served by CloudFront.
- **API:** a Nuxt/Nitro Lambda behind an API Gateway HTTP API handles public catalog reads, owner login, catalog changes, and TMDB requests.
- **Storage:** one on-demand DynamoDB table stores movie records, unique TMDB-ID mappings, login sessions, and expiring login-attempt counters.
- **Publishing:** successful add, edit, and delete requests emit an EventBridge event. EventBridge starts CodeBuild, which reads the public API, regenerates the homepage, collection, and movie detail pages, uploads them to S3, and invalidates CloudFront.
- **Build cost control:** the publisher uses on-demand Lambda compute (2 GiB) with a 15-minute timeout and one concurrent build. There is no reserved or always-running build capacity.
- **Region:** `us-east-1`. CloudFront certificates must also be in `us-east-1`.

Catalog changes are saved immediately in DynamoDB. The public static pages update after the publisher completes; this normally takes a few minutes. Public catalog pages include titles, notes, watched status, ratings, and “would watch again” values. Login protects editing and TMDB add-flow endpoints; it does not hide catalog details.

## Local development

1. Install Node.js 24 or newer, then run `npm ci`.
2. Run `npm run auth:setup` in an interactive terminal. It prints a password hash and signing secret; it does not echo the password.
3. Copy `.env.example` to `.env`, fill in the API key, generated authentication values, and the deployed table, event bus, and API endpoint. Keep `.env` private.
4. Configure AWS CLI credentials with access to the deployed DynamoDB table and EventBridge bus.
5. Run `npm run dev`.

Local development uses the deployed serverless services. There is no local persistence fallback.

## First AWS deployment

You need an AWS account configured for the AWS CLI in `us-east-1` and the AWS SAM CLI. The GitHub repository used by CodeBuild must be publicly cloneable; the default in `template.yaml` points at this project's public repository.

1. Generate or choose the owner credentials with `npm run auth:setup`. Keep the password, hash, and signing secret available for the deployment prompts.
2. Build the Lambda artifact and deploy the stack:

   ```sh
   npm run build:lambda
   sam build --template-file template.yaml
   sam deploy --template-file template.yaml
   ```

   Use region `us-east-1` and stack name `glover-media`. Enter the owner username, password hash, signing secret, TMDB key, and domain when prompted. `AuthPasswordHash`, `AuthSecret`, and `TmdbApiKey` are CloudFormation `NoEcho` parameters. **Do not save secret parameter values into `samconfig.toml` or commit them.** You may initially leave the certificate ARN empty to use the CloudFront hostname while setting up the domain.

3. Start the initial static-site publish from the stack output:

   ```sh
   aws codebuild start-build --project-name glover-media-static-publish
   ```

   Check the CodeBuild build logs and wait for the distribution deployment before using the CloudFront hostname.

4. To use `glovermedia.ca`, request an ACM certificate for the domain **in `us-east-1`**, add ACM's DNS validation CNAME record(s) in Namecheap, and wait until the certificate is issued. Update the stack with that certificate ARN and `SiteDomainName=glovermedia.ca`; do not save secret parameter overrides in `samconfig.toml`. Then add a Namecheap **ALIAS** record for host `@` pointing to the CloudFront hostname from the stack outputs. Namecheap BasicDNS supports ALIAS records at the root; remove conflicting root A, AAAA, CNAME, or URL-redirect records first. See [Namecheap's ALIAS record instructions](https://www.namecheap.com/support/knowledgebase/article.aspx/10128/2237/how-to-create-an-alias-record/).

## Updating and operating

- For API or Lambda changes, run these commands from the repository root. SAM uses the configured AWS CLI credentials and selected region:

  ```sh
  npm run build:lambda
  sam build --template-file template.yaml
  sam deploy --template-file template.yaml
  ```

- The static publisher clones the repository's default branch. Commit and push frontend changes before starting a build. Catalog edits automatically start a build from the latest default-branch revision.
- To manually regenerate the public pages, start the CodeBuild project again. The build needs the API to be available and reads the current catalog through its public GET endpoint.
- The S3 bucket blocks public access; CloudFront uses Origin Access Control. API requests are not cached. Lambda sessions and login-attempt counters expire through DynamoDB TTL.
- Configure an AWS Budget or billing alerts before public launch. Request volume, data transfer, CloudFront invalidations, and AWS pricing/free-tier eligibility vary.

## Design

The interface follows the supplied Figma reference: canvas `#101217`, raised surfaces `#1a1d24` and `#242832`, warm text `#f4ead5`, coral action `#ff6b42`, and Inter / Bebas Neue / IBM Plex Mono typography.
