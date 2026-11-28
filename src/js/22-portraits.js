function portraitStep(d) {
  const n = currentImageList.length;
  if (n < 2) return;
  const i = Math.max(0, currentImageList.indexOf(currentImageId));
  setPortrait(currentImageList[(i + d + n) % n]);
  scheduleDirtyCheck();
}
document.getElementById("portraitPrev").onclick = () => portraitStep(-1);
document.getElementById("portraitNext").onclick = () => portraitStep(1);
function portraitFull() {
  if (currentImageList.length >= MAX_PORTRAIT_IMAGES) {
    toast("画像は1キャラクターにつき" + MAX_PORTRAIT_IMAGES + "枚までです。不要な画像を削除してください");
    return true;
  }
  return false;
}
document.getElementById("portraitPick").onclick = () => {
  if (portraitFull()) return;
  document.getElementById("portraitFile").click();
};
document.getElementById("portraitFile").addEventListener("change", async (e) => {
  const files = [...(e.target.files || [])];
  e.target.value = "";
  if (!files.length) return;
  let added = 0,
    over = false,
    err = null,
    where = null,
    size = 0;
  for (const f of files) {
    if (currentImageList.length >= MAX_PORTRAIT_IMAGES) {
      over = true;
      break;
    }
    try {
      const blob = await resizeImage(f, imgFallback ? 480 : 640);
      const id = uid();
      where = await imgPut(id, blob);
      size = blob.size;
      await setPortrait(id);
      added++;
    } catch (er) {
      err = er;
    }
  }
  if (!added) {
    toast(
      over
        ? "画像は1キャラクターにつき" + MAX_PORTRAIT_IMAGES + "枚までです。不要な画像を削除してください"
        : "画像を読み込めませんでした：" + ((err && err.message) || err),
    );
    return;
  }
  scheduleDirtyCheck();
  const tail = over ? "（上限" + MAX_PORTRAIT_IMAGES + "枚のため、残りは追加していません）" : "";
  if (added > 1) {
    toast(added + "枚の画像を追加しました。保存すると反映されます" + tail);
    return;
  }
  toast(
    (where === "idb"
      ? "画像を追加しました（" + Math.round(size / 1024) + "KB）。保存すると反映されます"
      : where === "ls"
        ? "画像を追加しました。この環境では簡易保存になります（" + Math.round(size / 1024) + "KB）"
        : "画像を追加しました。ただしこの環境では保存領域が使えず、ページを閉じると消えます。バックアップに含めて保存してください") + tail,
  );
});
document.getElementById("portraitDel").onclick = async () => {
  const id = currentImageId;
  if (!id) return;
  const i = currentImageList.indexOf(id),
    list = currentImageList.filter((x) => x !== id);
  await setPortrait(list.length ? list[Math.min(Math.max(i, 0), list.length - 1)] : null, list);
  scheduleDirtyCheck();
  toast(
    list.length
      ? "この画像を削除しました（残り" + list.length + "枚）。保存すると反映されます"
      : "画像を削除しました。保存すると反映されます",
  );
};
document.getElementById("portraitUrl").onclick = async () => {
  if (portraitFull()) return;
  const input = await askDialog({
    title: "画像のURLで追加",
    desc: "画像のURL（https://…）を入力します。画像はこの端末に取り込まず、URLのまま表示します。",
    value: "",
    okText: "追加",
  });
  if (input === null) return;
  const url = input.trim();
  if (!url) return;
  if (!/^https?:\/\/\S+$/i.test(url)) {
    toast("http:// または https:// で始まるURLを入力してください");
    return;
  }
  const id = IMG_URL_PREFIX + url,
    had = currentImageList.includes(id);
  await setPortrait(id);
  scheduleDirtyCheck();
  toast(had ? "すでに追加済みの画像なので、その画像に切り替えました" : "画像のURLを追加しました。保存すると反映されます");
};
let imgGcTimer = null;
function scheduleImageGc() {
  clearTimeout(imgGcTimer);
  imgGcTimer = setTimeout(gcImages, 2500);
}
function formImageIds(f) {
  const out = [];
  if (!f) return out;
  if (f.imageId) out.push(f.imageId);
  if (Array.isArray(f.imageList))
    f.imageList.forEach((x) => {
      if (x) out.push(x);
    });
  return out;
}
function allSavedImageIds() {
  const ids = new Set();
  managerData.characters.forEach((c) => formImageIds(c.form).forEach((x) => ids.add(x)));
  managerData.groups.forEach((g) => formImageIds(g.template).forEach((x) => ids.add(x)));
  return ids;
}
async function gcImages() {
  try {
    const keep = allSavedImageIds();
    if (currentImageId) keep.add(currentImageId);
    currentImageList.forEach((x) => keep.add(x));
    const keys = await imgKeys();
    for (const k of keys) {
      if (!keep.has(k)) {
        await imgDel(k);
        const u = imageUrlCache.get(k);
        if (u) {
          URL.revokeObjectURL(u);
          imageUrlCache.delete(k);
        }
      }
    }
  } catch (e) {}
}
const blobToDataUrl = (b) =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(b);
  });
