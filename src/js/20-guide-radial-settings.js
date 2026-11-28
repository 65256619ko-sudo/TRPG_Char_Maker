function closeGuideBar() {
  document.getElementById("guideBar").classList.add("hidden");
  document.querySelectorAll(".guide-pulse").forEach((e) => e.classList.remove("guide-pulse"));
  guideCurrent = null;
}
function runGuide(i) {
  const g = GUIDE_GOALS[i];
  closeGuide();
  if (!document.body.classList.contains("editor-mode")) {
    toast("編集画面で使えます");
    return;
  }
  guideCurrent = g;
  document.querySelectorAll(".guide-pulse").forEach((e) => e.classList.remove("guide-pulse"));
  const el = g.sel ? document.querySelector(g.sel) : null;
  if (el) {
    const sec = el.closest("#editorView > section");
    if (sec) {
      sec.classList.remove("is-collapsed");
    }
    ensureTabFor(el);
    const target = el.tagName === "INPUT" ? el.closest("label") || el : el;
    target.classList.add("guide-pulse");
    setTimeout(() => target.scrollIntoView({ block: "center", behavior: "smooth" }), 60);
    setTimeout(() => target.classList.remove("guide-pulse"), 6000);
  }
  document.getElementById("guideBarTitle").textContent = g.t;
  const ol = document.getElementById("guideBarSteps");
  ol.textContent = "";
  g.steps.forEach((x) => {
    const li = document.createElement("li");
    li.textContent = x;
    ol.append(li);
  });
  const run = document.getElementById("guideBarRun");
  run.classList.toggle("hidden", !g.act);
  if (g.act) run.textContent = g.act[0];
  document.getElementById("guideBar").classList.remove("hidden");
}
document.getElementById("openGuide").addEventListener("click", () => {
  document.getElementById("editorMenu").classList.add("hidden");
  openGuide("");
});
document.getElementById("guideClose").onclick = closeGuide;
document.getElementById("guideDialog").addEventListener("click", (e) => {
  if (e.target.id === "guideDialog") closeGuide();
});
document.getElementById("guideSearch").addEventListener("input", renderGuideList);
document.getElementById("guideBarClose").onclick = closeGuideBar;
document.getElementById("guideBarList").onclick = () => openGuide("");
document.getElementById("guideBarRun").onclick = () => {
  const g = guideCurrent;
  closeGuideBar();
  if (g && g.act) g.act[1]();
};
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeGuide();
  }
});

// ===== 円形メニューの設定 =====
const RS_SLOT_NAME = ["真上（12時）", "右上（1時）", "右上（2時）", "右（3時）", "右下（4時）", "右下（5時）", "真下（6時）", "左下（7時）", "左下（8時）", "左（9時）", "左上（10時）", "左上（11時）"];
let rsTab = "skills",
  rsMap = {},
  rsSel = 1;
