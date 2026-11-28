function refreshCharacterGroupSelect() {
  const wrap = document.getElementById("characterGroupChecks");
  if (!wrap) return;
  wrap.innerHTML = "";
  if (!managerData.groups.length) {
    const p = document.createElement("p");
    p.className = "hint";
    p.textContent = "グループはまだありません。下のボタンから作成できます。";
    wrap.append(p);
    return;
  }
  managerData.groups.forEach((g) => {
    const label = document.createElement("label");
    label.className = "switch-label";
    label.style.margin = "5px 0";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = g.id;
    cb.checked = currentGroupIds.includes(g.id);
    cb.addEventListener("change", () => {
      currentGroupIds = [...wrap.querySelectorAll('input[type="checkbox"]:checked')].map((x) => x.value);
      currentGroupId = currentGroupIds[0] || null;
    });
    const span = document.createElement("span");
    span.textContent = groupPath(g);
    label.append(cb, span);
    wrap.append(label);
  });
}
function createGroupFromCharacterSelect() {
  const panel = document.getElementById("createCharacterGroupPanel");
  const input = document.getElementById("newCharacterGroupName");
  if (!panel || !input) return;
  panel.classList.remove("hidden");
  input.value = "";
  input.focus();
}
function confirmCreateCharacterGroup() {
  const input = document.getElementById("newCharacterGroupName");
  const name = input ? input.value.trim() : "";
  if (!name) {
    message.textContent = "グループ名を入力してください。";
    if (input) input.focus();
    return;
  }
  const group = { id: uid(), name, nextNumber: 1, template: null, createdAt: new Date().toISOString() };
  managerData.groups.push(group);
  currentGroupIds = [...currentGroupIds, group.id];
  currentGroupId = currentGroupIds[0] || null;
  if (!persistManagerData()) {
    managerData.groups = managerData.groups.filter((g) => g.id !== group.id);
    currentGroupIds = currentGroupIds.filter((id) => id !== group.id);
    currentGroupId = currentGroupIds[0] || null;
    return;
  }
  document.getElementById("createCharacterGroupPanel").classList.add("hidden");
  refreshCharacterGroupSelect();
}
document.getElementById("createCharacterGroup").onclick = (e) => {
  e.preventDefault();
  createGroupFromCharacterSelect();
};
document.getElementById("confirmCreateCharacterGroup").onclick = (e) => {
  e.preventDefault();
  confirmCreateCharacterGroup();
};
document.getElementById("cancelCreateCharacterGroup").onclick = (e) => {
  e.preventDefault();
  document.getElementById("createCharacterGroupPanel").classList.add("hidden");
};
document.getElementById("newCharacterGroupName").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    confirmCreateCharacterGroup();
  }
});
function refreshBatchSelect() {
  const sel = document.getElementById("batchGroupSelect");
  if (!sel) return;
  const old = sel.value;
  sel.innerHTML = "";
  const opt = document.createElement("option");
  opt.value = "__new__";
  opt.textContent = "新しくまとめる";
  sel.append(opt);
  managerData.groups.forEach((g) => {
    const o = document.createElement("option");
    o.value = g.id;
    o.textContent = g.name;
    sel.append(o);
  });
  if ([...sel.options].some((o) => o.value === old)) sel.value = old;
}

