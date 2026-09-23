(function () {
  "use strict";
  const S = globalThis.Sub2api;
  const root = document.querySelector("#sub2api-settings");
  const STORE = "sub2api-converter.templates.v1";
  let library = [],
    batch = S.emptyProfile(),
    overrides = [],
    converted = [],
    selectedAccount = -1,
    importDocument;
  let editorError = "",
    revision = 0,
    persistedWarning = "";
  const el = (tag, text, attrs = {}) => {
    const e = document.createElement(tag);
    if (text !== undefined) e.textContent = text;
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") e.className = v;
      else e.setAttribute(k, v);
    }
    return e;
  };
  const button = (text, fn) => {
    const b = el("button", text, {
      type: "button",
      class: "button button-secondary",
    });
    b.addEventListener("click", () => guard(fn));
    return b;
  };
  const input = (type, value = "") => {
    const e = el("input", undefined, { type });
    e.value = value;
    return e;
  };
  const label = (text, control) => {
    const l = el("label", text);
    control.setAttribute("aria-label", text);
    l.append(control);
    return l;
  };
  const select = (entries) => {
    const e = el("select");
    entries.forEach(([v, t]) => {
      const o = el("option", t, { value: v });
      e.append(o);
    });
    return e;
  };
  const copy = (x) => JSON.parse(JSON.stringify(x));
  const profile = () => {
    if (selectedAccount < 0) return batch;
    const override = (overrides[selectedAccount] ||= {});
    return (override.profile ||= {
      settings: {},
      proxies: copy(batch.proxies),
    });
  };
  const refresh = () => globalThis.Converter.updateOutput();
  function guard(fn) {
    try {
      fn();
    } catch (e) {
      status.textContent = e.message;
      status.className = "status-line is-error";
    }
  }
  function inform(text) {
    status.textContent = text;
    status.className = "status-line is-ok";
  }
  function saveLibrary(next) {
    localStorage.setItem(STORE, JSON.stringify(next));
    library = next;
    renderLibrary();
  }
  try {
    const raw = localStorage.getItem(STORE);
    if (raw) {
      const data = JSON.parse(raw);
      if (!Array.isArray(data)) throw Error("模板库格式错误");
      library = data.map(S.parseTemplate);
    }
  } catch {
    persistedWarning =
      "无法读取本地模板库；仍可转换并导入、导出模板文件。原存储未被覆盖。";
  }

  root.className = "panel settings-panel";
  const head = el("div", undefined, { class: "panel-head" });
  const title = el("div");
  title.append(
    el("h2", "Sub2API 配置与模板"),
    el("p", "先导入账号，再应用模板。凭据和订阅档位始终取自新账号。"),
  );
  head.append(title);
  const collapse = button("收起配置", () => {
    body.hidden = !body.hidden;
    collapse.textContent = body.hidden ? "展开配置与模板" : "收起配置";
    collapse.setAttribute("aria-expanded", String(!body.hidden));
  });
  collapse.setAttribute("aria-expanded", "true");
  head.append(collapse);
  root.append(head);
  const body = el("div", undefined, { class: "panel-body" });
  root.append(body);
  const toolbar = el("div", undefined, { class: "template-toolbar" });
  const templateName = input("text");
  templateName.placeholder = "例如：日常 Codex";
  const savedSelect = select([["", "选择已保存模板"]]);
  const withPassword = input("checkbox");
  const fileInput = input("file");
  fileInput.accept = ".json,application/json";
  fileInput.hidden = true;
  const templateFile = input("file");
  templateFile.accept = ".json,application/json";
  templateFile.hidden = true;
  toolbar.append(
    label("模板名称", templateName),
    label("本地模板库", savedSelect),
  );
  const actions = el("div", undefined, { class: "config-actions" });
  actions.append(
    button("从账号文件提取", () => fileInput.click()),
    button("导入模板文件", () => templateFile.click()),
    button("应用选中模板", () => {
      const t = library[Number(savedSelect.value)];
      if (savedSelect.value === "" || !t) throw Error("请先选择模板");
      setProfile(t.profile);
      templateName.value = t.name;
      inform("模板已应用到当前编辑范围。");
    }),
  );
  const save = button("保存为新模板", () => {
    checkEditor();
    const t = S.serializeTemplate(
      templateName.value,
      profile(),
      withPassword.checked,
    );
    if (library.some((x) => x.name === t.name))
      throw Error("模板名称已存在，请更换名称或使用更新按钮");
    saveLibrary([...library, t]);
    savedSelect.value = String(library.length - 1);
    inform("模板已保存；账号 token 未写入模板库。");
  });
  actions.append(
    save,
    button("更新选中模板", () => {
      checkEditor();
      if (savedSelect.value === "") throw Error("请先选择要更新的模板");
      const i = Number(savedSelect.value);
      const t = S.serializeTemplate(
        templateName.value,
        profile(),
        withPassword.checked,
      );
      if (library.some((x, j) => j !== i && x.name === t.name))
        throw Error("模板名称已存在");
      const next = [...library];
      next[i] = t;
      saveLibrary(next);
      savedSelect.value = String(i);
      inform("模板已更新。");
    }),
    button("复制选中模板", () => {
      if (savedSelect.value === "") throw Error("请先选择模板");
      const t = library[Number(savedSelect.value)];
      setProfile(t.profile);
      templateName.value = `${t.name} 副本`;
      savedSelect.value = "";
      inform("已复制到编辑区，填写名称后保存。");
    }),
    button("删除选中模板", () => {
      if (savedSelect.value === "") throw Error("请先选择模板");
      const i = Number(savedSelect.value);
      if (!confirm(`删除本地模板“${library[i].name}”？`)) return;
      saveLibrary(library.filter((_, j) => i !== j));
      inform("模板已删除。");
    }),
    button("导出当前模板", () => {
      checkEditor();
      download(
        S.serializeTemplate(
          templateName.value,
          profile(),
          withPassword.checked,
        ),
        "sub2api-template.json",
      );
      inform("模板文件已生成。");
    }),
  );
  body.append(
    toolbar,
    actions,
    label("保存／导出时包含代理密码（明文，仅在明确勾选后包含）", withPassword),
    fileInput,
    templateFile,
  );
  const importArea = el("div", undefined, { class: "import-area" });
  body.append(importArea);
  const scope = select([["-1", "整批账号默认配置"]]);
  scope.addEventListener("change", () => {
    if (editorError) {
      scope.value = String(selectedAccount);
      inform("请先修正当前配置错误，或恢复继承。");
      return;
    }
    selectedAccount = Number(scope.value);
    renderEditor();
  });
  const reset = button("恢复继承 / 清空当前设置", () => {
    setProfile(S.emptyProfile());
    if (selectedAccount >= 0) delete overrides[selectedAccount].name;
    editorError = "";
    renderEditor();
    refresh();
    inform("已恢复基础配置或整批默认配置。");
  });
  const scopeRow = el("div", undefined, { class: "scope-row" });
  scopeRow.append(label("编辑范围", scope), reset);
  body.append(scopeRow);
  const editor = el("div");
  body.append(editor);
  const status = el(
    "p",
    persistedWarning || "模板只保存运行设置；原始账号数据不会写入本地存储。",
    { class: "status-line", role: "status", "aria-live": "polite" },
  );
  body.append(status);
  function renderLibrary() {
    const selected = savedSelect.value;
    savedSelect.replaceChildren(el("option", "选择已保存模板", { value: "" }));
    library.forEach((t, i) =>
      savedSelect.append(el("option", t.name, { value: i })),
    );
    savedSelect.value = selected;
  }
  savedSelect.addEventListener("change", () => {
    if (savedSelect.value !== "")
      templateName.value = library[Number(savedSelect.value)].name;
  });
  function setProfile(p) {
    if (selectedAccount < 0) batch = copy(p);
    else (overrides[selectedAccount] ||= {}).profile = copy(p);
    editorError = "";
    renderEditor();
    refresh();
  }
  function checkEditor() {
    if (editorError) throw Error(editorError);
    S.validateProfile(profile());
  }
  function download(data, name) {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    );
    const a = el("a", undefined, { href: url, download: name });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function renderEditor() {
    const p = profile();
    editor.replaceChildren();
    if (selectedAccount >= 0) {
      const n = input(
        "text",
        overrides[selectedAccount]?.name ??
          converted[selectedAccount]?.name ??
          "",
      );
      n.addEventListener("input", () => {
        overrides[selectedAccount].name = n.value;
        refresh();
      });
      editor.append(label("当前账号名称（不会保存到模板）", n));
    }
    const common = el("div", undefined, { class: "config-grid" });
    const advanced = el("details");
    advanced.append(el("summary", "高级配置 · 模型 / 指纹 / 通信 / 额度"));
    const advancedGrid = el("div", undefined, { class: "config-grid" });
    advanced.append(advancedGrid);
    const readers = [];
    function changed() {
      try {
        readers.forEach((fn) => fn());
        S.validateProfile(p);
        editorError = "";
        inform("配置已更新，输出已重新生成。");
      } catch (e) {
        editorError = e.message;
        status.textContent = editorError;
        status.className = "status-line is-error";
      }
      refresh();
    }
    for (const [path, text, type, defaultValue, section] of S.FIELDS) {
      const wrap = el("div", undefined, { class: "config-field" });
      const enabled = input("checkbox");
      enabled.checked = Object.hasOwn(p.settings, path);
      const id = `setting-${path.replaceAll(".", "-")}`;
      enabled.id = `${id}-apply`;
      let control;
      if (Array.isArray(type)) control = select(type.map((v) => [v, v]));
      else if (type === "boolean")
        control = select([
          ["true", "开启"],
          ["false", "关闭"],
        ]);
      else if (type === "mapping") {
        control = el("textarea");
        control.rows = 3;
      } else {
        control = input("number");
        control.min = "0";
        control.step = type === "integer" ? "1" : "any";
        if (type === "percent") control.max = "100";
      }
      control.id = id;
      const value = enabled.checked ? p.settings[path] : defaultValue;
      control.value =
        type === "mapping"
          ? JSON.stringify(value, null, 2)
          : String(type === "percent" && enabled.checked ? value * 100 : value);
      control.disabled = !enabled.checked;
      const applyLabel = label(`应用：${text}`, enabled);
      wrap.append(applyLabel, label(text, control));
      const error = el("span", "", { class: "field-error", id: `${id}-error` });
      control.setAttribute("aria-describedby", error.id);
      wrap.append(error);
      if (path === "extra.codex_fingerprint_mode")
        wrap.append(
          el(
            "small",
            "off 关闭；device 单设备；session 单设备与会话、独立线程；full 全收敛。每个新账号由服务端生成独立种子。",
          ),
        );
      if (path === "extra.auto_reset_credit_enabled")
        wrap.append(
          el(
            "small",
            "启用后 Sub2API 可自动消耗账号的重置信用；不会复制旧账号信用余额或执行状态。",
          ),
        );
      readers.push(() => {
        error.textContent = "";
        control.removeAttribute("aria-invalid");
        if (!enabled.checked) {
          delete p.settings[path];
          return;
        }
        try {
          let v = control.value;
          if (type === "mapping") v = JSON.parse(v);
          else if (type === "boolean") v = v === "true";
          else if (!Array.isArray(type)) {
            if (v.trim() === "") throw Error("不能为空");
            v = Number(v);
            if (type === "percent") v /= 100;
          }
          S.validateSettings({ [path]: v });
          p.settings[path] = v;
        } catch (e) {
          error.textContent = e.message;
          control.setAttribute("aria-invalid", "true");
          throw e;
        }
      });
      enabled.addEventListener("change", () => {
        control.disabled = !enabled.checked;
        changed();
      });
      control.addEventListener("input", changed);
      (section === "common" ? common : advancedGrid).append(wrap);
    }
    const groupApply = input("checkbox");
    groupApply.checked = Object.hasOwn(p, "group_ids");
    groupApply.id = "setting-group-ids-apply";
    const groupInput = input("text");
    groupInput.id = "setting-group-ids";
    groupInput.placeholder = "例如：1, 2, 5";
    groupInput.value = groupApply.checked ? p.group_ids.join(", ") : "";
    groupInput.disabled = !groupApply.checked;
    const groupWrap = el("div", undefined, { class: "config-field" });
    const groupError = el("span", "", {
      class: "field-error",
      id: "setting-group-ids-error",
    });
    groupInput.setAttribute("aria-describedby", groupError.id);
    groupWrap.append(
      label("应用：参与分组 ID", groupApply),
      label("参与分组 ID（逗号分隔）", groupInput),
      el(
        "small",
        "填写目标 Sub2API 实例中的分组 ID；勾选后留空表示明确不加入任何分组。",
      ),
      groupError,
    );
    common.append(groupWrap);
    readers.push(() => {
      groupError.textContent = "";
      groupInput.removeAttribute("aria-invalid");
      if (!groupApply.checked) {
        delete p.group_ids;
        return;
      }
      try {
        const raw = groupInput.value.trim();
        const ids = raw
          ? raw.split(",").map((part) => {
              const value = part.trim();
              if (!/^\d+$/.test(value))
                throw Error("参与分组只能填写正整数 ID");
              const id = Number(value);
              if (!Number.isSafeInteger(id) || id <= 0)
                throw Error("参与分组只能填写正整数 ID");
              return id;
            })
          : [];
        S.validateProfile({ settings: {}, proxies: [], group_ids: ids });
        p.group_ids = ids;
      } catch (e) {
        groupError.textContent = e.message;
        groupInput.setAttribute("aria-invalid", "true");
        throw e;
      }
    });
    groupApply.addEventListener("change", () => {
      groupInput.disabled = !groupApply.checked;
      changed();
    });
    groupInput.addEventListener("input", changed);
    const expiry = select([
      ["inherit", "沿用新账号 / 继承整批"],
      ["none", "无限期"],
      ["date", "指定到期时间"],
    ]);
    expiry.value = !Object.hasOwn(p, "expiry")
      ? "inherit"
      : p.expiry === null
        ? "none"
        : "date";
    const date = input("datetime-local");
    if (p.expiry) {
      const d = new Date(p.expiry * 1000);
      date.value = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
    }
    date.disabled = expiry.value !== "date";
    const expiryWrap = el("div", undefined, { class: "config-field" });
    expiryWrap.append(
      label("账号到期策略", expiry),
      label("到期时间（本地时区）", date),
      el("small", "账号调度有效期，不修改 token 自身的有效期。"),
    );
    common.append(expiryWrap);
    readers.push(() => {
      if (expiry.value === "inherit") delete p.expiry;
      else if (expiry.value === "none") p.expiry = null;
      else {
        const v = Date.parse(date.value);
        if (!Number.isFinite(v)) throw Error("请选择有效的账号到期时间");
        p.expiry = Math.floor(v / 1000);
      }
    });
    expiry.addEventListener("change", () => {
      date.disabled = expiry.value !== "date";
      changed();
    });
    date.addEventListener("input", changed);
    editor.append(common);
    renderProxies(p, editor, changed, readers);
    editor.append(advanced);
    editor.append(
      el(
        "p",
        selectedAccount < 0
          ? "未勾选的设置沿用新账号基础值；单账号可覆盖整批设置。"
          : "未勾选的设置继承整批配置；应用模板只覆盖模板中已设置的项目。",
        { class: "config-hint" },
      ),
    );
  }
  function renderProxies(p, parent, changed, readers) {
    const box = el("details");
    box.open = !!p.proxies.length;
    box.append(el("summary", "代理配置"));
    const binding = select([
      ["__inherit", "继承 / 不添加代理"],
      ["__none", "直连（明确不使用代理）"],
      ...p.proxies.map((x) => [x.name, x.name]),
    ]);
    binding.value = !Object.hasOwn(p, "proxy")
      ? "__inherit"
      : p.proxy === null
        ? "__none"
        : p.proxy;
    box.append(label("当前使用的代理", binding));
    readers.push(() => {
      if (binding.value === "__inherit") delete p.proxy;
      else p.proxy = binding.value === "__none" ? null : binding.value;
    });
    binding.addEventListener("change", changed);
    p.proxies.forEach((proxy, index) => {
      const card = el("fieldset", undefined, { class: "proxy-card" });
      card.append(el("legend", `代理 ${index + 1}`));
      const grid = el("div", undefined, { class: "config-grid" });
      card.append(grid);
      const definitions = [
        ["name", "名称", "text"],
        [
          "protocol",
          "协议",
          ["http", "https", "socks5", "socks5h", "hysteria2"],
        ],
        ["host", "主机（不含协议）", "text"],
        ["port", "端口", "number"],
        ["username", "用户名", "text"],
        [
          "password",
          proxy.password_required ? "密码（需要补填）" : "密码",
          "password",
        ],
        ["status", "状态", ["active", "inactive"]],
        ["fallback_mode", "失效备用策略", ["none", "direct", "proxy"]],
        ["backup_proxy_name", "备用代理名称", "text"],
        ["expiry_warn_days", "到期提醒天数", "number"],
        ["expires_at", "代理到期（本地时区，可留空）", "datetime-local"],
      ];
      for (const [key, title, type] of definitions) {
        const c = Array.isArray(type)
          ? select(type.map((v) => [v, v]))
          : input(type);
        c.value =
          proxy[key] ??
          (key === "status" ? "active" : key === "fallback_mode" ? "none" : "");
        if (key === "expires_at" && proxy[key]) {
          const d = new Date(proxy[key] * 1000);
          c.value = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 16);
        }
        if (key === "port") {
          c.min = "1";
          c.max = "65535";
        }
        if (key === "expiry_warn_days") c.min = "0";
        grid.append(label(title, c));
        c.addEventListener("input", () => {
          const oldName = proxy.name;
          let v = c.value;
          if (type === "number" && v !== "") v = Number(v);
          if (key === "expires_at" && v !== "")
            v = Math.floor(Date.parse(v) / 1000);
          if (
            v === "" &&
            ["expires_at", "expiry_warn_days", "backup_proxy_name"].includes(
              key,
            )
          )
            delete proxy[key];
          else proxy[key] = v;
          if (key === "name") {
            p.proxies.forEach((x) => {
              if (x.backup_proxy_name === oldName) x.backup_proxy_name = v;
            });
            if (p.proxy === oldName) p.proxy = v;
            const selected = binding.value === oldName ? v : binding.value;
            binding.replaceChildren(
              ...[
                ["__inherit", "继承 / 不添加代理"],
                ["__none", "直连（明确不使用代理）"],
                ...p.proxies.map((x) => [x.name, x.name]),
              ].map(([v, t]) => el("option", t, { value: v })),
            );
            binding.value = selected;
          }
          if (key === "password" && v) delete proxy.password_required;
          changed();
        });
      }
      card.append(
        button("删除此代理", () => {
          if (p.proxy === proxy.name) delete p.proxy;
          p.proxies.splice(index, 1);
          editorError = "";
          renderEditor();
          try {
            S.validateProfile(p);
          } catch (e) {
            editorError = e.message;
          }
          refresh();
        }),
      );
      box.append(card);
    });
    box.append(
      button("添加代理", () => {
        let n = p.proxies.length + 1;
        while (p.proxies.some((x) => x.name === `代理 ${n}`)) n++;
        const proxy = {
          name: `代理 ${n}`,
          protocol: "socks5",
          host: "",
          port: 1080,
          status: "active",
          fallback_mode: "none",
        };
        p.proxies.push(proxy);
        if (!Object.hasOwn(p, "proxy")) p.proxy = proxy.name;
        editorError = "请填写新代理主机";
        renderEditor();
        refresh();
      }),
    );
    parent.append(box);
  }
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    fileInput.value = "";
    if (!file) return;
    const request = ++revision;
    try {
      const data = JSON.parse(await file.text());
      if (request !== revision) return;
      if (!Array.isArray(data.accounts) || !Array.isArray(data.proxies))
        throw Error("请选择 Sub2API 导出文件");
      importDocument = data;
      importArea.replaceChildren();
      const choose = select(
        data.accounts.map((a, i) => [
          String(i),
          `${a.name || "未命名"} · ${a.platform}/${a.type}`,
        ]),
      );
      const report = el("p");
      let extracted;
      function preview() {
        try {
          extracted = S.extractTemplate(importDocument, Number(choose.value));
          report.textContent = `已提取：${extracted.included.join("、") || "无"}。已排除：${extracted.excluded.join("、")}。`;
        } catch (e) {
          extracted = null;
          report.textContent = e.message;
        }
      }
      choose.addEventListener("change", preview);
      importArea.append(
        label("选择参考账号", choose),
        report,
        button("应用提取的设置", () => {
          if (!extracted) throw Error("当前账号不能作为模板");
          setProfile(extracted.profile);
          inform("运行设置已提取；可编辑后保存模板。");
          importDocument = null;
          importArea.replaceChildren();
        }),
        button("取消提取", () => {
          importDocument = null;
          importArea.replaceChildren();
        }),
      );
      preview();
    } catch (e) {
      inform(`导入失败：${e.message}`);
    }
  });
  templateFile.addEventListener("change", async () => {
    const file = templateFile.files[0];
    templateFile.value = "";
    if (!file) return;
    try {
      const t = S.parseTemplate(JSON.parse(await file.text()));
      setProfile(t.profile);
      templateName.value = t.name;
      inform("模板文件已载入，点击保存可加入本地模板库。");
    } catch (e) {
      inform(`导入失败：${e.message}`);
    }
  });
  globalThis.Sub2apiUI = {
    build(items, now) {
      if (editorError) throw Error(editorError);
      return S.buildDocument(items, batch, overrides, now);
    },
    sync(format, items) {
      root.hidden = format !== "sub2api";
      if (converted !== items) {
        converted = items;
        overrides = [];
        selectedAccount = -1;
        scope.replaceChildren(
          el("option", "整批账号默认配置", { value: "-1" }),
        );
        items.forEach((x, i) =>
          scope.append(
            el("option", `${i + 1}. ${x.name || "未命名"}`, { value: i }),
          ),
        );
        scope.value = "-1";
        renderEditor();
      }
    },
  };
  renderLibrary();
  renderEditor();
  refresh();
})();
