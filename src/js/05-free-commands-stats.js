document.getElementById("toggleLabelTools").onclick = (e) => {
  const box = document.getElementById("labelTools"),
    on = box.classList.contains("hidden");
  box.classList.toggle("hidden", !on);
  e.currentTarget.setAttribute("aria-expanded", String(on));
  if (on) renderLabelTools();
};
document.getElementById("openLabelOrganize").onclick = () => {
  if (!prioritySwitch.checked) {
    prioritySwitch.checked = true;
    prioritySwitch.dispatchEvent(new Event("change"));
  }
  document.getElementById("paletteOrderBody").open = true;
  setPaletteView("cats");
  document.querySelector(".label-bar").scrollIntoView({ block: "start", behavior: "smooth" });
};
document.getElementById("applyLabelTools").onclick = () => {
  const map = {};
  document.querySelectorAll("#labelToolsList .lt-new").forEach((inp) => {
    const o = inp.dataset.orig,
      cb = document.querySelector('#labelToolsList input[type="checkbox"][data-orig="' + CSS.escape(o) + '"]');
    const v = inp.value.replace(/[【】]/g, "").trim();
    if (cb && cb.checked) map[o] = "";
    else if (v && v !== o) map[o] = v;
  });
  setLabelMap(map);
  renderLabelTools();
  message.textContent = Object.keys(map).length ? "ラベルの変更を反映しました。" : "ラベルの変更はありません（元の名前に戻しました）。";
};
document.getElementById("resetLabelTools").onclick = () => {
  setLabelMap({});
  renderLabelTools();
  message.textContent = "ラベルを元に戻しました。";
};
document.getElementById("clearPaletteSelection").onclick = () => {
  selectedPaletteIndices.clear();
  renderPaletteOrderList();
};
prioritySwitch.addEventListener("change", () => {
  const on = prioritySwitch.checked;
  paletteOrderPanel.classList.toggle("hidden", !on);
  if (on) {
    // 手で直していない生成結果なら、最新のフォームの内容から作り直してから並べ替えを始める
    if (paletteMode === "generated" && !paletteOrderOverride) {
      try {
        regeneratePaletteOutput();
      } catch (e) {}
    }
    paletteOrderBeforeEdit = currentPaletteLines();
    paletteOrderDraft = paletteOrderBeforeEdit.slice();
    selectedPaletteIndices.clear();
    renderPaletteOrderList();
  } else {
    syncPaletteDraft();
  }
});
document.getElementById("cancelPaletteOrder").onclick = () => {
  paletteOrderDraft = paletteOrderBeforeEdit.slice();
  paletteOutput.value = paletteOrderBeforeEdit.join("\n");
  paletteOrderOverride = null;
  paletteOrderApplied = false;
  prioritySwitch.checked = false;
  paletteOrderPanel.classList.add("hidden");
};
// 上部の反映ボタンから呼び出された場合、編集中の順番も確定する。
function commitPaletteOrder() {
  if (!prioritySwitch.checked) return false;
  if (!paletteOrderDraft.length) {
    message.textContent = "並べ替えるコマンドがありません。";
    return false;
  }
  syncPaletteDraft();
  try {
    if (output.value.trim()) {
      const obj = JSON.parse(output.value);
      const d = obj.data || obj.character || obj;
      if (d && typeof d === "object") {
        d.commands = paletteOutput.value;
        output.value = JSON.stringify(obj, null, 2);
      }
    }
  } catch (e) {
    message.textContent = "チャパレ順は反映しました。JSON欄はJSON形式ではないため更新していません。";
  }
  paletteOutput.dispatchEvent(new Event("change", { bubbles: true }));
  prioritySwitch.checked = false;
  paletteOrderPanel.classList.add("hidden");
  return true;
}