function batchMsg(t) {
  const el = document.getElementById("batchMessage");
  if (el) el.textContent = t;
  message.textContent = t;
}
function closeBatchDialog() {
  document.getElementById("batchDialog").classList.add("hidden");
  document.getElementById("batchMessage").textContent = "";
}
// 連続生成用：式の中のダイス（例：50+1d50）だけを振って確定する。STRなどの参照は残し、数字だけの式は計算まで済ませる
function substDiceNames(s, ctx) {
  const val = (n) => {
    const k = Object.keys(ctx).find((x) => x.toLowerCase() === String(n).toLowerCase());
    return k == null ? null : ctx[k];
  };
  s = s.replace(/(\d)d([A-Za-z_][A-Za-z0-9_]*|[\u3040-\u30ff\u3400-\u9fff々ー]+)/gi, (m, c, n) => {
    const v = val(n);
    return v == null ? m : c + "d" + v;
  });
  return s.replace(/([A-Za-z_][A-Za-z0-9_]*|[\u3040-\u30ff\u3400-\u9fff々ー]+)d(?=\d)/gi, (m, n) => {
    const v = val(n);
    return v == null ? m : String(v) + "d";
  });
}
// いま画面にある能力値・基本ステータスの数値（「その他」の1dMPなどを振るときに使う）
function liveStatCtx() {
  const ctx = {};
  readBaseNumbers(ctx);
  for (let k = 0; k < 2; k++)
    derivedStatuses.querySelectorAll(".derived-row").forEach((r) => {
      const n = r.dataset.derivedName,
        f = r.querySelector(".derived-formula").value.trim();
      if (!n || !f || ctx[n] != null || DICE_ANY_RE.test(f)) return;
      try {
        ctx[n] = Number(resolveExpr(f, ctx));
      } catch (e) {}
    });
  return ctx;
}
function readBaseNumbers(ctx) {
  const b = readBase();
  names.forEach((n) => {
    const v = String(b[n] || "").trim();
    if (/^\d+$/.test(v)) ctx[n] = Number(v);
  });
}
function rollDiceInExpr(raw, ctx) {
  const s0 = String(raw == null ? "" : raw);
  let s = normalizeFormula(s0);
  if (!DICE_ANY_RE.test(s)) return s0;
  // 「1dMP」「MPd6」のように、ダイスの個数・面に書かれた名前は、その時点の値に置き換えてから振る
  if (ctx) {
    s = substDiceNames(s, ctx);
  }
  if (!/(?:^|[^A-Za-z0-9_])\d*d\d+/i.test(s)) return s0;
  const out = s.replace(/(^|[^A-Za-z0-9_])(\d*)d(\d+)/gi, (_, pre, c, d) => pre + String(rollFormula((c || "1") + "d" + d)));
  return /^[0-9+\-*/().\s<=]+$/.test(out) ? String(rollFormula(out)) : out;
}
// 技能の成功値・追加ステータス・基本ステータスの式にあるダイスを、キャラクターごとに振って数字にする（ダメージ式とDBは、卓で振るので触らない）
function rollBatchFormDice(form) {
  const hasD = (x) => {
    const t = String(x == null ? "" : x);
    return /(?:^|[^A-Za-z0-9_])\d*[dDｄＤ]\d+/.test(t) || DICE_ANY_RE.test(normalizeFormula(t));
  };
  // 「1dMP」のような名前入りダイスのために、このキャラの能力値と基本ステータスの値を先に用意する
  const ctx = {};
  names.forEach((n) => {
    const v = statTotal(form.base && form.base[n], form.baseAdd && form.baseAdd[n], form.baseOther && form.baseOther[n]);
    if (/^\d+$/.test(v)) ctx[n] = Number(v);
  });
  const dl = Array.isArray(form.derived) && form.derived.length ? form.derived : derivedDefinitions;
  for (let k = 0; k < 2; k++)
    dl.forEach((d) => {
      const n = d && d.name,
        f = String((d && d.formula) || "").trim();
      if (!n || !f || ctx[n] != null || hasD(f)) return;
      try {
        ctx[n] = Number(resolveExpr(f, ctx));
      } catch (e) {}
    });
  const hasO = (x) => otherHasDice(String(x == null ? "" : x));
  const sp = !!form.spMode;
  (form.skills || []).forEach((r) => {
    if (!r) return;
    const v0 = String(r.value == null ? "" : r.value),
      b0 = r.base == null ? "" : String(r.base);
    const o0 = r.other == null ? "" : String(r.other).trim();
    if (sp && (hasD(b0) || hasO(o0))) {
      // 割り振りモードの成功値は「初期値＋職業P＋興味P＋その他」。初期値・その他のダイスを振り、成功値も合わせて作り直す（その他の記述はそのまま残す）
      if (hasD(b0)) r.base = rollDiceInExpr(b0, ctx);
      let ov = Number(o0) || 0;
      if (hasO(o0)) {
        try {
          ov = rollFormula(normalizeFormula(o0));
          r.otherRoll = ov;
        } catch (e) {}
      }
      const add = (Number(r.occ) || 0) + (Number(r.int) || 0) + ov,
        b = String(r.base == null ? "" : r.base).trim();
      r.value = b === "" ? String(add) : /^\d+$/.test(b) ? String(Number(b) + add) : add ? b + "+" + add : b;
    } else {
      let nv = v0;
      if (hasD(v0)) {
        nv = rollDiceInExpr(v0, ctx);
        r.value = nv;
      }
      if (hasD(b0)) r.base = b0 === v0 ? nv : rollDiceInExpr(b0, ctx);
    }
  });
  (form.extras || []).forEach((x) => {
    if (
      x &&
      String(x.name || "")
        .trim()
        .toUpperCase() !== "DB" &&
      hasD(x.value)
    )
      x.value = rollDiceInExpr(x.value, ctx);
  });
  (form.derived || []).forEach((x) => {
    if (x && hasD(x.formula)) x.formula = rollDiceInExpr(x.formula, ctx);
  });
}
// v90：画像のURLをJSONに出す。ココフォリアの形式に合わせ、使用中の1枚は iconUrl、2枚以上あるときは faces にも全部入れる（この端末にだけある画像は出せない）
function issuedUrlOf(id) {
  return isImgUrlId(id) ? imgUrlOf(id) : imgUrlMap()[id] || null;
}
function iconFields() {
  const pairs = currentImageList.map((id) => [id, issuedUrlOf(id)]).filter((x) => x[1]);
  const urls = pairs.map((x) => x[1]);
  if (!urls.length) return {};
  const mp = pairs.find((x) => x[0] === currentImageId);
  const main = mp ? mp[1] : urls[0];
  return urls.length > 1 ? { iconUrl: main, faces: urls.map((u, i) => ({ iconUrl: u, label: "画像" + (i + 1) })) } : { iconUrl: main };
}
// ===== v98：画像つき共有。ツール同士で渡すためのファイル（ココフォリア用のJSONに、小さくした画像を同梱）。ココフォリア用のJSONとは別に作る =====
const SHARE_IMG_SIDE = 512;
// ===== 共有データに載せる、このツール独自の情報（分類・成功時の処理・能力値と技能の内訳）。成長記録・秘密メモは載せない =====
function collectShareExtra() {
  const f = captureForm(),
    out = {};
  if (f.baseAdd || f.baseOther) {
    out.base = f.base;
    if (f.baseAdd) out.baseAdd = f.baseAdd;
    if (f.baseOther) out.baseOther = f.baseOther;
  }
  const sk = [];
  (f.skills || []).forEach((x) => {
    const n = String(x.name || "").trim();
    if (!n) return;
    const e = { name: n };
    if (x.cats) e.cats = x.cats;
    if (x.osMemo) e.osMemo = x.osMemo;
    if (x.osLines) e.osLines = x.osLines;
    const used =
      x.occ ||
      x.int ||
      (x.other !== undefined && String(x.other).trim() !== "") ||
      (x.base !== undefined && String(x.base) !== String(x.value));
    if (x.base !== undefined && used) e.pts = { base: x.base, occ: x.occ, int: x.int, other: x.other, otherRoll: x.otherRoll };
    if (Object.keys(e).length > 1) sk.push(e);
  });
  if (sk.length) out.skills = sk;
  if (Array.isArray(f.growthLog) && f.growthLog.length) out.growthLog = JSON.parse(JSON.stringify(f.growthLog));
  if (f.spMode && sk.some((e) => e.pts)) out.spMode = true;
  return Object.keys(out).length ? out : null;
}
// 受け取った共有データの独自情報を、読み込んだ直後のフォームに当てる（名前が一致する技能・能力値だけ）
function applyToolExtra(ex) {
  if (!ex || typeof ex !== "object") return;
  if (ex.baseAdd || ex.baseOther) {
    names.forEach((n) => {
      const el = document.getElementById("base-" + n);
      if (el && ex.base && ex.base[n] != null) el.value = String(ex.base[n]);
      const a = statDeltaInput(n, "add"),
        o = statDeltaInput(n, "other");
      if (a) a.value = ex.baseAdd && ex.baseAdd[n] != null ? String(ex.baseAdd[n]) : "";
      if (o) o.value = ex.baseOther && ex.baseOther[n] != null ? String(ex.baseOther[n]) : "";
    });
    updateStatTotals();
  }
  const rows = [...skills.querySelectorAll(".row")];
  (Array.isArray(ex.skills) ? ex.skills : []).forEach((e) => {
    const r = rows.find((x) => nameKey(x.querySelector(".skill-name").value) === nameKey(e.name || ""));
    if (!r) return;
    const cur = rowMoreData(r);
    setRowMore(r, {
      ...cur,
      cats: Array.isArray(e.cats) ? e.cats.map(String) : cur.cats,
      osMemo: typeof e.osMemo === "string" ? e.osMemo : cur.osMemo,
      osLines: typeof e.osLines === "string" ? e.osLines : cur.osLines,
    });
    if (e.pts && typeof e.pts === "object") {
      const set = (c, v) => {
        const i = r.querySelector(c);
        if (i && v != null) i.value = String(v);
      };
      set(".skill-base", e.pts.base);
      set(".skill-occ", e.pts.occ);
      set(".skill-int", e.pts.int);
      set(".skill-other", e.pts.other);
      if (e.pts.otherRoll !== undefined && e.pts.otherRoll !== null && e.pts.otherRoll !== "") {
        r.dataset.otherRoll = String(e.pts.otherRoll);
        r.dataset.otherSrc = String(e.pts.other == null ? "" : e.pts.other).trim();
      }
    }
  });
  if (ex.spMode) setSkillPointMode(true);
  if (Array.isArray(ex.growthLog)) {
    const str = (v) => (v == null ? "" : String(v)).slice(0, 2000);
    growthLog = ex.growthLog
      .filter((e) => e && typeof e === "object")
      .slice(0, 300)
      .map((e) => ({
        id: str(e.id) || "g" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        date: str(e.date),
        scenario: str(e.scenario),
        memo: str(e.memo),
        applied: !!e.applied,
        growth: (Array.isArray(e.growth) ? e.growth : [])
          .filter((x) => x && typeof x === "object")
          .map((x) => {
            const g = { skill: str(x.skill) };
            if (typeof x.delta === "number" && Number.isFinite(x.delta)) g.delta = x.delta;
            if (x.amount != null) g.amount = str(x.amount);
            return g;
          }),
        gains: (Array.isArray(e.gains) ? e.gains : []).filter((x) => x && typeof x === "object").map((x) => ({ ...x, name: str(x.name) })),
      }));
  }
}
// 共有にロックメモ（パスワードで暗号化済み）を含めるか。持っていなければ聞かずに true
let shareIncludeSecret = true;
async function askShareSecret() {
  shareIncludeSecret = true;
  if (!(secretBlob && secretBlob.c)) return true;
  const r = await askDialog({
    title: "ロックメモも共有しますか？",
    desc: "ロックメモはパスワードで暗号化されています。「含める」で暗号文ごと共有します（パスワードを知る人だけが読めます）。「含めない」ではロックメモを外して共有します。",
    okText: "含める",
    cancelText: "含めない",
  });
  shareIncludeSecret = r !== null;
  return true;
}
async function buildShareObject(side = SHARE_IMG_SIDE, onlyActive = false) {
  if (!generateJSON()) throw Error("JSONを作れませんでした。入力を確認してください");
  const obj = JSON.parse(output.value);
  const list = [];
  let active = 0;
  for (const id of currentImageList) {
    const iu = issuedUrlOf(id);
    if (iu) {
      if (onlyActive && id !== currentImageId) continue;
      if (id === currentImageId) active = list.length;
      list.push({ url: iu });
      continue;
    }
    if (onlyActive && id !== currentImageId) continue;
    try {
      const b = await imgGet(id);
      if (!b) continue;
      const sm = await resizeImage(b, side);
      if (id === currentImageId) active = list.length;
      list.push({ data: await blobToDataUrl(sm) });
    } catch (e) {}
  }
  if (list.length) {
    obj.toolImages = list;
    obj.toolImageActive = active;
  }
  const extra = collectShareExtra();
  if (extra) obj.toolExtra = extra;
  if (!shareIncludeSecret && obj.data && typeof obj.data.memo === "string")
    obj.data.memo = obj.data.memo.replace(/\n*【ロックメモ】\s*\nSM1:\S*/g, "").replace(/^\n+/, "");
  return obj;
}
async function shareWithImages() {
  try {
    await askShareSecret();
    const obj = await buildShareObject();
    const text = JSON.stringify(obj);
    const nm = (document.getElementById("charName").value.trim() || "character").replace(/[\\/:*?"<>|\s]+/g, "_");
    const file = new File([text], nm + ".json", { type: "application/json" });
    const n = (obj.toolImages || []).filter((x) => x.data).length;
    const info = "画像" + n + "枚・" + Math.max(1, Math.round(text.length / 1024)) + "KB";
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: nm });
        toast("共有しました（" + info + "）");
        return;
      } catch (e) {
        if (e && e.name === "AbortError") return;
      }
    }
    const u = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = u;
    a.download = file.name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 3000);
    toast("ファイルを保存しました（" + info + "）。LINEなどで友達に送ってください");
  } catch (e) {
    toast("共有ファイルを作れません：" + (e.message || String(e)));
  }
}
// ===== v100：共有リンクで初めて画像をアップロードし、公開URLを発行する（Cloudinary・署名なしアップロード）。JSON出力ではアップロードしない。発行済みなら、JSONにもそのURLが入る =====
const IMG_UPLOAD_DEFAULT = { cloud: "lafsypps", preset: "trpg-portrait" }; // 運営者の Cloud name とアップロードプリセット名。ここに入れておくと、友達の設定が要らない
const IMG_UPLOAD_CFG_KEY = "trpg-image-upload-config",
  IMG_URL_MAP_KEY = "trpg-image-url-map";
function imgUploadConfig() {
  let c = {};
  try {
    c = JSON.parse(localStorage.getItem(IMG_UPLOAD_CFG_KEY) || "{}") || {};
  } catch (e) {}
  return { cloud: (c.cloud || IMG_UPLOAD_DEFAULT.cloud || "").trim(), preset: (c.preset || IMG_UPLOAD_DEFAULT.preset || "").trim() };
}
function imgUploadReady() {
  const c = imgUploadConfig();
  return !!(c.cloud && c.preset);
}
function imgUrlMap() {
  try {
    return JSON.parse(localStorage.getItem(IMG_URL_MAP_KEY) || "{}") || {};
  } catch (e) {
    return {};
  }
}
