// Talks only to the disposable converter-import-qa container. Never a deployed instance.
const { spawnSync } = require("node:child_process");
const assert = require("node:assert/strict");
const S = require("../../docs/js/sub2api");
let bearer;
function request(path, body) {
  const args = [
    "exec",
    "converter-import-qa-app-1",
    "wget",
    "-qO-",
    "--header=Content-Type: application/json",
  ];
  if (bearer) args.push("--header=Authorization: Bearer " + bearer);
  if (body) args.push("--post-data=" + JSON.stringify(body));
  args.push("http://127.0.0.1:8080/api/v1" + path);
  const processResult = spawnSync("docker", args, { encoding: "utf8" });
  if (processResult.status !== 0)
    throw Error(`Test API ${path} failed: ${processResult.stderr.trim()}`);
  const r = JSON.parse(processResult.stdout);
  assert.equal(r.code, 0, `Test API ${path} returned an error`);
  return r.data;
}
const login = request("/auth/login", {
  email: "converter@example.test",
  password: "Converter-Test-Only-2026!",
});
bearer = login.access_token;
assert.ok(bearer);
const compliance = request("/admin/compliance");
if (compliance.required) {
  console.error(
    "Import validation blocked: the disposable Sub2API instance requires administrator compliance acknowledgement. This test will not accept terms automatically.",
  );
  process.exit(2);
}
const profile = {
  settings: {
    concurrency: 3,
    priority: 1,
    rate_multiplier: 0,
    "credentials.model_mapping": { "qa-model": "qa-target" },
    "extra.codex_fingerprint_mode": "session",
    "extra.openai_oauth_responses_websockets_v2_mode": "off",
    "extra.openai_long_context_billing_enabled": false,
    "extra.auto_reset_credit_enabled": false,
    "extra.auto_reset_credit_5h_threshold": 1,
    "extra.auto_reset_credit_7d_threshold": 1,
  },
  proxy: "qa-proxy",
  proxies: [
    {
      name: "qa-proxy",
      protocol: "socks5",
      host: "127.0.0.1",
      port: 1080,
      status: "active",
    },
  ],
  group_ids: [],
};
const stamp = Date.now();
const items = ["free", "plus"].map((plan, i) => ({
  name: `converter-qa-${stamp}-${i}`,
  sub2apiAccount: {
    name: `converter-qa-${stamp}-${i}`,
    platform: "openai",
    type: "oauth",
    concurrency: 10,
    priority: 1,
    credentials: {
      access_token: `FAKE-ACCESS-${i}`,
      refresh_token: `FAKE-REFRESH-${i}`,
      email: `qa-${i}@example.test`,
      plan_type: plan,
      expires_at: "2099-01-01T00:00:00Z",
    },
    extra: {},
  },
}));
const document = S.buildDocument(items, profile);
const result = request("/admin/accounts/data", {
  data: document,
  skip_default_group_bind: true,
});
assert.equal(result.account_created, 2);
assert.equal(result.account_failed, 0);
assert.equal(result.proxy_failed, 0);
const exported = request("/admin/accounts/data");
const accounts = exported.accounts.filter((a) =>
  a.name.startsWith(`converter-qa-${stamp}-`),
);
assert.equal(accounts.length, 2);
for (const a of accounts) {
  assert.equal(a.concurrency, 3);
  assert.equal(a.priority, 1);
  assert.equal(a.rate_multiplier, 0);
  assert.equal(a.extra.codex_fingerprint_mode, "session");
  assert.equal(a.extra.openai_oauth_responses_websockets_v2_enabled, false);
  assert.equal(a.extra.openai_long_context_billing_enabled, false);
  assert.equal(a.extra.auto_reset_credit_enabled, false);
  assert.deepEqual(a.group_ids, []);
  assert.equal(a.credentials.model_mapping["qa-model"], "qa-target");
  assert.ok(a.credentials.refresh_token.startsWith("FAKE-REFRESH"));
  assert.ok(exported.proxies.some((p) => p.proxy_key === a.proxy_key));
  assert.ok(a.extra.codex_fingerprint_seed);
}
assert.deepEqual(accounts.map((a) => a.credentials.plan_type).sort(), [
  "free",
  "plus",
]);
assert.notEqual(
  accounts[0].extra.codex_fingerprint_seed,
  accounts[1].extra.codex_fingerprint_seed,
);
console.log(
  "Sub2API import/export verified: 2 accounts, explicit empty groups, proxy association, independent tiers/tokens/seeds, scheduling, mapping, and explicit false/zero values.",
);
