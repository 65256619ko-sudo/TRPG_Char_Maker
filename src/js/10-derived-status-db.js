document.getElementById("rollStats").onclick = () => {
  try {
    base.querySelectorAll("input[data-stat]").forEach((i) => (i.value = String(rollFormula(statFormulas[i.dataset.stat]))));
    refreshDBDisplay();
    updateDerivedPreviews();
  } catch (e) {
    message.textContent = "エラー：" + e.message;
  }
};
document.getElementById("resetStats").onclick = () => {
  base.querySelectorAll("input[data-stat]").forEach((i) => (i.value = "0"));
  clearStatDeltas();
  refreshDBDisplay();
  updateDerivedPreviews();
};
document.getElementById("dbOverride").addEventListener("input", refreshDBDisplay);
function updateDerivedPreviews(baseValues = readBase(), notify = false) {
  let applied = 0,
    skipped = [];
  derivedStatuses.querySelectorAll(".derived-row").forEach((r) => {
    const name = r.dataset.derivedName,
      formula = r.querySelector(".derived-formula").value.trim(),
      out = r.querySelector(".derived-preview");
    try {
      const value = /[A-Za-z]/.test(formula) ? resolveExpr(formula, baseValues) : rollFormula(formula);
      out.textContent = String(value);
      out.classList.remove("pending");
      applied++;
    } catch (e) {
      out.textContent = "未確定";
      out.classList.add("pending");
      skipped.push(name);
    }
  });
  updatePointSummary();
  updateSanInfo();
}
document.getElementById("applyDerived").onclick = () => updateDerivedPreviews(readBase(), true);

