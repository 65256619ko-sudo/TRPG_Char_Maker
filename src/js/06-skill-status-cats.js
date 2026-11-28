// ===== JSON出力：技能の成功値をステータスにするか =====
// all＝全部（既定） / pick＝選んだ技能だけ / none＝出さない。外した技能はチャパレに数値で出る
let skillStatusMode = "all";
function skillStatusExcluded(r) {
  return skillStatusMode === "none" || (skillStatusMode === "pick" && r.dataset.noStatus === "1");
}
function setSkillStatusMode(m) {
  skillStatusMode = m === "pick" || m === "none" ? m : "all";
  const sel = document.getElementById("skillStatusMode");
  if (sel) sel.value = skillStatusMode;
  renderSkillStatusPanel();
}
function renderSkillStatusPanel() {
  const panel = document.getElementById("skillStatusPanel"),
    hint = document.getElementById("skillStatusHint");
  if (!panel) return;
  panel.classList.toggle("hidden", skillStatusMode !== "pick");
  hint.textContent =
    skillStatusMode === "all"
      ? "技能ごとにステータスを作り、チャパレは {技能名} を参照します。"
      : skillStatusMode === "none"
        ? "技能のステータスは作らず、チャパレに成功値の数字をそのまま入れます。"
        : "チェックした技能だけステータスにします。外した技能は、チャパレに数字で入ります。";
  if (skillStatusMode !== "pick") return;
  const list = document.getElementById("skillStatusList"),
    kw = kanaFold(document.getElementById("skillStatusSearch").value.trim());
  list.textContent = "";
  [...skills.querySelectorAll(".row")].forEach((r) => {
    const n = r.querySelector(".skill-name").value.trim();
    if (!n || (kw && !kanaFold(n).includes(kw))) return;
    const lb = document.createElement("label"),
      cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = r.dataset.noStatus !== "1";
    cb.onchange = () => {
      if (cb.checked) delete r.dataset.noStatus;
      else r.dataset.noStatus = "1";
      r.dispatchEvent(new Event("input", { bubbles: true }));
    };
    lb.append(cb, document.createTextNode(n));
    list.append(lb);
  });
  if (!list.childNodes.length) list.textContent = "該当する技能がありません";
}
let skillCatFilter = "";
let skillCatBarSig = "";
const SKILL_CAT_DEFAULTS = ["戦闘", "探索", "行動", "交渉", "知識", "技術", "医療"];
const SKILL_CAT_MAP = {
  戦闘: "こぶし、キック、頭突き、組み付き、マーシャルアーツ、投擲、拳銃、サブマシンガン、ショットガン、マシンガン、ライフル、弓、火炎放射器、回避",
  探索: "目星、聞き耳、図書館、隠す、隠れる、忍び歩き、追跡",
  行動: "跳躍、登攀、水泳、運転、操縦、ナビゲート、乗馬、サバイバル、重機械操作、鍵開け、忍び歩き、隠れる、追跡、回避",
  交渉: "説得、言いくるめ、信用、値切り、母国語、他の言語、心理学",
  知識: "図書館、医学、薬学、精神分析、心理学、オカルト、歴史、クトゥルフ神話、生物学、地質学、化学、物理学、天文学、博物学、考古学、人類学、法律、経理、コンピューター、電子工学、鑑定、母国語、他の言語、言語学",
  技術: "機械修理、電気修理、鍵開け、重機械操作、運転、操縦、コンピューター、電子工学、写真術、製作、芸術、変装、隠す",
  医療: "応急手当、医学、精神分析、薬学",
};
const SKILL_CAT_BY_NAME = (() => {
  const m = new Map();
  SKILL_CAT_DEFAULTS.forEach((cat) => SKILL_CAT_MAP[cat].split("、").forEach((n) => m.set(n, (m.get(n) || []).concat(cat))));
  m.set("ほかの言語", m.get("他の言語"));
  return m;
})();
// 「芸術（絵画）」「運転(自動車)」→「芸術」「運転」
function skillBaseName(name) {
  return String(name || "")
    .replace(/[（(].*$/, "")
    .replace(/\s+/g, "");
}
function defaultSkillCats(name) {
  return (SKILL_CAT_BY_NAME.get(skillBaseName(name)) || []).slice();
}
// 保存された分類（配列）があればそれ、なければ名前からの既定
function effectiveSkillCats(name, cats) {
  return Array.isArray(cats) ? cats.slice() : defaultSkillCats(name);
}
function rowCatsExplicit(r) {
  try {
    const a = JSON.parse(r.dataset.cats || "null");
    return Array.isArray(a) ? a : null;
  } catch (e) {
    return null;
  }
}
function rowCats(r) {
  return effectiveSkillCats(r.querySelector(".skill-name").value.trim(), rowCatsExplicit(r));
}
function setRowCats(r, arr) {
  if (!Array.isArray(arr)) delete r.dataset.cats;
  else r.dataset.cats = JSON.stringify(arr);
}
// 保存用：入力があるものだけ返す（空のままなら何も出さない）
function rowMoreData(r) {
  const o = {},
    c = rowCatsExplicit(r),
    m = r.querySelector(".skill-os-memo"),
    l = r.querySelector(".skill-os-lines");
  if (c) o.cats = c;
  if (r.dataset.noStatus === "1") o.noStatus = true;
  if (m && m.value.trim()) o.osMemo = m.value;
  if (l && l.value.trim()) o.osLines = l.value;
  return o;
}
function setRowMore(r, d) {
  d = d || {};
  setRowCats(r, Array.isArray(d.cats) ? d.cats.map(String) : null);
  if (d.noStatus) r.dataset.noStatus = "1";
  else delete r.dataset.noStatus;
  r.querySelector(".skill-os-memo").value = d.osMemo || "";
  r.querySelector(".skill-os-lines").value = d.osLines || "";
  syncSkillMore(r);
}
// 画面に出ている全技能で使われている分類（既定→自分で足したもの）
function allSkillCats(extra) {
  const set = new Set(SKILL_CAT_DEFAULTS);
  skills.querySelectorAll(".row").forEach((r) => rowCats(r).forEach((c) => set.add(c)));
  (extra || []).forEach((c) => set.add(c));
  return [...set];
}
function syncSkillMore(r) {
  const has = !!(r.querySelector(".skill-os-memo").value.trim() || r.querySelector(".skill-os-lines").value.trim());
  const b = r.querySelector(".skill-more-btn");
  if (b) {
    b.classList.toggle("has-os", has);
    const cats = rowCats(r);
    b.title = "ラベル・成功時の処理" + (cats.length ? "（" + cats.join("・") + "）" : "");
  }
  renderSkillCatChips(r);
}
function renderSkillCatChips(r) {
  const box = r.querySelector(".skill-cat-chips");
  if (!box) return;
  const cur = rowCats(r);
  box.textContent = "";
  allSkillCats(cur).forEach((c) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "cat-chip" + (cur.includes(c) ? " on" : "");
    b.textContent = (cur.length > 1 && cur[0] === c ? "★" : "") + c;
    b.setAttribute("aria-pressed", String(cur.includes(c)));
    b.onclick = () => {
      const next = cur.includes(c) ? cur.filter((x) => x !== c) : cur.concat(c);
      const def = defaultSkillCats(r.querySelector(".skill-name").value.trim());
      const same = next.length === def.length && next.every((x, i) => x === def[i]);
      setRowCats(r, same ? null : next);
      syncSkillMore(r);
      r.dispatchEvent(new Event("input", { bubbles: true }));
      filterSkillRows();
    };
    box.append(b);
  });
  // 主ラベル：複数のラベルがあるときだけ選べる（先頭が主ラベル）
  const wrap = r.querySelector(".sm-main"),
    sel = r.querySelector(".skill-cat-primary");
  if (wrap && sel) {
    wrap.classList.toggle("hidden", cur.length < 2);
    sel.textContent = "";
    cur.forEach((c) => {
      const o = document.createElement("option");
      o.value = c;
      o.textContent = c;
      sel.append(o);
    });
    sel.value = cur[0] || "";
  }
}
function setPrimaryCat(r, c) {
  const cur = rowCats(r);
  if (!cur.includes(c) || cur[0] === c) return;
  const next = [c].concat(cur.filter((x) => x !== c));
  const def = defaultSkillCats(r.querySelector(".skill-name").value.trim());
  const same = next.length === def.length && next.every((x, i) => x === def[i]);
  setRowCats(r, same ? null : next);
  syncSkillMore(r);
  renderSkillCatChips(r);
  r.dispatchEvent(new Event("input", { bubbles: true }));
  filterSkillRows();
  if (typeof skillOrderPanel !== "undefined" && !skillOrderPanel.classList.contains("hidden")) renderSkillOrderList();
  if (typeof prioritySwitch !== "undefined" && prioritySwitch.checked) renderPaletteOrderList();
}
function attachSkillMore(r, nameInput) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "skill-more-btn";
  setIconText(btn, "tag");
  btn.setAttribute("aria-label", "ラベル・成功時の処理");
  btn.setAttribute("aria-expanded", "false");
  nameInput.parentElement.append(btn);
  const panel = document.createElement("div");
  panel.className = "skill-more";
  panel.innerHTML =
    '<div class="sm-h">ラベル（複数選べます）</div><div class="skill-cat-chips"></div>' +
    '<div class="sm-main hidden"><label>★主ラベル（並べ替え・まとめ表示でこのラベルに入ります）<select class="skill-cat-primary" aria-label="主ラベル"></select></label></div>' +
    '<div class="sm-add"><input type="text" class="skill-cat-new" maxlength="12" placeholder="新しいラベル名" aria-label="新しいラベル名" autocomplete="off"><button type="button" class="small-btn skill-cat-add">追加</button></div>' +
    '<div class="sm-h">成功したときのメモ</div><textarea class="skill-os-memo" rows="2" placeholder="例：成功したら鍵開け道具の耐久を1減らす" aria-label="成功したときのメモ"></textarea>' +
    '<div class="sm-h">成功のあとに出すチャットパレット（1行に1コマンド）</div><textarea class="skill-os-lines" rows="2" placeholder="例：1d3 【鍵開け成功：道具消耗】" aria-label="成功のあとに出すチャットパレット"></textarea>' +
    '<div class="hint">パレットは、この技能の判定のすぐ後ろに並びます。</div>';
  r.append(panel);
  btn.onclick = () => {
    const open = !r.classList.contains("more-open");
    r.classList.toggle("more-open", open);
    btn.setAttribute("aria-expanded", String(open));
    if (open) renderSkillCatChips(r);
  };
  const addCat = () => {
    const inp = panel.querySelector(".skill-cat-new"),
      t = inp.value.trim().replace(/\s+/g, "");
    if (!t) return;
    const cur = rowCats(r);
    if (!cur.includes(t)) setRowCats(r, cur.concat(t));
    inp.value = "";
    syncSkillMore(r);
    r.dispatchEvent(new Event("input", { bubbles: true }));
    filterSkillRows();
  };
  panel.querySelector(".skill-cat-add").onclick = addCat;
  panel.querySelector(".skill-cat-primary").addEventListener("change", (e) => setPrimaryCat(r, e.target.value));
  panel.querySelector(".skill-cat-new").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addCat();
    }
  });
  ["skill-os-memo", "skill-os-lines"].forEach((c) => panel.querySelector("." + c).addEventListener("input", () => syncSkillMore(r)));
  nameInput.addEventListener("input", () => syncSkillMore(r));
  syncSkillMore(r);
}
function addSkill(n = "", v = "", pts, secret, damage = "", dsecret) {
  const x = row(skills, "row", [
    { label: "技能名", value: n, className: "skill-name", placeholder: "例：こぶし" },
    { label: "成功値（数値・ステータス・式）", value: v, className: "skill-value", placeholder: "例：75、SAN、POW*5" },
    { label: "ダメージ式", value: damage || "", className: "damage-value", placeholder: "例：1d3+DB" },
  ]);
  x.inputs[2].addEventListener("input", () => recalcSkillRow(x.row));
  buildDamageUi(x.row, x.inputs[2], damage);
  setRowSecretDmg(x.row, dsecret);
  // 数値だけでなく SAN / MP / STR*5 などのステータス参照も受け付ける。
  x.inputs[1].inputMode = "text";
  setRowSecret(x.row, secret);
  x.inputs[0].addEventListener("input", () => {
    refreshPaletteStatusOptions();
    filterSkillRows();
  });
  attachSkillPoints(x, v, pts);
  attachSkillMore(x.row, x.inputs[0]);
  refreshPaletteStatusOptions();
  filterSkillRows();
  return x;
}
// 手で「技能を追加」したとき、ラベルで絞り込み中なら、そのラベルを最初から付ける
function addSkillHere() {
  const x = addSkill();
  if (skillCatFilter) {
    setRowCats(x.row, [skillCatFilter]);
    filterSkillRows();
    toast("ラベル「" + skillCatFilter + "」を付けて追加しました");
  }
  return x;
}
// ===== v65：ダメージ式は⚔で開閉。DBは基本付き、チップで外す =====
const DB_TAIL = /\s*[+＋]\s*DB\s*$/i;
function buildDamageUi(r, inp, damage) {
  const wrap = inp.parentElement;
  wrap.classList.add("dmg-wrap");
  const tg = document.createElement("button");
  tg.type = "button";
  tg.className = "dmg-toggle";
  setIconText(tg, "sword");
  tg.title = "ダメージ式を開く・閉じる";
  tg.setAttribute("aria-label", "ダメージ式");
  const line = document.createElement("div");
  line.className = "dmg-line";
  const chip = document.createElement("button");
  chip.type = "button";
  chip.className = "db-chip";
  chip.textContent = "+DB";
  chip.title = "ダメージボーナスを加える・外す";
  wrap.insertBefore(tg, inp);
  line.append(inp, chip);
  wrap.append(line);
  inp.placeholder = "例：1d3（DBは自動で加算）";
  const dmg = String(damage || "").trim();
  if (dmg && !/DB/i.test(dmg)) r.dataset.nodb = "1";
  if (dmg) r.classList.add("dmg-open");
  tg.onclick = () => {
    const open = !r.classList.contains("dmg-open");
    r.classList.toggle("dmg-open", open);
    if (open) delete r.dataset.dmgClosed;
    else r.dataset.dmgClosed = "1";
    if (open) inp.focus();
  };
  inp.addEventListener("focus", () => {
    r.dataset.prevBlank = inp.value.trim() ? "" : "1";
  });
  inp.addEventListener("change", () => {
    const t = inp.value.trim();
    if (t && r.dataset.prevBlank === "1" && !r.dataset.nodb && !/DB/i.test(t)) {
      inp.value = t + "+DB";
      inp.dispatchEvent(new Event("input", { bubbles: true }));
    }
    r.dataset.prevBlank = "";
  });
  chip.onclick = () => {
    const t = inp.value.trim(),
      on = /DB/i.test(t) || (!t && !r.dataset.nodb);
    if (on) {
      if (t && !DB_TAIL.test(t)) {
        toast("式の途中のDBは手で消してください");
        return;
      }
      inp.value = t.replace(DB_TAIL, "");
      r.dataset.nodb = "1";
    } else {
      delete r.dataset.nodb;
      if (t) inp.value = t + "+DB";
    }
    inp.dispatchEvent(new Event("input", { bubbles: true }));
    syncDamageUi(r);
  };
}
function syncDamageUi(r) {
  const inp = r.querySelector(".damage-value"),
    tg = r.querySelector(".dmg-toggle"),
    chip = r.querySelector(".db-chip");
  if (!inp || !tg) return;
  const t = inp.value.trim();
  tg.classList.toggle("has-dmg", !!t);
  if (t && !r.dataset.dmgClosed) r.classList.add("dmg-open");
  chip.classList.toggle("on", /DB/i.test(t) || (!t && !r.dataset.nodb));
}
// 技能ポイント割り振り：成功値＝初期値＋職業P＋興味P＋その他
function attachSkillPoints(x, v, pts) {
  const r = x.row,
    box = document.createElement("div");
  box.className = "skill-points";
  const defs = [
    ["skill-base", "初期値", pts ? pts.base : v, "text"],
    ["skill-occ", "職業P", pts ? pts.occ : "", "number"],
    ["skill-int", "興味P", pts ? pts.int : "", "number"],
    ["skill-other", "その他", pts ? pts.other : "", "text"],
  ];
  defs.forEach((d) => {
    const w = document.createElement("div"),
      l = document.createElement("label"),
      i = document.createElement("input");
    l.textContent = d[1];
    i.className = d[0];
    i.type = d[3];
    i.value = d[2] == null ? "" : d[2];
    i.setAttribute("aria-label", d[1]);
    if (d[3] === "number") {
      i.min = "0";
      i.step = "1";
      i.inputMode = "numeric";
    } else {
      i.inputMode = "text";
      i.placeholder = "";
    }
    i.addEventListener("input", () => {
      recalcSkillRow(r);
      updatePointSummary();
    });
    w.append(l, i);
    box.append(w);
  });
  r.append(box);
  if (pts && pts.otherRoll !== undefined && pts.otherRoll !== null && pts.otherRoll !== "") {
    r.dataset.otherRoll = String(pts.otherRoll);
    r.dataset.otherSrc = String(pts.other == null ? "" : pts.other).trim();
  }
  const dbtn = document.createElement("button");
  dbtn.type = "button";
  dbtn.className = "dice-btn";
  setIconText(dbtn, "dice");
  dbtn.title = "「その他」のダイスを振る・振り直す";
  dbtn.setAttribute("aria-label", "その他のダイスを振り直す");
  dbtn.onclick = () => {
    const t = r.querySelector(".skill-other").value.trim();
    if (!otherHasDice(t)) {
      toast("「その他」にダイス（例：1d10、50<1d100）を書くと、ここで振れます");
      r.querySelector(".skill-other").focus();
      return;
    }
    const v = skillOtherValue(r, true);
    recalcSkillRow(r);
    updatePointSummary();
    toast("その他「" + t + "」→ " + v + "　合計 " + r.querySelector(".skill-value").value);
  };
  r.append(dbtn);
  const val = x.inputs[1];
  // 割り振りOFFのときは成功値の手入力を初期値として同期しておく（ONにしたとき値が変わらないように）
  val.addEventListener("input", () => {
    if (!document.body.classList.contains("sp-on")) {
      r.querySelector(".skill-base").value = val.value;
      ["skill-occ", "skill-int", "skill-other"].forEach((c) => (r.querySelector("." + c).value = ""));
      delete r.dataset.otherRoll;
      delete r.dataset.otherSrc;
    }
  });
  x.inputs[0].addEventListener("input", () => recalcSkillRow(r));
  recalcSkillRow(r);
}
// 「その他」の値。ダイス（例：1d10、50<1d100）が書いてあれば、振った結果を行に覚えておく（記述はそのまま、合計にだけ反映）
function otherHasDice(t) {
  return /(^|[^A-Za-z0-9_])\d*[dDｄＤ]\d+/.test(t) || /[<＜]/.test(t) || DICE_ANY_RE.test(normalizeFormula(t));
}
function skillOtherValue(r, force) {
  const inp = r.querySelector(".skill-other"),
    t = inp.value.trim();
  if (t === "") {
    inp.title = "";
    return 0;
  }
  if (/^[+-]?\d+$/.test(t)) {
    inp.title = "";
    return Number(t) || 0;
  }
  const n = normalizeFormula(t);
  if (otherHasDice(n)) {
    if (!force && r.dataset.otherSrc === t && r.dataset.otherRoll !== undefined) return Number(r.dataset.otherRoll) || 0;
    try {
      const v = rollFormula(substDiceNames(n, liveStatCtx()));
      r.dataset.otherRoll = String(v);
      r.dataset.otherSrc = t;
      inp.title = t + " → " + v;
      return v;
    } catch (e) {
      delete r.dataset.otherRoll;
      delete r.dataset.otherSrc;
      return 0;
    }
  }
  try {
    return /^[0-9+\-*/().\s]+$/.test(n) ? rollFormula(n) : 0;
  } catch (e) {
    return 0;
  }
}