document.getElementById("addPaletteCommand").addEventListener("click", () => {
  const status = paletteStatusSelect.value;
  const op = document.getElementById("paletteOperator").value;
  const amount = Number(document.getElementById("paletteAmount").value);
  if (!status) {
    message.textContent = "対象ステータスを選択してください。";
    return;
  }
  if (!Number.isSafeInteger(amount) || amount < 0) {
    message.textContent = "数字は0以上の整数で入力してください。";
    return;
  }
  const line = ":" + status + document.getElementById("paletteTarget").value + op + amount;
  const lines = getPaletteCommandLines();
  lines.push(line);
  commitExtraCommands(lines);
});
// ----- 自由入力のコマンド -----
const FREE_CMD_TEMPLATES = [
  ["", "テンプレを選ぶ…", "", ""],
  ["hpdown", "HPを減らす（ダメージを受ける）", ":HP-1", "ダメージを受ける"],
  ["hpup", "HPを回復する", ":HP+1", "回復"],
  ["mpdown", "MPを消費する", ":MP-1", "MP消費"],
  ["sandown", "SANを減らす", ":SAN-1", "SAN減少"],
  ["sancheck", "SANチェック（正気度ロール）", "1d100<={SAN}", "SANチェック"],
  ["res", "対抗ロール（能力値どうし）", "RESB({STR}-{POW})", "対抗ロール"],
  ["dice", "ダイスを振る", "1d100", "ダイス"],
];
// {名前} や :名前+1 に出てくる名前が、ステータス・能力値・技能にあるか確かめる
function knownRefNames() {
  const set = new Set(["HP", "MP", "SAN", "アイデア", "幸運", "知識", "回避", "DB", "DB個数", "DB面", "DB符号"]);
  names.forEach((n) => set.add(n));
  derivedStatuses.querySelectorAll(".derived-row").forEach((r) => set.add((r.dataset.derivedName || "").trim()));
  extras.querySelectorAll(".row .extra-name").forEach((i) => set.add(i.value.trim()));
  skills.querySelectorAll(".row").forEach((r) => {
    if (!skillStatusExcluded(r)) set.add(r.querySelector(".skill-name").value.trim());
  });
  return new Set([...set].filter(Boolean).map(nameKey));
}
function freeCommandLine() {
  const text = document
      .getElementById("freeCmdText")
      .value.replace(/\s*\n\s*/g, " ")
      .trim(),
    label = document
      .getElementById("freeCmdLabel")
      .value.replace(/[【】]/g, "")
      .trim();
  if (!text) return "";
  return label && !/【[^【】]*】\s*$/.test(text) ? text + " 【" + label + "】" : text;
}
function freeCommandWarnings(line) {
  const known = knownRefNames(),
    bad = new Set();
  [...line.matchAll(/\{([^{}]+)\}/g)].forEach((m) => {
    if (!known.has(nameKey(m[1].trim()))) bad.add(m[1].trim());
  });
  const st = /^:([^+\-=]+?)(?:\.max)?[+\-=]/.exec(line);
  if (st && !known.has(nameKey(st[1].trim()))) bad.add(st[1].trim());
  return [...bad];
}
function updateFreeCommandPreview() {
  const line = freeCommandLine(),
    prev = document.getElementById("freeCmdPreview"),
    warn = document.getElementById("freeCmdWarn");
  prev.textContent = line || "—";
  const bad = line ? freeCommandWarnings(line) : [];
  warn.textContent = bad.length
    ? "「" + bad.join("」「") + "」という名前のステータス・能力値・技能が見つかりません。綴りを確認してください。"
    : "";
}
(function () {
  const sel = document.getElementById("freeCmdTemplate");
  FREE_CMD_TEMPLATES.forEach(([v, label]) => {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = label;
    sel.append(o);
  });
  sel.addEventListener("change", () => {
    const t = FREE_CMD_TEMPLATES.find((x) => x[0] === sel.value);
    if (!t || !t[0]) return;
    document.getElementById("freeCmdText").value = t[2];
    document.getElementById("freeCmdLabel").value = t[3];
    sel.value = "";
    updateFreeCommandPreview();
  });
  ["freeCmdText", "freeCmdLabel"].forEach((id) => document.getElementById(id).addEventListener("input", updateFreeCommandPreview));
  document.getElementById("addFreeCommand").addEventListener("click", () => {
    const line = freeCommandLine();
    if (!line) {
      message.textContent = "コマンドを入力してください。";
      return;
    }
    const lines = getPaletteCommandLines();
    lines.push(line);
    commitExtraCommands(lines);
    document.getElementById("freeCmdText").value = "";
    document.getElementById("freeCmdLabel").value = "";
    updateFreeCommandPreview();
    const bad = freeCommandWarnings(line);
    message.textContent = bad.length ? "追加しました。ただし「" + bad.join("」「") + "」は見つかりません。" : "コマンドを追加しました。";
  });
})();

