async function copyCharacterJSON(c) {
  restoreSecretSkip = true;
  const snapshot = captureForm();
  const oldId = currentCharacterId,
    oldGroupId = currentGroupId,
    oldGroupIds = [...currentGroupIds],
    oldLabel = document.getElementById("editingLabel").textContent;
  try {
    restoreForm(c.form || {});
    document.getElementById("preserveFormulas").checked = !!(c.form && c.form.preserveFormulas);
    const customPalette = paletteOutput.value;
    const data = makeData({
      allowInvalidDamage: !!customPalette.trim(),
      preserveFormulas: document.getElementById("preserveFormulas").checked,
    });
    if (customPalette.trim() && (paletteOrderApplied || paletteOrderOverride)) data.data.commands = jsonizePalette(customPalette);
    else if (customPalette.trim() && paletteMode === "manual") data.data.commands = manualPaletteCommands(customPalette);
    data.data.commands = addPaletteHeadings(data.data.commands);
    const json = JSON.stringify(data, null, 2);
    await copyTextOrThrow(json);
    toast("JSONをコピーしました");
  } catch (e) {
    toast("JSONコピーに失敗しました：" + (e.message || String(e)));
  } finally {
    restoreForm(snapshot);
    restoreSecretSkip = false;
    currentCharacterId = oldId;
    currentGroupId = oldGroupId;
    currentGroupIds = oldGroupIds;
    document.getElementById("editingLabel").textContent = oldLabel;
  }
}
function makeHomeTutorial() {
  const box = document.createElement("div");
  box.className = "home-tutorial";
  box.innerHTML =
    "<h3>はじめての方へ</h3>" +
    '<ol><li><b>＋ 新規キャラクター</b>を押して、名前と能力値を入れます（「3d6で能力値を振る」も使えます）。</li>' +
    "<li><b>技能</b>のタブで「基本技能を適用」を押し、割り振りを入力します。</li>" +
    "<li><b>出力</b>のタブでJSONやチャットパレットを作り、ココフォリアなどに貼り付けます。</li>" +
    "<li>「保存してホームへ」で、ここにキャラが並びます。「閲覧」でステータスを見られます。</li></ol>" +
    '<p class="muted">データはこの端末のブラウザ内に保存されます。ときどき「バックアップ」でファイルに残しておくと安心です。画面の空いた所を長押し（パソコンは右クリック）すると、円形メニューが出ます。</p>';
  const b = document.createElement("button");
  b.type = "button";
  b.className = "primary";
  b.textContent = "＋ 最初のキャラクターを作る";
  b.onclick = () => quickClick("newCharacter");
  box.append(b);
  return box;
}
function homeStatsOn() {
  try {
    return localStorage.getItem("trpg_home_stats") !== "0";
  } catch (e) {
    return true;
  }
}
// ホームのカードに、HP・MP・SAN などの基本ステータスを小さく出す（閲覧画面と同じ計算）
function makeHomeStats(c) {
  if (!homeStatsOn() || !c.form) return null;
  let k;
  try {
    k = viewerCompute(c.form);
  } catch (e) {
    return null;
  }
  const wrap = document.createElement("div");
  wrap.className = "card-stats";
  ["HP", "MP", "SAN"].forEach((n) => {
    const d = k.derived.find((x) => x.name === n);
    if (!d || d.value === "—") return;
    const sp = document.createElement("span");
    sp.className = "cs-chip";
    const b = document.createElement("b");
    b.textContent = n;
    sp.append(b, document.createTextNode(d.value));
    wrap.append(sp);
  });
  return wrap.children.length ? wrap : null;
}
function makeCharacterCard(c, opts) {
  opts = opts || {};
  const card = document.createElement("div");
  card.className = "home-card";
  const top = document.createElement("div");
  top.className = "card-top";
  if (opts.select) {
    const pk = document.createElement("input");
    pk.type = "checkbox";
    pk.className = "pick";
    pk.checked = bulkSel.has(c.id);
    pk.setAttribute("aria-label", (c.name || "名称未設定") + "を選択");
    card.classList.toggle("is-selected", pk.checked);
    pk.addEventListener("change", () => {
      if (pk.checked) bulkSel.add(c.id);
      else bulkSel.delete(c.id);
      card.classList.toggle("is-selected", pk.checked);
      updateBulkBar();
    });
    top.append(pk);
  }
  const h = document.createElement("h3");
  h.textContent = c.name || "名称未設定";
  const copyJson = document.createElement("button");
  copyJson.type = "button";
  copyJson.className = "copy-json";
  copyJson.textContent = "JSONコピー";
  copyJson.onclick = () => copyCharacterJSON(c);
  top.append(h, copyJson);
  const p = document.createElement("p");
  const grps = characterGroupIds(c)
    .map((id) => managerData.groups.find((x) => x.id === id))
    .filter(Boolean);
  p.textContent = (grps.length ? grps.map((g) => g.name).join("・") + "　" : "") + "更新 " + (c.updatedAt ? fmtDate(c.updatedAt) : "不明");
  if (grps.length) {
    p.insertAdjacentHTML("afterbegin", icon("folder"));
    p.firstChild.classList.add("ic-l");
  }
  const actions = document.createElement("div");
  actions.className = "actions act-tiers";
  const edit = document.createElement("button");
  edit.className = "primary";
  edit.textContent = "編集";
  edit.onclick = () => openCharacter(c.id);
  const vwb = document.createElement("button");
  vwb.textContent = "閲覧";
  vwb.onclick = () => showViewer(c.id);
  h.classList.add("vw-open");
  h.title = "タップで閲覧";
  h.onclick = () => showViewer(c.id);
  const acts = cardActionList(c, opts.removeFrom);
  const mk = (id) => {
    const a = acts.find((x) => x.id === id);
    const bt = document.createElement("button");
    bt.type = "button";
    bt.textContent = a.label;
    bt.className = "pc-act" + (a.danger ? " danger" : "");
    bt.onclick = a.run;
    return bt;
  };
  const rm = opts.removeFrom ? mk("remove") : null;
  if (rm) rm.title = "キャラクターは削除せず、このグループへの所属だけを外します";
  const der = mk("derive");
  der.title = "このキャラを元に、能力値を振り直して新規作成";
  // v90：右利きで親指が届きやすいよう、よく使う「閲覧」「編集」は右下にまとめ、たまに使うボタンは上の段に右寄せで並べる
  // スマホ幅では、たまに使うボタンを「⋯」メニューにまとめる（CSSで切り替え）
  const sub = document.createElement("div");
  sub.className = "act-sub";
  const mainRow = document.createElement("div");
  mainRow.className = "act-main";
  const more = document.createElement("button");
  more.type = "button";
  more.className = "card-more";
  more.textContent = "⋯";
  more.setAttribute("aria-label", "その他の操作");
  more.setAttribute("aria-haspopup", "menu");
  more.onclick = () => openCardMenu(more, c, opts.removeFrom);
  sub.append(...[mk("del"), rm, der, mk("dup"), mk("output"), mk("growth"), more].filter(Boolean));
  mainRow.append(vwb, edit);
  actions.append(sub, mainRow);
  card.dataset.cid = c.id;
  card.dataset.rmfrom = opts.removeFrom || "";
  const pf = (c.form && c.form.profile) || {},
    infoParts = [pf.job ? "職業：" + pf.job : "", pf.tags ? "タグ：" + pf.tags : ""].filter(Boolean);
  card.append(top);
  if (c.form && c.form.imageId) addCardPortrait(card, c.form.imageId, (c.name || "") + "の立ち絵");
  if (infoParts.length) {
    const inf = document.createElement("p");
    inf.className = "card-info";
    inf.textContent = infoParts.join("　");
    card.append(inf);
  }
  const hs = makeHomeStats(c);
  if (hs) card.append(hs);
  card.append(p, actions);
  return card;
}
async function setBatchImage(g, file) {
  try {
    const blob = await resizeImage(file, imgFallback ? 480 : 640);
    const id = uid();
    await imgPut(id, blob);
    managerData.characters
      .filter((c) => characterGroupIds(c).includes(g.id))
      .forEach((c) => {
        c.form = c.form || {};
        c.form.imageId = id;
        delete c.form.imageList;
      });
    if (g.template) {
      g.template.imageId = id;
      delete g.template.imageList;
    }
    persistManagerData();
    scheduleImageGc();
    renderGroupView();
    toast("全員の画像を変更しました");
  } catch (err) {
    toast("画像を読み込めませんでした：" + (err.message || err));
  }
}
function renderBatchImage(g, members) {
  const box = document.getElementById("batchImageBox");
  box.innerHTML = "";
  box.classList.toggle("hidden", !g.batch);
  if (!g.batch) return;
  const withImg = members.find((c) => c.form && c.form.imageId);
  const th = document.createElement("div");
  th.className = "bi-thumb";
  if (withImg) {
    const im = document.createElement("img");
    im.alt = "";
    im.referrerPolicy = "no-referrer";
    th.append(im);
    imageUrl(withImg.form.imageId).then((u) => {
      if (u) im.src = u;
      else setIconText(th, "image");
    });
  } else setIconText(th, "image");
  const pick = document.createElement("button");
  pick.type = "button";
  setIconText(pick, "image", "画像を全員に設定");
  const hint = document.createElement("span");
  hint.className = "muted";
  hint.textContent = "1体だけ変えたいときは、そのキャラの「編集」で変更できます";
  const fi = document.createElement("input");
  fi.type = "file";
  fi.accept = "image/*";
  fi.className = "hidden";
  pick.onclick = () => fi.click();
  fi.onchange = () => {
    const f = fi.files && fi.files[0];
    fi.value = "";
    if (f) setBatchImage(g, f);
  };
  const side = document.createElement("div");
  side.className = "bi-side";
  side.append(pick, hint);
  box.append(th, side, fi);
}
function makeBatchRow(c, g) {
  const row = document.createElement("div");
  row.className = "batch-row";
  const info = document.createElement("div");
  info.className = "b-info";
  const nm = document.createElement("strong");
  nm.textContent = c.name || "名称未設定";
  nm.classList.add("vw-open");
  nm.title = "タップで閲覧";
  nm.onclick = () => showViewer(c.id);
  const st = document.createElement("span");
  st.className = "b-stats";
  const bs = (c.form && c.form.base) || {};
  names.forEach((n) => {
    const i = document.createElement("i");
    i.textContent = n + (bs[n] === undefined || bs[n] === "" ? "-" : bs[n]);
    st.append(i);
  });
  info.append(nm, st);
  const ed = document.createElement("button");
  ed.className = "primary";
  ed.textContent = "編集";
  ed.onclick = () => openCharacter(c.id);
  const js = document.createElement("button");
  js.textContent = "JSON";
  js.title = "ココフォリア用JSONをコピー";
  js.onclick = () => copyCharacterJSON(c);
  const dl = document.createElement("button");
  dl.className = "danger";
  dl.textContent = "×";
  dl.title = "削除";
  dl.setAttribute("aria-label", (c.name || "") + "を削除");
  dl.onclick = () => deleteCharacter(c.id);
  row.append(info, dl, js, ed);
  return row;
}
function renderGroupView() {
  const g = managerData.groups.find((x) => x.id === viewGroupId);
  if (!g) {
    viewGroupId = null;
    showHome();
    return;
  }
  const members = managerData.characters.filter((c) => characterGroupIds(c).includes(g.id));
  setIconText(document.getElementById("groupViewTitle"), g.batch ? "dice" : "folderOpen", g.name + (g.batch ? " ×" + members.length : ""));
  document.getElementById("sec-subgroups").classList.toggle("hidden", !!g.batch && !childGroups(g.id).length);
  document.getElementById("sec-groupmembers").querySelector("h2").textContent = g.batch ? "メンバー" : "キャラクター";
  renderBatchImage(g, members);
  const subs = childGroups(g.id);
  document.getElementById("groupViewInfo").textContent = g.batch
    ? "連続生成　" + members.length + "体"
    : members.length + "キャラクター" + (subs.length ? "・サブグループ" + subs.length : "");
  renderCrumb(g);
  const sl = document.getElementById("subGroupList");
  sl.innerHTML = "";
  if (!subs.length) {
    const p0 = document.createElement("p");
    p0.className = "muted";
    p0.textContent = "サブグループはありません。";
    sl.append(p0);
  }
  subs.forEach((sg) => sl.append(makeGroupCard(sg, {})));
  const list = document.getElementById("groupMemberList");
  list.innerHTML = "";
  if (!members.length) {
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = "このグループにキャラクターはいません。";
    list.append(p);
  }
  if (g.batch)
    members
      .slice()
      .sort((a, b) => String(a.name).localeCompare(String(b.name), "ja", { numeric: true }))
      .forEach((c) => list.append(makeBatchRow(c, g)));
  else sortCharacters(members).forEach((c) => list.append(makeCharacterCard(c, { removeFrom: g.id })));
}
function showGroupView(id) {
  if (!managerData.groups.some((g) => g.id === id)) return;
  viewGroupId = id;
  ["homeView", "editorView"].forEach((i) => document.getElementById(i).classList.add("hidden"));
  document.getElementById("groupView").classList.remove("hidden");
  renderGroupView();
  setScreen("home", "グループ", "");
  document.body.classList.add("group-mode");
  window.scrollTo(0, 0);
}
async function deleteCharacter(id) {
  const c = managerData.characters.find((x) => x.id === id);
  if (!c) return;
  if (!(await askDialog({ title: "キャラクターの削除", desc: "「" + c.name + "」を削除しますか？", okText: "削除", danger: true }))) return;
  managerData.characters = managerData.characters.filter((x) => x.id !== id);
  if (!persistManagerData()) return;
  renderHome();
  if (viewGroupId) renderGroupView();
}
async function renameGroup(id) {
  const g = managerData.groups.find((x) => x.id === id);
  if (!g) return;
  const oldName = g.name;
  const input = await askDialog({ title: "グループ名の変更", value: oldName, okText: "変更" });
  if (input === null) return;
  const newName = input.trim();
  if (!newName || newName === oldName) return;
  // グループ名だけを変更し、所属キャラクターの名前は一切変更しない。
  g.name = newName;
  persistManagerData();
  renderHome();
  if (viewGroupId) renderGroupView();
  refreshBatchSelect();
  refreshCharacterGroupSelect();
}
let pendingDeleteGroupId = null;
function deleteGroup(id) {
  const g = managerData.groups.find((x) => x.id === id);
  if (!g) return;
  pendingDeleteGroupId = id;
  const count = managerData.characters.filter((c) => characterGroupIds(c).includes(id)).length;
  document.getElementById("deleteDialogDescription").textContent =
    `「${g.name}」と所属キャラクター${count}体をどうしますか？削除方法を選んでください。${childGroups(id).length ? "（サブグループは削除されず、最上位に移ります）" : ""}`;
  document.getElementById("groupDeleteDialog").classList.remove("hidden");
  document.getElementById("cancelGroupDelete").focus();
}
function closeGroupDelete() {
  pendingDeleteGroupId = null;
  document.getElementById("groupDeleteDialog").classList.add("hidden");
}
function confirmGroupDelete(deleteMembers) {
  const id = pendingDeleteGroupId;
  if (!id) return;
  managerData.characters = managerData.characters.filter((c) => {
    const had = characterGroupIds(c).includes(id);
    const ids = characterGroupIds(c).filter((x) => x !== id);
    c.groupIds = ids;
    c.groupId = ids[0] || null;
    // 他のどのグループにも属さない「このグループのメンバー」だけを削除する（もともとグループに入っていないキャラは消さない）
    return !(deleteMembers && had && ids.length === 0);
  });
  managerData.groups.forEach((x) => {
    if (Array.isArray(x.parentIds)) x.parentIds = x.parentIds.filter((pid) => pid !== id);
  });
  managerData.groups = managerData.groups.filter((x) => x.id !== id);
  closeGroupDelete();
  persistManagerData();
  if (viewGroupId === id) viewGroupId = null;
  showHome();
  refreshBatchSelect();
  refreshCharacterGroupSelect();
}
// グループを、キャラクターとサブグループごと複製する（保存できなければ全て元に戻す）
async function duplicateGroupTree(id) {
  const g = managerData.groups.find((x) => x.id === id);
  if (!g) return;
  const src = new Set([id, ...groupDescendants(id)]);
  const srcGroups = managerData.groups.filter((x) => src.has(x.id));
  const members = managerData.characters.filter((c) => characterGroupIds(c).some((x) => src.has(x)));
  const subN = srcGroups.length - 1;
  const what = [members.length ? "キャラクター" + members.length + "体" : "", subN ? "サブグループ" + subN + "個" : ""]
    .filter(Boolean)
    .join("と");
  const input = await askDialog({
    title: "グループを複製",
    desc: "複製先のグループ名を入力してください。" + (what ? what + "も一緒に複製されます。" : ""),
    value: g.name + " コピー",
    okText: "複製",
  });
  if (input === null) return;
  const newName = input.trim();
  if (!newName) {
    toast("グループ名を入力してください");
    return;
  }
  const now = new Date().toISOString(),
    gmap = new Map();
  srcGroups.forEach((x) => gmap.set(x.id, uid()));
  const newGroups = srcGroups.map((x) => {
    const ng = JSON.parse(JSON.stringify(x));
    ng.id = gmap.get(x.id);
    ng.createdAt = now;
    ng.nextNumber = Number(x.nextNumber) || 1;
    if (x.id === id) {
      ng.name = newName;
      ng.parentIds = [...groupParents(x)];
    } else ng.parentIds = groupParents(x).map((p) => gmap.get(p) || p);
    if (!x.template) ng.template = null;
    return ng;
  });
  const newChars = members.map((c) => {
    const form = JSON.parse(JSON.stringify(c.form || {}));
    // 複製先でもキャラクター名は元の名前をそのまま引き継ぐ。
    form.charName = c.name || form.charName || "";
    const gids = characterGroupIds(c)
      .filter((x) => src.has(x))
      .map((x) => gmap.get(x));
    return { id: uid(), groupId: gids[0] || null, groupIds: gids, name: form.charName, form, createdAt: now, updatedAt: now };
  });
  const prevGroups = managerData.groups,
    prevChars = managerData.characters;
  managerData.groups = [...prevGroups, ...newGroups];
  managerData.characters = [...prevChars, ...newChars];
  if (!persistManagerData()) {
    // ブラウザの保存領域が足りないときは、複製を取り消して元の状態に戻す
    managerData.groups = prevGroups;
    managerData.characters = prevChars;
    persistManagerData();
    toast("ブラウザの保存領域が足りないため複製できませんでした。不要なキャラを整理してください");
    return;
  }
  const newTop = gmap.get(id);
  renderHome();
  refreshBatchSelect();
  refreshCharacterGroupSelect();
  if (viewGroupId === id) {
    showGroupView(newTop);
    return;
  }
  if (viewGroupId && managerData.groups.some((x) => x.id === viewGroupId)) renderGroupView();
  toast("「" + newName + "」を複製しました（" + (what || "空のグループ") + "）");
}
