function applySkillSet(set) {
  const fire = (el) => el.dispatchEvent(new Event("input", { bubbles: true }));
  set.items.forEach((it) => {
    const row = findRowByName(skills, ".skill-name", it.name);
    if (row) {
      if (it.value) {
        const v = row.querySelector(".skill-value");
        v.value = it.value;
        fire(v);
      }
      if (it.damage) {
        const dm = row.querySelector(".damage-value");
        dm.value = it.damage;
        fire(dm);
      }
    } else addSkill(it.name, it.value, undefined, false, it.damage || "", false);
  });
  removeBlankSkillRows();
  filterSkillRows();
  toast("「" + set.name + "」を適用しました");
}
// ===== v69：ロックメモ（パスワードで暗号化：PBKDF2 + AES-GCM）。ココフォリアのJSONには含めない =====
const secretEnc = new TextEncoder(),
  secretDec = new TextDecoder();
let secretChain = Promise.resolve();
const secB64 = (u) => {
  let t = "";
  u.forEach((x) => (t += String.fromCharCode(x)));
  return btoa(t);
};
const secUnB64 = (t) => Uint8Array.from(atob(t), (c) => c.charCodeAt(0));
async function secretDerive(pw, salt) {
  const km = await crypto.subtle.importKey("raw", secretEnc.encode(pw), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 200000, hash: "SHA-256" },
    km,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}
