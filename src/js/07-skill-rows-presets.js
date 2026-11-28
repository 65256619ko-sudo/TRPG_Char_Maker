function recalcSkillRow(r) {
  const val = r.querySelector(".skill-value");
  r.classList.toggle("has-dice", otherHasDice(r.querySelector(".skill-other").value.trim()));
  if (!document.body.classList.contains("sp-on")) {
    val.readOnly = false;
    return;
  }
  val.readOnly = true;
  const base = r.querySelector(".skill-base").value.trim();
  const add = (Number(r.querySelector(".skill-occ").value) || 0) + (Number(r.querySelector(".skill-int").value) || 0) + skillOtherValue(r);
  const hasName = !!r.querySelector(".skill-name").value.trim();
  const hasDmg = !!r.querySelector(".damage-value")?.value.trim();
  if (base === "") {
    val.value = add || (hasName && !hasDmg) ? String(add) : "";
  } else if (/^\d+$/.test(base)) val.value = String(Number(base) + add);
  else val.value = add ? base + "+" + add : base;
}
function updatePointSummary() {
  if (!document.body.classList.contains("sp-on")) return;
  const rows = [...skills.querySelectorAll(".row")];
  const sum = (c) => rows.reduce((t, r) => t + (Number(r.querySelector("." + c).value) || 0), 0);
  const b0 = readBase(),
    b = {};
  Object.keys(b0).forEach((k) => {
    if (!hasUncertain(b0[k])) b[k] = b0[k];
  });
  const limit = (id) => {
    const f = document.getElementById(id).value.trim();
    if (!f) return null;
    try {
      return /^[0-9+\-*/().\s]+$/.test(f) ? rollFormula(f) : resolveExpr(f, b);
    } catch (e) {
      return null;
    }
  };
  const show = (id, label, used, lim) => {
    const el = document.getElementById(id);
    if (lim === null) {
      el.textContent = label + "：使用 " + used + "／上限は確定後に計算";
      el.classList.remove("over");
    } else {
      const rem = lim - used;
      el.textContent = label + "：使用 " + used + "／" + lim + (rem < 0 ? "　超過 " + -rem : "　残り " + rem);
      el.classList.toggle("over", rem < 0);
    }
    const bar = document.getElementById(id === "spOccLine" ? "spBarOcc" : "spBarInt");
    if (bar) {
      bar.textContent =
        (id === "spOccLine" ? "職 " : "興 ") + used + "/" + (lim === null ? "?" : lim) + (lim === null ? "" : lim - used < 0 ? " 超過" + (used - lim) : " 残" + (lim - used));
      bar.classList.toggle("over", lim !== null && lim - used < 0);
    }
  };
  show("spOccLine", "職業P", sum("skill-occ"), limit("spOccFormula"));
  show("spIntLine", "興味P", sum("skill-int"), limit("spIntFormula"));
}
function setSkillPointMode(on) {
  document.body.classList.toggle("sp-on", on);
  document.getElementById("spMode").checked = on;
  document.getElementById("spPanel").classList.toggle("hidden", !on);
  if (on)
    skills.querySelectorAll(".row").forEach((r) => {
      const f = (c) => r.querySelector(c).value.trim();
      if (!f(".skill-base") && !f(".skill-occ") && !f(".skill-int") && !f(".skill-other"))
        r.querySelector(".skill-base").value = r.querySelector(".skill-value").value;
    });
  skills.querySelectorAll(".row").forEach(recalcSkillRow);
  updatePointSummary();
}
// ダメージ式を追加する。同名の行でダメージ式が空のものがあればそこへ入れ（技能とダメージを1行にまとめる）、なければ成功値が空の行を作る。
function addDamage(n = "", v = "", secret) {
  const name = String(n || "").trim(),
    val = String(v || "").trim();
  if (!name && !val) return null;
  if (name) {
    const hit = [...skills.querySelectorAll(".row")].find(
      (r) => r.querySelector(".skill-name").value.trim() === name && !r.querySelector(".damage-value").value.trim(),
    );
    if (hit) {
      hit.querySelector(".damage-value").value = val;
      setRowSecretDmg(hit, secret);
      recalcSkillRow(hit);
      return hit;
    }
  }
  const x = addSkill(name, "", undefined, false, val, secret);
  return x.row;
}
// ===== 基本技能（定番技能・戦闘機能）のカタログ =====
// skill: 技能の成功値 / damage: ダメージ式 / dodge: 基本ステータスの回避（DEX*2）を適用
const presetCatalog = [
  {
    cat: "戦闘（近接）",
    items: [
      { name: "こぶし", skill: "50", damage: "1d3+DB" },
      { name: "キック", skill: "25", damage: "1d6+DB" },
      { name: "頭突き", skill: "10", damage: "1d4+DB" },
      { name: "組み付き", skill: "25" },
      { name: "マーシャルアーツ", skill: "1" },
      { name: "回避", dodge: true, note: "基本ステータスの回避＝DEX×2" },
    ],
  },
  {
    cat: "戦闘（射撃・投擲）",
    items: [
      { name: "投擲", skill: "25" },
      { name: "拳銃", skill: "20" },
      { name: "サブマシンガン", skill: "15" },
      { name: "ショットガン", skill: "30" },
      { name: "マシンガン", skill: "15" },
      { name: "ライフル", skill: "25" },
      { name: "弓", skill: "10" },
      { name: "火炎放射器", skill: "1" },
    ],
  },
  {
    cat: "探索",
    items: [
      { name: "目星", skill: "25" },
      { name: "聞き耳", skill: "25" },
      { name: "図書館", skill: "25" },
      { name: "隠す", skill: "15" },
      { name: "隠れる", skill: "10" },
      { name: "忍び歩き", skill: "10" },
    ],
  },
  {
    cat: "行動・運動",
    items: [
      { name: "跳躍", skill: "25" },
      { name: "登攀", skill: "40" },
      { name: "水泳", skill: "25" },
      { name: "運転", skill: "20" },
      { name: "操縦", skill: "1" },
      { name: "ナビゲート", skill: "10" },
      { name: "乗馬", skill: "5" },
      { name: "サバイバル", skill: "10" },
      { name: "重機械操作", skill: "1" },
      { name: "機械修理", skill: "20" },
      { name: "電気修理", skill: "10" },
      { name: "鍵開け", skill: "1" },
      { name: "追跡", skill: "10" },
    ],
  },
  {
    cat: "交渉・言語",
    items: [
      { name: "説得", skill: "15" },
      { name: "言いくるめ", skill: "5" },
      { name: "信用", skill: "15" },
      { name: "値切り", skill: "5" },
      { name: "母国語", skill: "EDU*5" },
      { name: "他の言語", skill: "1" },
    ],
  },
  {
    cat: "医療・知識・専門",
    items: [
      { name: "応急手当", skill: "30" },
      { name: "医学", skill: "5" },
      { name: "精神分析", skill: "1" },
      { name: "薬学", skill: "1" },
      { name: "心理学", skill: "5" },
      { name: "オカルト", skill: "5" },
      { name: "歴史", skill: "20" },
      { name: "クトゥルフ神話", skill: "0" },
      { name: "生物学", skill: "1" },
      { name: "地質学", skill: "1" },
      { name: "化学", skill: "1" },
      { name: "物理学", skill: "1" },
      { name: "天文学", skill: "1" },
      { name: "博物学", skill: "10" },
      { name: "考古学", skill: "1" },
      { name: "人類学", skill: "1" },
      { name: "法律", skill: "5" },
      { name: "経理", skill: "10" },
      { name: "コンピューター", skill: "1" },
      { name: "電子工学", skill: "1" },
      { name: "鑑定", skill: "5" },
      { name: "写真術", skill: "10" },
      { name: "製作", skill: "5" },
      { name: "芸術", skill: "5" },
      { name: "変装", skill: "1" },
      { name: "言語学", skill: "1" },
    ],
  },
];
// ===== 技能欄の並べ替えとチャパレの並べ替えを連動させる =====
// 技能の行が持つ「判定・ダメージ・成功時の続き行」のチャパレ行と、その技能の行要素を対応づける
const BUILTIN_PALETTE_LABELS = new Set(["回避", "アイデア", "幸運", "知識", "正気度ロール"]);
function skillLineOwners() {
  const m = new Map(),
    rows = [...skills.querySelectorAll(".row")];
  rows.forEach((r) => {
    const n = r.querySelector(".skill-name").value.trim(),
      d = r.querySelector(".damage-value").value.trim();
    if (!n && !d) return;
    const k = paletteOrderKey("x 【" + labelWithRefs(n || "ダメージ判定") + "】");
    // 標準で入る行（回避・アイデアなど）と名前が同じ技能は、どちらの行か区別できないので連動の対象にしない
    if (!m.has(k) && !BUILTIN_PALETTE_LABELS.has(n)) m.set(k, r);
  });
  rows.forEach((r) =>
    textLines(r.querySelector(".skill-os-lines")?.value, true).forEach((ln) => {
      const k = paletteOrderKey(ln);
      if (!m.has(k)) m.set(k, r);
    }),
  );
  return m;
}
// チャパレの行の並びから、技能の行の並び（初めて出てくる順）を取り出す
function paletteSkillSeq(lines) {
  const owners = skillLineOwners(),
    seq = [];
  lines.forEach((l) => {
    const r = owners.get(paletteOrderKey(l));
    if (r && !seq.includes(r)) seq.push(r);
  });
  return seq;
}
// チャパレ側で技能の順番を変えたら、技能欄の行も同じ順にする（技能以外の行の位置は変えない）
function applySkillSeqToSkills(seq) {
  const rows = [...skills.children],
    set = new Set(seq),
    slots = [];
  rows.forEach((r, i) => {
    if (set.has(r)) slots.push(i);
  });
  const next = rows.slice();
  slots.forEach((slot, k) => (next[slot] = seq[k]));
  if (next.every((r, i) => r === rows[i])) return false;
  next.forEach((r) => skills.append(r));
  skillOrderCustom = true;
  return true;
}
// 技能欄で順番を変えたら、チャパレの並び替え結果（優先順位）も同じ技能順にする。技能以外の行の位置は変えない
function remapPaletteLinesToSkills(list) {
  const owners = skillLineOwners(),
    rows = [...skills.querySelectorAll(".row")],
    o = list.slice(),
    slots = [],
    items = [];
  o.forEach((l, i) => {
    const r = owners.get(paletteOrderKey(l));
    if (r) {
      slots.push(i);
      items.push({ l, rank: rows.indexOf(r), i });
    }
  });
  items.sort((a, b) => a.rank - b.rank || a.i - b.i);
  slots.forEach((slot, k) => (o[slot] = items[k].l));
  return o;
}
function onSkillOrderChanged() {
  skillOrderCustom = true;
  const has = Array.isArray(paletteOrderOverride) && paletteOrderOverride.length;
  const open = typeof prioritySwitch !== "undefined" && prioritySwitch.checked;
  if (open) {
    paletteOrderDraft = remapPaletteLinesToSkills(paletteOrderDraft);
    selectedPaletteIndices.clear();
    renderPaletteOrderList();
  }
  if (has) paletteOrderOverride = remapPaletteLinesToSkills(paletteOrderOverride);
  if (open && has) paletteOrderOverride = paletteOrderDraft.slice();
  try {
    if (has || open) {
      paletteOutput.value = open ? paletteOrderDraft.join("\n") : generatedPaletteText();
      paletteMode = "manual";
      paletteOrderApplied = true;
    } else if (paletteMode === "generated") regeneratePaletteOutput();
  } catch (e) {}
}
// ===== 技能の並べ替え：チャパレ単体の「優先順位を編集」と同じ操作 =====
// 専用パネルに技能を一覧し、チェックで複数選択、左端の⠿を押したままドラッグするとカードの束として持ち上げて移動する（↑↓ボタンも使える）。
let skillOrderDraft = []; // 並べ替え中の行要素の配列
let skillOrderBefore = [];
let selectedSkillIdx = new Set();
const skillOrderSwitch = document.getElementById("skillOrderSwitch");
const skillOrderPanel = document.getElementById("skillOrderPanel");
const skillOrderList = document.getElementById("skillOrderList");
function skillCatText(r) {
  const c = document.getElementById("skillShowCats");
  if (!c || !c.checked) return "";
  const a = rowCats(r);
  return a.length ? "　［" + a.join("・") + "］" : "　［ラベルなし］";
}
function skillOrderLabel(r) {
  const n = (r.querySelector(".skill-name").value || "").trim(),
    v = (r.querySelector(".skill-value").value || "").trim(),
    d = (r.querySelector(".damage-value").value || "").trim();
  return (n || "（名前なし）") + (v ? "　" + v + (/^\d+$/.test(v) ? "%" : "") : "") + (d ? "　／　" + d : "") + skillCatText(r);
}
// 技能のかたまり：主ラベル（先頭のラベル）ごとに1つ。ラベルのない技能は1件ずつ
let skillViewMode = "items";
let skillBlocksCache = null;
let expandedSkillBlocks = new Set();
function skillBlocks() {
  const seen = new Map(),
    out = [];
  skillOrderDraft.forEach((r) => {
    const cat = rowCats(r)[0];
    if (!cat) return out.push({ key: "", label: "", isCat: false, rows: [r] });
    if (seen.has(cat)) seen.get(cat).rows.push(r);
    else {
      const b = { key: "cat:" + cat, label: cat, isCat: true, rows: [r] };
      seen.set(cat, b);
      out.push(b);
    }
  });
  return out;
}
function ensureSkillsGrouped() {
  const next = [].concat(...skillBlocks().map((b) => b.rows));
  if (next.every((r, i) => r === skillOrderDraft[i])) return false;
  skillOrderDraft = next;
  syncSkillDraft();
  onSkillOrderChanged();
  return true;
}
function moveSkillBlocks(indices, insertionIndex, keep) {
  const r = reorderGroup(skillBlocks(), indices, insertionIndex, keep);
  if (!r) return;
  skillOrderDraft = [].concat(...r.draft.map((b) => b.rows));
  selectedSkillIdx = r.selected;
  syncSkillDraft();
  onSkillOrderChanged();
  renderSkillOrderList();
}
function syncSkillDraft() {
  skillOrderDraft.forEach((r) => skills.append(r));
}
function skillDraftMatchesDom() {
  const cur = [...skills.children];
  return cur.length === skillOrderDraft.length && cur.every((r, i) => r === skillOrderDraft[i]);
}
function moveSkillGroup(indices, insertionIndex, keep) {
  const r = reorderGroup(skillOrderDraft, indices, insertionIndex, keep);
  if (!r) return;
  skillOrderDraft = r.draft;
  selectedSkillIdx = r.selected;
  syncSkillDraft();
  onSkillOrderChanged();
  renderSkillOrderList();
}
function moveSkillLine(from, to) {
  moveOneLine(skillOrderDraft.length, from, to, moveSkillGroup, selectedSkillIdx);
}
function updateSkillSelectionCount() {
  document.getElementById("skillSelectionCount").textContent = selectedSkillIdx.size + "件選択中";
  markSelectionBar(document.getElementById("skillSelectionCount"), selectedSkillIdx.size);
}
function setSkillView(mode) {
  skillViewMode = mode;
  selectedSkillIdx.clear();
  renderSkillOrderList();
}
function renderSkillOrderList() {
  const byCat = skillViewMode === "cats";
  document.getElementById("skillViewItems").classList.toggle("on", !byCat);
  document.getElementById("skillViewCats").classList.toggle("on", byCat);
  document.getElementById("skillViewItems").setAttribute("aria-pressed", String(!byCat));
  document.getElementById("skillViewCats").setAttribute("aria-pressed", String(byCat));
  document.getElementById("skillShowCatsWrap").classList.toggle("hidden", byCat);
  document.getElementById("skillViewHelp").textContent = byCat
    ? "ラベルごとに1つのかたまり。かたまりごと動かせます。複数のラベルがある技能は、★主ラベルに入ります（技能の🏷で変更）。「中身」で技能を確認。"
    : "1件ずつ動かします。「ラベルごと」にすると、同じラベル（戦闘・探索など）の技能がひとかたまりになります。";
  if (byCat) {
    ensureSkillsGrouped();
    skillBlocksCache = skillBlocks();
    renderOrderList({
      list: skillOrderList,
      getDraft: () => skillBlocksCache,
      getSelected: () => selectedSkillIdx,
      updateCount: updateSkillSelectionCount,
      render: renderSkillOrderList,
      itemName: "ラベル",
      makeBody: (b) => {
        const wrap = document.createElement("div");
        wrap.className = "pl-block";
        const head = document.createElement("div");
        head.className = "pl-block-head";
        const t = document.createElement("span");
        t.className = "pl-label" + (b.isCat ? " is-cat" : " none");
        t.textContent = b.isCat ? "［" + b.label + "］" : skillOrderLabel(b.rows[0]);
        head.append(t);
        if (!b.isCat) {
          const n = document.createElement("span");
          n.className = "pl-note";
          n.textContent = "（ラベルなし）";
          head.append(n);
        } else {
          const c = document.createElement("span");
          c.className = "pl-count";
          c.textContent = b.rows.length + "技能";
          head.append(c);
          const open = expandedSkillBlocks.has(b.key);
          const tg = document.createElement("button");
          tg.type = "button";
          tg.className = "pl-toggle";
          tg.textContent = open ? "中身を隠す" : "中身";
          tg.setAttribute("aria-expanded", String(open));
          tg.onclick = () => {
            if (open) expandedSkillBlocks.delete(b.key);
            else expandedSkillBlocks.add(b.key);
            renderSkillOrderList();
          };
          head.append(tg);
        }
        wrap.append(head);
        if (b.isCat && expandedSkillBlocks.has(b.key)) {
          const sub = document.createElement("div");
          sub.className = "pl-sub";
          b.rows.forEach((r) => {
            const code = document.createElement("code");
            const others = rowCats(r).slice(1);
            code.textContent = skillOrderLabel(r) + (others.length ? "（他：" + others.join("・") + "）" : "");
            sub.append(code);
          });
          wrap.append(sub);
        }
        return wrap;
      },
      previewOf: (b) => (b.isCat ? "［" + b.label + "］ " + b.rows.length + "技能" : skillOrderLabel(b.rows[0])),
      moveLine: (from, to) => moveOneLine(skillBlocksCache.length, from, to, moveSkillBlocks, selectedSkillIdx),
      moveGroup: moveSkillBlocks,
      emptyText: "並べ替える技能がありません。",
    });
    skillOrderList.querySelectorAll(".palette-order-item").forEach((el) => el.classList.add("is-block"));
    return;
  }
  renderOrderList({
    list: skillOrderList,
    getDraft: () => skillOrderDraft,
    getSelected: () => selectedSkillIdx,
    updateCount: updateSkillSelectionCount,
    render: renderSkillOrderList,
    itemName: "技能",
    makeBody: (rowEl) => {
      const name = document.createElement("div");
      name.className = "skill-order-name";
      name.textContent = skillOrderLabel(rowEl);
      return name;
    },
    previewOf: skillOrderLabel,
    moveLine: moveSkillLine,
    moveGroup: moveSkillGroup,
    emptyText: "並べ替える技能がありません。",
  });
}
