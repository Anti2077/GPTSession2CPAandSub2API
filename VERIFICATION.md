# Verification — 2026-09-23

Base: converter fork main `a097eb155bb7bdf6cbbc26f1e4e75e120ab3163c`.
Feature branch: `Anti2077/sub2api-templates`.
Sub2API contract: `Anti2077/custom`; local inspected source `ada5f8448eddc5cdeaaae3f96816e0759d4c9830`.

## Passed

- Original converter regression suite (`npm test`), updated only to expect preserved credential expiry for refreshable Sub2API accounts; top-level scheduling expiry remains absent for ordinary refreshable input.
- 10 pure policy tests: whitelist extraction, protected identity/tier, overrides, false/zero, expiry, password exclusion, malformed templates, proxy dependency ordering/cycles and deduplication.
- 7 Chromium browser scenarios: extraction and multi-account selection, per-account overrides, local template CRUD, template file roundtrip, password opt-in/refill, invalid-input recovery, output download, other formats, unavailable storage, 1280/390px layout and file:// operation.
- Browser static server applies the same headers as Cloudflare Pages. Browser interaction requests were limited to local static GETs; no account-bearing network requests.
- User-provided export checked in memory: 11 supported settings and 1 proxy extracted. Default serialized template was checked for absence of source access/refresh/id tokens, fingerprint seed, and proxy password. No source data copied into fixtures, screenshots, logs or repository.
- `npm run format:check` and `git diff --check`.

## Actual import — passed

The user authorized first-run compliance acknowledgement on the disposable test instance on 2026-09-23. It was completed once through the instance's normal compliance API; the reusable test script still does not accept terms automatically.

`node tests/integration/import.cjs` passed against the isolated OrbStack Compose project `converter-import-qa`, using `sub2api-sync-20260920:local` (image ID `sha256:e3cc90a4566b9587a0ac38eddd3bbb53d97586450097e751aa9f2db123ed5b70`). Two fake accounts were imported and read back through Sub2API's export API. Verified persisted concurrency 3, priority 1, multiplier 0, proxy association, model mapping, explicit false flags, distinct Free/Plus plans, retained refresh tokens, and distinct server-generated fingerprint seeds.

The image is a locally available September 20 build, not a rebuild of the September 23 contract source. No real-token gateway request was made.

Postgres data and app state are tmpfs. The app/database network remains internal. A separate nginx preview service exposes only `127.0.0.1:18097`, with the app accessible through the gateway; the app itself has no external network. Health returned `{"status":"ok"}` and the Sub2API HTML homepage returned HTTP 200 after configuring the browser entry. The test instance remains running for user inspection.

Cloudflare account connection and public deployment have not been performed. Publication status is recorded by the repository main ref and GitHub Actions.

## Fork attribution and delivery

The page credits `gtxx3600/GPTSession2CPAandSub2API` as its fork source and links “本页面开源” to `Anti2077/GPTSession2CPAandSub2API`. The inherited Discord promotional card and its styles were removed; the MIT license and original copyright remain unchanged. Original conversion tests, 10 policy tests, 7 browser scenarios, formatting and whitespace checks passed again before main integration.