async function secretEncryptNow(text) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, secretKey, secretEnc.encode(text)));
  secretBlob = { v: 1, s: secB64(secretSalt), i: secB64(iv), c: secB64(ct) };
}
function secretQueue(text) {
  secretChain = secretChain.then(() => secretEncryptNow(text)).catch(() => {});
  return secretChain;
}
async function askPassword(title, desc) {
  const pr = askDialog({ title, desc, value: "", okText: "OK" });
  const f = document.getElementById("inputDialogField");
  f.type = "password";
  f.autocomplete = "off";
  const eye = document.createElement("button");
  eye.type = "button";
  eye.className = "small-btn";
  eye.style.marginTop = "6px";
  setIconText(eye, "eye", "入力中のパスワードを見る");
  eye.onclick = () => {
    const show = f.type === "password";
    f.type = show ? "text" : "password";
    setIconText(eye, show ? "eyeOff" : "eye", show ? "パスワードを隠す" : "入力中のパスワードを見る");
  };
  f.parentNode.insertBefore(eye, f.nextSibling);
  const r = await pr;
  eye.remove();
  f.type = "text";
  return r;
}
function restoreSecret(blob) {
  secretBlob = blob && blob.c ? blob : null;
  secretKey = null;
  secretSalt = null;
  secretOpen = false;
  secretText = "";
  renderSecret();
}
function renderSecret() {
  const box = document.getElementById("secretBody");
  if (!box) return;
  box.innerHTML = "";
  const hint = (t) => {
    const p = document.createElement("p");
    p.className = "hint";
    p.textContent = t;
    box.append(p);
  };
  const btn = (t, fn, cls, iconName) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "small-btn" + (cls ? " " + cls : "");
    if (iconName) setIconText(b, iconName, t);
    else b.textContent = t;
    b.onclick = fn;
    box.append(b);
    return b;
  };
  const det = document.getElementById("secretBlock");
  if (!(window.crypto && crypto.subtle)) {
    hint("この環境では暗号化が使えません（https などの安全な接続で開いてください）。");
    return;
  }
  if (secretOpen) {
    det.open = true;
    const ta = document.createElement("textarea");
    ta.id = "secretMemoText";
    ta.placeholder = "ここに書いた内容は暗号化して保存されます（GM用の秘密・本音など）";
    ta.value = secretText;
    ta.addEventListener("input", () => {
      secretText = ta.value;
      secretQueue(secretText).then(() => scheduleAutoUpdate());
    });
    box.append(ta);
    btn(
      "ロックする",
      async () => {
        await secretQueue(secretText);
        secretKey = null;
        secretSalt = null;
        secretOpen = false;
        secretText = "";
        renderSecret();
        toast("ロックしました");
      },
      "",
      "lock",
    );
    btn("パスワード変更", async () => {
      const a = await askPassword("新しいパスワード", "忘れると開けなくなります。");
      if (!a) return;
      secretSalt = crypto.getRandomValues(new Uint8Array(16));
      secretKey = await secretDerive(a, secretSalt);
      await secretQueue(secretText);
      toast("パスワードを変更しました");
    });
    btn(
      "メモを削除",
      async () => {
        if (!(await askDialog({ title: "ロックメモの削除", desc: "暗号化したメモを完全に消します。", okText: "削除", danger: true })))
          return;
        secretBlob = null;
        secretKey = null;
        secretSalt = null;
        secretOpen = false;
        secretText = "";
        renderSecret();
      },
      "danger",
    );
    hint(
      "書いた内容は暗号文として保存されます。ココフォリア用JSONには、メモ欄の「【ロックメモ】SM1:…」という暗号文の行として入り、このツールで読み込むと元に戻ります（パスワードが無いと読めません）。パスワードを忘れると復元できません。",
    );
  } else if (secretBlob) {
    const p = document.createElement("p");
    p.className = "secret-state";
    setIconText(p, "lock", "ロック中");
    box.append(p);
    btn("パスワードで開く", async () => {
      const pw = await askPassword("ロックメモを開く", "");
      if (!pw) return;
      try {
        const salt = secUnB64(secretBlob.s);
        const key = await secretDerive(pw, salt);
        const plain = secretDec.decode(
          await crypto.subtle.decrypt({ name: "AES-GCM", iv: secUnB64(secretBlob.i) }, key, secUnB64(secretBlob.c)),
        );
        secretKey = key;
        secretSalt = salt;
        secretText = plain;
        secretOpen = true;
        renderSecret();
      } catch (e) {
        toast("パスワードが違います");
      }
    });
  } else {
    hint("パスワードを決めると、このキャラクター専用の秘密のメモを書けます。内容は暗号化され、JSONには暗号文だけが入ります。");
    btn("パスワードを設定して使う", async () => {
      const a = await askPassword("パスワードを設定", "忘れると開けなくなります。");
      if (!a) return;
      const b = await askPassword("もう一度入力", "確認のため、同じパスワードを入力してください。");
      if (b !== a) {
        toast("パスワードが一致しませんでした");
        return;
      }
      secretSalt = crypto.getRandomValues(new Uint8Array(16));
      secretKey = await secretDerive(a, secretSalt);
      secretText = "";
      secretOpen = true;
      await secretQueue("");
      renderSecret();
    });
  }
}
renderSecret();
// ===== v70：立ち絵（IndexedDBに保存。縮小したWebP/JPEGのみ） =====
let imgDbPromise = null;
function imgDb() {
  if (!imgDbPromise)
    imgDbPromise = new Promise((res, rej) => {
      if (!window.indexedDB) {
        rej(Error("IndexedDBが使えません"));
        return;
      }
      const r = indexedDB.open("trpg-images-v1", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("images");
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  return imgDbPromise;
}
async function imgTx(mode, fn) {
  const db = await imgDb();
  return new Promise((res, rej) => {
    const t = db.transaction("images", mode),
      st = t.objectStore("images"),
      rq = fn(st);
    t.oncomplete = () => res(rq && rq.result);
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error);
  });
}
// IndexedDBが開けない環境（シークレット表示・ブラウザの保存領域の不具合など）では、localStorage、それも無理ならメモリに保存する
const imgMem = new Map(),
  IMG_LS = "trpg-img-";
let imgFallback = false;
const lsGet = (k) => {
  try {
    return localStorage.getItem(k);
  } catch (e) {
    return null;
  }
};
const lsSet = (k, v) => {
  try {
    localStorage.setItem(k, v);
    return true;
  } catch (e) {
    return false;
  }
};
const lsDel = (k) => {
  try {
    localStorage.removeItem(k);
  } catch (e) {}
};
async function imgPut(id, blob) {
  if (!imgFallback) {
    try {
      await imgTx("readwrite", (st) => st.put(blob, id));
      return "idb";
    } catch (e) {
      imgFallback = true;
    }
  }
  imgMem.set(id, blob);
  try {
    const u = await blobToDataUrl(blob);
    if (lsSet(IMG_LS + id, u)) return "ls";
  } catch (e) {}
  return "mem";
}
async function imgGet(id) {
  if (imgMem.has(id)) return imgMem.get(id);
  const d = lsGet(IMG_LS + id);
  if (d) {
    try {
      const b = await (await fetch(d)).blob();
      imgMem.set(id, b);
      return b;
    } catch (e) {}
  }
  if (imgFallback) return null;
  try {
    return await imgTx("readonly", (st) => st.get(id));
  } catch (e) {
    imgFallback = true;
    return null;
  }
}
async function imgDel(id) {
  imgMem.delete(id);
  lsDel(IMG_LS + id);
  if (!imgFallback) {
    try {
      await imgTx("readwrite", (st) => st.delete(id));
    } catch (e) {}
  }
}
async function imgKeys() {
  const k = new Set(imgMem.keys());
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const n = localStorage.key(i);
      if (n && n.startsWith(IMG_LS)) k.add(n.slice(IMG_LS.length));
    }
  } catch (e) {}
  if (!imgFallback) {
    try {
      ((await imgTx("readonly", (st) => st.getAllKeys())) || []).forEach((x) => k.add(x));
    } catch (e) {
      imgFallback = true;
    }
  }
  return [...k];
}
const imageUrlCache = new Map();
// 画像は「この端末に保存した画像（ID）」か「外部の画像URL（"url:https://…"）」のどちらか。URLは取り込まず、そのまま表示に使う。
const IMG_URL_PREFIX = "url:";
function isImgUrlId(id) {
  return typeof id === "string" && id.startsWith(IMG_URL_PREFIX) && /^https?:\/\/\S+$/i.test(id.slice(IMG_URL_PREFIX.length));
}
function imgUrlOf(id) {
  return isImgUrlId(id) ? id.slice(IMG_URL_PREFIX.length) : "";
}
async function imageUrl(id) {
  if (!id) return null;
  if (isImgUrlId(id)) return imgUrlOf(id);
  if (imageUrlCache.has(id)) return imageUrlCache.get(id);
  try {
    const b = await imgGet(id);
    if (!b) return null;
    const u = URL.createObjectURL(b);
    imageUrlCache.set(id, u);
    return u;
  } catch (e) {
    return null;
  }
}
async function decodeImage(file) {
  try {
    return await createImageBitmap(file);
  } catch (e) {}
  const url = URL.createObjectURL(file);
  try {
    const im = new Image();
    await new Promise((ok, ng) => {
      im.onload = ok;
      im.referrerPolicy = "no-referrer";
      im.onerror = () => ng(Error("画像として読めないファイルです"));
      im.src = url;
    });
    return { width: im.naturalWidth, height: im.naturalHeight, im, close() {}, _draw: (c, w, h) => c.drawImage(im, 0, 0, w, h) };
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  }
}
async function resizeImage(file, maxSide = 640, quality = 0.82) {
  const bmp = await decodeImage(file);
  const k = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const cv = document.createElement("canvas");
  cv.width = Math.max(1, Math.round(bmp.width * k));
  cv.height = Math.max(1, Math.round(bmp.height * k));
  if (bmp._draw) bmp._draw(cv.getContext("2d"), cv.width, cv.height);
  else cv.getContext("2d").drawImage(bmp, 0, 0, cv.width, cv.height);
  if (bmp.close) bmp.close();
  let blob = await new Promise((r) => cv.toBlob(r, "image/webp", quality));
  if (!blob || blob.type !== "image/webp") blob = await new Promise((r) => cv.toBlob(r, "image/jpeg", Math.min(0.95, quality + 0.03)));
  return blob;
}
// ===== v90：立ち絵は複数登録できる。いま使う1枚（imageId）が、カード・閲覧・JSON出力に使われる =====
const MAX_PORTRAIT_IMAGES = 10;
function normImageList(list, active) {
  const out = [];
  (Array.isArray(list) ? list : []).forEach((x) => {
    if (typeof x === "string" && x && !out.includes(x)) out.push(x);
  });
  if (active && !out.includes(active)) out.unshift(active);
  return out;
}
function portraitEmptyText(t) {
  const e = document.getElementById("portraitEmpty");
  if (!e) return;
  e.textContent = t || "";
  e.classList.toggle("hidden", !t);
}
function renderPortraitNav() {
  const n = currentImageList.length,
    i = currentImageList.indexOf(currentImageId),
    multi = n > 1;
  document.getElementById("portraitPrev").classList.toggle("hidden", !multi);
  document.getElementById("portraitNext").classList.toggle("hidden", !multi);
  const cnt = document.getElementById("portraitCount");
  cnt.classList.toggle("hidden", !multi);
  cnt.textContent = i + 1 + " / " + n;
}
// id：いま表示する画像。list：登録する画像の一覧（省略すると今の一覧のまま、idが無ければ末尾に足す。idもlistも無ければ全て外す）
async function setPortrait(id, list) {
  id = id || null;
  if (list !== undefined) {
    currentImageList = normImageList(list, id);
    if (!id) id = currentImageList[0] || null;
  } else if (!id) currentImageList = [];
  else if (!currentImageList.includes(id)) currentImageList = [...currentImageList, id];
  currentImageId = id;
  const img = document.getElementById("portraitImg"),
    del = document.getElementById("portraitDel");
  if (!img) return;
  renderPortraitNav();
  del.classList.toggle("hidden", !id);
  img.onerror = null;
  if (!id) {
    img.classList.add("hidden");
    img.removeAttribute("src");
    portraitEmptyText("画像はまだありません");
    return;
  }
  const u = await imageUrl(id);
  if (currentImageId !== id) return;
  if (!u) {
    img.classList.add("hidden");
    img.removeAttribute("src");
    portraitEmptyText("この画像を読み込めません（この端末に画像データがありません）");
    return;
  }
  const isUrl = isImgUrlId(id);
  img.onerror = () => {
    if (currentImageId !== id) return;
    img.classList.add("hidden");
    portraitEmptyText(isUrl ? "画像のURLを読み込めません" : "画像を読み込めません");
    if (isUrl) toast("画像のURLを読み込めませんでした（URLが正しいか、公開されているか確認してください）");
  };
  img.classList.remove("hidden");
  portraitEmptyText("");
  img.src = u;
}
