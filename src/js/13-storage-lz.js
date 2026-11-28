// ===== キャラクター保存・ホーム・グループ管理 =====
const STORAGE_KEY = "trpg-character-manager-v1";
var currentImageId = null,
  currentImageList = [],
  growthLog = [];
var secretBlob = null,
  secretKey = null,
  secretSalt = null,
  secretOpen = false,
  secretText = "",
  restoreSecretSkip = false;
let managerData = { characters: [], groups: [], skillSets: [] };
let currentCharacterId = null;
let currentGroupId = null;
let currentGroupIds = [];
function characterGroupIds(c) {
  return Array.isArray(c.groupIds)
    ? c.groupIds.filter((id) => managerData.groups.some((g) => g.id === id))
    : c.groupId && managerData.groups.some((g) => g.id === c.groupId)
      ? [c.groupId]
      : [];
}
function uid() {
  return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9);
}
// ===== 保存の圧縮（LZW：バイト列→1文字1コード、辞書は上限で固定）。戻せなければ圧縮せず保存する =====
const LZ_MAX = 0xd800;
function lzEncode(str) {
  const bytes = new TextEncoder().encode(str),
    dict = new Map(),
    out = [];
  let next = 256;
  if (!bytes.length) return "";
  let cur = bytes[0];
  for (let i = 1; i < bytes.length; i++) {
    const b = bytes[i],
      k = cur * 256 + b,
      e = dict.get(k);
    if (e !== undefined) cur = e;
    else {
      out.push(cur);
      if (next < LZ_MAX) dict.set(k, next++);
      cur = b;
    }
  }
  out.push(cur);
  let r = "";
  for (let i = 0; i < out.length; i += 8192) r += String.fromCharCode.apply(null, out.slice(i, i + 8192));
  return r;
}
function lzDecode(str) {
  if (!str.length) return "";
  const prefix = [],
    suffix = [];
  let next = 256;
  const out = [];
  const expand = (c) => {
    const a = [];
    while (c >= 256) {
      a.push(suffix[c]);
      c = prefix[c];
    }
    a.push(c);
    return a.reverse();
  };
  let prev = str.charCodeAt(0);
  let pe = expand(prev);
  for (const x of pe) out.push(x);
  for (let i = 1; i < str.length; i++) {
    const c = str.charCodeAt(i);
    let e;
    if (c < next) e = expand(c);
    else if (c === next) e = pe.concat([pe[0]]);
    else throw Error("壊れた圧縮データ");
    for (const x of e) out.push(x);
    if (next < LZ_MAX) {
      prefix[next] = prev;
      suffix[next] = e[0];
      next++;
    }
    prev = c;
    pe = e;
  }
  return new TextDecoder().decode(new Uint8Array(out));
}
function packStore(json) {
  try {
    const c = lzEncode(json);
    if (lzDecode(c) === json && c.length + 4 < json.length) return "LZ1:" + c;
  } catch (e) {}
  return json;
}
function unpackStore(raw) {
  return raw.startsWith("LZ1:") ? lzDecode(raw.slice(4)) : raw;
}
// 保存用に軽くする：再生成できる出力と空欄は保存しない（開いたとき復元する）
function slimForm(f) {
  const o = { ...f };
  delete o.output;
  if (
    (o.paletteMode || "generated") === "generated" &&
    !o.paletteOrderApplied &&
    !(o.paletteOrderOverride && o.paletteOrderOverride.length)
  )
    delete o.palette;
  if (o.lists && !Object.keys(o.lists).length) delete o.lists;
  if (o.profile) {
    const p = {};
    Object.keys(o.profile).forEach((k) => {
      if (String(o.profile[k] || "").trim()) p[k] = o.profile[k];
    });
    o.profile = p;
  }
  if (Array.isArray(o.skills))
    o.skills = o.skills.map((r) => {
      const x = {};
      Object.keys(r).forEach((k) => {
        if (r[k] !== "" && r[k] !== false && r[k] != null) x[k] = r[k];
      });
      if (x.name === undefined) x.name = "";
      // 技能ポイント内訳は、4つとも空なら省く（一部でも入力があれば4つとも保持）
      if (!(x.base || x.occ || x.int || x.other)) {
        delete x.base;
        delete x.occ;
        delete x.int;
        delete x.other;
      } else {
        ["base", "occ", "int", "other"].forEach((k) => {
          if (x[k] === undefined) x[k] = "";
        });
      }
      return x;
    });
  if (Array.isArray(o.extras)) o.extras = o.extras.filter((x) => x && (x.name || x.value));
  return o;
}
function serializeManager() {
  return JSON.stringify({
    ...managerData,
    characters: managerData.characters.map((ch) => (ch.form ? { ...ch, form: slimForm(ch.form) } : ch)),
  });
}
function loadManagerData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(unpackStore(raw));
      if (parsed && Array.isArray(parsed.characters) && Array.isArray(parsed.groups)) managerData = parsed;
    }
  } catch (e) {
    message.textContent = "保存データを読み込めませんでした。バックアップがあれば復元してください。";
  }
  if (!Array.isArray(managerData.skillSets)) managerData.skillSets = [];
  renderHome();
}
function persistManagerData() {
  try {
    const json = serializeManager(),
      packed = packStore(json);
    localStorage.setItem(STORAGE_KEY, packed);
    document.getElementById("storageInfo").textContent =
      "このブラウザに保存（" +
      managerData.characters.length +
      "キャラ・" +
      managerData.groups.length +
      "グループ・約" +
      Math.max(1, Math.round((packed.length * 2) / 1024)) +
      "KB" +
      (packed.startsWith("LZ1:") ? "・圧縮" : "") +
      "）";
    if (typeof scheduleImageGc === "function") scheduleImageGc();
    return true;
  } catch (e) {
    message.textContent = "保存できませんでした。ブラウザの保存容量を確認し、バックアップを取ってください。";
    return false;
  }
}
function captureForm() {
  return {
    base: readBaseRaw(),
    ...statDeltaData(),
    ...(skillStatusMode !== "all" ? { skillStatusMode } : {}),
    ...(skillOrderCustom ? { skillOrderCustom: true } : {}),
    ...(Object.keys(paletteLabelMap).length ? { paletteLabelMap } : {}),
    dbOverride: document.getElementById("dbOverride").value,
    derived: [...derivedStatuses.querySelectorAll(".derived-row")].map((r) => ({
      name: r.dataset.derivedName,
      formula: r.querySelector(".derived-formula").value,
      custom: r.dataset.custom === "1",
    })),
    extras: [...extras.querySelectorAll(".row")].map((r) => ({
      name: r.querySelector(".extra-name").value,
      value: r.querySelector(".extra-value").value,
    })),
    skills: [...skills.querySelectorAll(".row")].map((r) => ({
      name: r.querySelector(".skill-name").value,
      value: r.querySelector(".skill-value").value,
      base: r.querySelector(".skill-base").value,
      occ: r.querySelector(".skill-occ").value,
      int: r.querySelector(".skill-int").value,
      other: r.querySelector(".skill-other").value,
      otherRoll:
        r.dataset.otherRoll !== undefined && r.dataset.otherSrc === r.querySelector(".skill-other").value.trim()
          ? Number(r.dataset.otherRoll)
          : undefined,
      secret: rowSecret(r),
      damage: r.querySelector(".damage-value").value,
      dsecret: rowSecretDmg(r),
      ...rowMoreData(r),
    })),
    spMode: document.body.classList.contains("sp-on"),
    spOccFormula: document.getElementById("spOccFormula").value,
    spIntFormula: document.getElementById("spIntFormula").value,
    charName: document.getElementById("charName").value,
    playerName: document.getElementById("playerName").value,
    memo: document.getElementById("memo").value,
    profile: readProfile(),
    lists: readLists(),
    secret: secretBlob || undefined,
    growthLog: growthLog.length ? JSON.parse(JSON.stringify(growthLog)) : undefined,
    imageId: currentImageId || undefined,
    imageList: currentImageList.length > 1 ? [...currentImageList] : undefined,
    palette: paletteOutput.value,
    paletteMode,
    paletteOrderApplied,
    paletteOrderOverride,
    extraPaletteCommands: document.getElementById("extraPaletteCommands").value,
    numbering: document.getElementById("numbering").checked,
    preserveFormulas: document.getElementById("preserveFormulas").checked,
    outputSettings: {
      indefinite: document.getElementById("includeIndefinite").checked,
      rollMode,
      preserveFormulas: document.getElementById("preserveFormulas").checked,
      autoUpdate,
      paletteHeads: document.getElementById("paletteHeads").checked,
      successMemo: document.getElementById("includeSuccessMemo").checked,
    },
    output: output.value,
  };
}
function restoreForm(d) {
  if (!d) return;
  growthLog = Array.isArray(d.growthLog) ? JSON.parse(JSON.stringify(d.growthLog)) : [];
  names.forEach((n) => {
    const el = document.getElementById("base-" + n);
    if (el) el.value = d.base && d.base[n] != null ? String(d.base[n]) : statFormulas[n];
    const a = statDeltaInput(n, "add"),
      o = statDeltaInput(n, "other");
    if (a) a.value = d.baseAdd && d.baseAdd[n] != null ? String(d.baseAdd[n]) : "";
    if (o) o.value = d.baseOther && d.baseOther[n] != null ? String(d.baseOther[n]) : "";
  });
  updateStatTotals();
  document.getElementById("dbOverride").value = d.dbOverride || "";
  derivedStatuses.innerHTML = "";
  const derivedList = (d.derived || derivedDefinitions).slice();
  // 古い保存データには回避がないので補う
  if (!derivedList.some((x) => x.name === "回避")) {
    const k = derivedList.findIndex((x) => x.name === "知識");
    derivedList.splice(k >= 0 ? k + 1 : derivedList.length, 0, { name: "回避", formula: "DEX*2" });
  }
  derivedList.forEach((x) => addDerivedStatus({ name: x.name, formula: x.formula, custom: !!x.custom }));
  extras.innerHTML = "";
  (d.extras || []).forEach((x) => addExtra(x.name || "", x.value || ""));
  skills.innerHTML = "";
  (d.skills && d.skills.length ? d.skills : [{ name: "", value: "" }]).forEach((x) => {
    const added = addSkill(
      x.name || "",
      x.value || "",
      x.base !== undefined ? { base: x.base, occ: x.occ, int: x.int, other: x.other, otherRoll: x.otherRoll } : undefined,
      !!x.secret,
      x.damage || "",
      !!x.dsecret,
    );
    setRowMore(added.row, x);
  });
  setSkillStatusMode(d.skillStatusMode);
  document.getElementById("spOccFormula").value = d.spOccFormula || "EDU*20";
  document.getElementById("spIntFormula").value = d.spIntFormula || "INT*10";
  setSkillPointMode(!!d.spMode);
  // 旧形式の保存データ（ダメージ式が別リスト）は、同名の技能行へ統合して読み込む
  (Array.isArray(d.damages) ? d.damages : []).forEach((x) => {
    if (x) addDamage(x.name || "", x.value || "", !!x.secret);
  });
  if (!skills.children.length) addSkill();
  document.getElementById("charName").value = d.charName || "";
  document.getElementById("playerName").value = d.playerName || "";
  document.getElementById("memo").value = d.memo || "";
  writeProfile(d.profile);
  writeLists(d.lists);
  if (!restoreSecretSkip) restoreSecret(d.secret);
  setPortrait(d.imageId || null, normImageList(d.imageList, d.imageId));
  paletteOutput.value = d.palette || "";
  paletteMode = d.paletteMode || "generated";
  skillOrderCustom = !!d.skillOrderCustom;
  paletteLabelMap = {};
  if (d.paletteLabelMap && typeof d.paletteLabelMap === "object")
    Object.entries(d.paletteLabelMap).forEach(([k, v]) => {
      if (typeof v === "string") paletteLabelMap[k] = v;
    });
  paletteOrderApplied = !!d.paletteOrderApplied;
  paletteOrderOverride = Array.isArray(d.paletteOrderOverride) ? d.paletteOrderOverride : null;
  document.getElementById("extraPaletteCommands").value = d.extraPaletteCommands || "";
  renderPaletteCommandList();
  refreshPaletteStatusOptions();
  document.getElementById("numbering").checked = !!d.numbering;
  document.getElementById("preserveFormulas").checked = !!d.preserveFormulas;
  output.value = d.output || "";
  // 出力設定（判定方式・自動更新・計算式の出力）はキャラクターごとに復元する。古い保存データには無いので、そのときは現在の設定を保つ。
  document.getElementById("includeIndefinite").checked = !(d.outputSettings && d.outputSettings.indefinite === false);
  document.getElementById("paletteHeads").checked = !!(d.outputSettings && d.outputSettings.paletteHeads);
  document.getElementById("includeSuccessMemo").checked = !!(d.outputSettings && d.outputSettings.successMemo);
  refreshPaletteHeadings();
  if (d.outputSettings) {
    const o = d.outputSettings;
    if (o.rollMode === "CC" || o.rollMode === "CCB") {
      rollMode = o.rollMode;
      updateRollModeButton();
    }
    if (typeof o.preserveFormulas === "boolean") document.getElementById("preserveFormulas").checked = o.preserveFormulas;
    if (typeof o.autoUpdate === "boolean") {
      autoUpdate = o.autoUpdate;
      updateAutoButton();
    }
  }
  refreshDBDisplay();
  updateDerivedPreviews();
}
function setScreen(mode, title, subtitle) {
  const home = mode === "home",
    vw = mode === "viewer";
  document.body.classList.toggle("home-mode", home);
  document.body.classList.toggle("editor-mode", !home && !vw);
  document.body.classList.toggle("viewer-mode", vw);
  document.body.classList.remove("group-mode");
  document.getElementById("viewerView").classList.toggle("hidden", !vw);
  const view = document.getElementById(home ? "homeView" : vw ? "viewerView" : "editorView");
  view.classList.remove("view-enter");
  void view.offsetWidth;
  view.classList.add("view-enter");
}
function showEditor() {
  document.getElementById("backHome").textContent = viewGroupId ? "← グループ" : "← ホーム";
  document.getElementById("saveCharacter").textContent = viewGroupId ? "保存してグループへ" : "保存してホームへ";
  document.getElementById("homeView").classList.add("hidden");
  document.getElementById("groupView").classList.add("hidden");
  document.getElementById("editorView").classList.remove("hidden");
  refreshBatchSelect();
  refreshCharacterGroupSelect();
  setScreen(
    "editor",
    document.getElementById("editingLabel").textContent || "キャラクター編集",
    "能力値・技能・出力などを編集します。ホームとは色と画面構成が変わります。",
  );
  applyEditorTabs();
  window.scrollTo(0, 0);
  markBaseline();
  requestAnimationFrame(() => refreshAutoGrow());
}
function showHome() {
  document.getElementById("editorView").classList.add("hidden");
  if (viewGroupId && managerData.groups.some((g) => g.id === viewGroupId)) {
    showGroupView(viewGroupId);
    return;
  }
  viewGroupId = null;
  document.getElementById("groupView").classList.add("hidden");
  document.getElementById("homeView").classList.remove("hidden");
  renderHome();
  setScreen("home", "ホーム", "グループや保存済みキャラクターを管理します。");
  window.scrollTo(0, 0);
}
function newCharacter() {
  currentCharacterId = null;
  currentGroupId = null;
  currentGroupIds = [];
  generatedNameBase = null;
  generatedNameLast = null;
  generatedNameCount = 0;
  restoreForm({ base: statFormulas, derived: derivedDefinitions, skills: [{ name: "", value: "" }], damages: [{ name: "", value: "" }] });
  document.getElementById("editingLabel").textContent = "新規キャラクター";
  showEditor();
}
function saveCurrentCharacter(silent = false) {
  const form = captureForm();
  if (!form.charName.trim()) {
    if (!silent) message.textContent = "キャラクター名を入力してください。";
    return false;
  }
  let record = managerData.characters.find((x) => x.id === currentCharacterId);
  const selectedGroups = [...document.querySelectorAll("#characterGroupChecks input[type=checkbox]:checked")].map((x) => x.value);
  currentGroupIds = selectedGroups;
  currentGroupId = selectedGroups[0] || null;
  if (!record) {
    record = { id: uid(), groupId: currentGroupId, groupIds: selectedGroups, createdAt: new Date().toISOString() };
    managerData.characters.push(record);
    currentCharacterId = record.id;
  }
  record.name = form.charName.trim();
  record.form = form;
  record.updatedAt = new Date().toISOString();
  record.groupIds = selectedGroups;
  record.groupId = currentGroupId;
  if (!persistManagerData()) return false;
  markSaved(form);
  return true;
}
function openCharacter(id) {
  const c = managerData.characters.find((x) => x.id === id);
  if (!c) return;
  currentCharacterId = id;
  currentGroupIds = characterGroupIds(c);
  currentGroupId = currentGroupIds[0] || null;
  restoreForm(c.form);
  regenPaletteIfEmpty();
  document.getElementById("editingLabel").textContent = "編集中：" + c.name;
  showEditor();
}
function duplicateCharacter() {
  const form = captureForm();
  form.charName = (form.charName || "キャラクター") + " コピー";
  currentCharacterId = null;
  currentGroupId = null;
  currentGroupIds = [];
  form.output = "";
  restoreForm(form);
  refreshCharacterGroupSelect();
  document.getElementById("editingLabel").textContent = "複製した新規キャラクター";
}
// 標準の prompt/confirm はアプリ内ブラウザ等で無言でキャンセルされるため、ページ内ダイアログで代替する。
// value を渡すと入力欄付き（OKで文字列、キャンセルでnull）。value省略時は確認のみ（OKでtrue、キャンセルでnull）。