const base = document.getElementById("base"),
  extras = document.getElementById("extras"),
  derivedStatuses = document.getElementById("derivedStatuses"),
  skills = document.getElementById("skills"),
  message = document.getElementById("message"),
  output = document.getElementById("output");
document.getElementById("editorView").addEventListener("input", (e) => {
  if (e.target.matches(".derived-name,.extra-name")) refreshPaletteStatusOptions();
});
const statFormulas = { STR: "3d6", CON: "3d6", POW: "3d6", DEX: "3d6", APP: "3d6", SIZ: "2d6+6", INT: "2d6+6", EDU: "3d6+3" };
// 増加分・その他は整数（+3、-2）。合計＝初期値＋増加分＋その他（初期値がダイス式のときは「3d6+2」の形）
function statDelta(v) {
  const t = String(v == null ? "" : v)
    .normalize("NFKC")
    .replace(/[\u2212\u2010-\u2015\u30fc]/g, "-")
    .replace(/\s+/g, "");
  if (t === "") return 0;
  return /^[+-]?\d+$/.test(t) ? Number(t) : NaN;
}
function statTotal(b, a, o) {
  const bs = String(b == null ? "" : b).trim(),
    d = (statDelta(a) || 0) + (statDelta(o) || 0);
  if (!d || bs === "") return bs;
  if (/^\d+$/.test(bs)) return String(Math.max(0, Number(bs) + d));
  return bs + (d > 0 ? "+" : "-") + Math.abs(d);
}
// 能力値の表：能力値 / 初期値 / 増加分 / その他 / 合計
["能力値", "初期値", "増加分", "その他", "合計"].forEach((t, k) => {
  const h = document.createElement("div");
  h.className = "st-h" + (k === 0 ? " st-first" : "");
  h.textContent = t;
  base.append(h);
});
names.forEach((n) => {
  const l = document.createElement("label"),
    i = document.createElement("input"),
    out = document.createElement("output");
  l.htmlFor = "base-" + n;
  l.textContent = n;
  l.className = "st-n";
  i.setAttribute("aria-label", n + "の初期値（値または式）");
  i.id = "base-" + n;
  i.dataset.stat = n;
  i.value = statFormulas[n];
  i.placeholder = "例：2d6+5";
  i.addEventListener("input", refreshDBDisplay);
  base.append(l, i);
  [
    ["add", "増加分"],
    ["other", "その他"],
  ].forEach(([key, label]) => {
    const x = document.createElement("input");
    x.type = "text";
    x.inputMode = "text";
    x.autocomplete = "off";
    x.className = "st-d";
    x.id = "base-" + key + "-" + n;
    x.dataset.statKey = key;
    x.dataset.statOf = n;
    x.placeholder = "±0";
    x.setAttribute("aria-label", n + "の" + label + "（整数。例：+2、-1）");
    x.addEventListener("input", refreshDBDisplay);
    base.append(x);
  });
  out.className = "st-total";
  out.dataset.statTotal = n;
  out.setAttribute("aria-label", n + "の合計");
  base.append(out);
});
function statDeltaInput(n, key) {
  return document.getElementById("base-" + key + "-" + n);
}
function clearStatDeltas() {
  base.querySelectorAll("input[data-stat-key]").forEach((i) => (i.value = ""));
}
function updateStatTotals() {
  names.forEach((n) => {
    const b = document.getElementById("base-" + n),
      a = statDeltaInput(n, "add"),
      o = statDeltaInput(n, "other"),
      out = base.querySelector('[data-stat-total="' + n + '"]');
    if (!b || !out) return;
    [a, o].forEach((x) => {
      const bad = Number.isNaN(statDelta(x.value));
      x.classList.toggle("inv", bad);
      x.title = bad ? "整数で入力してください（例：+2、-1）" : "";
    });
    const t = statTotal(b.value, a.value, o.value);
    out.textContent = t === "" ? "—" : t;
    out.classList.toggle("changed", t !== b.value.trim());
  });
}
base.addEventListener("input", updateStatTotals);
function row(parent, cls, fields) {
  let r = document.createElement("div");
  r.className = cls;
  const ins = [];
  fields.forEach((f) => {
    let w = document.createElement("div"),
      l = document.createElement("label"),
      i = document.createElement("input");
    l.textContent = f.label;
    i.value = f.value;
    i.className = f.className || "";
    i.placeholder = f.placeholder || "";
    i.setAttribute("aria-label", f.label);
    w.append(l, i);
    r.append(w);
    ins.push(i);
  });
  if (parent === skills) {
    const bx = document.createElement("span");
    bx.className = "secret-box";
    [
      ["secret-flag", "技能判定をS", "技能判定をシークレットダイス（先頭にS）にします"],
      ["secret-flag-dmg", "ダメージをS", "ダメージ式をシークレットダイス（先頭にS）にします"],
    ].forEach((d) => {
      const sw = document.createElement("label");
      sw.className = "secret-chk";
      sw.title = d[2];
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.className = d[0];
      cb.setAttribute("aria-label", d[1]);
      sw.append(cb, document.createTextNode(d[1]));
      bx.append(sw);
    });
    r.append(bx);
  }
  let del = document.createElement("button");
  del.type = "button";
  del.textContent = "削除";
  del.className = "danger";
  del.onclick = () => {
    r.remove();
    if (parent === skills) {
      refreshPaletteStatusOptions();
      filterSkillRows();
    }
  };
  r.append(del);
  if (parent === skills) {
    ins[0].setAttribute("list", "nameSuggestList");
    ins[0].setAttribute("autocomplete", "off");
  }
  parent.append(r);
  return { row: r, inputs: ins };
}
const derivedDefinitions = [
  { name: "HP", formula: "(CON+SIZ+1)/2" },
  { name: "MP", formula: "POW" },
  { name: "SAN", formula: "POW*5" },
  { name: "アイデア", formula: "INT*5" },
  { name: "幸運", formula: "POW*5" },
  { name: "知識", formula: "EDU*5" },
  { name: "回避", formula: "DEX*2" },
];
function addDerivedStatus(def) {
  const r = document.createElement("div");
  r.className = "derived-row";
  r.dataset.derivedName = def.name;
  r.dataset.custom = def.custom ? "1" : "0";
  const nameWrap = document.createElement("div"),
    nameLabel = document.createElement("label");
  nameLabel.textContent = "ステータス名";
  nameWrap.append(nameLabel);
  if (def.custom) {
    const nameInput = document.createElement("input");
    nameInput.className = "derived-name";
    nameInput.value = def.name || "";
    nameInput.placeholder = "例：装甲";
    nameInput.addEventListener("input", () => {
      r.dataset.derivedName = nameInput.value.trim();
      updateDerivedPreviews();
    });
    nameWrap.append(nameInput);
  } else {
    const nameText = document.createElement("div");
    nameText.textContent = def.name;
    nameText.style.padding = "9px 0";
    nameWrap.append(nameText);
  }
  const formulaWrap = document.createElement("div"),
    formulaLabel = document.createElement("label"),
    formulaInput = document.createElement("input");
  formulaLabel.textContent = "計算式";
  formulaInput.className = "derived-formula";
  formulaInput.value = def.formula;
  formulaInput.placeholder = "例：INT*5";
  formulaInput.setAttribute("aria-label", def.name + "の計算式");
  formulaWrap.append(formulaLabel, formulaInput);
  const valueWrap = document.createElement("div"),
    valueLabel = document.createElement("label"),
    valueOutput = document.createElement("output");
  valueLabel.textContent = "計算値";
  valueOutput.className = "derived-preview pending";
  valueOutput.textContent = "未計算";
  valueWrap.append(valueLabel, valueOutput);
  r.append(nameWrap, formulaWrap, valueWrap);
  if (!def.custom) {
    const sp = document.createElement("span");
    sp.className = "derived-spacer";
    r.append(sp);
  }
  if (def.custom) {
    const del = document.createElement("button");
    del.type = "button";
    del.className = "danger";
    del.textContent = "削除";
    del.onclick = () => r.remove();
    r.append(del);
  }
  derivedStatuses.append(r);
  return r;
}
derivedDefinitions.forEach(addDerivedStatus);
refreshPaletteStatusOptions();
renderPaletteCommandList();
function addExtra(n = "", v = "") {
  return row(extras, "row", [
    { label: "ステータス名", value: n, className: "extra-name", placeholder: "例：装甲" },
    { label: "値・計算式", value: v, className: "extra-value", placeholder: "例：4、CON+SIZ" },
  ]);
}
// ===== 技能の分類・成功時の処理 =====
// 分類は複数付けられる。基本技能は名前から自動で分類され、ユーザーが変えたときだけ技能ごとに保存する（cats）。