async function collectBackupImages() {
  const out = {};
  const ids = allSavedImageIds();
  for (const id of ids) {
    if (isImgUrlId(id)) continue;
    try {
      const b = await imgGet(id);
      if (b) out[id] = await blobToDataUrl(b);
    } catch (e) {}
  }
  return out;
}
async function restoreBackupImages(map) {
  for (const [id, url] of Object.entries(map || {})) {
    try {
      const b = await (await fetch(url)).blob();
      await imgPut(id, b);
    } catch (e) {}
  }
}
// ===== v73：未保存の検知（保存済みの内容と比べる）。ボタン表示・戻る確認・閉じる前の警告 =====
var savedSnap = null,
  dirtyTimer = null;
function formSnap(form) {
  return JSON.stringify(slimForm(form || captureForm()));
}
function setDirtyUI(d) {
  const b = document.getElementById("saveCharacter");
  if (b) b.classList.toggle("unsaved", !!d);
  const b2 = document.getElementById("saveStay");
  if (b2) b2.classList.toggle("unsaved", !!d);
  window.__formDirty = !!d;
}
function markSaved(form) {
  savedSnap = formSnap(form);
  setDirtyUI(false);
}
function markBaseline() {
  savedSnap = formSnap();
  setDirtyUI(false);
}
function markDirty() {
  savedSnap = null;
  setDirtyUI(true);
}
function checkDirty() {
  if (document.getElementById("editorView").classList.contains("hidden")) return;
  if (savedSnap === null) {
    setDirtyUI(true);
    return;
  }
  try {
    setDirtyUI(formSnap() !== savedSnap);
  } catch (e) {}
}
function scheduleDirtyCheck() {
  clearTimeout(dirtyTimer);
  dirtyTimer = setTimeout(checkDirty, 250);
}
["input", "change", "click", "pointerup", "keyup"].forEach((t) =>
  document.getElementById("editorView").addEventListener(t, scheduleDirtyCheck),
);
const _derive = deriveNewCharacter;
deriveNewCharacter = function () {
  _derive.apply(this, arguments);
  markDirty();
};
const _dup = duplicateCharacter;
duplicateCharacter = function () {
  _dup.apply(this, arguments);
  markDirty();
};
window.addEventListener("beforeunload", (e) => {
  if (
    window.__formDirty &&
    (!document.getElementById("editorView").classList.contains("hidden") ||
      (document.body.classList.contains("viewer-mode") && viewerSrc === "editor"))
  ) {
    e.preventDefault();
    e.returnValue = "";
  }
});
document.getElementById("backHome").addEventListener(
  "click",
  async (e) => {
    if (!window.__formDirty) return;
    e.stopImmediatePropagation();
    e.preventDefault();
    const ok = await askDialog({
      title: "保存していない変更があります",
      desc: "保存せずに戻ると、変更は失われます。",
      okText: "保存せずに戻る",
      danger: true,
    });
    if (ok) {
      setDirtyUI(false);
      showHome();
    }
  },
  true,
);
// ===== v74：入れ子グループ（グループは複数の親を持てる。キャラクターは従来どおり複数グループに所属できる） =====
function groupParents(g) {
  return (Array.isArray(g.parentIds) ? g.parentIds : []).filter((id) => id !== g.id && managerData.groups.some((x) => x.id === id));
}
function topGroups() {
  return managerData.groups.filter((g) => !groupParents(g).length);
}
function childGroups(id) {
  return managerData.groups.filter((g) => groupParents(g).includes(id));
}
function groupDescendants(id) {
  const out = new Set(),
    q = [id];
  while (q.length) {
    const cur = q.pop();
    childGroups(cur).forEach((c) => {
      if (!out.has(c.id)) {
        out.add(c.id);
        q.push(c.id);
      }
    });
  }
  return out;
}
function groupAncestors(g) {
  const chain = [],
    seen = new Set([g.id]);
  let cur = g;
  while (cur) {
    const par = groupParents(cur)[0];
    const pg = par && managerData.groups.find((x) => x.id === par);
    if (!pg || seen.has(pg.id)) break;
    chain.unshift(pg);
    seen.add(pg.id);
    cur = pg;
  }
  return chain;
}
function groupPath(g) {
  return [...groupAncestors(g), g].map((x) => x.name).join(" ＞ ");
}
function renderCrumb(g) {
  const nav = document.getElementById("groupCrumb");
  nav.innerHTML = "";
  const add = (label, fn) => {
    if (nav.childNodes.length) {
      const sp = document.createElement("span");
      sp.className = "sep";
      sp.textContent = "＞";
      nav.append(sp);
    }
    if (fn) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = label;
      b.onclick = fn;
      nav.append(b);
    } else {
      const t = document.createElement("span");
      t.textContent = label;
      t.style.fontWeight = "700";
      nav.append(t);
    }
  };
  add("ホーム", () => {
    viewGroupId = null;
    showHome();
  });
  groupAncestors(g).forEach((a) => add(a.name, () => showGroupView(a.id)));
  add(g.name, null);
}
document.getElementById("groupNewSub").onclick = async () => {
  const parent = viewGroupId;
  if (!parent) return;
  const input = await askDialog({ title: "サブグループを作成", value: "", okText: "作成" });
  if (input === null) return;
  const name = input.trim();
  if (!name) {
    toast("グループ名を入力してください");
    return;
  }
  managerData.groups.push({ id: uid(), name, nextNumber: 1, template: null, parentIds: [parent], createdAt: new Date().toISOString() });
  if (!persistManagerData()) return;
  renderGroupView();
  renderHome();
  refreshBatchSelect();
  refreshCharacterGroupSelect();
};
(function () {
  const d = document.createElement("div");
  d.id = "groupMoveDialog";
  d.className = "hidden";
  d.setAttribute("role", "dialog");
  d.setAttribute("aria-modal", "true");
  d.innerHTML =
    '<div class="delete-dialog-card"><h2>場所を変更（親グループ）</h2><p class="hint">このグループを入れる親グループを選びます（複数可）。何も選ばなければ、ホームの最上位に置きます。</p><div id="groupMoveList"></div><div style="display:flex;gap:7px;margin-top:10px"><button type="button" class="primary" id="groupMoveOk">保存</button><button type="button" id="groupMoveCancel">キャンセル</button></div></div>';
  document.body.append(d);
  let target = null;
  document.getElementById("groupMove").onclick = () => {
    const g = managerData.groups.find((x) => x.id === viewGroupId);
    if (!g) return;
    target = g;
    const blocked = groupDescendants(g.id);
    blocked.add(g.id);
    const list = document.getElementById("groupMoveList");
    list.innerHTML = "";
    const cands = managerData.groups.filter((x) => !blocked.has(x.id));
    if (!cands.length) {
      const p = document.createElement("p");
      p.className = "hint";
      p.textContent = "移動先にできるグループがありません。";
      list.append(p);
    }
    cands.forEach((x) => {
      const lb = document.createElement("label");
      lb.className = "move-row";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.value = x.id;
      cb.checked = groupParents(g).includes(x.id);
      const sp = document.createElement("span");
      sp.textContent = groupPath(x);
      lb.append(cb, sp);
      list.append(lb);
    });
    d.classList.remove("hidden");
  };
  document.getElementById("groupMoveCancel").onclick = () => d.classList.add("hidden");
  d.addEventListener("click", (e) => {
    if (e.target === d) d.classList.add("hidden");
  });
  document.getElementById("groupMoveOk").onclick = () => {
    if (!target) return;
    target.parentIds = [...document.querySelectorAll("#groupMoveList input:checked")].map((x) => x.value);
    d.classList.add("hidden");
    if (!persistManagerData()) return;
    renderGroupView();
    renderHome();
    refreshBatchSelect();
    refreshCharacterGroupSelect();
    toast("場所を変更しました");
  };
})();
// ===== v75：メモ欄などの高さを内容に合わせて自動で広げる =====
const AUTOGROW_SEL = "#memo,#secretMemoText,.profile-long textarea";
function autoGrow(t) {
  if (!t || t.offsetHeight === 0) return;
  t.style.height = "auto";
  const min = parseFloat(getComputedStyle(t).minHeight) || 0;
  t.style.height = Math.max(min, t.scrollHeight + 2) + "px";
}
function refreshAutoGrow(root) {
  (root || document).querySelectorAll(AUTOGROW_SEL).forEach(autoGrow);
}
document.getElementById("editorView").addEventListener("input", (e) => {
  if (e.target.matches && e.target.matches(AUTOGROW_SEL)) autoGrow(e.target);
});
document.addEventListener(
  "toggle",
  (e) => {
    if (e.target.tagName === "DETAILS" && e.target.open) refreshAutoGrow(e.target);
  },
  true,
);

// ===== v83：閲覧モード（保存済みキャラクターを、編集欄を開かずに読み取り専用で見る） =====
let viewerId = null;
function vwEl(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
const VW_DICE_RE = DICE_ANY_RE;
// 保存されたフォームから、表示用の数値（ステータス・技能値・DB）を計算する。ダイスを含む式は振らずに式のまま見せる。
