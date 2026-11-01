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
Auth redirect URLs for legacy email links. Production builds on Vercel use the same two
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

Login uses a username and password, verified by Supabase Auth. No SMTP service
is required. Existing sessions and workspace data are preserved. The account
dialog lets signed-in users set their own password; the workspace owner can
initialize only members previously approved by an administrator. Passwords are
never stored in app data, browser storage, source control, or application logs.

Apply `database/password-login.sql` once after the initial schema. Privately seed
`login_accounts` with the approved username, existing membership email, workspace,
and Auth user ID (if already registered). Only a deliberately designated owner
gets `is_owner=true`. Account aliases and emails are inaccessible to client roles.
Deploy `supabase/functions/account-access` with gateway JWT verification disabled:
its public login action verifies the password with Supabase Auth, while profile
and provisioning validate the caller token with `getUser` and server-owned roles.
The Edge runtime supplies its service-role secret; never copy it into Vercel or
the browser. Login is limited atomically to 10 attempts per name per 10 minutes.
New accounts are confirmed by the owner through the Admin API; global email
confirmation is not disabled. Existing accounts cannot be overwritten by setup.

Without SMTP, forgotten-password recovery requires an administrator through the
Supabase dashboard. A partial provisioning failure may require linking the newly
created Auth user ID to its existing `login_accounts` record administratively.

Connect this GitHub repository to Vercel. Build: `npm run build`;
output: `dist`. Set the two environment variables before deploying. Set the actual
production URL as the Supabase Auth Site URL and allowed redirect URL. The public
login page contains no personal records. Keep preview deployment protection on.

The old Sites deployment remains available during migration. Its “גיבוי והעברה”
button exports the browser data; storage does not automatically cross website
origins. The extracted `private/` directory is ignored and must never be committed.

## Verification

`npm test` covers merges, conflicts, failed writes, CAS retries, backup integrity,
public asset privacy, and the original annual calendar. Database access checks
must also be run against the deployed Supabase project, and actual password login,
file upload/download, reload, and second-device behavior must be verified after
deployment. `database/schema.sql` is an initial schema, not an idempotent reset.