function rsPersist() {
  const o = ctxCustomLoad();
  o[rsTab] = rsMap;
  ctxCustomSave(o);
}
function rsSlotOf(id) {
  const k = Object.keys(rsMap).find((x) => rsMap[x] === id);
  return k === undefined ? null : Number(k);
}
function rsRender() {
  const { map, home } = allQuickActions();
  const tabs = document.getElementById("rsTabs");
  tabs.textContent = "";
  EDITOR_TABS.forEach((t) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "small-btn" + (t.id === rsTab ? " on" : "");
    b.setAttribute("aria-pressed", String(t.id === rsTab));
    b.textContent = t.label + (ctxCustomLoad()[t.id] ? " ●" : "");
    b.onclick = () => {
      rsTab = t.id;
      rsMap = Object.assign({}, ctxMapFor(rsTab));
      rsRender();
    };
    tabs.append(b);
  });
  const st = document.getElementById("rsStage");
  st.textContent = "";
  const R = 104;
  for (let i = 0; i < 12; i++) {
    const th = ((-90 + i * 30) * Math.PI) / 180,
      id = rsMap[i],
      a = id ? map.get(id) : null;
    const b = document.createElement("button");
    b.type = "button";
    b.className = "rs-slot" + (i === rsSel ? " sel" : "") + (a ? "" : " empty");
    b.style.left = "calc(50% + " + (R * Math.cos(th)).toFixed(1) + "px - 22px)";
    b.style.top = "calc(50% + " + (R * Math.sin(th)).toFixed(1) + "px - 22px)";
    b.title = RS_SLOT_NAME[i] + "：" + (a ? a.label : "空き");
    b.setAttribute("aria-label", b.title);
    if (a) setIconText(b, a.ic || "tag");
    else b.textContent = "＋";
    b.onclick = () => {
      rsSel = i;
      rsRender();
    };
    st.append(b);
  }
  const c = document.createElement("div");
  c.className = "rs-center";
  const cur = rsMap[rsSel] ? map.get(rsMap[rsSel]) : null;
  c.innerHTML = "";
  const l1 = document.createElement("b");
  l1.textContent = RS_SLOT_NAME[rsSel];
  const l2 = document.createElement("span");
  l2.textContent = cur ? cur.label : "空き";
  c.append(l1, l2);
  st.append(c);
  const pool = document.getElementById("rsPool");
  pool.textContent = "";
  const groups = [
    ["このタブの操作", [...map.keys()].filter((id) => home.get(id) === rsTab)],
    ["共通の操作", ["growth", "viewer", "guide", "top"]],
    ["タブへ移動", ["go:basic", "go:stats", "go:skills", "go:out"]],
    ["他のタブの操作", [...map.keys()].filter((id) => home.has(id) && home.get(id) !== rsTab && !["growth", "viewer", "guide", "top"].includes(id))],
  ];
  groups.forEach(([title, ids]) => {
    ids = ids.filter((id) => map.has(id));
    if (!ids.length) return;
    const h = document.createElement("div");
    h.className = "gd-group";
    h.textContent = title;
    pool.append(h);
    const row = document.createElement("div");
    row.className = "rs-pool-row";
    ids.forEach((id) => {
      const a = map.get(id),
        at = rsSlotOf(id);
      const b = document.createElement("button");
      b.type = "button";
      b.className = "rs-act" + (at !== null ? " placed" : "");
      setIconText(b, a.ic || "tag", a.label.replace(/ ›$/, "") + (at !== null ? "（" + RS_SLOT_NAME[at].replace(/（.*/, "") + "）" : ""));
      b.onclick = () => rsAssign(id);
      row.append(b);
    });
    pool.append(row);
  });
}
function rsAssign(id) {
  const prev = rsSlotOf(id),
    occ = rsMap[rsSel];
  if (prev === rsSel) return;
  if (prev !== null) delete rsMap[prev];
  if (occ && prev !== null && occ !== id) rsMap[prev] = occ;
  rsMap[rsSel] = id;
  rsPersist();
  rsRender();
}
function openRadialSettings() {
  rsTab = document.body.classList.contains("editor-mode") ? activeTab() : "skills";
  rsMap = Object.assign({}, ctxMapFor(rsTab));
  rsSel = 1;
  rsRender();
  syncRsHold();
  applyQuickFabMode();
  document.getElementById("radialDialog").classList.remove("hidden");
}
function quickFabMode() {
  try {
    const v = localStorage.getItem("trpg_quick_fab");
    if (v === "always" || v === "never") return v;
  } catch (e) {}
  return "auto";
}
function applyQuickFabMode() {
  const m = quickFabMode();
  document.body.classList.toggle("quick-always", m === "always");
  document.body.classList.toggle("quick-never", m === "never");
  const sel = document.getElementById("rsFab");
  if (sel) sel.value = m;
  if (m === "never") closeQuickPanel();
}
applyQuickFabMode();
document.getElementById("rsFab").addEventListener("change", (e) => {
  try {
    localStorage.setItem("trpg_quick_fab", e.target.value);
  } catch (err) {}
  applyQuickFabMode();
  message.textContent = { auto: "☰はタブ表示のときだけ出します。", always: "☰をいつも出します。", never: "☰を出さないようにしました（円形メニューは使えます）。" }[e.target.value];
});
function holdLast() {
  try {
    const v = Number(localStorage.getItem("trpg_ctx_hold_last"));
    if (v >= 100) return Math.min(5000, v);
  } catch (e) {}
  return 500;
}
function syncHoldUi() {
  const hs = document.getElementById("homeStatsOn");
  if (hs) hs.checked = homeStatsOn();
  const ms = window.ctxHoldMs();
  const shown = ms > 0 ? ms : holdLast();
  ["rsHold", "homeHold"].forEach((id) => {
    const sec = document.getElementById(id + "Sec"),
      off = document.getElementById(id + "Off");
    if (!sec || !off) return;
    off.checked = ms === 0;
    sec.disabled = ms === 0;
    sec.value = String(Math.round(shown / 10) / 100);
  });
}
function setHoldMs(ms) {
  try {
    localStorage.setItem("trpg_ctx_hold", String(ms));
    if (ms > 0) localStorage.setItem("trpg_ctx_hold_last", String(ms));
  } catch (err) {}
  syncHoldUi();
  message.textContent = ms === 0 ? "長押しでの円形メニューをやめました。" : "長押しの長さを" + (ms / 1000).toFixed(2).replace(/0$/, "") + "秒にしました。";
}
["rsHold", "homeHold"].forEach((id) => {
  document.getElementById(id + "Sec").addEventListener("change", (e) => {
    const v = parseFloat(e.target.value);
    if (!isFinite(v)) return syncHoldUi();
    setHoldMs(Math.round(Math.max(0.1, Math.min(5, v)) * 100) * 10);
  });
  document.getElementById(id + "Off").addEventListener("change", (e) => {
    setHoldMs(e.target.checked ? 0 : holdLast());
  });
});
document.getElementById("homeStatsOn").addEventListener("change", (e) => {
  try {
    localStorage.setItem("trpg_home_stats", e.target.checked ? "1" : "0");
  } catch (err) {}
  renderHome();
});
function syncRsHold() {
  syncHoldUi();
}
syncHoldUi();
function closeRadialSettings() {
  document.getElementById("radialDialog").classList.add("hidden");
}
document.getElementById("openRadialSettings").addEventListener("click", () => {
  document.getElementById("editorMenu").classList.add("hidden");
  openRadialSettings();
});
document.getElementById("rsClose").onclick = closeRadialSettings;
document.getElementById("radialDialog").addEventListener("click", (e) => {
  if (e.target.id === "radialDialog") closeRadialSettings();
});
document.getElementById("rsClear").onclick = () => {
  delete rsMap[rsSel];
  rsPersist();
  rsRender();
};
document.getElementById("rsReset").onclick = () => {
  const o = ctxCustomLoad();
  delete o[rsTab];
  ctxCustomSave(o);
  rsMap = Object.assign({}, ctxDefaultMap(rsTab));
  rsRender();
  toast("このタブの配置を初期に戻しました");
};
document.getElementById("rsSync").onclick = () => {
  const shared = ["growth", "viewer", "guide", "top", "go:basic", "go:stats", "go:skills", "go:out"];
  const o = ctxCustomLoad();
  o[rsTab] = rsMap;
  EDITOR_TABS.forEach((t) => {
    if (t.id === rsTab) return;
    const m = Object.assign({}, o[t.id] || ctxDefaultMap(t.id));
    shared.forEach((id) => {
      const s = rsSlotOf(id);
      if (s === null) return;
      Object.keys(m).forEach((k) => {
        if (m[k] === id) delete m[k];
      });
      const occ = m[s];
      if (occ && occ !== id) {
        for (let f = 0; f < 12; f++) if (!m[f] && !shared.includes(occ)) { m[f] = occ; break; }
      }
      m[s] = id;
    });
    o[t.id] = m;
  });
  ctxCustomSave(o);
  rsRender();
  toast("共通の操作の向きを、ほかのタブにもそろえました");
};
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeRadialSettings();
});
// 初回起動はホーム画面。既存の作成フォーム機能は編集画面内でそのまま利用する。
document.getElementById("spMode").addEventListener("change", (e) => setSkillPointMode(e.target.checked));
["spOccFormula", "spIntFormula"].forEach((id) => document.getElementById(id).addEventListener("input", updatePointSummary));
base.addEventListener("input", updatePointSummary);
new MutationObserver(updatePointSummary).observe(skills, { childList: true });
new MutationObserver(() => filterSkillRows()).observe(skills, { childList: true });
new MutationObserver(() => {
  if (skillStatusMode === "pick") renderSkillStatusPanel();
}).observe(skills, { childList: true });

