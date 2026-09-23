/* Pure conversion policy shared by the browser and Node tests. No storage or network. */
(function (root) {
  "use strict";
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o || {}, k);
  const object = (v) =>
    v !== null && typeof v === "object" && !Array.isArray(v);
  const clone = (v) => JSON.parse(JSON.stringify(v));
  const FIELDS = [
    ["concurrency", "并发数", "integer", 10, "common"],
    ["priority", "优先级（越小越优先）", "integer", 1, "common"],
    ["rate_multiplier", "费用倍率", "number", 1, "common"],
    ["auto_pause_on_expired", "到期自动暂停", "boolean", true, "common"],
    [
      "credentials.model_mapping",
      "模型映射（JSON 对象）",
      "mapping",
      {},
      "advanced",
    ],
    [
      "extra.codex_fingerprint_mode",
      "Codex 指纹收敛",
      ["off", "device", "session", "full"],
      "off",
      "advanced",
    ],
    [
      "extra.openai_oauth_responses_websockets_v2_mode",
      "OAuth WebSocket 模式",
      ["off", "ctx_pool", "passthrough", "http_bridge"],
      "off",
      "advanced",
    ],
    [
      "extra.openai_long_context_billing_enabled",
      "长上下文计费",
      "boolean",
      false,
      "advanced",
    ],
    [
      "extra.auto_pause_5h_threshold",
      "5 小时暂停阈值（%）",
      "percent",
      100,
      "advanced",
    ],
    [
      "extra.auto_pause_7d_threshold",
      "7 天暂停阈值（%）",
      "percent",
      100,
      "advanced",
    ],
    [
      "extra.auto_pause_5h_disabled",
      "禁用 5 小时用量暂停",
      "boolean",
      false,
      "advanced",
    ],
    [
      "extra.auto_pause_7d_disabled",
      "禁用 7 天用量暂停",
      "boolean",
      false,
      "advanced",
    ],
    [
      "extra.auto_reset_credit_enabled",
      "自动使用重置信用",
      "boolean",
      false,
      "advanced",
    ],
    [
      "extra.auto_reset_credit_5h_threshold",
      "5 小时重置信用阈值（%）",
      "percent",
      100,
      "advanced",
    ],
    [
      "extra.auto_reset_credit_7d_threshold",
      "7 天重置信用阈值（%）",
      "percent",
      100,
      "advanced",
    ],
  ];
  const paths = new Set(FIELDS.map((f) => f[0]));
  function get(o, path) {
    return path.split(".").reduce((v, k) => v?.[k], o);
  }
  function set(o, path, value) {
    const parts = path.split(".");
    let dest = o;
    for (const k of parts.slice(0, -1)) {
      if (!object(dest[k])) dest[k] = {};
      dest = dest[k];
    }
    dest[parts.at(-1)] = clone(value);
  }
  function validateSettings(settings) {
    if (!object(settings)) throw Error("配置必须是对象");
    for (const [path, value] of Object.entries(settings)) {
      if (!paths.has(path)) throw Error(`不支持的配置：${path}`);
      const [, label, type] = FIELDS.find((f) => f[0] === path);
      let ok = true;
      if (Array.isArray(type)) ok = type.includes(value);
      else if (type === "boolean") ok = typeof value === "boolean";
      else if (type === "mapping")
        ok =
          object(value) &&
          Object.entries(value).every(
            ([k, v]) =>
              k.trim() &&
              typeof v === "string" &&
              v.trim() &&
              !["__proto__", "constructor", "prototype"].includes(k),
          );
      else
        ok =
          typeof value === "number" &&
          Number.isFinite(value) &&
          value >= 0 &&
          (type !== "integer" || Number.isSafeInteger(value)) &&
          (type !== "percent" || value <= 1);
      if (!ok) throw Error(`${label}：值无效`);
    }
    return settings;
  }
  const proxyFields = [
    "name",
    "protocol",
    "host",
    "port",
    "username",
    "password",
    "status",
    "expires_at",
    "fallback_mode",
    "backup_proxy_name",
    "expiry_warn_days",
    "password_required",
  ];
  function cleanProxy(p) {
    if (!object(p)) throw Error("代理必须是对象");
    const out = {};
    for (const k of proxyFields) if (own(p, k)) out[k] = clone(p[k]);
    return out;
  }
  function proxyKey(p) {
    return [p.protocol, p.host, p.port, p.username || "", p.password || ""]
      .map((x) => String(x).trim())
      .join("|");
  }
  function validateProxy(p, requirePassword = true) {
    if (typeof p.name !== "string" || !p.name.trim())
      throw Error("代理名称不能为空");
    if (
      !["http", "https", "socks5", "socks5h", "hysteria2"].includes(p.protocol)
    )
      throw Error(`${p.name}：代理协议无效`);
    if (typeof p.host !== "string" || !p.host.trim() || /[\s/|]/.test(p.host))
      throw Error(`${p.name}：主机填写域名或 IP，不含协议和路径`);
    if (!Number.isInteger(p.port) || p.port < 1 || p.port > 65535)
      throw Error(`${p.name}：端口应为 1–65535`);
    for (const k of ["username", "password"])
      if (own(p, k) && (typeof p[k] !== "string" || p[k].includes("|")))
        throw Error(`${p.name}：${k} 无效（不能包含 |）`);
    if (
      requirePassword &&
      (p.password_required || p.protocol === "hysteria2") &&
      !p.password?.trim()
    )
      throw Error(`${p.name}：请补填代理密码`);
    if (p.status && !["active", "inactive"].includes(p.status))
      throw Error(`${p.name}：代理状态无效`);
    if (
      p.fallback_mode &&
      !["none", "direct", "proxy"].includes(p.fallback_mode)
    )
      throw Error(`${p.name}：备用模式无效`);
    if (
      own(p, "expires_at") &&
      (!Number.isSafeInteger(p.expires_at) || p.expires_at <= 0)
    )
      throw Error(`${p.name}：代理到期时间无效`);
    if (
      own(p, "expiry_warn_days") &&
      (!Number.isSafeInteger(p.expiry_warn_days) || p.expiry_warn_days < 0)
    )
      throw Error(`${p.name}：到期提醒天数无效`);
  }
  function emptyProfile() {
    return { settings: {}, proxies: [] };
  }
  function validateProfile(p, requirePassword = false) {
    if (!object(p)) throw Error("模板配置格式错误");
    validateSettings(p.settings);
    if (!Array.isArray(p.proxies)) throw Error("代理列表格式错误");
    const names = new Set();
    p.proxies.forEach((x) => {
      validateProxy(x, requirePassword);
      if (names.has(x.name)) throw Error(`代理名称重复：${x.name}`);
      names.add(x.name);
    });
    if (
      own(p, "proxy") &&
      p.proxy !== null &&
      (typeof p.proxy !== "string" || !names.has(p.proxy))
    )
      throw Error("所选代理不存在");
    if (
      own(p, "expiry") &&
      p.expiry !== null &&
      (!Number.isSafeInteger(p.expiry) || p.expiry <= 0)
    )
      throw Error("账号到期时间无效");
    orderProxies(p.proxies, false);
    return p;
  }
  function orderProxies(list, requirePassword = true) {
    const byName = new Map(list.map((p) => [p.name, p]));
    const active = new Set();
    const done = new Set();
    const out = [];
    function visit(p) {
      if (done.has(p.name)) return;
      if (active.has(p.name)) throw Error(`备用代理存在循环：${p.name}`);
      active.add(p.name);
      validateProxy(p, requirePassword);
      if (p.fallback_mode === "proxy") {
        const b = byName.get(p.backup_proxy_name);
        if (!b)
          throw Error(`${p.name}：缺少备用代理 ${p.backup_proxy_name || ""}`);
        visit(b);
      }
      active.delete(p.name);
      done.add(p.name);
      out.push(p);
    }
    list.forEach(visit);
    return out;
  }
  function extractTemplate(document, index = 0) {
    if (
      !object(document) ||
      !Array.isArray(document.accounts) ||
      !Array.isArray(document.proxies)
    )
      throw Error("请选择 Sub2API 导出的 accounts/proxies 文件");
    const a = document.accounts[index];
    if (!a || a.platform !== "openai" || a.type !== "oauth")
      throw Error("模板仅支持 OpenAI OAuth 账号");
    const profile = emptyProfile();
    const included = [];
    const excluded = [];
    for (const [path] of FIELDS) {
      const v = get(a, path);
      if (v !== undefined) {
        profile.settings[path] = clone(v);
        included.push(path);
      }
    }
    if (
      !own(
        profile.settings,
        "extra.openai_oauth_responses_websockets_v2_mode",
      ) &&
      typeof a.extra?.openai_oauth_responses_websockets_v2_enabled === "boolean"
    ) {
      profile.settings["extra.openai_oauth_responses_websockets_v2_mode"] = a
        .extra.openai_oauth_responses_websockets_v2_enabled
        ? "ctx_pool"
        : "off";
      included.push("extra.openai_oauth_responses_websockets_v2_mode");
    }
    if (a.proxy_key) {
      const selected = document.proxies.find(
        (p) => p.proxy_key === a.proxy_key,
      );
      if (!selected) throw Error("模板账号的 proxy_key 找不到对应代理");
      const visited = new Set();
      function add(p) {
        if (visited.has(p.name)) return;
        visited.add(p.name);
        profile.proxies.push(cleanProxy(p));
        if (p.fallback_mode === "proxy") {
          const b = document.proxies.find(
            (x) => x.name === p.backup_proxy_name,
          );
          if (!b) throw Error("缺少模板备用代理");
          add(b);
        }
      }
      add(selected);
      profile.proxy = selected.name;
      included.push("代理及备用代理");
    }
    function walk(o, prefix = "") {
      for (const [k, v] of Object.entries(o || {})) {
        const path = prefix ? `${prefix}.${k}` : k;
        if (paths.has(path)) continue;
        if (["credentials", "extra"].includes(path) && object(v)) walk(v, path);
        else excluded.push(path);
      }
    }
    walk(a);
    validateProfile(profile);
    return { profile, included, excluded };
  }
  function preserveSource(base, record) {
    if (record.platform !== "openai" || record.type !== "oauth") return base;
    const a = clone(base);
    for (const [path] of FIELDS) {
      const value = get(record, path);
      if (value !== undefined) set(a, path, value);
    }
    if (own(record, "expires_at")) a.expires_at = record.expires_at;
    // No proxy_key: proxies must be explicitly supplied through the template/proxy editor.
    return a;
  }
  function applyProfile(account, profile) {
    validateProfile(profile);
    const a = clone(account);
    for (const [path, value] of Object.entries(profile.settings))
      set(a, path, value);
    if (own(profile, "expiry")) {
      if (profile.expiry === null) delete a.expires_at;
      else a.expires_at = profile.expiry;
    }
    if (own(profile, "proxy")) {
      delete a.proxy_key;
      if (profile.proxy !== null)
        a.proxy_key = proxyKey(
          profile.proxies.find((p) => p.name === profile.proxy),
        );
    }
    if (
      own(profile.settings, "extra.openai_oauth_responses_websockets_v2_mode")
    )
      a.extra.openai_oauth_responses_websockets_v2_enabled =
        profile.settings["extra.openai_oauth_responses_websockets_v2_mode"] !==
        "off";
    if (a.extra) delete a.extra.codex_fingerprint_seed;
    return a;
  }
  function mergeProfiles(base, override) {
    const out = clone(base);
    out.settings = { ...base.settings, ...override.settings };
    if (own(override, "proxy")) {
      out.proxy = override.proxy;
      out.proxies = clone(override.proxies);
    }
    if (own(override, "expiry")) out.expiry = override.expiry;
    return out;
  }
  function buildDocument(
    items,
    batch = emptyProfile(),
    overrides = [],
    now = new Date(),
  ) {
    const proxies = new Map();
    const names = new Map();
    const accounts = items.map((item, i) => {
      try {
        const ov = overrides[i] || {};
        const profile = mergeProfiles(batch, ov.profile || emptyProfile());
        const a = applyProfile(item.sub2apiAccount, profile);
        if (ov.name !== undefined) {
          if (!ov.name.trim()) throw Error("账号名称不能为空");
          a.name = ov.name.trim();
        }
        if (profile.proxy) {
          const required = new Set();
          const add = (name) => {
            if (required.has(name)) return;
            required.add(name);
            const p = profile.proxies.find((x) => x.name === name);
            if (p?.fallback_mode === "proxy") add(p.backup_proxy_name);
          };
          add(profile.proxy);
          for (const p of orderProxies(
            profile.proxies.filter((p) => required.has(p.name)),
          )) {
            const key = proxyKey(p);
            const output = cleanProxy(p);
            delete output.password_required;
            output.proxy_key = key;
            if (names.has(p.name) && names.get(p.name) !== key)
              throw Error(`不同代理使用相同名称：${p.name}`);
            if (output.fallback_mode === "proxy")
              output.backup_proxy_name = proxies.get(
                names.get(p.backup_proxy_name),
              ).name;
            if (proxies.has(key)) {
              const existing = proxies.get(key);
              if (
                JSON.stringify({ ...existing, name: output.name }) !==
                JSON.stringify(output)
              )
                throw Error(`同一代理存在冲突配置：${p.name}`);
            } else proxies.set(key, output);
            names.set(p.name, key);
          }
        }
        validateSettings(
          Object.fromEntries(
            FIELDS.map(([p]) => [p, get(a, p)]).filter(
              ([, v]) => v !== undefined,
            ),
          ),
        );
        return a;
      } catch (e) {
        throw Error(`账号 ${i + 1}（${item.name || "未命名"}）：${e.message}`);
      }
    });
    return {
      exported_at: now.toISOString(),
      proxies: [...proxies.values()],
      accounts,
    };
  }
  function serializeTemplate(name, profile, includePasswords = false) {
    validateProfile(profile);
    if (typeof name !== "string" || !name.trim()) throw Error("请填写模板名称");
    const p = {
      settings: clone(profile.settings),
      proxies: profile.proxies.map(cleanProxy),
    };
    for (const k of ["proxy", "expiry"]) if (own(profile, k)) p[k] = profile[k];
    for (const proxy of p.proxies) {
      if (!includePasswords && proxy.password) {
        delete proxy.password;
        proxy.password_required = true;
      }
    }
    return {
      type: "sub2api-converter-template",
      version: 1,
      name: name.trim(),
      profile: p,
    };
  }
  function parseTemplate(data) {
    if (
      !object(data) ||
      data.type !== "sub2api-converter-template" ||
      data.version !== 1
    )
      throw Error("不支持的模板文件或版本");
    return serializeTemplate(data.name, data.profile, true);
  }
  const api = {
    FIELDS,
    emptyProfile,
    validateSettings,
    validateProfile,
    extractTemplate,
    preserveSource,
    applyProfile,
    mergeProfiles,
    buildDocument,
    serializeTemplate,
    parseTemplate,
    proxyKey,
    cleanProxy,
  };
  root.Sub2api = api;
  if (typeof module !== "undefined") module.exports = api;
})(globalThis);
