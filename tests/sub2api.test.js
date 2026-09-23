const { test } = require("node:test");
const assert = require("node:assert/strict");
const S = require("../docs/js/sub2api");
const proxy = {
  name: "test-proxy",
  protocol: "socks5",
  host: "127.0.0.1",
  port: 1080,
  password: "FAKE-PROXY-PASSWORD",
  status: "active",
};
const account = {
  name: "new@example.test",
  platform: "openai",
  type: "oauth",
  concurrency: 10,
  priority: 1,
  credentials: {
    access_token: "FAKE-NEW-TOKEN",
    refresh_token: "FAKE-REFRESH",
    email: "new@example.test",
    plan_type: "free",
  },
  extra: { email: "new@example.test" },
};
const reference = {
  ...account,
  name: "reference",
  credentials: {
    access_token: "FAKE-OLD-TOKEN",
    plan_type: "pro",
    model_mapping: { "test-model": "test-target" },
  },
  concurrency: 3,
  rate_multiplier: 0,
  group_ids: [2, 5],
  expires_at: 9999999999,
  proxy_key: S.proxyKey(proxy),
  notes: "PRIVATE NOTE",
  extra: {
    codex_fingerprint_mode: "session",
    codex_fingerprint_seed: "OLD-SEED",
    codex_7d_used_percent: 100,
    mailbox_email: "private@example.test",
    auto_reset_credit_enabled: false,
    auto_reset_credit_5h_threshold: 1,
    openai_oauth_responses_websockets_v2_mode: "off",
    openai_long_context_billing_enabled: false,
  },
};
const doc = {
  accounts: [reference],
  proxies: [{ ...proxy, proxy_key: S.proxyKey(proxy) }],
};
const item = (a) => ({ name: a.name, sub2apiAccount: a });
test("template copies supported settings, never account identity or runtime state", () => {
  const { profile, included, excluded } = S.extractTemplate(doc);
  assert.equal(profile.settings.concurrency, 3);
  assert.equal(profile.settings.rate_multiplier, 0);
  assert.equal(profile.expiry, undefined);
  assert.deepEqual(profile.group_ids, [2, 5]);
  assert.ok(included.includes("参与分组"));
  assert.ok(included.includes("extra.codex_fingerprint_mode"));
  assert.ok(excluded.includes("credentials.access_token"));
  const result = S.buildDocument([item(account)], profile);
  const a = result.accounts[0];
  assert.equal(a.name, account.name);
  assert.equal(a.credentials.plan_type, "free");
  assert.equal(a.credentials.access_token, "FAKE-NEW-TOKEN");
  assert.equal(a.credentials.refresh_token, "FAKE-REFRESH");
  assert.equal(a.extra.codex_fingerprint_seed, undefined);
  assert.equal(a.extra.codex_7d_used_percent, undefined);
  assert.equal(a.extra.auto_reset_credit_enabled, false);
  assert.equal(a.rate_multiplier, 0);
  assert.deepEqual(a.group_ids, [2, 5]);
  assert.equal(a.extra.openai_oauth_responses_websockets_v2_enabled, false);
  assert.equal(result.proxies.length, 1);
  assert.equal(a.proxy_key, result.proxies[0].proxy_key);
  assert.equal(a.credentials.model_mapping["test-model"], "test-target");
});
test("multiple account tiers and tokens remain independent; override takes precedence", () => {
  const p = S.extractTemplate(doc).profile;
  const second = structuredClone(account);
  second.name = "second";
  second.credentials.plan_type = "plus";
  second.credentials.access_token = "SECOND";
  const result = S.buildDocument([item(account), item(second)], p, [
    {},
    {
      name: "renamed",
      profile: {
        settings: { concurrency: 7, "extra.codex_fingerprint_mode": "off" },
        group_ids: [9],
        proxies: [],
        proxy: null,
      },
    },
  ]);
  assert.equal(result.accounts[1].concurrency, 7);
  assert.equal(result.accounts[1].name, "renamed");
  assert.equal(result.accounts[1].credentials.plan_type, "plus");
  assert.equal(result.accounts[1].proxy_key, undefined);
  assert.deepEqual(result.accounts[1].group_ids, [9]);
  assert.equal(result.accounts[0].concurrency, 3);
  assert.equal(account.concurrency, 10);
});
test("empty group IDs are explicit and invalid IDs are rejected", () => {
  const p = S.extractTemplate(doc).profile;
  const empty = S.buildDocument([item(account)], { ...p, group_ids: [] });
  assert.deepEqual(empty.accounts[0].group_ids, []);
  assert.throws(() => S.validateProfile({ ...p, group_ids: [1, 1] }), /重复/);
  assert.throws(() => S.validateProfile({ ...p, group_ids: [0] }), /正整数/);
  assert.throws(() => S.validateProfile({ ...p, group_ids: [-1] }), /正整数/);
  assert.throws(() => S.validateProfile({ ...p, group_ids: [1.5] }), /正整数/);
  const parsed = S.parseTemplate(
    S.serializeTemplate("groups", { ...p, group_ids: [3] }),
  );
  assert.deepEqual(parsed.profile.group_ids, [3]);
});
test("password excluded by default, including proxy_key; requires refill", () => {
  const profile = S.extractTemplate(doc).profile;
  const t = S.serializeTemplate("example", profile);
  assert.ok(!JSON.stringify(t).includes("FAKE-PROXY-PASSWORD"));
  assert.equal(t.profile.proxies[0].proxy_key, undefined);
  assert.equal(t.profile.proxies[0].password_required, true);
  assert.throws(
    () => S.buildDocument([item(account)], t.profile),
    /补填代理密码/,
  );
  assert.equal(
    S.serializeTemplate("example", profile, true).profile.proxies[0].password,
    proxy.password,
  );
  assert.ok(!JSON.stringify(t).includes("FAKE-OLD-TOKEN"));
});
test("unknown template fields cannot inject account data or prototypes", () => {
  const p = { settings: { "credentials.access_token": "bad" }, proxies: [] };
  assert.throws(() => S.serializeTemplate("bad", p), /不支持/);
  assert.throws(
    () =>
      S.validateSettings({
        "credentials.model_mapping": JSON.parse('{"__proto__":"bad"}'),
      }),
    /无效/,
  );
  assert.throws(
    () => S.parseTemplate({ type: "sub2api-converter-template", version: 999 }),
    /版本/,
  );
  const clean = S.parseTemplate({
    type: "sub2api-converter-template",
    version: 1,
    name: "good",
    profile: {
      settings: {},
      proxies: [],
      credentials: { access_token: "SECRET" },
    },
  });
  assert.ok(!JSON.stringify(clean).includes("SECRET"));
});
test("expiry override is independent of token expiry and can be reset", () => {
  const source = structuredClone(account);
  source.expires_at = 123;
  source.credentials.expires_at = 456;
  const p = {
    settings: { auto_pause_on_expired: false },
    proxies: [],
    expiry: null,
  };
  const a = S.applyProfile(source, p);
  assert.equal(a.expires_at, undefined);
  assert.equal(a.credentials.expires_at, 456);
  assert.equal(a.auto_pause_on_expired, false);
  assert.equal(S.applyProfile(source, S.emptyProfile()).expires_at, 123);
});
test("strict validation accepts zero and false but rejects malformed numbers", () => {
  S.validateSettings({
    priority: 0,
    concurrency: 0,
    rate_multiplier: 0,
    "extra.auto_reset_credit_enabled": false,
  });
  for (const v of [-1, NaN, Infinity, "3", 1.1])
    assert.throws(() => S.validateSettings({ concurrency: v }));
  assert.throws(() =>
    S.validateSettings({ "extra.auto_pause_5h_threshold": 1.01 }),
  );
  assert.throws(() =>
    S.validateSettings({ "extra.codex_fingerprint_mode": "unknown" }),
  );
});
test("proxy dependencies sorted, deduplicated, and cycles/missing/conflicts rejected", () => {
  const backup = { ...proxy, name: "backup", port: 1081 };
  const primary = {
    ...proxy,
    fallback_mode: "proxy",
    backup_proxy_name: "backup",
  };
  const p = { settings: {}, proxies: [primary, backup], proxy: primary.name };
  const result = S.buildDocument([item(account), item(account)], p);
  assert.deepEqual(
    result.proxies.map((x) => x.name),
    ["backup", "test-proxy"],
  );
  assert.equal(result.proxies.length, 2);
  assert.throws(
    () => S.validateProfile({ ...p, proxies: [primary] }),
    /缺少备用/,
  );
  assert.throws(
    () =>
      S.validateProfile({
        ...p,
        proxies: [
          primary,
          {
            ...backup,
            fallback_mode: "proxy",
            backup_proxy_name: primary.name,
          },
        ],
      }),
    /循环/,
  );
  assert.throws(
    () =>
      S.buildDocument([item(account), item(account)], p, [
        {},
        { profile: { ...p, proxies: [{ ...primary, port: 2222 }, backup] } },
      ]),
    /相同名称/,
  );
});
test("only selected template account is used; incompatible platforms rejected", () => {
  const d = {
    proxies: [],
    accounts: [
      { ...account, concurrency: 2 },
      { ...account, concurrency: 6 },
    ],
  };
  assert.equal(S.extractTemplate(d, 1).profile.settings.concurrency, 6);
  assert.throws(
    () =>
      S.extractTemplate({
        proxies: [],
        accounts: [{ platform: "anthropic", type: "oauth" }],
      }),
    /OpenAI/,
  );
});
test("proxy schema accepts sample Hysteria2 without persisting derived key", () => {
  const p = {
    settings: {},
    proxy: "hy",
    proxies: [
      {
        ...proxy,
        name: "hy",
        protocol: "hysteria2",
        fallback_mode: "none",
        expires_at: 1999999999,
        expiry_warn_days: 7,
      },
    ],
  };
  assert.equal(
    S.buildDocument([item(account)], p).proxies[0].protocol,
    "hysteria2",
  );
  assert.throws(
    () =>
      S.buildDocument([item(account)], {
        ...p,
        proxies: [{ ...p.proxies[0], password: "" }],
      }),
    /补填/,
  );
});
test("same endpoint under different template names deduplicates safely", () => {
  const a = { settings: {}, proxies: [proxy], proxy: proxy.name };
  const renamed = { ...proxy, name: "alias" };
  const b = { settings: {}, proxies: [renamed], proxy: "alias" };
  const result = S.buildDocument([item(account), item(account)], a, [
    {},
    { profile: b },
  ]);
  assert.equal(result.proxies.length, 1);
  assert.equal(result.accounts[0].proxy_key, result.accounts[1].proxy_key);
});
