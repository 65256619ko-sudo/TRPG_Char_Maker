// ===== ホームのカードの「⋯」メニューと、ホームから使える出力・成長 =====
// 注意：このファイルは起動処理（renderHome）より後ろに置かれる。起動時に呼ばれる関数は function 宣言（巻き上げ）で書き、
// トップレベルの const / let は使わない（var を使う）。
var cardMenuEl = null;
var outCtx = null; // 出力ダイアログを開いている間の状態（null＝閉じている）
var outPrevKind = ""; // 「中身を表示」で出している種類："pal" / "json" / ""
var outBoxShown = { pal: false, json: false }; // 出力タブの文字欄を出しているか

function cardRecord(id) {
  return managerData.characters.find((x) => x.id === id);
}
function removeCharacterFromGroup(c, gid) {
  const ids = characterGroupIds(c).filter((x) => x !== gid);
  c.groupIds = ids;
  c.groupId = ids[0] || null;
  persistManagerData();
  renderGroupView();
  renderHome();
  toast("このグループから外しました（キャラクターは残っています）");
}
// カード1枚ぶんの操作。スマホの「⋯」メニューと、円形メニュー（長押し・右クリック）で同じものを使う
function cardActionList(c, removeFrom) {
  const acts = [
    { id: "edit", label: "編集", ic: "user", primary: true, run: () => openCharacter(c.id) },
    { id: "viewer", label: "閲覧", ic: "eye", run: () => showViewer(c.id) },
    { id: "output", label: "出力", ic: "outbox", run: () => openOutputDialog(c.id) },
    { id: "growth", label: "成長", ic: "growth", run: () => openCardGrowth(c.id) },
    { id: "json", label: "JSONコピー", ic: "copy", run: () => copyCharacterJSON(c) },
    {
      id: "dup",
      label: "複製",
      ic: "users",
      run: () => {
        openCharacter(c.id);
        duplicateCharacter();
      },
    },
    {
      id: "derive",
      label: "元に新規",
      ic: "derive",
      run: () => {
        openCharacter(c.id);
        deriveNewCharacter();
      },
    },
  ];
  if (removeFrom) acts.push({ id: "remove", label: "この場所から外す", ic: "folderOpen", run: () => removeCharacterFromGroup(c, removeFrom) });
  acts.push({ id: "del", label: "削除", ic: "trash", danger: true, run: () => deleteCharacter(c.id) });
  return acts;
}
// 円形メニュー用（カードの上で長押し／右クリックしたとき）
function cardRadialActions(id) {
  const c = cardRecord(id);
  if (!c) return [];
  const sel = '.home-card[data-cid="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]';
  const el = document.querySelector(sel);
  return cardActionList(c, el ? el.dataset.rmfrom || "" : "");
}
function closeCardMenu() {
  if (cardMenuEl) {
    cardMenuEl.remove();
    cardMenuEl = null;
  }
}
// スマホ幅：カードの「⋯」を押すと出るメニュー（「閲覧」「編集」はカード上のボタンに残す）
function openCardMenu(btn, c, removeFrom) {
  if (cardMenuEl && cardMenuEl._for === btn) {
    closeCardMenu();
    return;
  }
  closeCardMenu();
  const m = document.createElement("div");
  m.className = "card-menu";
  m.setAttribute("role", "menu");
  m._for = btn;
  cardActionList(c, removeFrom)
    .filter((a) => a.id !== "edit" && a.id !== "viewer")
    .forEach((a) => {
      const b = document.createElement("button");
      b.type = "button";
      b.setAttribute("role", "menuitem");
      if (a.danger) b.className = "danger";
      setIconText(b, a.ic, a.label);
      b.onclick = () => {
        closeCardMenu();
        a.run();
      };
      m.append(b);
    });
  document.body.append(m);
  const r = btn.getBoundingClientRect(),
    mw = m.offsetWidth,
    mh = m.offsetHeight;
  const left = Math.min(Math.max(8, r.left), Math.max(8, window.innerWidth - mw - 8));
  let top = r.top - mh - 6;
  if (top < 8) top = Math.max(8, Math.min(r.bottom + 6, window.innerHeight - mh - 8));
  m.style.left = left + "px";
  m.style.top = top + "px";
  m._y = window.scrollY; // 開いた位置から画面が動いたら閉じる（開く直前のスクロール終わりの通知では閉じない）
  cardMenuEl = m;
}

