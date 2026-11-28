function ctxScreenOk() {
  return document.body.classList.contains("editor-mode") || document.body.classList.contains("home-mode");
}
function ctxAllowed(e) {
  if (!quickRadialOn() || !ctxScreenOk()) return false;
  if (e.shiftKey || document.querySelector("dialog[open]")) return false; // Shift+右クリックは、ふつうのメニュー
  if (!document.getElementById("guideDialog").classList.contains("hidden")) return false;
  const t = e.target;
  if (!(t instanceof Element)) return false;
  if (t.closest("input,textarea,select,a,[contenteditable],#quickDock,#ctxRadial,.preset-card,#guideBar,#catDialog,#presetDialog,#editorMenu,[id$=\"Dialog\"]")) return false;
  if (window.getSelection && window.getSelection().toString()) return false;
  return true;
}
function ctxTab(t) {
  if (document.body.classList.contains("home-mode")) return "home";
  const sec = t.closest ? t.closest("#editorView > section") : null;
  return document.body.classList.contains("tabs-on") ? editorTab : (sec && tabOfSection(sec)) || activeTab();
}
// 右ボタンを押した瞬間に開く（欄の外でも、編集画面のどこでも）
document.addEventListener(
  "mousedown",
  (e) => {
    if (e.button !== 2 || ctxState || !ctxAllowed(e)) return;
    ctxSuppress = true;
    clearTimeout(ctxSuppressTimer);
    e.preventDefault();
    openCtxRadial(e.clientX, e.clientY, ctxTab(e.target), true);
  },
  true,
);
document.addEventListener(
  "contextmenu",
  (e) => {
    if (ctxSuppress || ctxState) {
      e.preventDefault();
      return;
    }
    if (ctxAllowed(e)) {
      e.preventDefault();
      openCtxRadial(e.clientX, e.clientY, ctxTab(e.target), false);
    }
  },
  true,
);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeCtxRadial();
});
window.addEventListener("scroll", closeCtxRadial, { passive: true });
window.addEventListener("resize", closeCtxRadial);

