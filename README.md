# יום טוב — Noam Workday

Hebrew RTL workspace with tasks, an annual alternating A/B calendar, child goals,
treatment notes and Word exports, parent guidance tracking, and private file storage.

## Development

```sh
npm ci
cp .env.example .env.local
# Set the Supabase URL and publishable key (never a service-role key).
npm test
npm run build
npm run dev
```

The preview runs at http://127.0.0.1:4174. Configure this exact origin in Supabase
Auth redirect URLs for local login. Production builds on Vercel use the same two
environment variables: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`.

## Private data

- `database/schema.sql` defines the workspace, explicit email membership, file
  metadata, a private Storage bucket, and row-level access policies.
- Administrators seed a workspace and grant its owner's verified email membership.
  Signing up does **not** grant access to a workspace.
- All personal data loads after authentication and a successful RLS check.
  Child names, clinical goals, notes and backups are excluded from public assets.
- The browser uses a publishable key. No privileged API key is part of the app.
- A compare-and-swap revision prevents silent overwrites. Independent edits merge;
  same-field edits require a choice. Pending changes have an account-specific local
  recovery copy, a visible sync status, automatic retries, and an unload warning.
- Private files use unique object paths. Removing a file removes its app listing;
  old object versions remain private for administrative recovery. Storage retention
  and periodic full backups should be managed deliberately as usage grows.
- Full ZIP export/import includes record data and binary files. Import initially
  adds missing IDs only, without silently replacing records already in the cloud.

## Hosting

Connect this **private** GitHub repository to Vercel. Build: `npm run build`;
output: `dist`. Set the two environment variables before deploying. Set the actual
production URL as the Supabase Auth Site URL and allowed redirect URL. The public
login page contains no personal records. Keep preview deployment protection on.

The old Sites deployment remains available during migration. Its “גיבוי והעברה”
button exports the browser data; storage does not automatically cross website
origins. The extracted `private/` directory is ignored and must never be committed.

## Verification

`npm test` covers merges, conflicts, failed writes, CAS retries, backup integrity,
public asset privacy, and the original annual calendar. Database access checks
must also be run against the deployed Supabase project, and actual email login,
file upload/download, reload, and second-device behavior must be verified after
deployment. `database/schema.sql` is an initial schema, not an idempotent reset.

