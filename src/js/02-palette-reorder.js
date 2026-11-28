function reorderGroup(draft, indices, insertionIndex, keep) {
  const valid = [...indices].filter((i) => i >= 0 && i < draft.length).sort((a, b) => a - b);
  if (!valid.length) return null;
  const moving = valid.map((i) => draft[i]);
  const remaining = draft.filter((_, i) => !valid.includes(i));
  const beforeCount = valid.filter((i) => i < insertionIndex).length;
  const insertAt = Math.max(0, Math.min(remaining.length, insertionIndex - beforeCount));
  remaining.splice(insertAt, 0, ...moving);
  if (keep) {
    const order = draft.map((_, i) => i).filter((i) => !valid.includes(i));
    order.splice(insertAt, 0, ...valid);
    return { draft: remaining, selected: new Set(order.map((o, j) => (keep.has(o) ? j : -1)).filter((j) => j >= 0)) };
  }
  return { draft: remaining, selected: new Set(moving.map((_, i) => insertAt + i)) };
}
// 選択バー：選択中は色を変え、「選択解除」を押せる状態にする（バーは画面上部に張り付く）
function markSelectionBar(countEl, n) {
  const bar = countEl.closest(".palette-selection-bar");
  if (!bar) return;
  bar.classList.toggle("has-sel", n > 0);
  const b = bar.querySelector("button");
  if (b) b.disabled = n === 0;
}
// 1件だけ from → to へ動かす（↑↓ボタン用）。選択状態は変えない
function moveOneLine(length, from, to, moveGroup, sel) {
  if (from < 0 || to < 0 || from >= length || to >= length || from === to) return;
  moveGroup(new Set([from]), to > from ? to + 1 : to, sel || new Set());
}
// 並べ替えリストの描画。各行に「選択・つかむ印・本文・↑↓」を並べ、つかんで束ごと動かせるようにする。
// o: { list, getDraft, getSelected, updateCount, render, itemName, makeBody, previewOf, moveLine, moveGroup, emptyText }
function renderOrderList(o) {
  const list = o.list;
  list.innerHTML = "";
  o.updateCount();
  o.getDraft().forEach((entry, index) => {
    const item = document.createElement("div");
    item.className = "palette-order-item";
    item.dataset.index = String(index);
    if (o.getSelected().has(index)) item.classList.add("is-selected");
    const select = document.createElement("input");
    select.type = "checkbox";
    select.className = "palette-select";
    select.checked = o.getSelected().has(index);
    select.setAttribute("aria-label", index + 1 + "番目の" + o.itemName + "を選択");
    select.addEventListener("change", () => {
      if (select.checked) o.getSelected().add(index);
      else o.getSelected().delete(index);
      o.render();
    });
    const drag = document.createElement("div");
    drag.className = "palette-drag";
    drag.textContent = "⠿";
    drag.setAttribute("aria-label", "選択項目を持ち上げて移動");
    drag.style.textAlign = "center";
    const actions = document.createElement("div");
    actions.className = "palette-order-actions";
    const up = document.createElement("button");
    up.type = "button";
    up.textContent = "↑";
    up.disabled = index === 0;
    up.setAttribute("aria-label", "上へ移動");
    up.onclick = () => o.moveLine(index, index - 1);
    const down = document.createElement("button");
    down.type = "button";
    down.textContent = "↓";
    down.disabled = index === o.getDraft().length - 1;
    down.setAttribute("aria-label", "下へ移動");
    down.onclick = () => o.moveLine(index, index + 1);
    actions.append(up, down);
    item.append(select, drag, o.makeBody(entry), actions);
    list.append(item);
    let dragging = false,
      dropIndex = index,
      floatEl = null,
      grabOffsetX = 0,
      grabOffsetY = 0,
      dragIndices = [],
      markerEl = null;
    const markDragging = (on) =>
      dragIndices.forEach((i) => {
        const el = list.querySelector('[data-index="' + i + '"]');
        if (el) el.classList.toggle("is-dragging", on);
      });
    const clearTargets = () => {
      if (markerEl) {
        markerEl.remove();
        markerEl = null;
      }
    };
    const onMove = (e) => {
      if (!dragging) return;
      if (floatEl) {
        floatEl.style.left = e.clientX - grabOffsetX + "px";
        floatEl.style.top = e.clientY - grabOffsetY - 13 + "px";
      }
      clearTargets();
      const remainingItems = [...list.querySelectorAll(".palette-order-item")].filter(
        (el) => !dragIndices.includes(Number(el.dataset.index)),
      );
      markerEl = document.createElement("div");
      markerEl.className = "palette-insertion-marker";
      markerEl.setAttribute("aria-hidden", "true");
      const before = remainingItems.find((el) => {
        const rect = el.getBoundingClientRect();
        return e.clientY < rect.top + rect.height / 2;
      });
      if (before) {
        dropIndex = Number(before.dataset.index);
        list.insertBefore(markerEl, before);
      } else {
        dropIndex = o.getDraft().length;
        list.append(markerEl);
      }
      const edge = 92,
        speed = Math.max(5, Math.min(24, (edge - Math.min(e.clientY, window.innerHeight - e.clientY)) / 3));
      if (e.clientY < edge) window.scrollBy(0, -speed);
      else if (e.clientY > window.innerHeight - edge) window.scrollBy(0, speed);
      e.preventDefault();
    };
    const finish = () => {
      if (!dragging) return;
      dragging = false;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
      if (floatEl) floatEl.remove();
      floatEl = null;
      markDragging(false);
      clearTargets();
      if (dropIndex >= 0) o.moveGroup(new Set(dragIndices), dropIndex);
    };
    // 左端のハンドルを操作したときだけドラッグ。選択済みならその全件を一つの束として運ぶ。
    drag.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      const selected = o.getSelected();
      dragIndices = selected.has(index) && selected.size > 1 ? [...selected].sort((a, b) => a - b) : [index];
      if (!selected.has(index)) {
        selected.clear();
        selected.add(index);
      }
      dragging = true;
      dropIndex = -1;
      const r = item.getBoundingClientRect();
      grabOffsetX = e.clientX - r.left;
      grabOffsetY = e.clientY - r.top;
      floatEl = document.createElement("div");
      floatEl.className = "palette-drag-stack";
      floatEl.style.width = r.width + "px";
      floatEl.style.height = Math.max(48, r.height) + "px";
      floatEl.style.left = e.clientX - grabOffsetX + "px";
      floatEl.style.top = e.clientY - grabOffsetY - 13 + "px";
      dragIndices.slice(-3).forEach((i) => {
        const card = document.createElement("div");
        card.className = "stack-card";
        const c = document.createElement("code");
        c.textContent = o.previewOf(o.getDraft()[i]);
        card.append(c);
        floatEl.append(card);
      });
      const count = document.createElement("div");
      count.className = "stack-count";
      count.textContent = dragIndices.length;
      floatEl.append(count);
      document.body.append(floatEl);
      markDragging(true);
      o.updateCount();
      window.addEventListener("pointermove", onMove, { passive: false });
      window.addEventListener("pointerup", finish);
      window.addEventListener("pointercancel", finish);
      e.preventDefault();
    });
  });
  if (!o.getDraft().length) {
    const p = document.createElement("p");
    p.className = "hint";
    p.textContent = o.emptyText;
    list.append(p);
  }
}
// チャパレ順序編集。複数選択した項目をカードの束として持ち上げて移動する。
let paletteOrderDraft = [];
let paletteOrderBeforeEdit = [];
let selectedPaletteIndices = new Set();
const prioritySwitch = document.getElementById("priorityEditSwitch");
const paletteOrderPanel = document.getElementById("paletteOrderPanel");
const paletteOrderList = document.getElementById("paletteOrderList");
const paletteSelectionCount = document.getElementById("paletteSelectionCount");
// チャパレ単体用（数値入り）の行は、JSON（ココフォリア）では {技能名} の参照に戻す。手で変えた行はそのまま残す
function jsonizePalette(text) {
  try {
    const o = { includeSkillValueComments: false, allowInvalidDamage: true },
      split = (t) => textLines(t);
    const sa = split(makeData({ ...o, standalonePalette: true }).data.commands),
      sb = split(makeData({ ...o, standalonePalette: true }).data.commands),
      js = split(makeData(o).data.commands);
    if (sa.length !== js.length || sb.length !== sa.length) return text;
    const lab = (l) => (l.match(/【[^【]*】\s*$/) || [""])[0],
      norm = (l) => l.trim().replace(/\d+/g, "#");
    const exact = new Map(),
      loose = new Map();
    for (let i = 0; i < sa.length; i++) {
      if (lab(sa[i]) !== lab(js[i])) return text;
      if (!exact.has(sa[i].trim())) exact.set(sa[i].trim(), js[i]);
      // 振るたびに数字が変わる行（ダイス技能など）は、数字を無視して同じ行とみなす
      if (sa[i] !== sb[i] && !loose.has(norm(sa[i]))) loose.set(norm(sa[i]), js[i]);
    }
    return mapLines(text, (l) => (exact.has(l.trim()) ? exact.get(l.trim()) : loose.has(norm(l)) ? loose.get(norm(l)) : l));
  } catch (e) {
    return text;
  }
}
// フォームの内容から、チャパレ単体用（数値入り）の文章を作る
function generatedPaletteText() {
  return orderPaletteLines(textLines(makeData({ includeSkillValueComments: false, standalonePalette: true }).data.commands)).join("\n");
}
// チャパレ欄を作り直し、並べ替え済みなら「手動」扱いにする
function regeneratePaletteOutput() {
  paletteOutput.value = generatedPaletteText();
  paletteMode = paletteOrderOverride ? "manual" : "generated";
  paletteOrderApplied = !!paletteOrderOverride;
}
// 手で直したチャパレ（数値入り）を、JSON用に {技能名} の参照へ戻し、追加コマンドを足す
function manualPaletteCommands(customPalette) {
  return [jsonizePalette(customPalette), document.getElementById("extraPaletteCommands").value.trim()].filter(Boolean).join("\n");
}
// 画面のチャパレ欄の状態（並べ替え・手動編集）を反映した、書き出し用データを作る
function makeDataWithPalette() {
  const customPalette = paletteOutput.value;
  const data = makeData({
    allowInvalidDamage: !!customPalette.trim(),
    preserveFormulas: document.getElementById("preserveFormulas").checked,
  });
  if (paletteOrderOverride && paletteOrderOverride.length) {
    data.data.commands = orderPaletteLines(textLines(data.data.commands)).join("\n");
  } else if (customPalette.trim() && paletteOrderApplied) data.data.commands = jsonizePalette(customPalette);
  else if (customPalette.trim() && paletteMode === "manual") data.data.commands = manualPaletteCommands(customPalette);
  data.data.commands = addPaletteHeadings(data.data.commands);
  return data;
}
function currentPaletteLines() {
  let text = paletteOutput.value.trim();
  if (!text) {
    try {
      text = makeData({ standalonePalette: true }).data.commands;
    } catch (e) {
      return [];
    }
  }
  return textLines(text, true);
}
function syncPaletteDraft() {
  paletteOrderOverride = paletteOrderDraft.slice();
  paletteOutput.value = paletteOrderDraft.join("\n");
  paletteMode = "manual";
  paletteOrderApplied = true;
}
function updatePaletteSelectionCount() {
  paletteSelectionCount.textContent = selectedPaletteIndices.size + "件選択中";
  markSelectionBar(paletteSelectionCount, selectedPaletteIndices.size);
}
function movePaletteGroup(indices, insertionIndex, keep) {
  const r = reorderGroup(paletteOrderDraft, indices, insertionIndex, keep);
  if (!r) return;
  const seqBefore = paletteSkillSeq(paletteOrderDraft);
  paletteOrderDraft = r.draft;
  selectedPaletteIndices = r.selected;
  syncPaletteDraft();
  // 技能の行の順番が変わったときだけ、技能欄の並びも同じにする
  const seqAfter = paletteSkillSeq(paletteOrderDraft);
  if (seqBefore.some((x, i) => x !== seqAfter[i])) applySkillSeqToSkills(seqAfter);
  renderPaletteOrderList();
}
function movePaletteLine(from, to) {
  moveOneLine(paletteOrderDraft.length, from, to, movePaletteGroup, selectedPaletteIndices);
}
// 並べ替えの単位：lines＝1行ずつ / cats＝技能のラベル（分類）ごと / names＝同じ【名前】ごと
let paletteViewMode = "lines";
function paletteLabelOnly() {
  return paletteViewMode !== "lines";
}
// 同じラベルの行が何行あるか（ラベルのない行は数えない）
function paletteLabelCounts(list) {
  const m = new Map();
  (list || paletteOrderDraft).forEach((l) => {
    if (!labelOfLine(l)) return;
    const k = paletteOrderKey(l);
    m.set(k, (m.get(k) || 0) + 1);
  });
  return m;
}
function updatePaletteLabelInfo() {
  const info = document.getElementById("paletteLabelInfo");
  if (!info) return;
  const dup = [...paletteLabelCounts()].filter(([, n]) => n > 1),
    exact = paletteOrderDraft.length - new Set(paletteOrderDraft.map((l) => l.trim())).size;
  const label = (k) => paletteOrderDraft.map(labelOfLine).find((x) => "label:" + x.replace(/\s+/g, " ").toLocaleLowerCase() === k) || k;
  info.textContent =
    (paletteLabelOnly()
      ? (paletteBlocksCache || paletteBlocks()).length + "個のかたまり（" + paletteOrderDraft.length + "行）。"
      : dup.length
        ? "同じラベルが複数ある行：" + dup.map(([k, n]) => "【" + label(k) + "】" + n + "行").join("、") + "。"
        : "同じラベルの行はありません。") + (exact > 0 ? "完全に同じ行が" + exact + "行重なっています。" : "");
}
// 並びを置き換える（技能の順番が変わったときは、技能欄にも反映する）
function setPaletteDraft(next) {
  const before = paletteSkillSeq(paletteOrderDraft);
  paletteOrderDraft = next;
  selectedPaletteIndices.clear();
  syncPaletteDraft();
  const after = paletteSkillSeq(paletteOrderDraft);
  if (before.some((x, i) => x !== after[i])) applySkillSeqToSkills(after);
  renderPaletteOrderList();
}
// 「かたまり」：同じラベル（分類）や同じ【名前】の行を一つにして、最初に出てくる位置に置く。
let expandedLabelBlocks = new Set();
let paletteBlocksCache = null;
// チャパレの行 → 技能の行（標準の行と名前が重なるものも含めて、名前で探す）
function paletteLineRowMap() {
  const m = new Map();
  skills.querySelectorAll(".row").forEach((r) => {
    const n = r.querySelector(".skill-name").value.trim();
    if (!n) return;
    const k = paletteOrderKey("x 【" + labelWithRefs(n) + "】");
    if (!m.has(k)) m.set(k, r);
  });
  skillLineOwners().forEach((r, k) => m.set(k, r));
  return m;
}
function paletteBlocks(list, mode) {
  mode = mode || paletteViewMode;
  const seen = new Map(),
    out = [],
    rowMap = mode === "cats" ? paletteLineRowMap() : null;
  (list || paletteOrderDraft).forEach((l) => {
    const lab = labelOfLine(l),
      k = lab ? paletteOrderKey(l) : "",
      row = rowMap && k ? rowMap.get(k) : null,
      cat = row ? rowCats(row)[0] : "";
    if (!lab) return out.push({ key: "", label: "", lines: [l], rows: [] });
    const key = cat ? "cat:" + cat : k;
    if (seen.has(key)) {
      const b = seen.get(key);
      b.lines.push(l);
      if (row && !b.rows.includes(row)) b.rows.push(row);
    } else {
      const b = { key, label: cat || lab, isCat: !!cat, lines: [l], rows: row ? [row] : [] };
      seen.set(key, b);
      out.push(b);
    }
  });
  return out;
}
function flattenBlocks(blocks) {
  return [].concat(...blocks.map((b) => b.lines));
}
// 「ラベルごと」などのとき、同じかたまりの行がばらけていたら実際の並びも隣にそろえる
function ensurePaletteGrouped() {
  const next = flattenBlocks(paletteBlocks());
  if (next.every((l, i) => l === paletteOrderDraft[i])) return false;
  const before = paletteSkillSeq(paletteOrderDraft);
  paletteOrderDraft = next;
  syncPaletteDraft();
  const after = paletteSkillSeq(paletteOrderDraft);
  if (before.some((x, i) => x !== after[i])) applySkillSeqToSkills(after);
  return true;
}
function movePaletteBlocks(indices, insertionIndex, keep) {
  const blocks = paletteBlocks(),
    r = reorderGroup(blocks, indices, insertionIndex, keep);
  if (!r) return;
  const before = paletteSkillSeq(paletteOrderDraft);
  paletteOrderDraft = flattenBlocks(r.draft);
  selectedPaletteIndices = r.selected;
  syncPaletteDraft();
  const after = paletteSkillSeq(paletteOrderDraft);
  if (before.some((x, i) => x !== after[i])) applySkillSeqToSkills(after);
  renderPaletteOrderList();
}
function setPaletteView(mode) {
  paletteViewMode = mode;
  selectedPaletteIndices.clear();
  renderPaletteOrderList();
}
const PALETTE_VIEW_BTNS = { lines: "viewLines", cats: "viewCats", names: "viewNames" };
const PALETTE_VIEW_HELP = {
  lines: "1行ずつ動かします。「ラベルごと」にすると、同じラベル（戦闘・探索など）の技能がひとかたまりになります。",
  cats: "ラベルごとに1つのかたまり。かたまりごと動かせます。複数のラベルがある技能は、★主ラベルに入ります（技能の🏷で変更）。「中身」で行を確認。",
  names: "同じ【名前】の行（例：【こぶし】の判定とダメージ）を1つにまとめます。",
};
function renderPaletteOrderList() {
  const byLabel = paletteLabelOnly();
  Object.entries(PALETTE_VIEW_BTNS).forEach(([m, id]) => {
    const b = document.getElementById(id);
    b.classList.toggle("on", m === paletteViewMode);
    b.setAttribute("aria-pressed", String(m === paletteViewMode));
  });
  document.getElementById("labelViewHelp").textContent = PALETTE_VIEW_HELP[paletteViewMode];
  if (byLabel) ensurePaletteGrouped();
  paletteBlocksCache = byLabel ? paletteBlocks() : null;
  updatePaletteLabelInfo();
  if (byLabel) {
    renderOrderList({
      list: paletteOrderList,
      getDraft: () => paletteBlocksCache,
      getSelected: () => selectedPaletteIndices,
      updateCount: updatePaletteSelectionCount,
      render: renderPaletteOrderList,
      itemName: "ラベル",
      makeBody: (b) => {
        const wrap = document.createElement("div");
        wrap.className = "pl-block";
        const head = document.createElement("div");
        head.className = "pl-block-head";
        const t = document.createElement("span");
        t.className = "pl-label" + (b.label ? "" : " none") + (b.isCat ? " is-cat" : "");
        const one = b.lines[0];
        t.textContent = b.label ? (b.isCat ? "［" + b.label + "］" : "【" + b.label + "】") : one.length > 26 ? one.slice(0, 26) + "…" : one;
        head.append(t);
        if (!b.label) {
          const n = document.createElement("span");
          n.className = "pl-note";
          n.textContent = "（ラベルなし）";
          head.append(n);
        }
        if (b.lines.length > 1) {
          const c = document.createElement("span");
          c.className = "pl-count";
          c.textContent = (b.isCat && b.rows.length > 1 ? b.rows.length + "技能・" : "") + b.lines.length + "行";
          head.append(c);
        }
        if (b.label && (b.isCat || b.lines.length > 1)) {
          const open = expandedLabelBlocks.has(b.key);
          const tg = document.createElement("button");
          tg.type = "button";
          tg.className = "pl-toggle";
          tg.textContent = open ? "中身を隠す" : "中身";
          tg.setAttribute("aria-expanded", String(open));
          tg.onclick = () => {
            if (open) expandedLabelBlocks.delete(b.key);
            else expandedLabelBlocks.add(b.key);
            renderPaletteOrderList();
          };
          head.append(tg);
        }
        wrap.append(head);
        if (b.label && (b.isCat || b.lines.length > 1) && expandedLabelBlocks.has(b.key)) {
          const sub = document.createElement("div");
          sub.className = "pl-sub";
          b.lines.forEach((l) => {
            const code = document.createElement("code");
            code.textContent = l;
            sub.append(code);
          });
          wrap.append(sub);
        }
        return wrap;
      },
      previewOf: (b) => (b.label ? (b.isCat ? "［" + b.label + "］" : "【" + b.label + "】") + (b.lines.length > 1 ? " " + b.lines.length + "行" : "") : b.lines[0]),
      moveLine: (from, to) => moveOneLine(paletteBlocksCache.length, from, to, movePaletteBlocks, selectedPaletteIndices),
      moveGroup: movePaletteBlocks,
      emptyText: "並べ替えるコマンドがありません。先にチャットパレットを生成してください。",
    });
    paletteOrderList.querySelectorAll(".palette-order-item").forEach((el) => el.classList.add("is-block"));
    return;
  }
  renderOrderList({
    list: paletteOrderList,
    getDraft: () => paletteOrderDraft,
    getSelected: () => selectedPaletteIndices,
    updateCount: updatePaletteSelectionCount,
    render: renderPaletteOrderList,
    itemName: "コマンド",
    makeBody: (line) => {
      const wrap = document.createElement("div");
      wrap.className = "pl-body";
      const lab = labelOfLine(line);
      const code = document.createElement("code");
      code.textContent = line;
      wrap.append(code);
      const dup = paletteLabelCounts().get(paletteOrderKey(line));
      if (dup > 1 && lab) {
        const b = document.createElement("span");
        b.className = "pl-dup";
        b.textContent = "同名×" + dup;
        b.title = "同じラベルの行が" + dup + "行あります";
        wrap.append(b);
      }
      return wrap;
    },
    previewOf: (line) => line,
    moveLine: movePaletteLine,
    moveGroup: movePaletteGroup,
    emptyText: "並べ替えるコマンドがありません。先にチャットパレットを生成してください。",
  });
}