// ===== スマホ：空いている所を0.5秒長押しすると、同じ円形メニューが出る（押したまま向きへ動かして離すと決定） =====
(() => {
  const SLOP = 10;
  // 長押しの長さ（ミリ秒）。0 は「長押しで出さない」。設定は「円形メニューの設定」で変える
  window.ctxHoldMs = function () {
    try {
      const v = localStorage.getItem("trpg_ctx_hold");
      if (v !== null && v !== "" && !isNaN(Number(v))) return Math.max(0, Math.min(5000, Number(v)));
    } catch (e) {}
    return 500;
  };
  let timer = 0,
    sx = 0,
    sy = 0,
    pressing = false,
    target = null;
  const touchCapable = () => "ontouchstart" in window || (navigator.maxTouchPoints || 0) > 0;
  function okTarget(t) {
    if (!ctxScreenOk() || document.querySelector("dialog[open]")) return false;
    if (!document.getElementById("guideDialog").classList.contains("hidden")) return false;
    if (!(t instanceof Element)) return false;
    // 画面が詰まっていて空きが少ないので、入力欄・ボタン・見出しの上でも出す。ただし文字を入力中の欄と、文字を選択中のときは、ふつうの長押しを優先する
    if (t.closest('select,input[type="range"],input[type="file"],input[type="color"],[draggable="true"],#quickDock,#ctxRadial,.preset-card,#guideBar,#editorMenu,[id$="Dialog"]')) return false;
    const ae = document.activeElement;
    if (ae && ae !== document.body && ae.matches && ae.matches("input,textarea,[contenteditable]") && (ae === t || ae.contains(t))) return false;
    try {
      if (window.getSelection().toString()) return false;
    } catch (e) {}
    return true;
  }
  const isField = (t) => !!(t && t.closest && t.closest("input,textarea,[contenteditable]"));
  function endPress(keepSel) {
    clearTimeout(timer);
    timer = 0;
    pressing = false;
    target = null;
    if (!keepSel && !ctxState) document.body.classList.remove("ctx-nosel");
  }
  function fire() {
    if (!pressing || ctxState) return;
    const t = target;
    clearTimeout(timer);
    timer = 0;
    pressing = false;
    ctxSuppress = true;
    clearTimeout(ctxSuppressTimer);
    ctxSuppressTimer = setTimeout(() => (ctxSuppress = false), 4000);
    try {
      window.getSelection().removeAllRanges();
      const ae = document.activeElement;
      if (isField(t) && ae && ae.blur) ae.blur(); // 長押しで入力欄にカーソルが入って、キーボードが出るのを防ぐ
    } catch (e) {}
    try {
      navigator.vibrate && navigator.vibrate(12);
    } catch (e) {}
    openCtxRadial(sx, sy, ctxTab(t), true);
    if (ctxState) {
      ctxState.touch = true;
      ctxState.root.classList.add("is-touch");
      const above = ctxState.cy - 168 >= 6;
      ctxState.root.style.setProperty("--capy", (above ? -168 : 140) + "px");
      document.body.classList.add("ctx-nosel");
    }
  }
  document.addEventListener(
    "touchstart",
    (e) => {
      endPress();
      const hold = window.ctxHoldMs();
      if (!hold || ctxState || !touchCapable() || e.touches.length !== 1 || !okTarget(e.target)) return;
      const t = e.touches[0];
      sx = t.clientX;
      sy = t.clientY;
      target = e.target;
      pressing = true;
      if (!isField(e.target)) document.body.classList.add("ctx-nosel"); // 入力欄は、タップで入力できなくならないよう、長押しが成立してから止める
      timer = setTimeout(fire, hold);
    },
    { capture: true, passive: true },
  );
  window.addEventListener(
    "touchmove",
    (e) => {
      const t = e.touches[0];
      if (ctxState && ctxState.touch && ctxState.held) {
        if (e.cancelable) e.preventDefault();
        if (t) ctxSetHot(ctxPick(t.clientX, t.clientY));
        return;
      }
      if (pressing && (e.touches.length !== 1 || (t && Math.hypot(t.clientX - sx, t.clientY - sy) > SLOP))) endPress();
    },
    { capture: true, passive: false },
  );
  function touchEnd(e) {
    if (ctxState && ctxState.touch && ctxState.held) {
      if (e.cancelable) e.preventDefault();
      const t = e.changedTouches[0];
      if (e.type === "touchcancel") ctxRemove();
      else if (t) ctxRelease(t.clientX, t.clientY);
      return;
    }
    endPress();
  }
  window.addEventListener("touchend", touchEnd, { capture: true, passive: false });
  window.addEventListener("touchcancel", touchEnd, { capture: true, passive: false });
  // Android などは、長押しで先に「長押しメニュー」(contextmenu) が来る。その場合もここで円形メニューに切り替える
  document.addEventListener(
    "contextmenu",
    (e) => {
      if (pressing) {
        e.preventDefault();
        fire();
      }
    },
    true,
  );
})();
function renderQuickPanel(sub) {
  const pnl = document.getElementById("quickPanel");
  if (!pnl) return;
  pnl.textContent = "";
  if (sub === "labels") {
    const head = document.createElement("div");
    head.className = "qk-h";
    head.textContent = "ラベルで技能を絞り込み";
    pnl.append(head);
    const back = document.createElement("button");
    back.type = "button";
    back.textContent = "‹ 戻る";
    back.onclick = () => renderQuickPanel();
    pnl.append(back);
    const count = new Map();
    skills.querySelectorAll(".row").forEach((r) => {
      if (r.querySelector(".skill-name").value.trim()) rowCats(r).forEach((c) => count.set(c, (count.get(c) || 0) + 1));
    });
    const pick = (c) => {
      skillCatFilter = c;
      filterSkillRows();
      closeQuickPanel();
      const bar = document.getElementById("skillCatBar");
      if (bar) bar.scrollIntoView({ block: "center", behavior: "smooth" });
    };
    const all = document.createElement("button");
    all.type = "button";
    all.className = skillCatFilter ? "primary" : "";
    all.textContent = "すべて表示";
    all.onclick = () => pick("");
    pnl.append(all);
    allSkillCatsOrdered(count).forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = skillCatFilter === c ? "primary" : "";
      b.textContent = c + "　" + count.get(c) + "技能";
      b.onclick = () => pick(c);
      pnl.append(b);
    });
    if (!count.size) pnl.append(Object.assign(document.createElement("div"), { className: "qk-h", textContent: "ラベルのついた技能がありません。" }));
    return;
  }
  const t = EDITOR_TABS.find((x) => x.id === activeTab());
  const h = document.createElement("div");
  h.className = "qk-h";
  h.textContent = "「" + (t ? t.label : "") + "」でよく使う操作";
  pnl.append(h);
  quickActions().forEach((a) => {
    const b = document.createElement("button");
    b.type = "button";
    setIconText(b, a.ic || "tag", a.label);
    b.className = (a.primary ? "primary " : "") + (a.active ? "active" : "");
    if (a.active && a.ic === "check") b.setAttribute("aria-pressed", "true");
    b.onclick = () => {
      if (!a.keepOpen) closeQuickPanel();
      a.run();
    };
    pnl.append(b);
  });
}
(() => {
  const dock = document.createElement("div");
  dock.id = "quickDock";
  dock.innerHTML =
    '<div id="quickPanel" class="hidden" role="menu" aria-label="クイック操作"></div><button type="button" id="quickFab" aria-expanded="false" aria-controls="quickPanel" aria-label="クイック操作を開く">☰</button>';
  document.body.append(dock);
  const fab = document.getElementById("quickFab"),
    pnl = document.getElementById("quickPanel");
  fab.onclick = () => {
    const open = pnl.classList.contains("hidden");
    if (open) renderQuickPanel();
    pnl.classList.toggle("hidden", !open);
    dock.classList.toggle("is-open", open);
    fab.textContent = open ? "✕" : "☰";
    fab.setAttribute("aria-expanded", String(open));
  };
  document.addEventListener("click", (e) => {
    if (!e.composedPath().includes(dock)) closeQuickPanel();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !pnl.classList.contains("hidden")) {
      closeQuickPanel();
      fab.focus();
    }
  });
  renderQuickPanel();
  const sw = document.getElementById("skillOrderSwitch");
  if (sw) sw.addEventListener("change", () => (updateQuickFabState(), renderQuickPanel()));
  updateQuickFabState();
})();