// ----- ホームから出力・成長を開くための「裏でキャラを読み込む」処理（copyCharacterJSON と同じ方法） -----
function cardLoadBackground(c) {
  restoreSecretSkip = true;
  const st = {
    snap: captureForm(),
    id: currentCharacterId,
    gid: currentGroupId,
    gids: [...currentGroupIds],
    label: document.getElementById("editingLabel").textContent,
    saved: savedSnap,
    dirty: !!window.__formDirty,
  };
  restoreForm(c.form || {});
  currentCharacterId = c.id;
  currentGroupIds = characterGroupIds(c);
  currentGroupId = currentGroupIds[0] || null;
  document.getElementById("preserveFormulas").checked = !!(c.form && c.form.preserveFormulas);
  regenPaletteIfEmpty();
  return st;
}
function cardUnloadBackground(st, keepRollMode) {
  restoreForm(st.snap);
  if (keepRollMode === "CC" || keepRollMode === "CCB") {
    rollMode = keepRollMode; // 判定方式は全体の設定。ダイアログで選んだ方式を、戻したあとも保つ
    updateRollModeButton();
  }
  restoreSecretSkip = false;
  currentCharacterId = st.id;
  currentGroupId = st.gid;
  currentGroupIds = st.gids;
  document.getElementById("editingLabel").textContent = st.label;
  savedSnap = st.saved;
  setDirtyUI(st.dirty);
}
// 成長記録：閉じたときに、変わっていればそのキャラへ保存して一覧を更新する
function openCardGrowth(id) {
  const c = cardRecord(id);
  if (!c || !window.__growth) return;
  const st = cardLoadBackground(c);
  refreshCharacterGroupSelect(); // saveCurrentCharacter が所属グループの欄を読むので、読み込み直後に必ず呼ぶ
  const snap0 = formSnap();
  const dlg = document.getElementById("growthDialog");
  let done = false;
  const obs = new MutationObserver(() => {
    if (done || !dlg.classList.contains("hidden")) return;
    done = true;
    obs.disconnect();
    try {
      if (formSnap() !== snap0) {
        refreshCharacterGroupSelect();
        if (saveCurrentCharacter(true)) toast("成長記録を保存しました");
        renderHome();
        if (viewGroupId) renderGroupView();
      }
    } catch (e) {
      toast("成長記録の保存に失敗しました：" + (e.message || String(e)));
    } finally {
      cardUnloadBackground(st);
    }
  });
  obs.observe(dlg, { attributes: true, attributeFilter: ["class"] });
  window.__growth.open();
}

