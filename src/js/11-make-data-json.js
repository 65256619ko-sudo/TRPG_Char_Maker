function makeData(options = {}) {
  if (options.preserveFormulas) return makeRawData();
  const rawBase = readBase();
  const rolled = {};
  for (const n of names) rolled[n] = rollFormula(rawBase[n]);
  const extrasResolved = [];
  const derived = {};
  for (const r of derivedStatuses.querySelectorAll(".derived-row")) {
    const n = r.dataset.derivedName;
    const raw = r.querySelector(".derived-formula").value.trim();
    if (!raw) throw Error("基本ステータス「" + n + "」の計算式を入力してください");
    let value;
    try {
      value = resolveExpr(raw, { ...rolled, ...derived });
    } catch (e) {
      throw Error("基本ステータス「" + n + "」を計算できません：" + e.message);
    }
    extrasResolved.push({ label: n, value: value, max: value });
    derived[n.toUpperCase()] = value;
  }
  const extraRows = [...extras.querySelectorAll(".row")]
    .map((r) => ({
      row: r,
      name: r.querySelector(".extra-name").value.trim(),
      raw: r.querySelector(".extra-value").value.trim(),
      done: false,
    }))
    .filter((x) => x.name && x.name.toUpperCase() !== "DB");
  // 追加ステータスは登録順に依存させず、参照先が解決できたものから計算する。
  const knownValues = { ...rolled, ...derived };
  let pending = extraRows.slice(),
    lastErrors = new Map();
  while (pending.length) {
    let progress = false;
    const next = [];
    for (const item of pending) {
      try {
        if (!item.raw) throw Error("値・計算式を入力してください");
        const value = resolveExpr(item.raw, knownValues);
        item.value = value;
        item.done = true;
        progress = true;
        knownValues[item.name] = value;
        knownValues[item.name.toUpperCase()] = value;
        derived[item.name.toUpperCase()] = value;
      } catch (e) {
        lastErrors.set(item.name, e);
        next.push(item);
      }
    }
    if (!progress) {
      const item = next[0];
      throw Error("ステータス「" + item.name + "」を計算できません：" + (lastErrors.get(item.name)?.message || "参照先を解決できません"));
    }
    pending = next;
  }
  for (const item of extraRows) {
    extrasResolved.push({ label: item.name, value: item.value, max: item.value });
  }
  const dbInput = document.getElementById("dbOverride").value.trim();
  const db = dbInput ? normalizeFormula(dbInput).replace(/\s+/g, "") : calculateDB(rolled.STR, rolled.SIZ);
  if (!db || !/^[+\-]?(?:\d*D\d+|\d+)(?:[+\-](?:\d*D\d+|\d+))*$/i.test(db))
    throw Error("DBは「+1D4」「-1D6」「0」などの形式で入力してください");
  // Basic derived statuses are kept in their dedicated section and emitted as status values.
  const params = names.map((n) => ({ label: n, value: String(rolled[n]) }));
  const commands = [];
  if (document.getElementById("includeIndefinite")?.checked) commands.push("C({SAN}*0.8) 【一日の終わり】");
  // standalonePalette：チャパレ単体用。入力したステータス（SANなど）は参照のまま、技能とDBはラベルを作らず数値の式で出力する。
  const ref = (name) => "{" + name + "}";
  commands.push("1d100<=" + ref("SAN") + " 【正気度ロール】");
  commands.push(rollCommandPrefix() + "<=" + ref("アイデア") + " 【アイデア】");
  commands.push(rollCommandPrefix() + "<=" + ref("幸運") + " 【幸運】");
  commands.push(rollCommandPrefix() + "<=" + ref("知識") + " 【知識】");
  commands.push(rollCommandPrefix() + "<=" + ref("回避") + " 【回避】");
  const skillRows = [...skills.querySelectorAll(".row")]
    .map((r) => ({
      row: r,
      name: r.querySelector(".skill-name").value.trim(),
      raw: r.querySelector(".skill-value").value.trim(),
      value: null,
    }))
    .filter((x) => x.name && (x.raw || !x.row.querySelector(".damage-value").value.trim()));
  // 技能同士の参照を許可する（例：モーニングスター = 拳-20）。
  // 参照先が後ろの行にあっても解決できるよう、依存先が確定するまで繰り返す。
  const skillValues = { ...rolled, ...derived };
  let pendingSkills = skillRows.slice(),
    skillErrors = new Map();
  while (pendingSkills.length) {
    let progress = false;
    const next = [];
    for (const item of pendingSkills) {
      try {
        if (!item.raw) throw Error("成功値を入力してください");
        let value;
        if (/^\d+$/.test(item.raw)) value = Number(item.raw);
        else value = resolveExpr(item.raw, skillValues);
        if (!Number.isFinite(Number(value)) || Number(value) < 0) throw Error("成功値は0以上の数値にしてください");
        item.value = Math.trunc(Number(value));
        skillValues[item.name] = item.value;
        skillValues[item.name.toUpperCase()] = item.value;
        progress = true;
      } catch (e) {
        skillErrors.set(item.name, e);
        next.push(item);
      }
    }
    if (!progress) {
      const item = next[0];
      throw Error(
        "技能「" +
          item.name +
          "」の成功値を計算できません：" +
          (skillErrors.get(item.name)?.message || "参照先を解決できません。参照先の技能名や循環参照を確認してください"),
      );
    }
    pendingSkills = next;
  }
  // 技能成功値に他の技能・ステータスを参照する式がある場合、
  // チャットパレットにも参照元の変数と演算子を残す。
  const paletteFormulaNames = [
    ...new Set([...Object.keys(rolled), ...Object.keys(derived), ...skillRows.map((x) => x.name)].filter(Boolean)),
  ].sort((a, b) => b.length - a.length);
  function formulaForPalette(raw, skillName) {
    let text = String(raw || "").trim();
    if (hasEx) text = literalizeNames(text, exVals).trim();
    if (/^\d+$/.test(text)) return "{" + skillName + "}";
    // 他の技能名を参照している場合、その技能の「式」を括弧付きで展開する。
    // 数値だけの技能は展開せず、ココフォリア変数 {技能名} として残す。
    const byName = new Map(skillRows.map((x) => [x.name, x]));
    const saved = [];
    let expanded = text;
    // ダイスを含む技能は式を展開せず、確定した値を持つ {技能名} のまま参照する（パレット側で振り直さない）。
    const targets = [...skillRows]
      .filter((x) => x.name && x.name !== skillName && x.raw && !/^\d+$/.test(x.raw) && !DICE_ANY_RE.test(x.raw) && !(x.name in exVals))
      .sort((a, b) => b.name.length - a.name.length);
    for (const target of targets) {
      const escaped = target.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const ascii = /^[A-Za-z_][A-Za-z0-9_]*$/.test(target.name);
      const re = ascii ? new RegExp("(^|[^A-Za-z0-9_{}])" + escaped + "(?=$|[^A-Za-z0-9_{}])", "gi") : new RegExp(escaped, "g");
      expanded = expanded.replace(re, (...args) => {
        const prefix = ascii ? args[1] || "" : "";
        const token = "\uE120" + saved.length + "\uE121";
        saved.push(prefix + "(" + target.raw + ")");
        return token;
      });
    }
    expanded = expanded.replace(/\uE120(\d+)\uE121/g, (_, i) => saved[Number(i)]);
    // 展開後の技能名（例：こぶし）は変数として残し、基本ステータスだけ既存変換する。
    return transformSuccessValue(expanded, { ...rolled, ...derived }, {});
  }

  // ステータスにしない技能（出力の設定）：成功値の数字をそのままチャパレに入れ、他の式からの参照も数字にする
  const exVals = {};
  skillRows.forEach((x) => {
    if (skillStatusExcluded(x.row)) exVals[x.name] = x.value;
  });
  const hasEx = Object.keys(exVals).length > 0;
  const dmgDone = new Set();
  const followIdx = new Set();
  const pushDmg = (r) => {
    if (dmgDone.has(r)) return;
    dmgDone.add(r);
    const label = r.querySelector(".skill-name").value.trim() || "ダメージ判定";
    const raw = r.querySelector(".damage-value").value.trim();
    if (!raw) return;
    try {
      const src = options.standalonePalette
        ? literalizeNames(raw, Object.fromEntries(skillRows.map((x) => [x.name, x.value])))
        : hasEx
          ? literalizeNames(raw, exVals)
          : raw;
      commands.push(
        secretPrefixDmg(r) +
          transformDamageFormula(src, rolled, derived, db, !options.standalonePalette) +
          " 【" +
          labelWithRefs(label) +
          "】",
      );
    } catch (e) {
      if (!options.allowInvalidDamage) throw e;
    }
  };
  skillRows.forEach((item) => {
    const excluded = !options.standalonePalette && skillStatusExcluded(item.row);
    if (!excluded) extrasResolved.push({ label: item.name, value: item.value, max: item.value });
    // ダイスを含む式は従来どおり計算結果を出力し、通常の参照式は元の式へ展開する。
    // 成功値にダイス式（例：50+1d50）があっても、計算結果はステータス（技能名のラベル）に入れ、パレットはその {技能名} を参照する。
    // 単体チャットパレット（ステータスを持たない）だけは計算結果の数値をそのまま入れる。
    const hasDice = DICE_ANY_RE.test(item.raw);
    const paletteFormula =
      options.standalonePalette || excluded ? String(item.value) : hasDice ? "{" + item.name + "}" : formulaForPalette(item.raw, item.name);
    commands.push(secretPrefix(item.row) + rollCommandPrefix() + "<=" + paletteFormula + " 【" + labelWithRefs(item.name) + "】");
    if (options.includeSkillValueComments) commands.push("※" + item.name + "は" + item.value);
    pushDmg(item.row);
    // 「成功したら続けて出すチャットパレット」を、この技能の判定の直後に並べる
    textLines(item.row.querySelector(".skill-os-lines")?.value, true).forEach((ln) => {
      followIdx.add(commands.length);
      commands.push(ln);
    });
    const ml = successMemoLine(item.name, item.row);
    if (ml) {
      followIdx.add(commands.length);
      commands.push(ml);
    }
  });
  skills.querySelectorAll(".row").forEach((r) => pushDmg(r));
  if (!options.standalonePalette) pushDBStatuses(extrasResolved, dbLabelParts(db));
  for (const n of names) commands.push(rollCommandPrefix() + "<=" + "{" + n + "}*5" + " 【" + n + " × 5】");
  commands.push(...getPaletteCommandLines());
  const memoParts = [buildMemoText()].filter(Boolean);
  return {
    kind: "character",
    data: {
      name: composeName(),
      memo: memoParts.join("\n"),
      initiative: rolled.DEX,
      externalUrl: (document.getElementById("prof-url")?.value || "").trim(),
      ...iconFields(),
      commands: (skillOrderCustom ? commands : prioritizeCommands(commands, followIdx)).map(applyLabelMapToLine).join("\n"),
      status: extrasResolved.map((x) => ({ label: x.label, value: x.value, max: x.max })),
      params,
    },
  };
}
// ナンバリングはコマンド行ではなく、生成するキャラクター名に付ける。
let generatedNameBase = null;
let generatedNameLast = null;
let generatedNameCount = 0;
function prepareGeneratedName() {
  const input = document.getElementById("charName");
  if (!document.getElementById("numbering").checked) return;
  const current = input.value.trim();
  if (generatedNameLast === null || current !== generatedNameLast) {
    generatedNameBase = current.replace(/\d+$/, "");
    generatedNameCount = 0;
  }
  generatedNameCount++;
  input.value = (generatedNameBase || current) + generatedNameCount;
  generatedNameLast = input.value;
}
document.querySelectorAll("[data-clear-field]").forEach((btn) =>
  btn.addEventListener("click", () => {
    const field = document.getElementById(btn.dataset.clearField);
    if (field) field.value = "";
    if (btn.dataset.clearField === "paletteOutput") {
      paletteMode = "generated";
      paletteOrderApplied = false;
      paletteOrderOverride = null;
    }
  }),
);

