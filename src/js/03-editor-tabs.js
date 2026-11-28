// ===== 編集画面のタブ（基本／能力値／技能／出力）と、右下のクイックメニュー =====
const EDITOR_TABS = [
  { id: "basic", label: "基本", heads: ["所属グループ", "基本キャラ情報"] },
  { id: "stats", label: "能力値", heads: ["基本能力値", "基本ステータス", "追加ステータス"] },
  { id: "skills", label: "技能", heads: ["技能・ダメージ"] },
  { id: "out", label: "出力", heads: ["追加チャパレコマンド", "チャットパレット単体", "出力"] },
];
let editorTab = "basic";
function editorTabsOn() {
  try {
    return localStorage.getItem("trpg_editor_tabs") !== "0";
  } catch (e) {
    return true;
  }
}
function tabOfSection(sec) {
  const h = sec.querySelector("h2"),
    t = h ? h.textContent.trim() : "";
  const f = EDITOR_TABS.find((x) => x.heads.some((k) => t.startsWith(k)));
  return f ? f.id : "";
}
function editorSections() {
  return [...document.querySelectorAll("#editorView > section")];
}
// いま操作の対象になっているタブ。タブ表示ONなら開いているタブ、OFFなら画面の上のほうに見えているセクションのタブ
function activeTab() {
  if (document.body.classList.contains("tabs-on")) return editorTab;
  const probe = window.innerHeight * 0.3;
  let cur = "",
    first = "";
  for (const sec of editorSections()) {
    const id = tabOfSection(sec);
    if (!id || !sec.offsetParent) continue;
    if (!first) first = id;
    if (sec.getBoundingClientRect().top <= probe) cur = id;
    else break;
  }
  return cur || first || editorTab;
}
function updateEditorTabCounts() {
  const b = document.querySelector('#editorTabs button[data-tab="skills"] .tab-n');
  if (b) b.textContent = String(document.getElementById("skills").querySelectorAll(".row").length);
}
function updateTabsH() {
  const t = document.getElementById("editorTabs");
  if (t && t.offsetHeight) document.documentElement.style.setProperty("--tabs-h", t.offsetHeight + "px");
}
window.addEventListener("resize", updateTabsH);
function applyEditorTabs() {
  const on = editorTabsOn();
  document.body.classList.toggle("tabs-on", on);
  const lab = document.getElementById("editorTabsToggleLabel");
  if (lab) lab.textContent = on ? "タブ表示：ON" : "タブ表示：OFF";
  editorSections().forEach((sec) => sec.classList.toggle("tab-off", on && tabOfSection(sec) !== editorTab));
  document.querySelectorAll("#editorTabs button").forEach((b) => {
    b.classList.toggle("on", b.dataset.tab === editorTab);
    b.setAttribute("aria-selected", String(b.dataset.tab === editorTab));
  });
  updateEditorTabCounts();
  closeQuickPanel();
  renderQuickPanel();
  updateQuickFabState();
  updateTabsH();
}
function showEditorTab(id, keepScroll) {
  if (!EDITOR_TABS.some((t) => t.id === id)) return;
  editorTab = id;
  applyEditorTabs();
  if (!keepScroll) window.scrollTo({ top: 0 });
}
// 別のタブにある場所へ移動しようとしたら、そのタブを先に開く（エラーからの移動・検索ジャンプなど）
function ensureTabFor(el) {
  if (!document.body.classList.contains("tabs-on") || !document.body.classList.contains("editor-mode")) return;
  const sec = el && el.closest ? el.closest("#editorView > section") : null;
  if (sec && sec.classList.contains("tab-off")) showEditorTab(tabOfSection(sec), true);
}
(() => {
  const sv = Element.prototype.scrollIntoView;
  Element.prototype.scrollIntoView = function (...a) {
    ensureTabFor(this);
    return sv.apply(this, a);
  };
  const fc = HTMLElement.prototype.focus;
  HTMLElement.prototype.focus = function (...a) {
    ensureTabFor(this);
    return fc.apply(this, a);
  };
})();
(() => {
  const nav = document.createElement("nav");
  nav.id = "editorTabs";
  nav.setAttribute("role", "tablist");
  nav.setAttribute("aria-label", "編集する内容");
  EDITOR_TABS.forEach((t) => {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.tab = t.id;
    b.setAttribute("role", "tab");
    b.append(t.label);
    if (t.id === "skills") {
      const n = document.createElement("span");
      n.className = "tab-n";
      b.append(n);
    }
    b.onclick = () => showEditorTab(t.id);
    nav.append(b);
  });
  const view = document.getElementById("editorView");
  view.insertBefore(nav, document.getElementById("editingBar").nextSibling);
  new MutationObserver(updateEditorTabCounts).observe(document.getElementById("skills"), { childList: true });
  document.getElementById("editorTabsToggle").onclick = () => {
    try {
      localStorage.setItem("trpg_editor_tabs", editorTabsOn() ? "0" : "1");
    } catch (e) {}
    applyEditorTabs();
    document.getElementById("editorMenu").classList.add("hidden");
    document.getElementById("editorMore").setAttribute("aria-expanded", "false");
    message.textContent = editorTabsOn() ? "タブ表示にしました。" : "タブをやめて、1画面にまとめて表示します。";
  };
})();

