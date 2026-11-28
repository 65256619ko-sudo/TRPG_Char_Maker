function setImgUrl(id, url) {
  try {
    const m = imgUrlMap();
    m[id] = url;
    localStorage.setItem(IMG_URL_MAP_KEY, JSON.stringify(m));
  } catch (e) {}
}
async function uploadOneImage(id) {
  const c = imgUploadConfig();
  const b = await imgGet(id);
  if (!b) throw Error("画像が見つかりません");
  const big = await resizeImage(b, 2048, 0.9);
  const fd = new FormData();
  fd.append("file", big, "portrait." + (big.type === "image/webp" ? "webp" : "jpg"));
  fd.append("upload_preset", c.preset);
  const ac = new AbortController(),
    tm = setTimeout(() => ac.abort(), 90000);
  try {
    const r = await fetch("https://api.cloudinary.com/v1_1/" + encodeURIComponent(c.cloud) + "/image/upload", {
      method: "POST",
      body: fd,
      signal: ac.signal,
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.secure_url) throw Error((j.error && j.error.message) || "アップロードに失敗しました（" + r.status + "）");
    if (!/^https:\/\//.test(j.secure_url)) throw Error("URLが不正です");
    setImgUrl(id, j.secure_url);
    return j.secure_url;
  } finally {
    clearTimeout(tm);
  }
}
// 立ち絵のうち、まだURLがない端末内の画像を上げる。失敗した画像はスキップして、成否を返す
async function ensureImagesUploaded() {
  const need = currentImageList.filter((id) => !issuedUrlOf(id));
  let ok = 0,
    fail = 0,
    msg = "";
  for (let i = 0; i < need.length; i++) {
    toast("画像をアップロード中… " + (i + 1) + "/" + need.length);
    try {
      await uploadOneImage(need[i]);
      ok++;
    } catch (e) {
      fail++;
      msg = e.message || String(e);
    }
  }
  return { ok, fail, msg, total: need.length };
}
function configureImageUpload() {
  const c = imgUploadConfig();
  const cloud = prompt("Cloudinary の Cloud name を入れてください（空欄で既定に戻します）", c.cloud);
  if (cloud === null) return;
  const preset = prompt("アップロードプリセット名（署名なし）を入れてください", c.preset);
  if (preset === null) return;
  try {
    localStorage.setItem(IMG_UPLOAD_CFG_KEY, JSON.stringify({ cloud: cloud.trim(), preset: preset.trim() }));
  } catch (e) {}
  toast(imgUploadReady() ? "画像アップロードの設定を保存しました" : "設定が空です。共有リンクは画像なし（小さい1枚）になります");
}
// ===== v99：共有リンク。キャラクターを圧縮して、リンクの # 以降に入れる（サーバーなし。開くとこのツールが読み取る） =====
function b64urlEncode(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(t) {
  t = t.replace(/-/g, "+").replace(/_/g, "/");
  while (t.length % 4) t += "=";
  const b = atob(t),
    a = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i);
  return a;
}
async function streamBytes(kind, bytes) {
  const S = new (kind === "z" ? CompressionStream : DecompressionStream)("deflate-raw");
  const w = S.writable.getWriter();
  w.write(bytes);
  w.close();
  return new Uint8Array(await new Response(S.readable).arrayBuffer());
}
async function packShare(text) {
  const raw = new TextEncoder().encode(text);
  if (window.CompressionStream) {
    try {
      return "z" + b64urlEncode(await streamBytes("z", raw));
    } catch (e) {}
  }
  return "r" + b64urlEncode(raw);
}
async function unpackShare(code) {
  const k = code[0],
    bytes = b64urlDecode(code.slice(1));
  if (k === "z") return new TextDecoder().decode(await streamBytes("u", bytes));
  if (k === "r") return new TextDecoder().decode(bytes);
  throw Error("リンクの形式が分かりません");
}
// クリップボードへコピー。標準APIが先、だめなら textarea + execCommand。両方だめなら最初のエラーを投げる
async function copyTextOrThrow(t) {
  try {
    await navigator.clipboard.writeText(t);
  } catch (e) {
    const ta = document.createElement("textarea");
    ta.value = t;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    if (!ok) throw e;
  }
}
async function copyText(t) {
  try {
    await copyTextOrThrow(t);
    return true;
  } catch (e) {
    return false;
  }
}
const SHARE_LINK_MAX = 9000;
async function shareLink() {
  try {
    await askShareSecret();
    const base = location.href.split("#")[0];
    // 画像：未公開のものがあれば、確認してアップロード→公開URLで共有（リンクが短く、全部の画像が入る）。しなければ、小さい1枚だけ付ける
    let uploadNote = "";
    const pending = currentImageList.filter((id) => !issuedUrlOf(id));
    if (pending.length && imgUploadReady()) {
      if (
        confirm(
          "未公開の画像が" +
            pending.length +
            "枚あります。\nアップロードして公開URLにしますか？（URLを知っている人は誰でも見られます）\n\nOK：アップロードして共有\nキャンセル：画像は小さい1枚だけ付けて共有",
        )
      ) {
        const u = await ensureImagesUploaded();
        if (u.fail) uploadNote = "（" + u.fail + "枚はアップロードできませんでした：" + u.msg + "）";
      }
    }
    const allUrl = currentImageList.length > 0 && currentImageList.every((id) => issuedUrlOf(id));
    let obj = await buildShareObject(112, !allUrl),
      link = base + "#c=" + (await packShare(JSON.stringify(obj))),
      withImg = !!(obj.toolImages && obj.toolImages.length);
    if (link.length > SHARE_LINK_MAX && withImg) {
      delete obj.toolImages;
      delete obj.toolImageActive;
      withImg = false;
      link = base + "#c=" + (await packShare(JSON.stringify(obj)));
    }
    if (link.length > SHARE_LINK_MAX && obj.toolExtra) {
      const gl = obj.toolExtra.growthLog;
      if (gl) obj.toolExtra = { growthLog: gl };
      else delete obj.toolExtra;
      link = base + "#c=" + (await packShare(JSON.stringify(obj)));
      uploadNote += "（長いため、分類・メモ・内訳は含めていません）";
      if (link.length > SHARE_LINK_MAX && obj.toolExtra) {
        delete obj.toolExtra;
        link = base + "#c=" + (await packShare(JSON.stringify(obj)));
        uploadNote += "（成長記録も含められませんでした。「画像つきで共有（ファイル）」なら全部送れます）";
      }
    }
    if (!(await copyText(link))) {
      toast("コピーできませんでした");
      return;
    }
    let msg =
      "共有リンクをコピーしました（" +
      link.length +
      "文字" +
      (withImg ? (allUrl ? "・画像" + obj.toolImages.length + "枚" : "・画像つき") : "・画像なし") +
      "）" +
      uploadNote;
    if (link.length > SHARE_LINK_MAX) msg += "。長いので、送れない場合は「画像つきで共有（ファイル）」を使ってください";
    else if (location.protocol === "file:") msg += "。ただし、このツールをURLで公開していないと、友達は開けません";
    toast(msg);
  } catch (e) {
    toast("共有リンクを作れません：" + (e.message || String(e)));
  }
}
// リンクから開いたとき：確認してから、新規キャラクターとして取り込む
async function handleShareHash() {
  const m = location.hash.match(/^#c=([A-Za-z0-9_-]+)$/);
  if (!m) return;
  const clear = () => {
    try {
      history.replaceState(null, "", location.pathname + location.search);
    } catch (e) {
      location.hash = "";
    }
  };
  try {
    const obj = JSON.parse(await unpackShare(m[1]));
    const d = obj.data || {};
    const nm = String(d.name || "名前なし").slice(0, 40);
    clear();
    if (
      !confirm("共有されたキャラクター「" + nm + "」を、新規キャラクターとして開きますか？\n（保存するまで、このツールには追加されません）")
    )
      return;
    newCharacter();
    document.getElementById("jsonImport").value = JSON.stringify(obj);
    importCharacterJSON();
  } catch (e) {
    clear();
    toast("共有リンクを読み取れませんでした。リンクが途中で切れていないか確認してください");
  }
}
// 画像つき共有ファイルを読み込んだとき、同梱の画像をこの端末に取り込んで立ち絵にする
async function importToolImages(obj) {
  try {
    const arr = obj && Array.isArray(obj.toolImages) ? obj.toolImages : null;
    if (!arr || !arr.length) return;
    const ids = [];
    let activeId = null;
    const act = Number(obj.toolImageActive) || 0;
    for (let i = 0; i < arr.length && ids.length < MAX_PORTRAIT_IMAGES; i++) {
      const it = arr[i] || {};
      let id = null;
      if (typeof it.url === "string" && /^https?:\/\/\S+$/i.test(it.url.trim())) id = IMG_URL_PREFIX + it.url.trim();
      else if (typeof it.data === "string" && /^data:image\//.test(it.data)) {
        const b = await (await fetch(it.data)).blob();
        id = uid();
        await imgPut(id, b);
      }
      if (id) {
        if (i === act) activeId = id;
        ids.push(id);
      }
    }
    if (ids.length) {
      await setPortrait(activeId || ids[0], ids);
      toast("画像を" + ids.length + "枚、取り込みました。保存すると確定します");
    }
  } catch (e) {
    toast("画像の取り込みに失敗しました：" + (e.message || String(e)));
  }
}
function importIconUrls(d) {
  const ok = (u) => typeof u === "string" && /^https?:\/\/\S+$/i.test(u.trim());
  const urls = [];
  [...(Array.isArray(d.faces) ? d.faces.map((f) => f && f.iconUrl) : []), d.iconUrl].forEach((u) => {
    if (ok(u) && !urls.includes(u.trim())) urls.push(u.trim());
  });
  if (!urls.length) return;
  const main = ok(d.iconUrl) ? d.iconUrl.trim() : urls[0];
  setPortrait(IMG_URL_PREFIX + main, [...currentImageList, ...urls.map((u) => IMG_URL_PREFIX + u)]);
}
function createBatch() {
  const count = Number(document.getElementById("batchCount").value);
  if (!Number.isInteger(count) || count < 1 || count > 1000) {
    batchMsg("生成数は1〜1000で指定してください。");
    return;
  }
  const baseNameInput = document.getElementById("batchBaseName");
  const baseName = baseNameInput.value.trim();
  if (!baseName) {
    batchMsg("キャラクター名を入力してください（末尾に連番が付きます）。");
    baseNameInput.focus();
    return;
  }
  const select = document.getElementById("batchGroupSelect");
  let g,
    isNew = select.value === "__new__";
  if (isNew) {
    g = { id: uid(), name: baseName, batch: true, nextNumber: 1, template: captureForm(), createdAt: new Date().toISOString() };
  } else {
    g = managerData.groups.find((x) => x.id === select.value);
    if (!g) return;
  }
  const template = JSON.parse(JSON.stringify(g.template || captureForm()));
  if (!g.template) g.template = JSON.parse(JSON.stringify(template));
  const created = [];
  // 既存グループに追加するときは、前回の続きの番号から振る（新規グループは1から）
  const startNumber = Number(g.nextNumber) || 1;
  try {
    for (let i = 0; i < count; i++) {
      const form = JSON.parse(JSON.stringify(template));
      for (const n of names) {
        const raw = String(form.base[n] ?? "");
        if (/[dD]/.test(raw)) form.base[n] = String(rollFormula(raw));
      }
      rollBatchFormDice(form);
      const fullName = baseName + (startNumber + i);
      form.charName = fullName;
      form.output = "";
      if (currentImageId) form.imageId = currentImageId;
      if (currentImageList.length > 1) form.imageList = [...currentImageList];
      delete form.growthLog;
      created.push({
        id: uid(),
        groupId: g.id,
        groupIds: [g.id],
        name: fullName,
        form,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  } catch (e) {
    batchMsg("一括生成エラー：" + e.message);
    return;
  }
  // 保存できなければ元に戻す。容量が足りないときは、実際に作れる数を探して知らせる
  const origNext = g.nextNumber,
    beforeLen = managerData.characters.length;
  const tryCommit = (n) => {
    g.nextNumber = startNumber + n;
    if (isNew && !managerData.groups.includes(g)) managerData.groups.push(g);
    managerData.characters.length = beforeLen;
    managerData.characters.push(...created.slice(0, n));
    return persistManagerData();
  };
  const rollback = () => {
    managerData.characters.length = beforeLen;
    if (isNew) managerData.groups = managerData.groups.filter((x) => x !== g);
    else g.nextNumber = origNext;
    persistManagerData();
  };
  if (!tryCommit(count)) {
    let lo = 0,
      hi = count - 1;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (tryCommit(mid)) lo = mid;
      else hi = mid - 1;
    }
    rollback();
    batchMsg(
      lo > 0
        ? "ブラウザの保存領域が足りないため作成できませんでした。いまの空きでは約" +
            lo +
            "体までです。生成数を減らすか、不要なキャラを整理してください。"
        : "ブラウザの保存領域がいっぱいで作成できません。バックアップを取って、不要なキャラを整理してください。",
    );
    return;
  }

  closeBatchDialog();
  showGroupView(g.id);
}
document.getElementById("homeSearch").addEventListener("input", () => renderHome());
(function () {
  const more = document.getElementById("groupMore"),
    menu = document.getElementById("groupMenu");
  const close = () => {
    menu.classList.add("hidden");
    more.setAttribute("aria-expanded", "false");
  };
  more.addEventListener("click", (e) => {
    e.stopPropagation();
    const open = menu.classList.toggle("hidden") === false;
    more.setAttribute("aria-expanded", String(open));
  });
  menu.addEventListener("click", close);
  document.addEventListener("click", (e) => {
    if (!menu.contains(e.target) && e.target !== more) close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });
})();
document.getElementById("groupBack").onclick = () => {
  const g = managerData.groups.find((x) => x.id === viewGroupId),
    par = g ? groupParents(g)[0] : null;
  if (par) {
    showGroupView(par);
    return;
  }
  viewGroupId = null;
  showHome();
};
document.getElementById("groupRename").onclick = () => renameGroup(viewGroupId);
document.getElementById("groupDuplicate").onclick = () => duplicateGroupTree(viewGroupId);
document.getElementById("groupDelete").onclick = () => deleteGroup(viewGroupId);
document.getElementById("groupNewCharacter").onclick = () => {
  const id = viewGroupId;
  newCharacter();
  currentGroupIds = [id];
  currentGroupId = id;
  refreshCharacterGroupSelect();
};
document.getElementById("homeCreateGroup").onclick = async () => {
  const input = await askDialog({ title: "グループを作成", value: "", okText: "作成" });
  if (input === null) return;
  const name = input.trim();
  if (!name) {
    message.textContent = "グループ名を入力してください。";
    return;
  }
  const g = { id: uid(), name, nextNumber: 1, template: null, createdAt: new Date().toISOString() };
  managerData.groups.push(g);
  if (!persistManagerData()) return;
  refreshBatchSelect();
  refreshCharacterGroupSelect();
  showGroupView(g.id);
};

document.getElementById("deleteGroupOnly").onclick = () => confirmGroupDelete(false);
document.getElementById("deleteGroupAndMembers").onclick = () => confirmGroupDelete(true);
document.getElementById("cancelGroupDelete").onclick = closeGroupDelete;
document.getElementById("groupDeleteDialog").addEventListener("click", (e) => {
  if (e.target.id === "groupDeleteDialog") closeGroupDelete();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !document.getElementById("groupDeleteDialog").classList.contains("hidden")) closeGroupDelete();
});
document.getElementById("newCharacter").onclick = newCharacter;
document.getElementById("saveStay").addEventListener("click", (e) => {
  e.preventDefault();
  try {
    if (saveCurrentCharacter()) {
      setDirtyUI(false);
      toast("保存しました（この画面のまま）");
    } else {
      const name = document.getElementById("charName");
      if (name && !name.value.trim()) {
        message.textContent = "キャラクター名を入力してください。";
        name.focus();
      }
    }
  } catch (err) {
    message.textContent = "保存エラー：" + err.message;
  }
});
