(() => {
  const OUTPUT_LABELS = {
    sub2api: "sub2api",
    cpa: "CPA",
    cockpit: "Cockpit",
    "9router": "9router",
    codex: "Codex",
    axonhub: "AxonHub",
    codexmanager: "Codex-Manager",
  };

  const state = {
    format: "sub2api",
    sessions: [],
    converted: [],
    skipped: [],
    outputText: "",
  };

  const elements = {
    accountBody: document.querySelector("#account-body"),
    clearInput: document.querySelector("#clear-input"),
    copyOutput: document.querySelector("#copy-output"),
    cpaNotice: document.querySelector("#cpa-notice"),
    downloadOutput: document.querySelector("#download-output"),
    fileInput: document.querySelector("#file-input"),
    formatButtons: Array.from(document.querySelectorAll("[data-format]")),
    input: document.querySelector("#session-input"),
    inputStatus: document.querySelector("#input-status"),
    issues: document.querySelector("#issues"),
    loadExample: document.querySelector("#load-example"),
    output: document.querySelector("#output"),
    outputStatus: document.querySelector("#output-status"),
    outputSubtitle: document.querySelector("#output-subtitle"),
    pickFiles: document.querySelector("#pick-files"),
    statCount: document.querySelector("#stat-count"),
    statErrors: document.querySelector("#stat-errors"),
    statFormat: document.querySelector("#stat-format"),
  };

  const exampleSession = {
    user: {
      id: "user-example",
      email: "mark@example.com",
    },
    expires: "2026-08-06T14:29:36.155Z",
    account: {
      id: "00000000-0000-4000-9000-000000000000",
      planType: "plus",
    },
    accessToken: "paste-real-access-token-here",
    sessionToken: "paste-real-session-token-here",
    authProvider: "openai",
  };

  const AXONHUB_PLACEHOLDER_REFRESH_TOKEN = "__missing_refresh_token__";

  function isPlainObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  function firstNonEmpty(...values) {
    for (const value of values) {
      if (typeof value === "string" && value.trim() !== "") {
        return value.trim();
      }
    }
    return undefined;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function decodeBase64Url(value) {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  function bytesToBase64Url(bytes) {
    let binary = "";
    for (let index = 0; index < bytes.length; index += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
    }
    return btoa(binary)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
  }

  function encodeBase64UrlJson(value) {
    return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(value)));
  }

  function parseJwtPayload(token) {
    if (typeof token !== "string" || token.trim() === "") {
      return undefined;
    }

    const segments = token.split(".");
    if (segments.length < 2) {
      return undefined;
    }

    try {
      return JSON.parse(decodeBase64Url(segments[1]));
    } catch {
      return undefined;
    }
  }

  function getOpenAIAuthSection(payload) {
    if (!isPlainObject(payload)) {
      return {};
    }

    const auth = payload["https://api.openai.com/auth"];
    return isPlainObject(auth) ? auth : {};
  }

  function getOpenAIProfileSection(payload) {
    if (!isPlainObject(payload)) {
      return {};
    }

    const profile = payload["https://api.openai.com/profile"];
    return isPlainObject(profile) ? profile : {};
  }

  function normalizeTimestamp(value) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value.toISOString();
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      const milliseconds = value > 1e11 ? value : value * 1000;
      const date = new Date(milliseconds);
      return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
    }

    if (typeof value !== "string" || value.trim() === "") {
      return undefined;
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  }

  function timestampFromUnixSeconds(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return undefined;
    }

    const date = new Date(numeric * 1000);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  }

  function unixSecondsFromJwtExp(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      return undefined;
    }

    return Math.trunc(numeric);
  }

  function epochSecondsFromValue(value) {
    if (value === undefined || value === null || value === "") {
      return 0;
    }

    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return Math.trunc(numeric > 1e11 ? numeric / 1000 : numeric);
    }

    const parsed = Date.parse(String(value));
    return Number.isFinite(parsed) ? Math.trunc(parsed / 1000) : 0;
  }

  function buildSyntheticCodexIdToken(
    email,
    accountId,
    planType,
    userId,
    expiresAt,
  ) {
    if (!accountId) {
      return undefined;
    }

    const now = Math.trunc(Date.now() / 1000);
    const authInfo = { chatgpt_account_id: accountId };
    const expires = epochSecondsFromValue(expiresAt) || now + 90 * 24 * 60 * 60;

    if (planType) {
      authInfo.chatgpt_plan_type = planType;
    }

    if (userId) {
      authInfo.chatgpt_user_id = userId;
      authInfo.user_id = userId;
    }

    const payload = {
      iat: now,
      exp: expires,
      "https://api.openai.com/auth": authInfo,
    };

    if (email) {
      payload.email = email;
    }

    return `${encodeBase64UrlJson({ alg: "none", typ: "JWT", cpa_synthetic: true })}.${encodeBase64UrlJson(payload)}.synthetic`;
  }

  function getExpiresIn(expiresAt, now = new Date()) {
    if (!expiresAt) {
      return undefined;
    }

    const expiresMs = new Date(expiresAt).getTime();
    if (Number.isNaN(expiresMs)) {
      return undefined;
    }

    return Math.max(0, Math.floor((expiresMs - now.getTime()) / 1000));
  }

  function getAxonHubLastRefresh(expiresAt, now = new Date()) {
    const expiresMs = expiresAt ? new Date(expiresAt).getTime() : NaN;
    if (Number.isNaN(expiresMs)) {
      return normalizeTimestamp(now);
    }

    return new Date(expiresMs - 60 * 60 * 1000).toISOString();
  }

  function stripUnavailable(value) {
    if (Array.isArray(value)) {
      return value.map(stripUnavailable).filter((item) => item !== undefined);
    }

    if (isPlainObject(value)) {
      const entries = Object.entries(value)
        .map(([key, item]) => [key, stripUnavailable(item)])
        .filter(([, item]) => item !== undefined);
      return entries.length ? Object.fromEntries(entries) : undefined;
    }

    if (value === undefined || value === null || value === "") {
      return undefined;
    }

    return value;
  }

  function toEmailKey(email) {
    if (typeof email !== "string") {
      return undefined;
    }

    return email
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function sanitizeFileToken(value, fallback = "chatgpt-session") {
    const base = firstNonEmpty(value, fallback) || fallback;
    return (
      base
        .replace(/\.[^.]+$/u, "")
        .replace(/[\\/:*?"<>|]+/g, "-")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-+|-+$/g, "")
        .toLowerCase()
        .slice(0, 80) || fallback
    );
  }

  function getTimestampToken(date = new Date()) {
    const pad = (value) => String(value).padStart(2, "0");
    return (
      [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join(
        "-",
      ) +
      "_" +
      [
        pad(date.getHours()),
        pad(date.getMinutes()),
        pad(date.getSeconds()),
      ].join("-")
    );
  }

  function formatDisplayDate(value) {
    if (!value) {
      return "";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    const pad = (item) => String(item).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function collectSessionLikeObjects(value, sourceName = "pasted-json") {
    const found = [];
    const visited = new WeakSet();

    function visit(item, path) {
      if (!isPlainObject(item) && !Array.isArray(item)) {
        return;
      }

      if (isPlainObject(item)) {
        if (visited.has(item)) {
          return;
        }
        visited.add(item);

        const token = firstNonEmpty(
          item.accessToken,
          item.access_token,
          item.tokens?.accessToken,
          item.tokens?.access_token,
          item.token?.accessToken,
          item.token?.access_token,
          item.credentials?.accessToken,
          item.credentials?.access_token,
        );
        const hasIdentity =
          isPlainObject(item.user) ||
          firstNonEmpty(
            item.email,
            item.name,
            item.label,
            item.meta?.label,
            item.tokens?.accountId,
            item.tokens?.account_id,
            item.tokens?.chatgptAccountId,
            item.tokens?.chatgpt_account_id,
            item.providerSpecificData?.chatgptAccountId,
            item.providerSpecificData?.chatgpt_account_id,
            item.id,
          );
        if (token && hasIdentity) {
          found.push({ value: item, sourceName, path });
          return;
        }

        for (const [key, child] of Object.entries(item)) {
          if (
            key === "accessToken" ||
            key === "access_token" ||
            key === "sessionToken"
          ) {
            continue;
          }
          visit(child, `${path}.${key}`);
        }
        return;
      }

      item.forEach((child, index) => visit(child, `${path}[${index}]`));
    }

    visit(value, "$");
    return found;
  }

  function parseInputDocuments(text) {
    if (typeof text !== "string" || text.trim() === "") {
      return [];
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      throw new Error(`JSON 解析失败：${error.message}`);
    }

    return collectSessionLikeObjects(parsed);
  }

  function convertSession(record, options = {}) {
    if (!isPlainObject(record)) {
      throw new Error("session 不是 JSON 对象");
    }

    const accessToken = firstNonEmpty(
      record.accessToken,
      record.access_token,
      record.tokens?.accessToken,
      record.tokens?.access_token,
      record.token?.accessToken,
      record.token?.access_token,
      record.credentials?.accessToken,
      record.credentials?.access_token,
    );
    if (!accessToken) {
      throw new Error("缺少 accessToken");
    }
    const sessionToken = firstNonEmpty(
      record.sessionToken,
      record.session_token,
      record.tokens?.sessionToken,
      record.tokens?.session_token,
      record.token?.sessionToken,
      record.token?.session_token,
      record.credentials?.session_token,
    );
    const refreshToken = firstNonEmpty(
      record.refreshToken,
      record.refresh_token,
      record.tokens?.refreshToken,
      record.tokens?.refresh_token,
      record.token?.refreshToken,
      record.token?.refresh_token,
      record.credentials?.refresh_token,
    );
    const inputIdToken = firstNonEmpty(
      record.idToken,
      record.id_token,
      record.tokens?.idToken,
      record.tokens?.id_token,
      record.token?.idToken,
      record.token?.id_token,
      record.credentials?.id_token,
    );

    const payload = parseJwtPayload(accessToken);
    const idPayload = parseJwtPayload(inputIdToken);
    const auth = getOpenAIAuthSection(payload);
    const idAuth = getOpenAIAuthSection(idPayload);
    const profile = getOpenAIProfileSection(payload);
    const hasRefreshToken = Boolean(refreshToken);
    const accessTokenExpiresAt = hasRefreshToken
      ? undefined
      : unixSecondsFromJwtExp(payload?.exp);
    const expiresAt = hasRefreshToken
      ? undefined
      : firstNonEmpty(
          payload ? timestampFromUnixSeconds(payload.exp) : undefined,
          normalizeTimestamp(record.expires),
          normalizeTimestamp(record.expiresAt),
          normalizeTimestamp(record.expired),
          normalizeTimestamp(record.expires_at),
        );
    const email = firstNonEmpty(
      record.user?.email,
      record.email,
      record.meta?.label,
      record.label,
      record.credentials?.email,
      record.providerSpecificData?.email,
      profile.email,
      idPayload?.email,
      payload?.email,
    );
    const accountId = firstNonEmpty(
      record.account?.id,
      record.account_id,
      record.tokens?.accountId,
      record.tokens?.account_id,
      record.chatgptAccountId,
      record.chatgpt_account_id,
      record.meta?.chatgptAccountId,
      record.meta?.chatgpt_account_id,
      record.tokens?.chatgptAccountId,
      record.tokens?.chatgpt_account_id,
      record.providerSpecificData?.chatgptAccountId,
      record.providerSpecificData?.chatgpt_account_id,
      record.credentials?.chatgpt_account_id,
      auth.chatgpt_account_id,
      idAuth.chatgpt_account_id,
      record.provider === "codex" ? record.id : undefined,
    );
    const chatgptAccountId = firstNonEmpty(
      record.chatgptAccountId,
      record.chatgpt_account_id,
      record.meta?.chatgptAccountId,
      record.meta?.chatgpt_account_id,
      record.tokens?.chatgptAccountId,
      record.tokens?.chatgpt_account_id,
      record.providerSpecificData?.chatgptAccountId,
      record.providerSpecificData?.chatgpt_account_id,
      record.credentials?.chatgpt_account_id,
      auth.chatgpt_account_id,
      idAuth.chatgpt_account_id,
    );
    const workspaceId = firstNonEmpty(
      record.account?.workspaceId,
      record.account?.workspace_id,
      record.workspaceId,
      record.workspace_id,
      record.meta?.workspaceId,
      record.meta?.workspace_id,
      record.providerSpecificData?.workspaceId,
      record.providerSpecificData?.workspace_id,
      record.credentials?.workspace_id,
      payload?.workspace_id,
      idPayload?.workspace_id,
    );
    const userId = firstNonEmpty(
      record.user?.id,
      record.user_id,
      record.chatgptUserId,
      record.credentials?.chatgpt_user_id,
      record.providerSpecificData?.chatgptUserId,
      record.providerSpecificData?.chatgpt_user_id,
      auth.chatgpt_user_id,
      auth.user_id,
      idAuth.chatgpt_user_id,
      idAuth.user_id,
    );
    const planType = firstNonEmpty(
      record.account?.planType,
      record.account?.plan_type,
      record.planType,
      record.plan_type,
      record.providerSpecificData?.chatgptPlanType,
      record.providerSpecificData?.chatgpt_plan_type,
      record.credentials?.plan_type,
      auth.chatgpt_plan_type,
      idAuth.chatgpt_plan_type,
    );
    const exportedAt = normalizeTimestamp(options.now || new Date());
    const expiresIn = getExpiresIn(expiresAt, options.now || new Date());
    const sourceName = firstNonEmpty(options.sourceName, "pasted-json");
    const sourceType =
      record.provider === "codex" && record.authType === "oauth"
        ? "9router"
        : "chatgpt_web_session";
    const name = firstNonEmpty(
      record.name,
      record.meta?.label,
      email,
      sourceName,
      "ChatGPT Account",
    );
    const syntheticIdToken = !inputIdToken
      ? buildSyntheticCodexIdToken(
          email,
          accountId,
          planType,
          userId,
          expiresAt,
        )
      : undefined;
    const idToken = firstNonEmpty(inputIdToken, syntheticIdToken);

    const cpa = Object.fromEntries(
      Object.entries({
        type: "codex",
        account_id: accountId,
        chatgpt_account_id: accountId,
        email,
        name,
        plan_type: planType,
        chatgpt_plan_type: planType,
        id_token: idToken,
        id_token_synthetic: Boolean(syntheticIdToken) || undefined,
        access_token: accessToken,
        refresh_token: refreshToken || "",
        session_token: sessionToken,
        last_refresh: exportedAt,
        expired: expiresAt,
        disabled: Boolean(record.disabled) || undefined,
      }).filter(([, value]) => value !== undefined && value !== null),
    );

    const cockpit = {
      type: "codex",
      id_token: idToken,
      access_token: accessToken,
      refresh_token: refreshToken || "",
      account_id: accountId,
      last_refresh: exportedAt,
      email,
      expired: expiresAt,
      account_note: firstNonEmpty(
        record.account_note,
        record.accountInfo,
        record.account_info,
        record.note,
        record.notes,
        record.remark,
      ),
    };

    const sub2apiAccount = stripUnavailable({
      name: firstNonEmpty(name, email, sourceName, "ChatGPT Account"),
      platform: "openai",
      type: "oauth",
      expires_at: accessTokenExpiresAt,
      auto_pause_on_expired: accessTokenExpiresAt ? true : undefined,
      concurrency: 10,
      priority: 1,
      credentials: {
        access_token: accessToken,
        refresh_token: refreshToken,
        id_token: inputIdToken,
        client_id: firstNonEmpty(
          record.client_id,
          record.credentials?.client_id,
        ),
        organization_id: firstNonEmpty(
          record.organization_id,
          record.credentials?.organization_id,
        ),
        chatgpt_account_id: accountId,
        chatgpt_user_id: userId,
        email,
        expires_at: firstNonEmpty(
          timestampFromUnixSeconds(payload?.exp),
          normalizeTimestamp(record.credentials?.expires_at),
          expiresAt,
        ),
        expires_in: expiresIn,
        plan_type: planType,
      },
      extra: {
        email,
        email_key: toEmailKey(email),
        name,
        auth_provider: firstNonEmpty(record.authProvider, record.auth_provider),
        source: sourceType,
        last_refresh: exportedAt,
      },
    });
    const priority = Number.isFinite(Number(record.priority))
      ? Number(record.priority)
      : 9;
    const isActive =
      typeof record.isActive === "boolean"
        ? record.isActive
        : !Boolean(record.disabled);
    const createdAt = normalizeTimestamp(record.createdAt) || exportedAt;
    const updatedAt = normalizeTimestamp(record.updatedAt) || exportedAt;
    const nineRouter = stripUnavailable({
      accessToken,
      refreshToken,
      expiresAt,
      testStatus: firstNonEmpty(
        record.testStatus,
        record.test_status,
        "active",
      ),
      expiresIn,
      providerSpecificData: {
        chatgptAccountId: accountId,
        chatgptPlanType: planType,
      },
      id: accountId,
      provider: "codex",
      authType: "oauth",
      name,
      email,
      priority,
      isActive,
      createdAt,
      updatedAt,
    });
    const axonHubRefreshToken =
      refreshToken || AXONHUB_PLACEHOLDER_REFRESH_TOKEN;
    const codexAuthJson = {
      auth_mode: "chatgpt",
      OPENAI_API_KEY: null,
      tokens: {
        id_token: idToken,
        access_token: accessToken,
        refresh_token: refreshToken || "",
        account_id: accountId,
      },
      last_refresh: exportedAt,
    };
    const axonHub = stripUnavailable({
      auth_mode: "chatgpt",
      last_refresh: getAxonHubLastRefresh(expiresAt, options.now || new Date()),
      tokens: {
        access_token: accessToken,
        refresh_token: axonHubRefreshToken,
        id_token: idToken,
      },
      axonhub_refresh_token_placeholder: refreshToken ? undefined : true,
      axonhub_note: refreshToken
        ? undefined
        : "refresh_token is a placeholder; access_token works only until it expires.",
    });
    const codexManagerTokenHints = Object.fromEntries(
      Object.entries({
        account_id: accountId,
        chatgpt_account_id: chatgptAccountId,
      }).filter(
        ([, value]) => value !== undefined && value !== null && value !== "",
      ),
    );
    const codexManagerMeta = Object.fromEntries(
      Object.entries({
        label: firstNonEmpty(name, email, sourceName, "ChatGPT Account"),
        workspace_id: workspaceId,
        chatgpt_account_id: chatgptAccountId,
        note: "Imported from ChatGPT session",
      }).filter(
        ([, value]) => value !== undefined && value !== null && value !== "",
      ),
    );
    const codexManager = {
      tokens: {
        access_token: accessToken,
        refresh_token: refreshToken || "",
        id_token: inputIdToken || "",
        ...codexManagerTokenHints,
      },
      meta: codexManagerMeta,
    };

    return {
      sourceName,
      sourcePath: options.sourcePath,
      email,
      name,
      expiresAt,
      accessTokenExpiresAt,
      cpa,
      cockpit,
      nineRouter,
      codexAuthJson,
      axonHub,
      codexManager,
      sub2apiAccount: globalThis.Sub2api.preserveSource(sub2apiAccount, record),
    };
  }

  function buildSub2apiDocument(converted, now = new Date()) {
    return {
      exported_at: normalizeTimestamp(now),
      proxies: [],
      accounts: converted.map((item) => item.sub2apiAccount),
    };
  }

  function buildOutputDocument() {
    const now = new Date();
    if (state.format === "sub2api") {
      return globalThis.Sub2apiUI
        ? globalThis.Sub2apiUI.build(state.converted, now)
        : buildSub2apiDocument(state.converted, now);
    }

    if (state.format === "cpa") {
      return state.converted.length === 1
        ? state.converted[0].cpa
        : state.converted.map((item) => item.cpa);
    }

    if (state.format === "cockpit") {
      return state.converted.length === 1
        ? state.converted[0].cockpit
        : state.converted.map((item) => item.cockpit);
    }

    if (state.format === "9router") {
      return state.converted.length === 1
        ? state.converted[0].nineRouter
        : state.converted.map((item) => item.nineRouter);
    }

    if (state.format === "codex") {
      return state.converted.length === 1
        ? state.converted[0].codexAuthJson
        : state.converted.map((item) => item.codexAuthJson);
    }

    if (state.format === "axonhub") {
      return state.converted.length === 1
        ? state.converted[0].axonHub
        : state.converted.map((item) => item.axonHub);
    }

    if (state.format === "codexmanager") {
      return state.converted.length === 1
        ? state.converted[0].codexManager
        : state.converted.map((item) => item.codexManager);
    }

    return buildSub2apiDocument(state.converted, now);
  }

  function convertFromText(text) {
    const sources = parseInputDocuments(text);
    const converted = [];
    const skipped = [];
    const now = new Date();

    sources.forEach((item, index) => {
      try {
        converted.push(
          convertSession(item.value, {
            now,
            sourceName: item.sourceName,
            sourcePath: item.path || `$[${index}]`,
          }),
        );
      } catch (error) {
        skipped.push({
          sourceName: item.sourceName,
          path: item.path,
          reason: error instanceof Error ? error.message : "无法转换",
        });
      }
    });

    if (!sources.length) {
      skipped.push({
        sourceName: "pasted-json",
        path: "$",
        reason: "未找到包含 accessToken 和 user/email 的 session 对象",
      });
    }

    state.converted = converted;
    state.skipped = skipped;
    state.sessions = sources;
    updateOutput();
  }

  function setStatus(element, text, tone = "") {
    element.textContent = text;
    element.classList.toggle("is-ok", tone === "ok");
    element.classList.toggle("is-error", tone === "error");
  }

  function updateOutput() {
    globalThis.Sub2apiUI?.sync(state.format, state.converted);
    const hasConverted = state.converted.length > 0;
    let outputText = "";

    let configError = "";
    if (hasConverted) {
      try {
        outputText = JSON.stringify(buildOutputDocument(), null, 2);
      } catch (error) {
        configError = error.message;
      }
    }

    state.outputText = outputText;
    elements.output.value = outputText;
    elements.copyOutput.disabled = !outputText;
    elements.downloadOutput.disabled = !outputText;
    elements.statCount.textContent = String(state.converted.length);
    elements.statErrors.textContent = String(state.skipped.length);
    elements.statFormat.textContent = OUTPUT_LABELS[state.format];
    elements.outputSubtitle.textContent = `当前输出为 ${OUTPUT_LABELS[state.format]} 导入 JSON。`;
    elements.cpaNotice.style.display = [
      "cpa",
      "cockpit",
      "codex",
      "axonhub",
      "codexmanager",
    ].includes(state.format)
      ? "block"
      : "none";

    renderAccounts();
    renderIssues();

    if (configError) {
      setStatus(elements.outputStatus, configError, "error");
    } else if (outputText) {
      setStatus(
        elements.outputStatus,
        `已生成 ${state.converted.length} 个账号。`,
        "ok",
      );
    } else {
      setStatus(
        elements.outputStatus,
        "暂无输出。",
        state.skipped.length ? "error" : "",
      );
    }
  }

  function renderAccounts() {
    if (!state.converted.length) {
      elements.accountBody.innerHTML =
        '<tr><td colspan="4" class="empty">暂无可转换账号。</td></tr>';
      return;
    }

    elements.accountBody.innerHTML = state.converted
      .map(
        (item) => `
            <tr>
              <td><div class="cell-clip" title="${escapeHtml(item.name)}">${escapeHtml(item.name || "-")}</div></td>
              <td><div class="cell-clip" title="${escapeHtml(item.email)}">${escapeHtml(item.email || "-")}</div></td>
              <td><div class="cell-clip" title="${escapeHtml(item.expiresAt)}">${escapeHtml(formatDisplayDate(item.expiresAt) || "-")}</div></td>
              <td><div class="cell-clip" title="${escapeHtml(item.sourceName)}">${escapeHtml(item.sourceName || "pasted-json")}</div></td>
            </tr>
          `,
      )
      .join("");
  }

  function renderIssues() {
    if (!state.skipped.length) {
      elements.issues.classList.remove("is-visible");
      elements.issues.textContent = "";
      return;
    }

    elements.issues.classList.add("is-visible");
    elements.issues.innerHTML = state.skipped
      .map(
        (item) =>
          `<div>${escapeHtml(item.sourceName || "input")} ${escapeHtml(item.path || "")}: ${escapeHtml(item.reason)}</div>`,
      )
      .join("");
  }

  function scheduleConvert() {
    const text = elements.input.value;
    if (!text.trim()) {
      state.converted = [];
      state.skipped = [];
      state.sessions = [];
      updateOutput();
      setStatus(elements.inputStatus, "等待输入。");
      return;
    }

    try {
      convertFromText(text);
      if (state.converted.length) {
        setStatus(
          elements.inputStatus,
          `解析完成：${state.converted.length} 个账号，跳过 ${state.skipped.length} 项。`,
          "ok",
        );
      } else {
        setStatus(elements.inputStatus, "没有可转换账号。", "error");
      }
    } catch (error) {
      state.converted = [];
      state.skipped = [
        {
          sourceName: "pasted-json",
          path: "$",
          reason: error instanceof Error ? error.message : "JSON 解析失败",
        },
      ];
      state.outputText = "";
      updateOutput();
      setStatus(
        elements.inputStatus,
        error instanceof Error ? error.message : "JSON 解析失败",
        "error",
      );
    }
  }

  function downloadOutput() {
    if (!state.outputText) {
      return;
    }

    const first = state.converted[0];
    const base = sanitizeFileToken(first?.email || first?.name || state.format);
    const fileName = `${base}.${state.format}.${getTimestampToken()}.json`;
    const blob = new Blob([state.outputText], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function copyOutput() {
    if (!state.outputText) {
      return;
    }

    try {
      await navigator.clipboard.writeText(state.outputText);
      setStatus(elements.outputStatus, "已复制到剪贴板。", "ok");
    } catch {
      elements.output.select();
      document.execCommand("copy");
      setStatus(elements.outputStatus, "已复制到剪贴板。", "ok");
    }
  }

  async function readFiles(files) {
    const jsonFiles = Array.from(files).filter((file) =>
      file.name.toLowerCase().endsWith(".json"),
    );
    if (!jsonFiles.length) {
      setStatus(elements.inputStatus, "没有选择 JSON 文件。", "error");
      return;
    }

    const documents = [];
    const skipped = [];

    for (const file of jsonFiles) {
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const found = collectSessionLikeObjects(
          parsed,
          file.webkitRelativePath || file.name,
        );
        if (!found.length) {
          skipped.push({
            sourceName: file.webkitRelativePath || file.name,
            path: "$",
            reason: "未找到包含 accessToken 和 user/email 的 session 对象",
          });
        }
        documents.push(...found);
      } catch (error) {
        skipped.push({
          sourceName: file.webkitRelativePath || file.name,
          path: "$",
          reason: error instanceof Error ? error.message : "无法读取文件",
        });
      }
    }

    const now = new Date();
    const converted = [];
    const convertSkipped = [...skipped];
    documents.forEach((item) => {
      try {
        converted.push(
          convertSession(item.value, {
            now,
            sourceName: item.sourceName,
            sourcePath: item.path,
          }),
        );
      } catch (error) {
        convertSkipped.push({
          sourceName: item.sourceName,
          path: item.path,
          reason: error instanceof Error ? error.message : "无法转换",
        });
      }
    });

    state.sessions = documents;
    state.converted = converted;
    state.skipped = convertSkipped;
    elements.input.value =
      documents.length === 1
        ? JSON.stringify(documents[0].value, null, 2)
        : JSON.stringify(
            documents.map((item) => item.value),
            null,
            2,
          );
    updateOutput();
    setStatus(
      elements.inputStatus,
      `读取 ${jsonFiles.length} 个文件，生成 ${converted.length} 个账号，跳过 ${convertSkipped.length} 项。`,
      converted.length ? "ok" : "error",
    );
  }

  elements.formatButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.format = button.dataset.format;
      elements.formatButtons.forEach((item) => {
        item.setAttribute("aria-pressed", String(item === button));
      });
      updateOutput();
    });
  });

  elements.input.addEventListener("input", scheduleConvert);
  elements.copyOutput.addEventListener("click", copyOutput);
  elements.downloadOutput.addEventListener("click", downloadOutput);
  elements.pickFiles.addEventListener("click", () =>
    elements.fileInput.click(),
  );
  elements.fileInput.addEventListener("change", (event) => {
    readFiles(event.target.files);
    event.target.value = "";
  });

  elements.input.addEventListener("dragover", (event) =>
    event.preventDefault(),
  );
  elements.input.addEventListener("drop", (event) => {
    event.preventDefault();
    if (event.dataTransfer?.files?.length) readFiles(event.dataTransfer.files);
  });

  elements.clearInput.addEventListener("click", () => {
    elements.input.value = "";
    scheduleConvert();
  });

  elements.loadExample.addEventListener("click", () => {
    elements.input.value = JSON.stringify(exampleSession, null, 2);
    scheduleConvert();
  });

  globalThis.Converter = { updateOutput, getConverted: () => state.converted };
  updateOutput();
})();