// ===== ラベル（分類）の名前変更・削除 =====
function catUsage() {
  const m = new Map();
  skills.querySelectorAll(".row").forEach((r) => rowCats(r).forEach((c) => m.set(c, (m.get(c) || 0) + 1)));
  return m;
}
function openCatManager() {
  const host = document.getElementById("catList");
  host.textContent = "";
  const use = catUsage();
  document.getElementById("catStatus").textContent = "";
  use.forEach((count, c) => {
    const row = document.createElement("div");
    row.className = "lt-row";
    const orig = document.createElement("span");
    orig.className = "lt-orig";
    orig.textContent = "［" + c + "］" + count + "技能";
    const inp = document.createElement("input");
    inp.type = "text";
    inp.className = "cat-new";
    inp.maxLength = 12;
    inp.dataset.orig = c;
    inp.value = c;
    inp.setAttribute("aria-label", "［" + c + "］の新しい名前");
    const rm = document.createElement("label");
    rm.className = "lt-rm";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.className = "cat-rm";
    cb.dataset.orig = c;
    cb.addEventListener("change", () => (inp.disabled = cb.checked));
    rm.append(cb, document.createTextNode("外す"));
    row.append(orig, inp, rm);
    host.append(row);
  });
  if (!use.size) host.textContent = "ラベルのついた技能がありません。";
  document.getElementById("catDialog").classList.remove("hidden");
}
function closeCatManager() {
  document.getElementById("catDialog").classList.add("hidden");
}
function applyCatManager() {
  const map = new Map();
  document.querySelectorAll("#catList .cat-new").forEach((inp) => {
    const o = inp.dataset.orig,
      rm = document.querySelector('#catList .cat-rm[data-orig="' + CSS.escape(o) + '"]').checked,
      n = inp.value.trim().replace(/\s+/g, "");
    map.set(o, rm ? "" : n || o);
  });
  let changed = 0;
  skills.querySelectorAll(".row").forEach((r) => {
    const cur = rowCats(r),
      next = [];
    cur.forEach((c) => {
      const t = map.has(c) ? map.get(c) : c;
      if (t && !next.includes(t)) next.push(t);
    });
    if (next.length === cur.length && next.every((x, i) => x === cur[i])) return;
    const def = defaultSkillCats(r.querySelector(".skill-name").value.trim());
    const same = next.length === def.length && next.every((x, i) => x === def[i]);
    setRowCats(r, same ? null : next);
    syncSkillMore(r);
    changed++;
  });
  if (!changed) {
    document.getElementById("catStatus").textContent = "変更はありません。";
    return;
  }
  skills.dispatchEvent(new Event("input", { bubbles: true }));
  filterSkillRows();
  if (skillOrderPanel && !skillOrderPanel.classList.contains("hidden")) {
    if (typeof skillOrderDraft !== "undefined") renderSkillOrderList();
  }
  if (typeof prioritySwitch !== "undefined" && prioritySwitch.checked) renderPaletteOrderList();
  closeCatManager();
  message.textContent = "ラベルの名前を" + changed + "つの技能に反映しました。";
}
document.getElementById("openCatManager").onclick = openCatManager;
document.getElementById("skillOpenCatManager").onclick = openCatManager;
document.getElementById("catClose").onclick = closeCatManager;
document.getElementById("catCancel").onclick = closeCatManager;
document.getElementById("catApply").onclick = applyCatManager;
document.getElementById("skillStatusMode").addEventListener("change", (e) => {
  setSkillStatusMode(e.target.value);
  skills.dispatchEvent(new Event("input", { bubbles: true }));
});
document.getElementById("skillStatusSearch").addEventListener("input", renderSkillStatusPanel);
document.getElementById("skillStatusAll").onclick = () => {
  skills.querySelectorAll(".row").forEach((r) => delete r.dataset.noStatus);
  renderSkillStatusPanel();
  skills.dispatchEvent(new Event("input", { bubbles: true }));
};
document.getElementById("skillStatusNone").onclick = () => {
  skills.querySelectorAll(".row").forEach((r) => (r.dataset.noStatus = "1"));
  renderSkillStatusPanel();
  skills.dispatchEvent(new Event("input", { bubbles: true }));
};
document.getElementById("viewLines").onclick = () => setPaletteView("lines");
document.getElementById("viewCats").onclick = () => {
  setPaletteView("cats");
  message.textContent = "同じラベルの技能を、ラベルごとのかたまりにそろえました。";
};
document.getElementById("viewNames").onclick = () => {
  setPaletteView("names");
  message.textContent = "同じ【名前】の行を、かたまりにそろえました。";
};
// ラベルの名前を変える／外す
function paletteLabelsUnmapped() {
  labelMapOff = true;
  try {
    const lines = textLines(makeData({ standalonePalette: true, allowInvalidDamage: true }).data.commands).concat(getPaletteCommandLines());
    const m = new Map();
    lines.forEach((l) => {
      const lab = labelOfLine(l);
      if (lab) m.set(lab, (m.get(lab) || 0) + 1);
    });
    return m;
  } finally {
    labelMapOff = false;
  }
}
function renderLabelTools() {
  const host = document.getElementById("labelToolsList");
  host.textContent = "";
  let labels;
  try {
    labels = paletteLabelsUnmapped();
  } catch (e) {
    host.textContent = "ラベルを調べられませんでした：" + e.message;
    return;
  }
  labels.forEach((count, lab) => {
    const row = document.createElement("div");
    row.className = "lt-row";
    const orig = document.createElement("span");
    orig.className = "lt-orig";
    orig.textContent = "【" + lab + "】×" + count;
    const inp = document.createElement("input");
    inp.type = "text";
    inp.className = "lt-new";
    inp.dataset.orig = lab;
    inp.value = Object.prototype.hasOwnProperty.call(paletteLabelMap, lab) ? paletteLabelMap[lab] : lab;
    inp.setAttribute("aria-label", "【" + lab + "】の新しい名前");
    const rm = document.createElement("label");
    rm.className = "lt-rm";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.dataset.orig = lab;
    cb.checked = paletteLabelMap[lab] === "";
    cb.addEventListener("change", () => (inp.disabled = cb.checked));
    inp.disabled = cb.checked;
    rm.append(cb, document.createTextNode("外す"));
    row.append(orig, inp, rm);
    host.append(row);
  });
  if (!labels.size) host.textContent = "ラベルのついた行がありません。";
}
function setLabelMap(newMap) {
  const old = paletteLabelMap;
  paletteLabelMap = newMap;
  if (Array.isArray(paletteOrderOverride)) paletteOrderOverride = relabelLines(paletteOrderOverride, old, newMap);
  if (prioritySwitch.checked) paletteOrderDraft = relabelLines(paletteOrderDraft, old, newMap);
  if (paletteMode === "manual" && paletteOutput.value.trim())
    paletteOutput.value = relabelLines(textLines(paletteOutput.value), old, newMap).join("\n");
  else {
    try {
      regeneratePaletteOutput();
    } catch (e) {}
  }
  if (prioritySwitch.checked) {
    paletteOutput.value = paletteOrderDraft.join("\n");
    renderPaletteOrderList();
  }
  const ta = document.getElementById("extraPaletteCommands");
  ta.dispatchEvent(new Event("input", { bubbles: true }));
}