// 式中の未登録名をすべて収集し、候補を一括表示する。
function collectSkillReferenceIssues() {
  const knownNames = new Set();
  Object.keys(readBase()).forEach((n) => {
    if (n) knownNames.add(n);
  });
  derivedStatuses.querySelectorAll(".derived-row").forEach((r) => {
    const n = (r.dataset.derivedName || "").trim();
    if (n) knownNames.add(n);
  });
  extras.querySelectorAll(".row").forEach((r) => {
    const n = r.querySelector(".extra-name")?.value.trim();
    if (n) knownNames.add(n);
  });
  skills.querySelectorAll(".row").forEach((r) => {
    const n = r.querySelector(".skill-name")?.value.trim();
    if (n) knownNames.add(n);
  });
  ["SAN", "DB", "アイデア", "幸運", "知識", "回避", "STR", "CON", "POW", "DEX", "APP", "SIZ", "INT", "EDU"].forEach((n) =>
    knownNames.add(n),
  );
  const fields = [...document.querySelectorAll(".skill-value,.derived-formula,.extra-value")];
  const sorted = [...knownNames].sort((a, b) => b.length - a.length);
  const issues = [];
  for (const field of fields) {
    const raw = normalizeFormula(String(field.value || "").trim());
    if (!raw) continue;
    let residue = raw.replace(/(?:\d*)d\d+/gi, "");
    for (const name of sorted) {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = nameRefRegex(name);
      residue = residue.replace(re, " ");
    }
    const tokens = [...residue.matchAll(/[A-Za-z_][A-Za-z0-9_]*|[\u3040-\u30ff\u3400-\u9fff々ー]+/g)].map((m) => m[0]);
    for (const token of [...new Set(tokens)]) {
      const ranked = [...knownNames]
        .map((name) => ({ name, distance: formulaNameDistance(token, name) }))
        .sort((a, b) => a.distance - b.distance);
      const best = ranked[0];
      const threshold = Math.max(1, Math.floor(Array.from(token).length * 0.25));
      if (best && best.distance <= threshold) issues.push({ wrong: token, right: best.name, field });
    }
  }
  const grouped = new Map();
  issues.forEach((x) => {
    const key = x.wrong + "\u0000" + x.right;
    if (!grouped.has(key)) grouped.set(key, { wrong: x.wrong, right: x.right, fields: [] });
    grouped.get(key).fields.push(x.field);
  });
  return [...grouped.values()];
}
let pendingSkillFixes = [];
let pendingSkillFixAction = "json";
function closeSkillFix() {
  document.getElementById("skillFixDialog").classList.add("hidden");
  pendingSkillFixes = [];
}
function openSkillFixDialog(issues, action) {
  pendingSkillFixes = issues;
  pendingSkillFixAction = action;
  const list = document.getElementById("skillFixList");
  list.innerHTML = "";
  document.getElementById("skillFixDescription").textContent =
    "見つかった修正候補：" + issues.length + "種類。チェックを外すと、その候補は今回修正しません。";
  issues.forEach((issue, index) => {
    const label = document.createElement("label");
    label.className = "skill-fix-item";
    const check = document.createElement("input");
    check.type = "checkbox";
    check.checked = true;
    check.dataset.fixIndex = String(index);
    const body = document.createElement("span");
    const strong = document.createElement("strong");
    strong.textContent = issue.wrong;
    const small = document.createElement("small");
    small.textContent = ": " + issue.right;
    const count = document.createElement("small");
    count.textContent = "該当する入力欄：" + issue.fields.length + "か所";
    body.append(strong, small, count);
    label.append(check, body);
    list.append(label);
  });
  document.getElementById("skillFixDialog").classList.remove("hidden");
}
function applySkillFix(all) {
  if (!pendingSkillFixes.length) return;
  const selected = all
    ? pendingSkillFixes
    : pendingSkillFixes.filter((_, i) => document.querySelector('#skillFixList input[data-fix-index="' + i + '"]')?.checked);
  if (!selected.length) {
    document.getElementById("skillFixDescription").textContent = "修正する項目にチェックを入れてください。";
    return;
  }
  selected.forEach((issue) => {
    const escaped = issue.wrong.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(escaped, "g");
    issue.fields.forEach((field) => {
      field.value = String(field.value || "").replace(re, issue.right);
    });
  });
  const action = pendingSkillFixAction;
  closeSkillFix();
  if (action === "palette") generatePaletteAfterFix();
  else generateJSON();
}
function offerSkillFix(issues, action) {
  if (!issues || !issues.length) return false;
  openSkillFixDialog(issues, action);
  return true;
}
document.getElementById("skillFixAll").onclick = () => applySkillFix(true);
document.getElementById("skillFixOne").onclick = () => applySkillFix(false);
document.getElementById("skillFixCancel").onclick = closeSkillFix;
document.getElementById("skillFixDialog").addEventListener("click", (e) => {
  if (e.target.id === "skillFixDialog") closeSkillFix();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeSkillFix();
});
function generateJSON() {
  try {
    const issues = collectSkillReferenceIssues();
    if (issues.length) {
      offerSkillFix(issues, "json");
      return false;
    }
    prepareGeneratedName();
    const data = makeDataWithPalette();
    output.value = JSON.stringify(data, null, 2);
    return true;
  } catch (e) {
    output.value = "";
    message.textContent = "生成エラー：" + (e && e.message ? e.message : String(e));
    document.getElementById("message").scrollIntoView({ behavior: "smooth", block: "center" });
    console.error(e);
    return false;
  }
}
document.getElementById("generate").type = "button";
document.getElementById("generate").onclick = () => {
  if (generateJSON()) output.scrollIntoView({ behavior: "smooth", block: "center" });
};
// ボタンを押した直後（ユーザー操作の中）に、同期コピーを先に試す。スマホのfile://表示やWebViewでは
// Clipboard APIが無効なことがあるため、一時テキスト欄を使う旧式手段を先に使い、だめなら標準APIを試す。成功なら true
async function copyTextInGesture(text) {
  let copied = false;
  const temp = document.createElement("textarea");
  temp.value = text;
  temp.setAttribute("readonly", "");
  temp.setAttribute("aria-hidden", "true");
  temp.style.position = "fixed";
  temp.style.left = "0";
  temp.style.top = "0";
  temp.style.width = "2px";
  temp.style.height = "2px";
  temp.style.padding = "0";
  temp.style.border = "0";
  temp.style.outline = "0";
  temp.style.boxShadow = "none";
  temp.style.background = "transparent";
  temp.style.opacity = "0.01";
  document.body.appendChild(temp);
  temp.focus({ preventScroll: true });
  temp.select();
  temp.setSelectionRange(0, temp.value.length);
  try {
    copied = document.execCommand("copy");
  } catch (_) {
    copied = false;
  }
  temp.remove();
  if (copied) return true;
  try {
    if (!navigator.clipboard || !navigator.clipboard.writeText) throw Error("Clipboard API unavailable");
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    return false;
  }
}