// ----- 出力のかんたんダイアログ -----
function outEl(id) {
  return document.getElementById(id);
}
function outSettingsNow() {
  return {
    heads: outEl("paletteHeads").checked,
    memo: outEl("includeSuccessMemo").checked,
    preserve: outEl("preserveFormulas").checked,
    status: skillStatusMode,
    roll: rollMode,
  };
}
function outSyncUi() {
  const s = outSettingsNow();
  outEl("outHeads").checked = s.heads;
  outEl("outMemo").checked = s.memo;
  outEl("outPreserve").checked = s.preserve;
  outEl("outStatusMode").value = s.status;
  outEl("outStatusHint").textContent = s.status === "pick" ? "どの技能を出すかは、編集画面の出力タブで選べます。" : "";
  ["CCB", "CC"].forEach((m) => {
    const b = outEl("outRoll" + m);
    b.classList.toggle("on", s.roll === m);
    b.setAttribute("aria-pressed", String(s.roll === m));
  });
}
function outFireChange(el) {
  el.dispatchEvent(new Event("change", { bubbles: true }));
}
function outPalettePlain() {
  if (!paletteOutput.value.trim()) paletteOutput.value = makeData({ standalonePalette: true }).data.commands;
  return addPaletteHeadings(paletteOutput.value);
}
// JSONを作り直す。作れなければ理由を知らせて false
function outGenerateJson() {
  if (generateJSON()) return true;
  const fix = outEl("skillFixDialog");
  if (outCtx && outCtx.st && fix && !fix.classList.contains("hidden")) {
    closeSkillFix(); // ホームでは直せない（裏で読み込んだ状態なので）
    toast("技能に、未登録の名前が使われています。編集画面の出力タブで直してください");
  } else if (!fix || fix.classList.contains("hidden")) toast(message.textContent || "生成できませんでした");
  return false;
}
async function outCopyPalette() {
  let text;
  try {
    text = outPalettePlain();
  } catch (e) {
    toast("生成エラー：" + (e.message || String(e)));
    return;
  }
  const ok = await copyTextInGesture(text);
  toast(ok ? "チャパレをコピーしました" : "コピーできませんでした。「チャパレを表示」から選んでコピーしてください");
}
async function outCopyJson() {
  if (!outGenerateJson()) return;
  const ok = await copyTextInGesture(output.value);
  toast(ok ? "ココフォリア駒（JSON）をコピーしました" : "コピーできませんでした。「JSONを表示」から選んでコピーしてください");
}
function outDownload() {
  if (!outGenerateJson()) return;
  outEl("download").click();
}
function outShowPreview(kind) {
  const ta = outEl("outPreview");
  try {
    if (kind === "pal") ta.value = outPalettePlain();
    else {
      if (!outGenerateJson()) return;
      ta.value = output.value;
    }
  } catch (e) {
    toast("生成エラー：" + (e.message || String(e)));
    return;
  }
  outPrevKind = kind;
  ta.classList.remove("hidden");
  [["outShowPal", "pal"], ["outShowJson", "json"]].forEach(([id, k]) => {
    outEl(id).classList.toggle("on", k === kind);
    outEl(id).setAttribute("aria-pressed", String(k === kind));
  });
}
function outRefreshPreview() {
  if (outPrevKind) outShowPreview(outPrevKind);
}
function openOutputDialog(id) {
  let st = null;
  if (id) {
    const c = cardRecord(id);
    if (!c) return;
    st = cardLoadBackground(c);
    outEl("outWho").textContent = c.name || "名称未設定";
  } else outEl("outWho").textContent = (outEl("charName").value || "").trim() || "編集中のキャラクター";
  outCtx = { st, id: id || null, before: outSettingsNow() };
  outPrevKind = "";
  outEl("outPreview").classList.add("hidden");
  outEl("outPreview").value = "";
  ["outShowPal", "outShowJson"].forEach((x) => {
    outEl(x).classList.remove("on");
    outEl(x).setAttribute("aria-pressed", "false");
  });
  outSyncUi();
  outEl("outDialog").classList.remove("hidden");
}
// ホームから開いたときは、変えた設定だけをそのキャラの保存データへ書く（フォーム全体は保存しない：「名前に連番」で名前が変わる恐れがあるため）
function outPersistToRecord(ctx) {
  const now = outSettingsNow();
  if (JSON.stringify(now) === JSON.stringify(ctx.before)) return;
  const rec = cardRecord(ctx.id);
  if (!rec) return;
  const f = captureForm();
  rec.form = rec.form || {};
  rec.form.outputSettings = Object.assign({}, rec.form.outputSettings, {
    paletteHeads: f.outputSettings.paletteHeads,
    successMemo: f.outputSettings.successMemo,
    preserveFormulas: f.outputSettings.preserveFormulas,
  });
  if (now.roll !== ctx.before.roll) rec.form.outputSettings.rollMode = now.roll;
  rec.form.preserveFormulas = f.preserveFormulas;
  if (f.skillStatusMode) rec.form.skillStatusMode = f.skillStatusMode;
  else delete rec.form.skillStatusMode;
  persistManagerData();
}
function closeOutputDialog() {
  const ctx = outCtx;
  if (!ctx) return;
  outCtx = null;
  outEl("outDialog").classList.add("hidden");
  if (!ctx.st) return;
  const chosen = rollMode;
  try {
    outPersistToRecord(ctx);
  } catch (e) {
    toast("出力設定の保存に失敗しました：" + (e.message || String(e)));
  } finally {
    cardUnloadBackground(ctx.st, chosen);
  }
}