function calculateDB(str, siz) {
  const sum = str + siz;
  if (sum <= 12) return "-1D6";
  if (sum <= 16) return "-1D4";
  if (sum <= 24) return "0";
  if (sum <= 32) return "+1D4";
  if (sum <= 40) return "+1D6";
  const dice = 2 + Math.floor((sum - 41) / 16);
  return "+" + dice + "D6";
}
// DBを「個数・面・符号」の数値ラベルに分解する（ココフォリアの変数は数値のみのため）。
// 例：+1D4→{x:1,y:4,neg:false} / -1D6→{x:1,y:6,neg:true} / 0→{x:0,y:6} / +3→{x:3,y:1}（3D1）。複数項の式はnull。
function dbLabelParts(db) {
  const m = String(db || "")
    .replace(/\s+/g, "")
    .match(/^([+-]?)(?:(\d*)D(\d+)|(\d+))$/i);
  if (!m) return null;
  const neg = m[1] === "-";
  if (m[3] !== undefined) return { x: m[2] === "" ? 1 : Number(m[2]), y: Number(m[3]), neg };
  const n = Number(m[4]);
  return n === 0 ? { x: 0, y: 6, neg: false } : { x: n, y: 1, neg };
}
// ダメージ式中のDBを {DB個数}D{DB面} に置き換える。マイナスDBは直前の演算子を反転する。
function replaceDBWithLabels(s, parts, hold) {
  const term = hold("{DB個数}D{DB面}");
  s = s.replace(/([+-])\s*DB(?![A-Za-z0-9_])/gi, (_, op) => (parts.neg ? (op === "+" ? "-" : "+") : op) + term);
  s = s.replace(/(^|[^A-Za-z0-9_])DB(?![A-Za-z0-9_])/gi, (_, p) => p + (parts.neg ? "-" : "") + term);
  return s;
}
// 上の逆変換。符号はDB符号（またはフォームのDB）から判断する。
function restoreDBLabels(s, neg) {
  const T = "\\{DB個数\\}[Dd]\\{DB面\\}";
  s = s.replace(new RegExp("^" + (neg ? "-?" : "") + T), "DB");
  s = s.replace(new RegExp("([+-])\\s*" + T, "g"), (_, op) => (neg ? (op === "+" ? "-" : "+") : op) + "DB");
  return s.replace(new RegExp(T, "g"), "DB");
}
function currentDBNeg() {
  const ov = document.getElementById("dbOverride").value.trim();
  if (ov) {
    const q = dbLabelParts(normalizeFormula(ov));
    return !!(q && q.neg);
  }
  const b = readBase();
  if (/^\d+$/.test(b.STR) && /^\d+$/.test(b.SIZ)) {
    const q = dbLabelParts(calculateDB(Number(b.STR), Number(b.SIZ)));
    return !!(q && q.neg);
  }
  return false;
}
function pushDBStatuses(list, parts) {
  if (!parts) return;
  list.push(
    { label: "DB個数", value: parts.x, max: parts.x },
    { label: "DB面", value: parts.y, max: parts.y },
    { label: "DB符号", value: parts.neg ? -1 : 1, max: parts.neg ? -1 : 1 },
  );
}
// チャットパレット単体用：式中の技能名などを、ラベル参照ではなく現在の数値に置き換える。{変数}の中身は触らない。
function literalizeNames(raw, values) {
  const entries = Object.entries(values)
    .filter(([n, v]) => n && v !== undefined && v !== null && /^-?\d+(?:\.\d+)?$/.test(String(v)))
    .sort((a, b) => b[0].length - a[0].length);
  return normalizeFormula(raw)
    .split(/(\{[^{}]*\})/)
    .map((seg) => {
      if (/^\{[^{}]*\}$/.test(seg)) return seg;
      for (const [n, v] of entries) {
        const esc = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const ascii = /^[A-Za-z_][A-Za-z0-9_]*$/.test(n);
        const re = ascii ? new RegExp("(^|[^A-Za-z0-9_])" + esc + "(?=$|[^A-Za-z0-9_])", "gi") : new RegExp(esc, "g");
        seg = seg.replace(re, ascii ? (_, pre) => (pre || "") + String(v) : () => String(v));
      }
      return seg;
    })
    .join("");
}
function refreshDBDisplay() {
  updateStatTotals();
  const raw = readBase();
  const out = document.getElementById("dbDisplay");
  const override = document.getElementById("dbOverride");
  if (override && override.value.trim()) {
    out.textContent = "手入力：" + normalizeFormula(override.value);
    return;
  }
  try {
    const str = Number(raw.STR),
      siz = Number(raw.SIZ);
    if (
      raw.STR === "" ||
      raw.SIZ === "" ||
      !Number.isFinite(str) ||
      !Number.isFinite(siz) ||
      hasUncertain(raw.STR) ||
      hasUncertain(raw.SIZ)
    ) {
      out.textContent = "生成時に計算";
    } else {
      out.textContent = calculateDB(str, siz);
    }
  } catch (e) {
    out.textContent = "生成時に計算";
  }
}
function normalizeFormula(raw) {
  return String(raw)
    .trim()
    .replace(/[Ｄｄ]/g, "d")
    .replace(/[＋]/g, "+")
    .replace(/[－−]/g, "-")
    .replace(/[＊×]/g, "*")
    .replace(/[／÷]/g, "/")
    .replace(/＜/g, "<")
    .replace(/＝/g, "=")
    .replace(/≦/g, "<=")
    .replace(/（/g, "(")
    .replace(/）/g, ")")
    .replace(/｛/g, "{")
    .replace(/｝/g, "}");
}
// ステータス名（能力値・HPなどの派生ステータス・追加ステータス）の一覧。大文字にした名前 → 元の名前
function statusNameMap(extraNames) {
  const map = new Map();
  const add = (n) => {
    n = String(n || "").trim();
    if (n) map.set(n.toUpperCase(), n);
  };
  [...names, "HP", "MP", "SAN", "アイデア", "幸運", "知識", "回避"].forEach(add);
  derivedStatuses.querySelectorAll(".derived-row").forEach((r) => add(r.querySelector(".derived-name")?.value || r.dataset.derivedName));
  extras.querySelectorAll(".row").forEach((r) => add(r.querySelector(".extra-name")?.value));
  (extraNames || []).forEach(add);
  return map;
}
// 技能名の照合用：全角かっこを半角にして、大文字にそろえる
function nameKey(n) {
  return String(n).replace(/（/g, "(").replace(/）/g, ")").trim().toUpperCase();
}
// 読み込んだ名前を、同じ名前（かっこの全角半角・大文字小文字の違いだけ）の既存の表記に合わせる
function matchName(name, candidates) {
  const key = nameKey(name);
  const hit = candidates.find((c) => nameKey(c) === key);
  return hit != null ? String(hit).trim() : name;
}
// 技能名の中の (MP)・（幸運） は、チャットパレットの【ラベル】ではココフォリアのステータス参照 {MP}・{幸運} にする
function labelWithRefs(name) {
  const known = statusNameMap();
  return String(name).replace(/[(（]\s*([^()（）]+?)\s*[)）]/g, (m, x) =>
    known.has(x.toUpperCase()) ? "{" + known.get(x.toUpperCase()) + "}" : m,
  );
}
// labelWithRefs の逆。読み込むとき、ラベルの {MP} を技能名の (MP) に戻す
function nameFromLabel(label, extraNames) {
  const known = statusNameMap(extraNames);
  return String(label).replace(/\{([^{}]+)\}/g, (m, x) =>
    known.has(x.trim().toUpperCase()) ? "(" + known.get(x.trim().toUpperCase()) + ")" : m,
  );
}
// 式の中の「名前」（英字・かな・漢字の並び）。ココフォリアでは {名前} で参照する
const NAME_TOKEN_RE = /[A-Za-z_][A-Za-z0-9_]*|[\u3040-\u30ff\u3400-\u9fff々ー]+/g;
function transformDamageFormula(raw, stats, derived, db, keepDB) {
  let s = normalizeFormula(raw);
  if (!s) throw Error("ダメージ式が空です");
  // ユーザーが明示した {変数} はそのまま保護する。
  const userVars = [];
  s = s.replace(/\{([^{}]+)\}/g, (_, name) => {
    const token = "\uE002" + userVars.length + "\uE003";
    userVars.push("{" + name.trim() + "}");
    return token;
  });
  // DB保持モード：DBを展開せず {DB個数}D{DB面} にする（DBが0でも式から消さない）。分解できない式は従来どおり展開。
  if (keepDB) {
    const dbParts = dbLabelParts(db);
    if (dbParts)
      s = replaceDBWithLabels(s, dbParts, (txt) => {
        const token = "\uE002" + userVars.length + "\uE003";
        userVars.push(txt);
        return token;
      });
  }
  // DBはステータスではないため、設定されたダメージボーナス式に展開する。
  s = s.replace(/([+-])\s*DB\b/gi, (_, op) => {
    if (db === "0") return "";
    const sign = db[0];
    const magnitude = sign === "+" || sign === "-" ? db.slice(1) : db;
    if (sign === "+") return op === "+" ? "+" + magnitude : "-" + magnitude;
    if (sign === "-") return op === "+" ? "-" + magnitude : "+" + magnitude;
    return op + db;
  });
  s = s.replace(/\bDB\b/gi, db === "0" ? "0" : db[0] === "+" ? db.slice(1) : db);
  // 1d(STR+6) のような面数式は計算せず、ステータス参照を残す。
  s = s.replace(/(\d*)d\s*\(([^()]*)\)/gi, (_, count, expr) => {
    const faceExpr = expr.replace(NAME_TOKEN_RE, (name) => "{" + name + "}");
    return (count || "1") + "D(" + faceExpr + ")";
  });
  // 登録済みステータスは名前に関係なく、ダイス面数の参照にも使える。
  // 例：1d装甲、1d魔力、1d防弾装甲、1dARMOR → 1D{ステータス名}
  const registeredNames = Object.keys({ ...stats, ...derived })
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  for (const name of registeredNames) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp("(\\d*)d\\s*" + escaped + "(?=$|[^A-Za-z0-9_])", "gi");
    s = s.replace(re, (_, count) => (count || "1") + "D{" + name + "}");
  }
  // 未登録の名前も従来どおり変数として扱う（装甲だけの特別処理にしない）。
  s = s.replace(/(\d*)d([A-Za-z][A-Za-z0-9_]*|[\u3040-\u30ff\u3400-\u9fff]+)/gi, (_, count, name) => (count || "1") + "D{" + name + "}");
  // すべての追加ステータス名を {ステータス名} の参照に変換する。
  // 既に波括弧で囲まれた参照は一時保護し、二重の波括弧にしない。
  const statusRefs = [];
  s = s.replace(/\{[^{}]*\}/g, (ref) => {
    const token = "\uE004" + statusRefs.length + "\uE005";
    statusRefs.push(ref);
    return token;
  });
  for (const name of Object.keys({ ...stats, ...derived }).sort((a, b) => b.length - a.length)) {
    if (!name) continue;
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp("(^|[^A-Za-z0-9_])" + escaped + "(?=$|[^A-Za-z0-9_])", "gi");
    s = s.replace(re, (_, prefix) => prefix + "{" + name + "}");
  }
  s = s.replace(/\uE004(\d+)\uE005/g, (_, i) => statusRefs[Number(i)]);
  // 通常のダイスと、すでに変換した「ダイス数 + {変数}」を一時保護。
  const diceTerms = [];
  s = s.replace(/\b\d*D(?:\d+|\{[^{}]+\}|\([^()]*\))/gi, (term) => {
    const token = "\uE000" + diceTerms.length + "\uE001";
    diceTerms.push(term.toUpperCase());
    return token;
  });
  // 既存の {STR} や {装甲} の中身を二重に変換しないよう保護する。
  const bracedRefs = [];
  s = s.replace(/\{[^{}]*\}/g, (ref) => {
    const token = "\uE006" + bracedRefs.length + "\uE007";
    bracedRefs.push(ref);
    return token;
  });
  // 残った名前（英数字・日本語）はすべてココフォリア変数として扱う。
  // STRなどの基本能力値やHP・装甲などの追加ステータス、「こぶし」などの技能名も、数値へ展開しない。
  s = s.replace(NAME_TOKEN_RE, (name) => "{" + name + "}");
  s = s.replace(/\uE006(\d+)\uE007/g, (_, i) => bracedRefs[Number(i)]);
  s = s.replace(/\uE000(\d+)\uE001/g, (_, i) => diceTerms[Number(i)]);
  s = s.replace(/\uE002(\d+)\uE003/g, (_, i) => userVars[Number(i)]);
  const validation = s.replace(/\{[^{}]*\}/g, "");
  // 参照名やC()などを含む既存のチャパレ式も許可し、式の記号だけを検証する。
  // 名前は上で {名前} に変換済みなので、ここでは一般的な英数字・日本語・演算子を許可。
  if (!/^[0-9A-Za-zぁ-んァ-ヶ一-龠D+*\/().{}\s-]*$/i.test(validation)) throw Error("ダメージ式を確認してください");
  // ステータス単体（例：MP、装甲）も有効なダメージ式として扱う。
  if (!s.trim()) throw Error("ダメージ式を確認してください");
  s = s.replace(/\s+/g, "");
  // ダイス表記がなく、四則演算を行う式だけはココフォリア用の C() で囲む。
  // F() は小数点以下を切り捨てる。ダイス式や単独のステータス参照には付けない。
  if (!/\d*D(?:\d+|\{[^{}]+\}|\([^()]*\))/i.test(s) && /[+*/-]/.test(s)) s = "C(" + s + ")";
  return s;
}
function transformSuccessValue(raw, stats = {}, derived = {}) {
  let s = normalizeFormula(raw).replace(/\s+/g, "");
  if (!s) throw Error("技能の成功値を入力してください");
  const refs = { ...stats, ...derived };
  // 既存の {変数} とダイス式は一時退避し、名前変換で壊さない。
  const saved = [];
  const hold = (value) => {
    const token = "\uE100" + saved.length + "\uE101";
    saved.push(value);
    return token;
  };
  s = s.replace(/\{[^{}]+\}/g, (ref) => hold("{" + ref.slice(1, -1).trim() + "}"));
  s = s.replace(/\b\d*d\d+\b/gi, (dice) => hold(dice));
  // 登録済みのステータス・技能名を長い名前から変数化する。
  const names = Object.keys(refs)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = /^[A-Za-z_][A-Za-z0-9_]*$/.test(name)
      ? new RegExp("(^|[^A-Za-z0-9_{}\\uE100-\\uE101])" + escaped + "(?=$|[^A-Za-z0-9_{}\\uE100-\\uE101])", "gi")
      : new RegExp(escaped, "g");
    s = s.replace(
      re,
      name.match(/^[A-Za-z_][A-Za-z0-9_]*$/) ? (_, prefix) => (prefix || "") + hold("{" + name + "}") : () => hold("{" + name + "}"),
    );
  }
  // 未登録の名前もココフォリア変数として扱う（日本語・英字の両方）。
  s = s.replace(/[A-Za-z_][A-Za-z0-9_]*|[\u3040-\u30ff\u3400-\u9fff々ー]+/g, (token) => hold("{" + token + "}"));
  s = s.replace(/\uE100(\d+)\uE101/g, (_, i) => saved[Number(i)]);
  const check = s.replace(/\{[^{}]+\}/g, "").replace(/\b\d*d\d+\b/gi, "");
  if (!/^[0-9+*\/().\s-]*$/.test(check)) throw Error("技能の成功値を確認してください");
  if (!/^[0-9A-Za-zぁ-んァ-ヶ一-龠々ーD+*\/().{}\s-]+$/i.test(s)) throw Error("技能の成功値を確認してください");
  // 四則演算は C() で囲み、ダイス式はそのままコマンドに残す。
  // CCB/CC の成功値には C() を自動付与しない。入力された括弧と演算子をそのまま残す。
  return s;
}
function makeRawData() {
  const rawBase = readBase();
  const derived = {};
  const status = [];
  // 基本ステータスは計算式をそのまま保持し、全項目をJSONのstatusへ登録する。
  for (const r of derivedStatuses.querySelectorAll(".derived-row")) {
    const n = (r.dataset.derivedName || "").trim();
    const raw = r.querySelector(".derived-formula").value.trim();
    if (!n) continue;
    if (!raw) throw Error("基本ステータス「" + n + "」の計算式を入力してください");
    status.push({ label: n, value: raw, max: raw });
    derived[n.toUpperCase()] = raw;
  }
  // 追加ステータスも式を評価せず、そのまま出力する。
  for (const r of extras.querySelectorAll(".row")) {
    const n = r.querySelector(".extra-name").value.trim();
    const raw = r.querySelector(".extra-value").value.trim();
    if (n && n.toUpperCase() !== "DB") {
      if (!raw) throw Error("ステータス「" + n + "」の値・計算式を入力してください");
      status.push({ label: n, value: raw, max: raw });
      derived[n.toUpperCase()] = raw;
    }
  }
  // ダイスを振らないモードでもDBを失わないよう、DBをstatusに残す（読み込み時に復元できる）。
  let dbRaw = "";
  {
    const ov = document.getElementById("dbOverride").value.trim();
    if (ov) dbRaw = normalizeFormula(ov).replace(/\s+/g, "");
    else if (/^\d+$/.test(rawBase.STR) && /^\d+$/.test(rawBase.SIZ)) dbRaw = calculateDB(Number(rawBase.STR), Number(rawBase.SIZ));
  }
  const rawDBParts = dbLabelParts(dbRaw);
  pushDBStatuses(status, rawDBParts);
  const commands = [];
  commands.push("1d100<={SAN} 【正気度ロール】");
  ["アイデア", "幸運", "知識", "回避"].forEach((n, i) => {
    const fallback = ["INT*5", "POW*5", "EDU*5", "DEX*2"][i];
    commands.push(rollCommandPrefix() + "<={" + n + "} 【" + n + "】");
  });
  skills.querySelectorAll(".row").forEach((r) => {
    const n = r.querySelector(".skill-name").value.trim();
    const raw = r.querySelector(".skill-value").value.trim();
    if (!n) return;
    if (!raw) {
      if (r.querySelector(".damage-value").value.trim()) return;
      throw Error("技能「" + n + "」の技能値（％）を入力してください");
    }
    // 技能成功値もステータスとして保存し、コマンド側は技能名の変数を参照する。
    // 出力の設定で外した技能はステータスを作らない（ほかの式から参照されているものは、式が壊れないよう残す）
    const referenced = [...skills.querySelectorAll(".row")].some(
      (o) => o !== r && [o.querySelector(".skill-value").value, o.querySelector(".damage-value").value].some((t) => String(t).includes(n)),
    );
    const noStatus = skillStatusExcluded(r) && !referenced;
    if (!noStatus) status.push({ label: n, value: raw, max: raw });
    const skillRefs = {};
    skills.querySelectorAll(".row").forEach((sr) => {
      const sn = sr.querySelector(".skill-name").value.trim();
      if (sn && sr.querySelector(".skill-value").value.trim()) skillRefs[sn] = sn;
    });
    const formula = transformSuccessValue(raw, skillRefs, derived);
    commands.push(
      secretPrefix(r) +
        rollCommandPrefix() +
        "<=" +
        (/^[0-9]+$/.test(raw) ? (noStatus ? raw : "{" + n + "}") : formula) +
        " 【" +
        labelWithRefs(n) +
        "】",
    );
    textLines(r.querySelector(".skill-os-lines")?.value, true).forEach((ln) => commands.push(ln));
    const ml = successMemoLine(n, r);
    if (ml) commands.push(ml);
  });
  skills.querySelectorAll(".row").forEach((r) => {
    const label = r.querySelector(".skill-name").value.trim() || "ダメージ判定";
    const raw = r.querySelector(".damage-value").value.trim();
    if (raw)
      commands.push(
        secretPrefixDmg(r) +
          (rawDBParts
            ? replaceDBWithLabels(raw, rawDBParts, () => "\uE0F0")
                .split("\uE0F0")
                .join("{DB個数}D{DB面}")
            : raw) +
          " 【" +
          labelWithRefs(label) +
          "】",
      );
  });
  for (const n of names) commands.push(rollCommandPrefix() + "<={" + n + "}*5 【" + n + " × 5】");
  commands.push(...getPaletteCommandLines());
  const memoParts = [buildMemoText()].filter(Boolean);
  return {
    kind: "character",
    data: {
      name: composeName(),
      memo: memoParts.join("\n"),
      initiative: rawBase.DEX,
      externalUrl: (document.getElementById("prof-url")?.value || "").trim(),
      ...iconFields(),
      commands: commands.map(applyLabelMapToLine).join("\n"),
      status,
      params: names.map((n) => ({ label: n, value: String(rawBase[n]) })),
    },
  };
}