// ===== v64：通知・正気度/不定・お気に入りセット・元に新規作成 =====
(function () {
  const t = document.createElement("div");
  t.id = "toast";
  t.className = "hidden";
  t.setAttribute("role", "status");
  document.body.append(t);
})();
let toastTimer = null;
function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add("hidden"), 2800);
}
function regenPaletteIfEmpty() {
  if (paletteOutput.value.trim() || paletteMode !== "generated") return;
  try {
    paletteOutput.value = generatedPaletteText();
  } catch (e) {}
}
function updateSanInfo() {
  const el = document.getElementById("sanInfo");
  if (!el) return;
  const row = [...derivedStatuses.querySelectorAll(".derived-row")].find((r) => r.dataset.derivedName === "SAN");
  const san = row ? Number(row.querySelector(".derived-preview").textContent) : NaN;
  if (!Number.isFinite(san)) {
    el.innerHTML = "<b>正気度</b>：能力値が確定すると表示されます";
    return;
  }
  const mr = findRowByName(skills, ".skill-name", "クトゥルフ神話");
  const mv = mr ? parseInt(mr.querySelector(".skill-value").value, 10) : 0;
  const myth = Number.isFinite(mv) ? mv : 0;
  const lim = Math.floor((san * 4) / 5);
  el.innerHTML =
    "<b>正気度</b> " +
    san +
    " ／ 上限 " +
    (99 - myth) +
    "（99−神話" +
    myth +
    "）<br><b>不定</b> 1日に" +
    (san - lim) +
    "以上減ると不定（正気度" +
    lim +
    "以下）";
}
skills.addEventListener("input", () => {
  updateSanInfo();
  filterSkillRows();
});
document.getElementById("hideInitial").addEventListener("change", filterSkillRows);
function deriveNewCharacter() {
  const f = captureForm();
  names.forEach((n) => {
    try {
      f.base[n] = String(rollFormula(statFormulas[n]));
    } catch (e) {}
  });
  f.dbOverride = "";
  f.charName = "";
  f.playerName = "";
  f.memo = "";
  f.profile = {};
  f.lists = {};
  f.secret = null;
  f.imageId = null;
  f.imageList = undefined;
  f.growthLog = undefined;
  f.output = "";
  f.palette = "";
  f.paletteMode = "generated";
  f.paletteOrderApplied = false;
  f.paletteOrderOverride = null;
  currentCharacterId = null;
  restoreForm(f);
  regenPaletteIfEmpty();
  refreshCharacterGroupSelect();
  document.getElementById("editingLabel").textContent = "元に作った新規キャラクター";
  toast("能力値を振り直しました。名前を入力してください");
}
document.getElementById("deriveCharacter").onclick = deriveNewCharacter;
document.getElementById("copyJsonEditor").onclick = () => copyCharacterJSON({ form: captureForm() });
document.getElementById("shareWithImages").onclick = () => shareWithImages();
document.getElementById("shareLink").onclick = () => shareLink();
document.getElementById("imgUploadSettingHome").onclick = () => configureImageUpload();
// お気に入りセット（技能名・成功値・ダメージ式の組）
function ensureSkillSets() {
  if (!Array.isArray(managerData.skillSets)) managerData.skillSets = [];
  return managerData.skillSets;
}
(function () {
  const d = document.createElement("div");
  d.id = "skillSetDialog";
  d.className = "hidden";
  d.setAttribute("role", "dialog");
  d.setAttribute("aria-modal", "true");
  d.innerHTML =
    '<div class="delete-dialog-card"><h2>お気に入りセット</h2><p class="hint">いまの技能欄（名前のある行）をセットとして保存し、他のキャラクターへまとめて適用できます。適用時、同名の技能があれば成功値・ダメージ式を上書きし、無ければ追加します。</p><div id="skillSetList"></div><div style="display:flex;gap:7px;margin-top:10px;flex-wrap:wrap"><button type="button" class="primary" id="skillSetSave">現在の技能を新しいセットとして保存</button><button type="button" id="skillSetClose">閉じる</button></div></div>';
  document.body.append(d);
  const list = d.querySelector("#skillSetList");
  const render = () => {
    list.innerHTML = "";
    const sets = ensureSkillSets();
    if (!sets.length) {
      const p = document.createElement("p");
      p.className = "hint";
      p.textContent = "保存済みのセットはありません。";
      list.append(p);
      return;
    }
    sets.forEach((set) => {
      const r = document.createElement("div");
      r.className = "skillset-row";
      const nm = document.createElement("span");
      nm.className = "nm";
      nm.textContent = set.name + "（" + set.items.length + "件）";
      const ap = document.createElement("button");
      ap.type = "button";
      ap.textContent = "適用";
      ap.onclick = () => {
        applySkillSet(set);
        d.classList.add("hidden");
      };
      const dl = document.createElement("button");
      dl.type = "button";
      dl.className = "danger";
      dl.textContent = "削除";
      dl.onclick = async () => {
        if (!(await askDialog({ title: "セットの削除", desc: "「" + set.name + "」を削除します。", okText: "削除", danger: true }))) return;
        managerData.skillSets = ensureSkillSets().filter((x) => x !== set);
        persistManagerData();
        render();
      };
      r.append(nm, ap, dl);
      list.append(r);
    });
  };
  document.getElementById("openSkillSets").onclick = () => {
    render();
    d.classList.remove("hidden");
  };
  d.querySelector("#skillSetClose").onclick = () => d.classList.add("hidden");
  d.addEventListener("click", (e) => {
    if (e.target === d) d.classList.add("hidden");
  });
  d.querySelector("#skillSetSave").onclick = async () => {
    const items = [...skills.querySelectorAll(".row")]
      .map((r) => ({
        name: r.querySelector(".skill-name").value.trim(),
        value: r.querySelector(".skill-value").value.trim(),
        damage: r.querySelector(".damage-value").value.trim(),
      }))
      .filter((x) => x.name);
    if (!items.length) {
      toast("名前のある技能がありません");
      return;
    }
    const nm = await askDialog({ title: "セット名", desc: items.length + "件の技能を保存します。", value: "", okText: "保存" });
    if (nm === null || !nm.trim()) return;
    ensureSkillSets().push({ id: uid(), name: nm.trim(), items });
    if (persistManagerData()) {
      render();
      toast("セットを保存しました");
    }
  };
})();