// ----- 出力タブの文字欄は、普段は隠す（「表示」ボタンか、並べ替えをONにしたときだけ出す） -----
function outBoxHidden(kind) {
  const b = outEl(kind === "pal" ? "paletteOutBox" : "jsonOutBox");
  return !b || b.classList.contains("hidden");
}
function updateOutBoxes(refresh) {
  const sw = outEl("priorityEditSwitch");
  const prio = !!(sw && sw.checked);
  const palOn = outBoxShown.pal || prio;
  outEl("paletteOutBox").classList.toggle("hidden", !palOn);
  outEl("jsonOutBox").classList.toggle("hidden", !outBoxShown.json);
  const pb = outEl("togglePaletteOut"),
    jb = outEl("toggleJsonOut");
  pb.classList.toggle("hidden", prio); // 並べ替え中は欄が出ているので、ボタンは隠す
  pb.textContent = palOn ? "隠す" : "表示";
  pb.setAttribute("aria-expanded", String(palOn));
  jb.textContent = outBoxShown.json ? "隠す" : "表示";
  jb.setAttribute("aria-expanded", String(outBoxShown.json));
  if (refresh) refreshAutoGrow();
}

(() => {
  // カードの「⋯」メニューは、外を押す・スクロール・Escで閉じる
  document.addEventListener(
    "pointerdown",
    (e) => {
      if (cardMenuEl && !cardMenuEl.contains(e.target) && !(e.target.closest && e.target.closest(".card-more"))) closeCardMenu();
    },
    true,
  );
  window.addEventListener(
    "scroll",
    () => {
      if (cardMenuEl && Math.abs(window.scrollY - cardMenuEl._y) > 8) closeCardMenu();
    },
    { passive: true },
  );
  window.addEventListener("resize", closeCardMenu);
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    closeCardMenu();
    const fix = outEl("skillFixDialog");
    if (outCtx && !(fix && !fix.classList.contains("hidden"))) closeOutputDialog();
  });

  // 出力ダイアログ
  outEl("outClose").onclick = closeOutputDialog;
  outEl("outDialog").addEventListener("click", (e) => {
    if (e.target === outEl("outDialog")) closeOutputDialog();
  });
  outEl("openOutDialog").onclick = () => openOutputDialog();
  ["CCB", "CC"].forEach((m) => {
    outEl("outRoll" + m).onclick = () => {
      if (rollMode !== m) outEl("rollModeToggle").click();
      outSyncUi();
      outRefreshPreview();
    };
  });
  const bind = (dlgId, realId) =>
    outEl(dlgId).addEventListener("change", (e) => {
      const real = outEl(realId);
      real.checked = e.target.checked;
      outFireChange(real);
      outSyncUi();
      outRefreshPreview();
    });
  bind("outHeads", "paletteHeads");
  bind("outMemo", "includeSuccessMemo");
  bind("outPreserve", "preserveFormulas");
  outEl("outStatusMode").addEventListener("change", (e) => {
    const sel = outEl("skillStatusMode");
    sel.value = e.target.value;
    outFireChange(sel);
    outSyncUi();
    outRefreshPreview();
  });
  outEl("outCopyPalette").onclick = outCopyPalette;
  outEl("outCopyJson").onclick = outCopyJson;
  outEl("outDownload").onclick = outDownload;
  outEl("outShowPal").onclick = () => outShowPreview("pal");
  outEl("outShowJson").onclick = () => outShowPreview("json");

  // 出力タブの文字欄
  outEl("togglePaletteOut").onclick = () => {
    outBoxShown.pal = !outBoxShown.pal;
    updateOutBoxes(true);
  };
  outEl("toggleJsonOut").onclick = () => {
    outBoxShown.json = !outBoxShown.json;
    updateOutBoxes(true);
  };
  outEl("priorityEditSwitch").addEventListener("change", () => updateOutBoxes(true));
  updateOutBoxes(false);
})();
