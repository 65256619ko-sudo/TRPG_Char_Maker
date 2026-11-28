
"use strict";
// ===== アイコン（24x24の線画。色は文字色に従う）=====
const ICONS = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  sortUD: '<path d="M8 4v16M8 4L5 7M8 4l3 3M16 20V4M16 20l-3-3M16 20l3-3"/>',
  arrowUp: '<path d="M12 19V5M5 12l7-7 7 7"/>',
  star: '<polygon points="12 3 14.8 9 21 9.6 16.4 13.9 17.8 20 12 16.8 6.2 20 7.6 13.9 3 9.6 9.2 9"/>',
  check: '<polyline points="4 12 10 18 20 6"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>',
  bars: '<path d="M6 20V11M12 20V4M18 20v-6"/>',
  list: '<path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
  outbox: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  compass: '<circle cx="12" cy="12" r="9"/><polygon points="15.8 8.2 13.6 13.6 8.2 15.8 10.4 10.4"/>',
  dice: '<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><circle cx="8.5" cy="8.5" r="1.2" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="15.5" cy="15.5" r="1.2" fill="currentColor" stroke="none"/>',
  growth: '<polyline points="3 17 9 11 13 15 21 7"/><polyline points="15 7 21 7 21 13"/>',
  tag: '<path d="M20.5 12.5l-8 8-9-9V3.5h8z"/><circle cx="7.6" cy="7.6" r="1.3"/>',
  sword: '<path d="M12 2.5l2.2 3v8.5H9.8V5.5z"/><path d="M7 14h10"/><path d="M12 14v5"/><circle cx="12" cy="20.5" r="1.2"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  folderOpen:
    '<path d="M3 17V6a1 1 0 0 1 1-1h5l2 2h7a1 1 0 0 1 1 1v2"/><path d="M3 17l2.5-7h16.5l-2.5 7a1 1 0 0 1-1 .8H4a1 1 0 0 1-1-.8z"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><line x1="16" y1="16" x2="21" y2="21"/>',
  image:
    '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.6"/><polyline points="3 18 9 12.5 13.5 17 16.5 14 21 18"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff:
    '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/><line x1="4" y1="4" x2="20" y2="20"/>',
  gift: '<rect x="3" y="9" width="18" height="4" rx="1"/><path d="M5 13v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7"/><line x1="12" y1="9" x2="12" y2="21"/><path d="M12 9C9 9 7 8 7 6.5S9.5 4 12 9zM12 9c3 0 5-1 5-2.5S14.5 4 12 9z"/>',
  gear: '<path d="M10.0 5.3 L10.5 2.6 L13.5 2.6 L14.0 5.3 L15.3 5.8 L17.6 4.3 L19.7 6.4 L18.2 8.7 L18.7 10.0 L21.4 10.5 L21.4 13.5 L18.7 14.0 L18.2 15.3 L19.7 17.6 L17.6 19.7 L15.3 18.2 L14.0 18.7 L13.5 21.4 L10.5 21.4 L10.0 18.7 L8.7 18.2 L6.4 19.7 L4.3 17.6 L5.8 15.3 L5.3 14.0 L2.6 13.5 L2.6 10.5 L5.3 10.0 L5.8 8.7 L4.3 6.4 L6.4 4.3 L8.7 5.8z"/><circle cx="12" cy="12" r="2.8"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  trash:
    '<line x1="3.5" y1="6" x2="20.5" y2="6"/><path d="M18.5 6l-1 14a2 2 0 0 1-2 1.8h-7a2 2 0 0 1-2-1.8L5.5 6"/><path d="M9.5 6V4h5v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>',
  save: '<path d="M5 3.5h11l3.5 3.5v12.5a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5V5A1.5 1.5 0 0 1 5 3.5z"/><path d="M7.5 3.5v5h8v-5"/><rect x="7" y="13.5" width="10" height="7"/>',
  import: '<path d="M12 3v12"/><polyline points="7 10 12 15 17 10"/><path d="M4 20h16"/>',
  share: '<path d="M12 15V3"/><polyline points="7 8 12 3 17 8"/><path d="M4 15v4a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 19v-4"/>',
  clipboard: '<rect x="5.5" y="4.5" width="13" height="16.5" rx="2"/><rect x="9" y="2.5" width="6" height="4" rx="1"/>',
  users:
    '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.6 2.7-6 6-6s6 2.4 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M16.5 14c2.8 0 4.5 2 4.5 5"/>',
  derive:
    '<circle cx="6" cy="5.5" r="2.2"/><circle cx="6" cy="18.5" r="2.2"/><circle cx="18" cy="9" r="2.2"/><line x1="6" y1="7.7" x2="6" y2="16.3"/><path d="M18 11.2c0 3.5-4 3.5-10 5.6"/>',
  copy: '<rect x="8.5" y="8.5" width="12" height="12" rx="2"/><path d="M15.5 8.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h2.5"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
};
// アイコンのSVG文字列
function icon(name) {
  return '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">' + ICONS[name] + "</svg>";
}
// ボタンや見出しの中身を「アイコン＋文字」にする
function setIconText(node, name, text) {
  node.textContent = "";
  node.insertAdjacentHTML("beforeend", icon(name));
  if (text) {
    node.firstChild.classList.add("ic-l");
    node.append(text);
  }
  return node;
}
// HTMLに書いた <svg class="ic" data-ic="名前"> の中身を埋める
function fillIcons(root) {
  (root || document).querySelectorAll("svg[data-ic]").forEach((n) => {
    n.innerHTML = ICONS[n.dataset.ic] || "";
  });
}
fillIcons();
// ダイス表記の判定（1d6 に加えて、1dMP・MPd6 のように個数や面に名前を書いたもの）
const DICE_ANY_RE = /(?:^|[^A-Za-z0-9_])\d*d\d+|\dd(?=[A-Za-z_{(\u3040-\u30ff\u3400-\u9fff])|[A-Za-z\u3040-\u30ff\u3400-\u9fff)]d\d/i;
const names = ["STR", "CON", "POW", "DEX", "APP", "SIZ", "INT", "EDU"];
const paletteOutput = document.getElementById("paletteOutput");
// manual: チャパレ欄の文章をそのまま使う / reflected: フォームへ読み込み済み / generated: フォームから生成済み
let paletteMode = "generated";
// 判定方式は初期値CCB。ユーザーの選択をブラウザ内に保存する。
let rollMode = "CCB";
try {
  if (localStorage.getItem("trpgCharmakerRollMode_v1") === "CC") rollMode = "CC";
} catch (e) {}
function rollCommandPrefix() {
  return rollMode;
}
function updateRollModeButton() {
  const b = document.getElementById("rollModeToggle");
  if (b) {
    b.textContent = "判定方式：" + rollMode;
    b.setAttribute("aria-pressed", String(rollMode === "CCB"));
    b.title = "クリックしてCC／CCBを切り替えます";
  }
}
// 改行で分けた行（空行は除く）。trim を true にすると各行の前後の空白も取る
function textLines(text, trim) {
  const lines = String(text || "").split(/\r?\n/);
  return (trim ? lines.map((x) => x.trim()) : lines).filter(Boolean);
}
// 各行に同じ処理をして、また改行でつなぐ（空行も残す）
function mapLines(text, fn) {
  return String(text || "")
    .split(/\r?\n/)
    .map(fn)
    .join("\n");
}
function replaceRollModeInText(text) {
  return mapLines(text, (line) => line.replace(/^(S?)(?:CCB|CC)(?=<)/i, (m, sp) => sp + rollMode));
}
// シークレットダイス：技能行・ダメージ行ごとのチェックで切り替える。ONの行のコマンド先頭に S を付ける（ココフォリアのシークレットダイス）。
const SECRET_PREFIX_RE = /^S(?=CCB?<=|\d*[dD](?:\d|\{|\())/;

// ===== 並べ替え（技能・ダメージ式）：行頭の「⠿」をドラッグ。マウス・タッチ両対応 =====
function setSecretEdit(on) {
  document.body.classList.toggle("secret-edit", on);
  document.querySelectorAll(".secret-edit-btn").forEach((b) => {
    b.textContent = "シークレット：" + (on ? "ON" : "OFF");
    b.setAttribute("aria-pressed", String(on));
    b.title = on
      ? "各行の「S」にチェックを入れると、その行をシークレットダイスにします。もう一度押すと閉じます（設定は保たれ、ONの行は紫の帯で表示）"
      : "押すと各行にシークレットダイスの「S」チェックを表示します";
  });
}
document
  .querySelectorAll(".secret-edit-btn")
  .forEach((b) => b.addEventListener("click", () => setSecretEdit(!document.body.classList.contains("secret-edit"))));
setSecretEdit(false);
function rowSecret(r) {
  const c = r && r.querySelector(".secret-flag");
  return !!(c && c.checked);
}
function secretPrefix(r) {
  return rowSecret(r) ? "S" : "";
}
function setRowSecret(r, on) {
  const c = r && r.querySelector(".secret-flag");
  if (c) c.checked = !!on;
}
function rowSecretDmg(r) {
  const c = r && r.querySelector(".secret-flag-dmg");
  return !!(c && c.checked);
}
function secretPrefixDmg(r) {
  return rowSecretDmg(r) ? "S" : "";
}
function setRowSecretDmg(r, on) {
  const c = r && r.querySelector(".secret-flag-dmg");
  if (c) c.checked = !!on;
}
let paletteOrderApplied = false;
let paletteOrderOverride = null;
// ラベルの一括置換・削除：元のラベル → 新しいラベル（空文字は「ラベルを外す」）。出力するすべての行の末尾【…】に反映する
let paletteLabelMap = {};
let labelMapOff = false;
// 技能欄の並びを自分で決めたか（決めた後は、目星などを先頭に寄せる初期の並びを使わない）
let skillOrderCustom = false;
// コマンドの数値・式が再生成で変わっても、末尾の【名前】を基準に順番を維持する。
// 【名前】がない独自コマンドは、従来どおりコマンド全文を識別子として扱う。
const LABEL_TAIL_RE = /(\s*)【([^【】]*)】(\s*)$/;
function labelOfLine(line) {
  const m = String(line || "").match(/【([^【】]*)】\s*$/);
  return m ? m[1].trim() : "";
}
function applyLabelMapToLine(line) {
  if (labelMapOff || !Object.keys(paletteLabelMap).length) return line;
  return String(line).replace(LABEL_TAIL_RE, (m, a, lab, b) => {
    const key = lab.trim();
    if (!Object.prototype.hasOwnProperty.call(paletteLabelMap, key)) return m;
    const to = paletteLabelMap[key];
    return to ? a + "【" + to + "】" + b : "";
  });
}
// 設定を変えたとき、すでにある並びや手直し済みのチャパレにも新しいラベルを反映する
function relabelLines(lines, oldMap, newMap) {
  const origOf = (lab) => {
    for (const [o, t] of Object.entries(oldMap)) if (t === lab && t !== "") return o;
    return lab;
  };
  return lines.map((l) =>
    String(l).replace(LABEL_TAIL_RE, (m, a, lab, b) => {
      const o = origOf(lab.trim()),
        to = Object.prototype.hasOwnProperty.call(newMap, o) ? newMap[o] : o;
      return to ? a + "【" + to + "】" + b : "";
    }),
  );
}
function paletteOrderKey(line) {
  const text = String(line || "").trim();
  const label = text.match(/【([^】]+)】\s*$/);
  return label ? "label:" + label[1].trim().replace(/\s+/g, " ").toLocaleLowerCase() : "line:" + text;
}
// 初期の並び：目星・聞き耳・図書館・こぶし・回避（とそのダメージ）を、不定の行の次に出す。「優先順位を編集」で決めた並びがあればそちらが優先される
const PRIORITY_SKILLS = ["目星", "聞き耳", "図書館", "こぶし", "回避"];
function prioritizeCommands(cmds, follow) {
  const lines = cmds.slice(),
    picked = new Set(),
    groups = [];
  PRIORITY_SKILLS.forEach((n) => {
    const tag = "【" + n + "】";
    const i = lines.findIndex((l, k) => !picked.has(k) && /^S?CCB?<=/.test(l) && l.trim().endsWith(tag));
    if (i < 0) return;
    const g = [i];
    picked.add(i);
    const j = i + 1;
    if (j < lines.length && !picked.has(j) && !/^S?CCB?<=/.test(lines[j]) && lines[j].trim().endsWith(tag)) {
      g.push(j);
      picked.add(j);
    }
    // 成功時に続けて出す行（技能ごとの設定）も一緒に動かす
    for (let k = g[g.length - 1] + 1; follow && follow.has(k) && !picked.has(k); k++) {
      g.push(k);
      picked.add(k);
    }
    groups.push(g);
  });
  if (!groups.length) return cmds;
  const head = lines[0] && lines[0].startsWith("C({SAN}") && !picked.has(0) ? 1 : 0;
  const top = [].concat(...groups).map((k) => lines[k]);
  const rest = lines.filter((l, k) => !picked.has(k));
  return [...rest.slice(0, head), ...top, ...rest.slice(head)];
}
function successMemoOn() {
  const c = document.getElementById("includeSuccessMemo");
  return !!(c && c.checked);
}
// 成功時のメモを、その技能の行の直後に出す1行にする（技能と同じ【ラベル】を付けて、技能と一緒に動くようにする）
function successMemoLine(name, row) {
  if (!successMemoOn() || !row) return "";
  const m = (row.querySelector(".skill-os-memo")?.value || "").trim().replace(/\s*\r?\n\s*/g, "／");
  if (!m) return "";
  return "※" + name + "（成功時）：" + m + " 【" + labelWithRefs(name) + "】";
}
function paletteHeadsOn() {
  const c = document.getElementById("paletteHeads");
  return !!(c && c.checked);
}
// 見出し行（―――― 戦闘 ――――）。チャパレ欄に表示し、読み出すときは取り除く（中身の処理は見出しなしの文章で行う）
const PAL_HEAD_RE = /^―{2,}\s.*\s―{2,}$/;
function stripPaletteHeadings(text) {
  return String(text || "")
    .split(/\r?\n/)
    .filter((l) => !PAL_HEAD_RE.test(l.trim()))
    .join("\n");
}
// 主ラベルが変わるところに見出し行を入れる。並べ替えをしていないときは、ラベルごとに自動でまとめる
function addPaletteHeadings(text) {
  if (!paletteHeadsOn()) return text;
  const lines = textLines(stripPaletteHeadings(text)),
    map = paletteLineRowMap(),
    catOf = (l) => {
      const lab = labelOfLine(l),
        row = lab ? map.get(paletteOrderKey(l)) : null;
      return (row ? rowCats(row)[0] : "") || "その他";
    },
    items = lines.map((l) => ({ l, cat: catOf(l) }));
  const auto = !(Array.isArray(paletteOrderOverride) && paletteOrderOverride.length) && paletteMode !== "manual";
  let seq = items;
  if (auto) {
    const order = [];
    items.forEach((x) => {
      if (!order.includes(x.cat)) order.push(x.cat);
    });
    seq = order.flatMap((c) => items.filter((x) => x.cat === c));
  }
  const out = [];
  let prev = null;
  seq.forEach((x) => {
    if (x.cat !== prev) out.push("―――― " + x.cat + " ――――");
    prev = x.cat;
    out.push(x.l);
  });
  return out.join("\n");
}
// チャパレ欄：書き込むと見出しが入り、読み出すと見出しなしの文章が返る
(() => {
  const d = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value");
  Object.defineProperty(paletteOutput, "value", {
    configurable: true,
    get() {
      return stripPaletteHeadings(d.get.call(this));
    },
    set(v) {
      d.set.call(this, paletteHeadsOn() ? addPaletteHeadings(v) : v);
    },
  });
})();
function refreshPaletteHeadings() {
  const t = paletteOutput.value;
  if (t.trim()) paletteOutput.value = t;
}
document.getElementById("paletteHeads").addEventListener("change", refreshPaletteHeadings);
function orderPaletteLines(lines) {
  if (!Array.isArray(paletteOrderOverride) || !paletteOrderOverride.length) return lines;
  const rank = new Map();
  paletteOrderOverride.forEach((line, i) => {
    const key = paletteOrderKey(line);
    if (!rank.has(key)) rank.set(key, i);
  });
  return lines
    .map((line, index) => ({
      line,
      index,
      rank: rank.has(paletteOrderKey(line)) ? rank.get(paletteOrderKey(line)) : Number.MAX_SAFE_INTEGER,
    }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((x) => x.line);
}
paletteOutput.addEventListener("input", () => {
  paletteMode = "manual";
  paletteOrderApplied = false;
  paletteOrderOverride = null;
});
updateRollModeButton();
document.getElementById("rollModeToggle").addEventListener("click", () => {
  rollMode = rollMode === "CCB" ? "CC" : "CCB";
  try {
    localStorage.setItem("trpgCharmakerRollMode_v1", rollMode);
  } catch (e) {}
  updateRollModeButton();
  paletteOutput.value = replaceRollModeInText(paletteOutput.value);
  if (output.value.trim()) {
    try {
      const obj = JSON.parse(output.value);
      const d = obj.data || obj.character || obj;
      if (d && typeof d === "object" && typeof d.commands === "string") {
        d.commands = replaceRollModeInText(d.commands);
        output.value = JSON.stringify(obj, null, 2);
      }
    } catch (e) {}
  }
  message.textContent = "判定方式を" + rollMode + "に切り替えました。既存のチャットパレットとJSON内の判定コマンドにも反映しました。";
});
// UIで追加チャパレを組み立て、既存の保存形式（コマンド文字列）へ同期する。
const paletteStatusSelect = document.getElementById("paletteStatusSelect");
const paletteCommandList = document.getElementById("paletteCommandList");
function refreshPaletteStatusOptions() {
  if (!paletteStatusSelect) return;
  const old = paletteStatusSelect.value;
  const q = kanaFold((document.getElementById("paletteStatusSearch")?.value || "").trim());
  const groups = [
    { label: "基本ステータス", values: ["HP", "MP", "SAN", "アイデア", "幸運", "知識", "回避"] },
    { label: "能力値", values: names.slice() },
    {
      label: "技能",
      values: [...skills.querySelectorAll(".row")]
        .filter((r) => r.querySelector(".skill-value")?.value.trim())
        .map((r) => (r.querySelector(".skill-name")?.value || "").trim())
        .filter(Boolean),
    },
    {
      label: "追加ステータス",
      values: [...derivedStatuses.querySelectorAll(".derived-row")]
        .map((r) => (r.querySelector(".derived-name")?.value || r.dataset.derivedName || "").trim())
        .filter(Boolean)
        .filter((n) => !["HP", "MP", "SAN", "アイデア", "幸運", "知識", "回避"].includes(n))
        .concat([...extras.querySelectorAll(".row")].map((r) => (r.querySelector(".extra-name")?.value || "").trim()).filter(Boolean)),
    },
  ];
  const seen = new Set();
  let total = 0;
  paletteStatusSelect.innerHTML = "";
  groups.forEach((group) => {
    const vals = group.values.filter((v) => v && !seen.has(v) && (!q || kanaFold(v).includes(q)));
    vals.forEach((v) => seen.add(v));
    if (!vals.length) return;
    const og = document.createElement("optgroup");
    og.label = group.label;
    vals.forEach((v) => {
      const o = document.createElement("option");
      o.value = v;
      o.textContent = v;
      og.append(o);
      total++;
    });
    paletteStatusSelect.append(og);
  });
  if ([...paletteStatusSelect.options].some((o) => o.value === old)) paletteStatusSelect.value = old;
  else if (paletteStatusSelect.options.length) paletteStatusSelect.selectedIndex = 0;
  const count = document.getElementById("paletteStatusCount");
  if (count) count.textContent = q ? `${total}件が見つかりました` : `全${total}件（カテゴリ別）`;
}
document.getElementById("paletteStatusSearch").addEventListener("input", refreshPaletteStatusOptions);
function getPaletteCommandLines() {
  return textLines(document.getElementById("extraPaletteCommands").value, true);
}
// 追加したコマンドの保存（隠しテキスト欄）。変更したら入力イベントを出して、自動更新・保存の判定に伝える
function commitExtraCommands(lines) {
  const ta = document.getElementById("extraPaletteCommands");
  ta.value = lines.join("\n");
  renderPaletteCommandList();
  ta.dispatchEvent(new Event("input", { bubbles: true }));
}
function renderPaletteCommandList() {
  const host = paletteCommandList;
  host.innerHTML = "";
  const lines = getPaletteCommandLines();
  lines.forEach((line, index) => {
    const item = document.createElement("div");
    item.className = "palette-command-item";
    const code = document.createElement("code");
    code.textContent = line;
    const ctl = document.createElement("div");
    ctl.className = "pc-ctl";
    const mk = (text, label, fn, cls) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "small-btn" + (cls ? " " + cls : "");
      b.textContent = text;
      b.setAttribute("aria-label", line + "を" + label);
      b.onclick = fn;
      return b;
    };
    const up = mk("↑", "上へ", () => {
      [lines[index - 1], lines[index]] = [lines[index], lines[index - 1]];
      commitExtraCommands(lines);
    });
    up.disabled = index === 0;
    const down = mk("↓", "下へ", () => {
      [lines[index + 1], lines[index]] = [lines[index], lines[index + 1]];
      commitExtraCommands(lines);
    });
    down.disabled = index === lines.length - 1;
    const edit = mk("編集", "編集", () => {
      const inp = document.createElement("input");
      inp.type = "text";
      inp.className = "pc-edit";
      inp.value = line;
      inp.setAttribute("aria-label", "コマンドの内容");
      const save = () => {
        const v = inp.value.replace(/\s*\n\s*/g, " ").trim();
        if (v) lines[index] = v;
        else lines.splice(index, 1);
        commitExtraCommands(lines);
      };
      inp.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          save();
        } else if (e.key === "Escape") renderPaletteCommandList();
      });
      const ok = mk("保存", "保存", save, "primary");
      const cancel = mk("取消", "編集を取り消し", renderPaletteCommandList);
      code.replaceWith(inp);
      ctl.replaceChildren(ok, cancel);
      inp.focus();
    });
    const del = mk(
      "削除",
      "削除",
      () => {
        lines.splice(index, 1);
        commitExtraCommands(lines);
      },
      "danger",
    );
    ctl.append(up, down, edit, del);
    item.append(code, ctl);
    host.append(item);
  });
  if (!lines.length) {
    const empty = document.createElement("p");
    empty.className = "hint";
    empty.textContent = "まだありません（上で入力して「＋ 追加」）";
    host.append(empty);
  }
}
// 並べ替え（チャパレ・技能で共通）。draft の indices を束にして insertionIndex の位置へ移した結果を返す（動かせないときは null）
// keep を渡すと、動かした項目を選択状態にせず、元の選択（keep）を新しい位置に付け替えて返す