// 右下のクイックメニュー：いま開いているタブに合う操作を並べる
function quickClick(id) {
  const el = document.getElementById(id);
  if (el) el.click();
}
function quickFocus(el) {
  if (!el) return;
  el.scrollIntoView({ block: "center", behavior: "smooth" });
  setTimeout(() => el.focus({ preventScroll: true }), 250);
}
// ホーム画面用の円形メニュー（配置の変更は未対応。初期配置のみ）
function homeActions() {
  return [
    { id: "h-new", label: "新規キャラクター", ic: "plus", primary: true, run: () => quickClick("newCharacter") },
    { id: "h-find", label: "検索", ic: "search", run: () => quickFocus(document.getElementById("homeSearch")) },
    { id: "h-group", label: "グループを作成", ic: "users", run: () => quickClick("homeCreateGroup") },
    { id: "h-backup", label: "バックアップ", ic: "save", run: () => quickClick("backupAll") },
    { id: "h-restore", label: "読み込み", ic: "import", run: () => quickClick("restoreAll") },
    { id: "h-bulk", label: "まとめて選択", ic: "check", run: () => quickClick("bulkToggle") },
    { id: "h-radial", label: "円形メニューの設定", ic: "gear", run: () => openRadialSettings() },
    { id: "top", label: "先頭へ", ic: "arrowUp", run: () => window.scrollTo({ top: 0, behavior: "smooth" }) },
  ];
}
function quickActions(tabId) {
  if (tabId === "home") return homeActions();
  const out = [];
  const tb = tabId || activeTab();
  if (tb === "skills") {
    out.push({
      id: "add",
      label: "技能を追加",
      ic: "plus",
      primary: true,
      run: () => {
        addSkillHere();
        const rows = skills.querySelectorAll(".row"),
          last = rows[rows.length - 1];
        if (last) quickFocus(last.querySelector(".skill-name"));
      },
    });
    out.push({ id: "preset", label: "基本技能を適用", ic: "gear", run: () => quickClick("openPresetDialog") });
    out.push({ id: "favs", label: "お気に入りセット", ic: "star", run: () => quickClick("openSkillSets") });
    out.push({ id: "find", label: "技能を探す", ic: "search", run: () => quickFocus(document.getElementById("skillSearch")) });
    out.push({ id: "labels", label: "ラベルで絞り込み" + (skillCatFilter ? "（" + skillCatFilter + "）" : "") + " ›", ic: "tag", active: !!skillCatFilter, keepOpen: true, run: () => renderQuickPanel("labels") });
    const orderOn = !!(document.getElementById("skillOrderSwitch") || {}).checked;
    out.push({
      id: "order",
      label: orderOn ? "並べ替え中（押すと終了）" : "並べ替えを編集",
      ic: orderOn ? "check" : "sortUD",
      active: orderOn,
      run: () => {
        const sw = document.getElementById("skillOrderSwitch");
        if (!sw) return;
        sw.checked = !sw.checked;
        sw.dispatchEvent(new Event("change"));
        if (sw.checked) document.getElementById("skillOrderPanel").scrollIntoView({ block: "start", behavior: "smooth" });
        else window.scrollTo({ top: 0, behavior: "smooth" });
        message.textContent = sw.checked ? "並べ替え編集をはじめました。もう一度押すと終了します。" : "並べ替え編集を終了しました。";
      },
    });
  } else if (tb === "stats") {
    out.push({ id: "roll", label: "3d6で能力値を振る", ic: "dice", primary: true, run: () => quickClick("rollStats") });
    out.push({ id: "extra", label: "ステータスを追加", ic: "plus", run: () => quickClick("addExtra") });
    out.push({ id: "derived", label: "まとめて適用", ic: "derive", run: () => quickClick("applyDerived") });
  } else if (tb === "out") {
    out.push({ id: "json", label: "JSON生成", ic: "derive", primary: true, run: () => quickClick("generate") });
    out.push({ id: "copy", label: "JSONコピー", ic: "copy", run: () => quickClick("copy") });
    out.push({ id: "palette", label: "チャパレ生成", ic: "dice", run: () => quickClick("generatePalette") });
  }
  out.push({ id: "growth", label: "成長記録", ic: "growth", run: () => quickClick("openGrowth") });
  out.push({ id: "viewer", label: "閲覧で見る", ic: "eye", run: () => quickClick("openViewerFromEditor") });
  out.push({ id: "guide", label: "やりたいこと一覧", ic: "compass", run: () => openGuide() });
  out.push({ id: "top", label: "先頭へ", ic: "arrowUp", run: () => window.scrollTo({ top: 0, behavior: "smooth" }) });
  return out;
}
function updateQuickFabState() {
  const fab = document.getElementById("quickFab");
  if (!fab) return;
  const on = !!(document.getElementById("skillOrderSwitch") || {}).checked;
  fab.classList.toggle("mode-on", on);
  fab.setAttribute("aria-label", on ? "クイック操作を開く（並べ替え編集中）" : "クイック操作を開く");
}
function closeQuickPanel() {
  const pnl = document.getElementById("quickPanel"),
    fab = document.getElementById("quickFab");
  if (pnl) pnl.classList.add("hidden");
  const dk = document.getElementById("quickDock");
  if (dk) dk.classList.remove("is-open");
  if (fab) {
    fab.textContent = "☰";
    fab.setAttribute("aria-expanded", "false");
  }
}
// パソコン（マウス操作で画面が広いとき）だけ、右クリックした場所に円形（放射状）のメニューを出す
function quickRadialOn() {
  try {
    return window.matchMedia("(hover: hover) and (pointer: fine) and (min-width: 820px)").matches;
  } catch (e) {
    return false;
  }
}
// 押している間だけメニューが出て、離した向きの項目が選ばれる（中央の小さな円の中は「選ばない」）。
// 中央で離すと開いたままになり、あとから向きをクリックしても選べる。
let ctxState = null;
let ctxSuppress = false;
let ctxSuppressTimer = 0;
const CTX_DEAD = 34;
const CTX_ARM = 24; // 押した場所からこれだけ動くまでは、何も選ばない
const CTX_TOL = 40; // 向きがこの角度より離れた方向は、選ばない（空きの位置）
// 12方向の固定の位置（時計の文字盤：0＝真上）。どのタブでも、共通の操作は同じ向きに出る
const CTX_COMMON_SLOT = { top: 0, viewer: 4, guide: 6, growth: 8 };
const CTX_SPECIFIC_SLOTS = [1, 2, 3, 11, 10, 9, 5, 7]; // タブごとの操作は、ここから順に使う
function ctxLayout(acts) {
  const used = new Set(Object.values(CTX_COMMON_SLOT));
  const free = CTX_SPECIFIC_SLOTS.filter((x) => !used.has(x));
  let k = 0;
  const items = [];
  acts.forEach((a) => {
    if (a.id in CTX_COMMON_SLOT) items.push({ a, slot: CTX_COMMON_SLOT[a.id] });
    else if (k < free.length) items.push({ a, slot: free[k++] });
  });
  return items;
}
// ----- 各タブへ移動する操作と、全操作の一覧（カスタム設定で使う） -----
function jumpActions() {
  const defs = [
    ["basic", "基本へ移動", "user"],
    ["stats", "能力値へ移動", "bars"],
    ["skills", "技能へ移動", "list"],
    ["out", "出力へ移動", "outbox"],
  ];
  return defs.map(([t, label, ic]) => ({
    id: "go:" + t,
    label,
    ic,
    run: () => {
      if (document.body.classList.contains("tabs-on")) showEditorTab(t);
      else {
        const sec = editorSections().find((x) => tabOfSection(x) === t);
        if (sec) sec.scrollIntoView({ block: "start", behavior: "smooth" });
      }
    },
  }));
}
function allQuickActions() {
  const m = new Map(),
    home = new Map();
  EDITOR_TABS.forEach((t) =>
    quickActions(t.id).forEach((a) => {
      if (!m.has(a.id)) {
        m.set(a.id, a);
        home.set(a.id, t.id);
      }
    }),
  );
  jumpActions().forEach((a) => m.set(a.id, a));
  return { map: m, home };
}
const CTX_LAYOUT_KEY = "trpg_ctx_layout";
function ctxCustomLoad() {
  try {
    const o = JSON.parse(localStorage.getItem(CTX_LAYOUT_KEY) || "{}");
    return o && typeof o === "object" ? o : {};
  } catch (e) {
    return {};
  }
}
function ctxCustomSave(o) {
  try {
    localStorage.setItem(CTX_LAYOUT_KEY, JSON.stringify(o));
  } catch (e) {}
}
// そのタブの、位置→操作ID。カスタム設定があればそれ、なければ初期配置
function ctxDefaultMap(tabId) {
  const m = {};
  ctxLayout(quickActions(tabId)).forEach((x) => (m[x.slot] = x.a.id));
  return m;
}
function ctxMapFor(tabId) {
  const c = ctxCustomLoad()[tabId];
  return c && typeof c === "object" ? c : ctxDefaultMap(tabId);
}
function ctxItemsFor(tabId) {
  if (String(tabId).indexOf("card:") === 0) return ctxLayout(cardRadialActions(String(tabId).slice(5)));
  if (tabId === "home") return ctxLayout(homeActions());
  const { map } = allQuickActions();
  const m = ctxMapFor(tabId);
  const items = [];
  Object.keys(m).forEach((k) => {
    const slot = Number(k),
      a = map.get(m[k]);
    if (a && slot >= 0 && slot < 12) items.push({ a, slot });
  });
  return items;
}
function ctxRemove() {
  const c = document.getElementById("ctxRadial");
  if (c) c.remove();
  window.removeEventListener("mousemove", ctxMove, true);
  window.removeEventListener("mouseup", ctxUp, true);
  document.body.classList.remove("ctx-nosel");
  ctxState = null;
}
function closeCtxRadial() {
  ctxRemove();
}
function ctxPick(px, py) {
  const st = ctxState;
  if (!st) return -1;
  if (!st.armed) {
    if (Math.hypot(px - st.x, py - st.y) < CTX_ARM) return -1;
    st.armed = true;
  }
  // 向きは、メニューの中心から見る（画面の端で中心が内側に寄っていても、全方向に届く）
  const dx = px - st.cx,
    dy = py - st.cy;
  if (Math.hypot(dx, dy) < CTX_DEAD) return -1;
  const a = Math.atan2(dy, dx);
  let best = -1,
    bd = (CTX_TOL * Math.PI) / 180;
  st.angles.forEach((th, i) => {
    const d = Math.abs(((a - th + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);
    if (d <= bd) {
      bd = d;
      best = i;
    }
  });
  return best;
}
function ctxSetHot(i) {
  const st = ctxState;
  if (!st || st.hot === i) return;
  st.hot = i;
  st.btns.forEach((b, k) => b.classList.toggle("hot", k === i));
  st.cap.textContent = i >= 0 ? st.acts[i].label : st.defCap;
  if (i >= 0) {
    const half = 15,
      deg = (st.angles[i] * 180) / Math.PI + 90;
    st.wedge.style.background = "conic-gradient(from " + (deg - half) + "deg, rgba(143,160,255,0.5) 0 " + half * 2 + "deg, transparent 0)";
    st.wedge.style.opacity = "1";
  } else st.wedge.style.opacity = "0";
}
function ctxChoose(i) {
  const st = ctxState;
  if (!st) return;
  const a = i >= 0 ? st.acts[i] : null;
  ctxRemove();
  if (a) {
    if (a.keepOpen && document.getElementById("quickPanel").classList.contains("hidden")) document.getElementById("quickFab").click();
    a.run();
  }
}
function ctxMove(e) {
  if (ctxState) ctxSetHot(ctxPick(e.clientX, e.clientY));
}
function ctxUp(e) {
  if (e.button === 2) ctxRelease(e.clientX, e.clientY);
}
function ctxRelease(x, y) {
  const st = ctxState;
  if (!st || !st.held) return;
  st.held = false;
  clearTimeout(ctxSuppressTimer);
  ctxSuppressTimer = setTimeout(() => (ctxSuppress = false), 700);
  const i = ctxPick(x, y);
  if (i >= 0) ctxChoose(i);
  else {
    st.root.classList.add("is-open");
    ctxSetHot(-1);
  }
}
function openCtxRadial(x, y, tabId, held) {
  ctxRemove();
  const items = ctxItemsFor(tabId);
  if (!items.length) return;
  const acts = items.map((x) => x.a);
  const R = 100,
    BTN = 46,
    M = R + BTN / 2 + 8;
  const cx = Math.min(Math.max(x, M), window.innerWidth - M),
    cy = Math.min(Math.max(y, M), window.innerHeight - M);
  const t = EDITOR_TABS.find((e) => e.id === tabId);
  const defCap = String(tabId).indexOf("card:") === 0 ? "カードの操作" : tabId === "home" ? "ホームの操作" : "「" + (t ? t.label : "") + "」の操作";
  const root = document.createElement("div");
  root.id = "ctxRadial";
  root.className = "rdmenu";
  root.setAttribute("role", "menu");
  root.setAttribute("aria-label", defCap);
  const disc = document.createElement("div");
  disc.className = "rd-disc";
  disc.style.left = cx + "px";
  disc.style.top = cy + "px";
  const wedge = document.createElement("div");
  wedge.className = "rd-wedge";
  const hub = document.createElement("div");
  hub.className = "rd-hub";
  const cap = document.createElement("div");
  cap.className = "rd-cap";
  cap.textContent = defCap;
  disc.append(wedge, hub, cap);
  root.append(disc);
  const angles = [],
    btns = [];
  items.forEach(({ a, slot }, i) => {
    const th = (-90 + slot * 30) * (Math.PI / 180);
    angles.push(th);
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("role", "menuitem");
    setIconText(b, a.ic || "tag");
    b.title = a.label;
    b.setAttribute("aria-label", a.label);
    b.className = "rd " + (a.primary ? "primary " : "") + (a.active ? "active" : "");
    b.style.left = cx - BTN / 2 + "px";
    b.style.top = cy - BTN / 2 + "px";
    b.style.setProperty("--x", (R * Math.cos(th)).toFixed(1) + "px");
    b.style.setProperty("--y", (R * Math.sin(th)).toFixed(1) + "px");
    b.style.setProperty("--d", i * 18 + "ms");
    b.onclick = (e) => {
      // キーボード（Enter）で選んだとき
      e.stopPropagation();
      ctxRemove();
      if (a.keepOpen && document.getElementById("quickPanel").classList.contains("hidden")) document.getElementById("quickFab").click();
      a.run();
    };
    btns.push(b);
    root.append(b);
  });
  ctxState = { x, y, cx, cy, acts, angles, btns, cap, defCap, wedge, root, hot: -2, held: !!held, armed: !held };
  ctxSetHot(-1);
  // 開いたあと（中央で離した状態）：向きをクリックして選ぶ。中央・外側すぎない場所をクリックすると閉じる
  root.addEventListener("mousedown", (e) => {
    if (!ctxState || ctxState.held) return;
    e.preventDefault();
    const i = ctxPick(e.clientX, e.clientY);
    if (e.button === 2) {
      ctxSuppress = true;
      clearTimeout(ctxSuppressTimer);
      ctxSuppressTimer = setTimeout(() => (ctxSuppress = false), 700);
    }
    if (i >= 0) ctxChoose(i);
    else ctxRemove();
  });
  root.addEventListener(
    "touchstart",
    (e) => {
      if (!ctxState || ctxState.held) return;
      e.preventDefault();
      const t = e.touches[0],
        i = ctxPick(t.clientX, t.clientY);
      if (i >= 0) ctxChoose(i);
      else ctxRemove();
    },
    { passive: false },
  );
  root.addEventListener("contextmenu", (e) => e.preventDefault());
  document.body.append(root);
  if (held) root.classList.add("is-held");
  window.addEventListener("mousemove", ctxMove, true);
  window.addEventListener("mouseup", ctxUp, true);
  if (!held) root.querySelector("button.rd").focus({ preventScroll: true });
}
