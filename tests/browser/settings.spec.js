const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const S = require("../../docs/js/sub2api");
const makeAccount = (name = "new@example.test", plan = "free") => ({
  name,
  platform: "openai",
  type: "oauth",
  credentials: {
    access_token: "FAKE-NEW-TOKEN",
    refresh_token: "FAKE-NEW-REFRESH",
    id_token: "FAKE-ID",
    email: name,
    plan_type: plan,
    chatgpt_user_id: "new-user",
    client_id: "new-client",
    organization_id: "new-org",
  },
});
const proxy = {
  name: "local-test",
  protocol: "socks5",
  host: "127.0.0.1",
  port: 1080,
  password: "FAKE-PROXY-PASSWORD",
  status: "active",
};
const sample = {
  proxies: [{ ...proxy, proxy_key: S.proxyKey(proxy) }],
  accounts: [
    {
      ...makeAccount("old@example.test", "pro"),
      concurrency: 3,
      priority: 1,
      rate_multiplier: 0,
      proxy_key: S.proxyKey(proxy),
      extra: {
        codex_fingerprint_mode: "session",
        codex_fingerprint_seed: "OLD-SEED",
        mailbox_email: "old-private@example.test",
        codex_7d_used_percent: 100,
        auto_reset_credit_enabled: false,
        openai_long_context_billing_enabled: false,
      },
    },
  ],
};
async function upload(page, data) {
  await page
    .locator("#sub2api-settings input[type=file]")
    .first()
    .setInputFiles({
      name: "sample.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(data)),
    });
  await page
    .getByRole("button", { name: "应用提取的设置", exact: true })
    .click();
}
async function output(page) {
  return JSON.parse(await page.locator("#output").inputValue());
}
test.beforeEach(async ({ page }) => {
  await page.goto("/");
});
test("template extraction, overrides, save/reload, download, and no account requests", async ({
  page,
}) => {
  const errors = [],
    requests = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) =>
    requests.push({ method: r.method(), url: r.url() }),
  );
  await page
    .locator("#session-input")
    .fill(
      JSON.stringify([
        makeAccount(),
        makeAccount("second@example.test", "plus"),
      ]),
    );
  await upload(page, sample);
  let d = await output(page);
  expect(d.accounts).toHaveLength(2);
  expect(d.accounts[0].concurrency).toBe(3);
  expect(d.accounts[0].credentials.refresh_token).toBe("FAKE-NEW-REFRESH");
  expect(d.accounts[0].credentials.id_token).toBe("FAKE-ID");
  expect(d.accounts[0].credentials.chatgpt_user_id).toBe("new-user");
  expect(d.accounts[1].credentials.plan_type).toBe("plus");
  expect(d.accounts[0].extra.codex_fingerprint_seed).toBeUndefined();
  expect(d.proxies).toHaveLength(1);
  await page.getByLabel("编辑范围", { exact: true }).selectOption("1");
  await page.locator("#setting-concurrency-apply").check();
  await page.locator("#setting-concurrency").fill("7");
  await page
    .getByLabel("当前账号名称（不会保存到模板）", { exact: true })
    .fill("renamed");
  d = await output(page);
  expect(d.accounts[1].name).toBe("renamed");
  expect(d.accounts[1].concurrency).toBe(7);
  expect(d.accounts[0].concurrency).toBe(3);
  await page
    .getByRole("button", { name: "恢复继承 / 清空当前设置", exact: true })
    .click();
  d = await output(page);
  expect(d.accounts[1].concurrency).toBe(3);
  expect(d.accounts[1].name).toBe("second@example.test");
  await page.getByLabel("编辑范围", { exact: true }).selectOption("-1");
  await page.getByLabel("模板名称", { exact: true }).fill("My template");
  await page.getByRole("button", { name: "保存为新模板", exact: true }).click();
  const stored = await page.evaluate(() =>
    localStorage.getItem("sub2api-converter.templates.v1"),
  );
  expect(stored).not.toContain("FAKE-PROXY-PASSWORD");
  expect(stored).not.toContain("FAKE-NEW-TOKEN");
  expect(stored).not.toContain("old@example.test");
  expect(stored).not.toContain("proxy_key");
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#download-output").click();
  const download = await downloadPromise;
  const json = JSON.parse(fs.readFileSync(await download.path(), "utf8"));
  expect(json.accounts[0].concurrency).toBe(3);
  await page.reload();
  expect(await page.locator("#session-input").inputValue()).toBe("");
  await page.getByLabel("本地模板库", { exact: true }).selectOption("0");
  await page.getByRole("button", { name: "应用选中模板", exact: true }).click();
  await page.locator("#session-input").fill(JSON.stringify(makeAccount()));
  await expect(page.locator("#download-output")).toBeDisabled();
  await expect(page.locator("#output-status")).toContainText("补填代理密码");
  await page.getByLabel("密码（需要补填）", { exact: true }).fill("REFILLED");
  await expect(page.locator("#download-output")).toBeEnabled();
  expect(errors).toEqual([]);
  expect(
    requests.every(
      (r) => r.method === "GET" && r.url.startsWith("http://127.0.0.1:4173/"),
    ),
  ).toBe(true);
});
test("false/zero/unset, invalid config recovery, other formats, and no stale per-account overrides", async ({
  page,
}) => {
  await page.locator("#session-input").fill(JSON.stringify(makeAccount()));
  await page.locator("#setting-priority-apply").check();
  await page.locator("#setting-priority").fill("0");
  expect((await output(page)).accounts[0].priority).toBe(0);
  await page.locator("#setting-priority").fill("-1");
  await expect(page.locator("#download-output")).toBeDisabled();
  await page.locator("#setting-priority-apply").uncheck();
  await expect(page.locator("#download-output")).toBeEnabled();
  await page.getByRole("button", { name: "CPA", exact: true }).click();
  await expect(page.locator("#sub2api-settings")).toBeHidden();
  expect((await output(page)).access_token).toBe("FAKE-NEW-TOKEN");
  await page.getByRole("button", { name: "sub2api", exact: true }).click();
  await page.getByLabel("编辑范围", { exact: true }).selectOption("0");
  await page.locator("#setting-priority-apply").check();
  await page.locator("#setting-priority").fill("5");
  expect((await output(page)).accounts[0].priority).toBe(5);
  await page
    .locator("#session-input")
    .fill(JSON.stringify(makeAccount("different@example.test")));
  expect((await output(page)).accounts[0].priority).toBe(1);
});
test("mobile and desktop layout; local file works", async ({ page }) => {
  await page.locator("#session-input").fill(JSON.stringify(makeAccount()));
  await upload(page, sample);
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/settings-${width}.png`,
      fullPage: true,
    });
  }
  await page.goto("file://" + require("node:path").resolve("docs/index.html"));
  await page.locator("#session-input").fill(JSON.stringify(makeAccount()));
  await expect(page.locator("#download-output")).toBeEnabled();
});
test("storage failures preserve conversion and show feedback", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new Error("Storage unavailable");
    };
  });
  await page.reload();
  await page.locator("#session-input").fill(JSON.stringify(makeAccount()));
  await page.getByLabel("模板名称", { exact: true }).fill("template");
  await page.getByRole("button", { name: "保存为新模板", exact: true }).click();
  await expect(page.locator("#sub2api-settings [role=status]")).toContainText(
    "Storage unavailable",
  );
  await expect(page.locator("#download-output")).toBeEnabled();
});

test("manual proxies, advanced validation, explicit false, and template file roundtrip", async ({
  page,
}) => {
  await page.locator("#session-input").fill(JSON.stringify(makeAccount()));
  await page.getByText("代理配置", { exact: true }).click();
  await page.getByRole("button", { name: "添加代理", exact: true }).click();
  await expect(page.locator("#download-output")).toBeDisabled();
  await page.getByLabel("主机（不含协议）", { exact: true }).fill("127.0.0.1");
  await expect(page.locator("#download-output")).toBeEnabled();
  await page
    .getByText("高级配置 · 模型 / 指纹 / 通信 / 额度", { exact: true })
    .click();
  await page
    .locator("#setting-extra-openai_long_context_billing_enabled-apply")
    .check();
  await page
    .locator("#setting-extra-openai_long_context_billing_enabled")
    .selectOption("false");
  await page.locator("#setting-credentials-model_mapping-apply").check();
  await page.locator("#setting-credentials-model_mapping").fill("{bad");
  await expect(page.locator("#download-output")).toBeDisabled();
  await expect(
    page.locator("#setting-credentials-model_mapping"),
  ).toHaveAttribute("aria-invalid", "true");
  await page
    .locator("#setting-credentials-model_mapping")
    .fill('{"model-a":"model-b"}');
  const d = await output(page);
  expect(d.accounts[0].extra.openai_long_context_billing_enabled).toBe(false);
  expect(d.accounts[0].credentials.model_mapping).toEqual({
    "model-a": "model-b",
  });
  await page.getByLabel("模板名称", { exact: true }).fill("roundtrip");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出当前模板", exact: true }).click();
  const download = await downloadPromise;
  const data = fs.readFileSync(await download.path());
  await page
    .getByRole("button", { name: "恢复继承 / 清空当前设置", exact: true })
    .click();
  expect((await output(page)).proxies).toHaveLength(0);
  await page
    .locator("#sub2api-settings input[type=file]")
    .nth(1)
    .setInputFiles({
      name: "template.json",
      mimeType: "application/json",
      buffer: data,
    });
  await expect(page.locator("#sub2api-settings [role=status]")).toContainText(
    "模板文件已载入",
  );
  expect((await output(page)).accounts[0].credentials.model_mapping).toEqual({
    "model-a": "model-b",
  });
});

test("template library update/copy/delete and explicit password persistence", async ({
  page,
}) => {
  await page.locator("#session-input").fill(JSON.stringify(makeAccount()));
  await upload(page, sample);
  await page.getByLabel("模板名称", { exact: true }).fill("with password");
  await page
    .getByLabel("保存／导出时包含代理密码（明文，仅在明确勾选后包含）", {
      exact: true,
    })
    .check();
  await page.getByRole("button", { name: "保存为新模板", exact: true }).click();
  expect(
    await page.evaluate(() =>
      localStorage.getItem("sub2api-converter.templates.v1"),
    ),
  ).toContain("FAKE-PROXY-PASSWORD");
  await page.locator("#setting-concurrency").fill("8");
  await page.getByRole("button", { name: "更新选中模板", exact: true }).click();
  await page.getByRole("button", { name: "复制选中模板", exact: true }).click();
  await expect(page.getByLabel("模板名称", { exact: true })).toHaveValue(
    "with password 副本",
  );
  await page.getByRole("button", { name: "保存为新模板", exact: true }).click();
  page.on("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "删除选中模板", exact: true }).click();
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("sub2api-converter.templates.v1")),
  );
  expect(stored).toHaveLength(1);
  expect(stored[0].profile.settings.concurrency).toBe(8);
});

test("choose reference account and show unsupported format errors", async ({
  page,
}) => {
  await page.locator("#session-input").fill(JSON.stringify(makeAccount()));
  const multi = {
    ...sample,
    accounts: [
      sample.accounts[0],
      { ...sample.accounts[0], name: "reference-two", concurrency: 6 },
    ],
  };
  await page
    .locator("#sub2api-settings input[type=file]")
    .first()
    .setInputFiles({
      name: "multi.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(multi)),
    });
  await page.getByLabel("选择参考账号", { exact: true }).selectOption("1");
  await page
    .getByRole("button", { name: "应用提取的设置", exact: true })
    .click();
  expect((await output(page)).accounts[0].concurrency).toBe(6);
  await page
    .locator("#sub2api-settings input[type=file]")
    .nth(1)
    .setInputFiles({
      name: "bad.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"type":"unsupported"}'),
    });
  await expect(page.locator("#sub2api-settings [role=status]")).toContainText(
    "导入失败",
  );
  expect((await output(page)).accounts[0].concurrency).toBe(6);
});
