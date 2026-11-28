document.getElementById("skillViewItems").onclick = () => setSkillView("items");
document.getElementById("skillViewCats").onclick = () => {
  setSkillView("cats");
  message.textContent = "同じラベルの技能を、ラベルごとのかたまりにそろえました。";
};
document.getElementById("skillShowCats").addEventListener("change", renderSkillOrderList);
document.getElementById("clearSkillSelection").onclick = () => {
  selectedSkillIdx.clear();
  renderSkillOrderList();
};
skillOrderSwitch.addEventListener("change", () => {
  const on = skillOrderSwitch.checked;
  skillOrderPanel.classList.toggle("hidden", !on);
  if (on) {
    skillOrderBefore = [...skills.children];
    skillOrderDraft = skillOrderBefore.slice();
    selectedSkillIdx.clear();
    renderSkillOrderList();
  }
});
document.getElementById("cancelSkillOrder").onclick = () => {
  skillOrderDraft = skillOrderBefore
    .filter((r) => r.parentElement === skills)
    .concat([...skills.children].filter((r) => !skillOrderBefore.includes(r)));
  syncSkillDraft();
  onSkillOrderChanged();
  selectedSkillIdx.clear();
  renderSkillOrderList();
};
// 並べ替え中に技能を追加・削除・読み込みしたときは、一覧を作り直す
new MutationObserver(() => {
  if (!skillOrderSwitch.checked || skillDraftMatchesDom()) return;
  skillOrderDraft = [...skills.children];
  selectedSkillIdx.clear();
  renderSkillOrderList();
}).observe(skills, { childList: true });
// 並べ替え中に技能名・成功値・ダメージ式を編集したら、一覧の表示も更新する
skills.addEventListener("input", () => {
  if (!skillOrderSwitch.checked) return;
  skillOrderList.querySelectorAll(".palette-order-item").forEach((el) => {
    const r = skillOrderDraft[Number(el.dataset.index)];
    const n = el.querySelector(".skill-order-name");
    if (r && n) n.textContent = skillOrderLabel(r);
  });
});
// ===== 技能名・判定名の予測入力：基本技能カタログから候補を出し、値が空なら初期値も自動入力 =====
(function () {
  const dl = document.createElement("datalist");
  dl.id = "nameSuggestList";
  const seen = new Set();
  presetCatalog.forEach((c) =>
    c.items.forEach((it) => {
      if (!seen.has(it.name)) {
        seen.add(it.name);
        const o = document.createElement("option");
        o.value = it.name;
        dl.append(o);
      }
    }),
  );
  document.body.append(dl);
  const lookup = (n) => {
    const k = kanaFold(n.trim());
    for (const c of presetCatalog) for (const it of c.items) if (kanaFold(it.name) === k) return it;
    return null;
  };
  // 入力欄の change（候補の選択・入力確定）で、ひらがな/カタカナ違いも正式名に直し、空欄なら初期値を補う
  skills.addEventListener("change", (e) => {
    const i = e.target;
    if (!i.classList || !i.classList.contains("skill-name")) return;
    const it = lookup(i.value);
    if (!it || it.dodge) return;
    if (i.value.trim() !== it.name) {
      i.value = it.name;
      i.dispatchEvent(new Event("input", { bubbles: true }));
    }
    const r = i.closest(".row"),
      v = r.querySelector(".skill-value");
    if (it.skill && !v.value.trim() && !r.querySelector(".damage-value").value.trim()) {
      v.value = it.skill;
      v.dispatchEvent(new Event("input", { bubbles: true }));
    }
    const dv = r.querySelector(".damage-value");
    if (it.damage && !dv.value.trim()) dv.value = it.damage;
  });
})();
function findRowByName(container, nameSel, name) {
  return [...container.children].find((r) => {
    const i = r.querySelector(nameSel);
    return i && i.value.trim() === name;
  });
}
function removeBlankSkillRows() {
  [...skills.children].forEach((r) => {
    const f = (c) => (r.querySelector(c)?.value || "").trim();
    if (!f(".skill-name") && !f(".skill-value") && !f(".damage-value")) r.remove();
  });
}
function applyDodge(quiet) {
  const row = [...derivedStatuses.querySelectorAll(".derived-row")].find((r) => r.dataset.derivedName === "回避");
  if (row) {
    row.querySelector(".derived-formula").value = "DEX*2";
  } else {
    addDerivedStatus({ name: "回避", formula: "DEX*2" });
  }
  updateDerivedPreviews();
}
// 1項目を適用。新しく追加・変更があれば true
function applyPresetItem(item) {
  if (item.dodge) {
    applyDodge(true);
    return true;
  }
  let added = false;
  if (item.skill != null) {
    removeBlankSkillRows();
    const ex = findRowByName(skills, ".skill-name", item.name);
    if (!ex) {
      addSkill(item.name, item.skill, undefined, false, item.damage || "");
      added = true;
    } else if (item.damage && !ex.querySelector(".damage-value").value.trim()) {
      ex.querySelector(".damage-value").value = item.damage;
      added = true;
    }
  } else if (item.damage) {
    removeBlankSkillRows();
    const ex = [...skills.querySelectorAll(".row")].find(
      (r) => r.querySelector(".skill-name").value.trim() === item.name && r.querySelector(".damage-value").value.trim(),
    );
    if (!ex) {
      addDamage(item.name, item.damage);
      added = true;
    }
  }
  return added;
}
function applyPresetItems(items) {
  let added = 0,
    skipped = 0;
  items.forEach((it) => {
    if (applyPresetItem(it)) added++;
    else skipped++;
  });
  return { added, skipped };
}
function allPresetItems() {
  return presetCatalog.flatMap((c) => c.items);
}
function presetDesc(it) {
  if (it.note) return it.note;
  const parts = [];
  if (it.skill != null) parts.push("技能 " + it.skill + (/^\d+$/.test(it.skill) ? "%" : ""));
  if (it.damage) parts.push("ダメージ " + it.damage);
  return parts.join(" / ");
}
let initialSkillMap = null;
function getInitialSkillMap() {
  if (!initialSkillMap) {
    initialSkillMap = new Map();
    presetCatalog.forEach((c) =>
      c.items.forEach((it) => {
        if (it.skill != null && it.name) initialSkillMap.set(it.name, String(it.skill));
      }),
    );
  }
  return initialSkillMap;
}
function filterSkillRows() {
  const q = kanaFold((document.getElementById("skillSearch")?.value || "").trim());
  const hide = !!document.getElementById("hideInitial")?.checked,
    im = getInitialSkillMap();
  skills.querySelectorAll(".row").forEach((r) => {
    const nm = (r.querySelector(".skill-name")?.value || "").trim(),
      n = kanaFold(nm);
    const val = (r.querySelector(".skill-value")?.value || "").trim(),
      dmg = (r.querySelector(".damage-value")?.value || "").trim();
    const init = !!nm && im.has(nm) && im.get(nm) === val && !dmg;
    r.classList.toggle("is-initial", init);
    syncDamageUi(r);
    const focused = r.contains(document.activeElement);
    const catHide = !!skillCatFilter && !rowCats(r).includes(skillCatFilter);
    r.classList.toggle("hidden", (!!q && !n.includes(q)) || (hide && init && !focused) || catHide);
  });
  renderSkillCatBar();
}
// 分類で絞り込む（もう一度押すと解除）
function renderSkillCatBar() {
  const bar = document.getElementById("skillCatBar");
  if (!bar) return;
  const count = new Map();
  skills.querySelectorAll(".row").forEach((r) => {
    if (!r.querySelector(".skill-name").value.trim()) return;
    rowCats(r).forEach((c) => count.set(c, (count.get(c) || 0) + 1));
  });
  if (skillCatFilter && !count.has(skillCatFilter)) skillCatFilter = "";
  const order = allSkillCatsOrdered(count);
  const sig = order.map((c) => c + count.get(c)).join("|") + "#" + skillCatFilter;
  if (sig === skillCatBarSig) return;
  skillCatBarSig = sig;
  bar.textContent = "";
  bar.classList.toggle("hidden", !order.length);
  order.forEach((c) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "cat-chip" + (skillCatFilter === c ? " on" : "");
    b.textContent = c + " " + count.get(c);
    b.setAttribute("aria-pressed", String(skillCatFilter === c));
    b.onclick = () => {
      skillCatFilter = skillCatFilter === c ? "" : c;
      filterSkillRows();
    };
    bar.append(b);
  });
}
function allSkillCatsOrdered(count) {
  return [...SKILL_CAT_DEFAULTS.filter((c) => count.has(c)), ...[...count.keys()].filter((c) => !SKILL_CAT_DEFAULTS.includes(c))];
}
document.getElementById("skillSearch").addEventListener("input", filterSkillRows);
function filterPresetItems() {
  const q = kanaFold((document.getElementById("presetSearch")?.value || "").trim());
  document.querySelectorAll("#presetList .preset-cat").forEach((head) => {
    const category = head.dataset.category || "";
    const rows = [...head.parentElement.querySelectorAll(".preset-item")].filter((row) => row.dataset.category === category);
    const matching = rows.filter((row) => !q || kanaFold(row.textContent).includes(q) || kanaFold(category).includes(q));
    rows.forEach((row) => row.classList.toggle("hidden", !matching.includes(row)));
    head.classList.toggle("hidden", !!q && !kanaFold(category).includes(q) && matching.length === 0);
  });
}
document.getElementById("presetSearch")?.addEventListener("input", filterPresetItems);
function closePresetDialog() {
  document.getElementById("presetDialog").classList.add("hidden");
}
function setPresetStatus(t) {
  document.getElementById("presetStatus").textContent = t;
}
function finishBulk(label, res) {
  closePresetDialog();
  if (!skills.children.length) addSkill();
}
function openPresetDialog() {
  const list = document.getElementById("presetList");
  list.innerHTML = "";
  setPresetStatus("");
  document.getElementById("presetSearch").value = "";
  presetCatalog.forEach((c, ci) => {
    const head = document.createElement("div");
    head.className = "preset-cat";
    head.dataset.category = c.cat;
    const t = document.createElement("strong");
    t.textContent = c.cat;
    const all = document.createElement("button");
    all.type = "button";
    all.className = "small-btn";
    all.textContent = c.cat + "をすべて適用";
    all.onclick = () => {
      const r = applyPresetItems(c.items);
      setPresetStatus(c.cat + "：追加 " + r.added + "件" + (r.skipped ? "（既存 " + r.skipped + "件）" : ""));
    };
    head.append(t, all);
    list.append(head);
    c.items.forEach((it, ii) => {
      const row = document.createElement("div");
      row.className = "preset-item";
      row.dataset.category = c.cat;
      const lab = document.createElement("label");
      lab.className = "preset-check";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.dataset.cat = ci;
      cb.dataset.idx = ii;
      const txt = document.createElement("span");
      txt.innerHTML = "";
      const nm = document.createElement("b");
      nm.textContent = it.name;
      const ds = document.createElement("small");
      ds.textContent = presetDesc(it);
      txt.append(nm, document.createElement("br"), ds);
      lab.append(cb, txt);
      const one = document.createElement("button");
      one.type = "button";
      one.className = "small-btn";
      one.textContent = "適用";
      one.onclick = () => {
        const ok = applyPresetItem(it);
        setPresetStatus(ok ? "「" + it.name + "」を適用しました。" : "「" + it.name + "」はすでに入っています。");
      };
      row.append(lab, one);
      list.append(row);
    });
  });
  filterPresetItems();
  document.getElementById("presetDialog").classList.remove("hidden");
}
document.getElementById("openPresetDialog").onclick = openPresetDialog;
document.getElementById("presetApplyChecked").onclick = () => {
  const items = [...document.querySelectorAll("#presetList input[type=checkbox]:checked")].map(
    (cb) => presetCatalog[Number(cb.dataset.cat)].items[Number(cb.dataset.idx)],
  );
  if (!items.length) {
    setPresetStatus("適用する項目にチェックを入れてください。");
    return;
  }
  finishBulk("選択した項目を適用", applyPresetItems(items));
};
document.getElementById("presetApplyAll").onclick = () => finishBulk("すべての基本技能を適用", applyPresetItems(allPresetItems()));
document.getElementById("presetApplyCombat").onclick = () => finishBulk("戦闘機能を適用", applyPresetItems(presetCatalog[0].items));
document.getElementById("presetClose").onclick = closePresetDialog;
document.getElementById("presetDialog").addEventListener("click", (e) => {
  if (e.target.id === "presetDialog") closePresetDialog();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !document.getElementById("presetDialog").classList.contains("hidden")) closePresetDialog();
});
addSkill();
refreshDBDisplay();
document.getElementById("addExtra").onclick = () => addExtra();
document.getElementById("addSkill").onclick = () => addSkillHere();
function rollFormula(raw) {
  let s = String(raw).trim().toLowerCase().replace(/\s+/g, "");
  if (!s) throw Error("式が空です");
  // 最低保証：A<式 → 式の結果がA以下ならA+1にする（50<1d100 で1が出たら51）。A<=式 → A以上にする。括弧の中でも使える
  if (s.includes("<")) {
    let g = 0;
    while (/\([^()]*<[^()]*\)/.test(s) && g++ < 50) s = s.replace(/\(([^()]*<[^()]*)\)/, (_, inner) => "(" + rollFormula(inner) + ")");
    if (s.includes("<")) {
      const i = s.indexOf("<"),
        eq = s[i + 1] === "=";
      return Math.max(rollFormula(s.slice(0, i)) + (eq ? 0 : 1), rollFormula(s.slice(i + (eq ? 2 : 1))));
    }
  }
  if (!/^[0-9d+\-*/().]+$/.test(s)) throw Error("式に使えない文字があります");
  s = s.replace(/(\d*)d(\d+)/g, (_, ct, st) => {
    let c = ct === "" ? 1 : Number(ct),
      d = Number(st);
    if (!Number.isInteger(c) || c < 1 || c > 10000 || !Number.isInteger(d) || d < 1 || d > 1000000)
      throw Error("ダイス数は1〜10000、面数は1〜1000000にしてください");
    let sum = 0;
    for (let j = 0; j < c; j++) sum += Math.floor(Math.random() * d) + 1;
    return String(sum);
  });
  if (s.includes("d")) throw Error("ダイス式を確認してください");
  const t = s.match(/\d+(?:\.\d+)?|[()+\-*/]/g);
  if (!t || t.join("") !== s) throw Error("計算式を確認してください");
  let p = 0;
  function expr() {
    let x = term();
    while (t[p] === "+" || t[p] === "-") {
      let o = t[p++],
        y = term();
      x = o === "+" ? x + y : x - y;
    }
    return x;
  }
  function term() {
    let x = factor();
    while (t[p] === "*" || t[p] === "/") {
      let o = t[p++],
        y = factor();
      if (o === "/" && y === 0) throw Error("0で割れません");
      x = o === "*" ? x * y : x / y;
    }
    return x;
  }
  function factor() {
    if (t[p] === "+") {
      p++;
      return factor();
    }
    if (t[p] === "-") {
      p++;
      return -factor();
    }
    if (t[p] === "(") {
      p++;
      let x = expr();
      if (t[p++] !== ")") throw Error("括弧を確認してください");
      return x;
    }
    let z = t[p++];
    if (z === undefined || !/^\d+(?:\.\d+)?$/.test(z)) throw Error("計算式を確認してください");
    return Number(z);
  }
  let v = expr();
  if (p !== t.length || !Number.isFinite(v)) throw Error("計算式を確認してください");
  return Math.floor(v);
}
function hasUncertain(s) {
  return /d/i.test(String(s)) || /[A-Za-z]/.test(String(s)) || String(s).trim() === "";
}

// ===== 基本キャラ情報（探索者シートの項目）：入力欄の生成と、JSONメモへの書き出し・読み込み =====
const PROFILE_SECTIONS = [
  {
    title: "探索者情報",
    open: true,
    fields: [
      ["kana", "ふりがな"],
      ["tags", "タグ"],
      ["url", "外部URL"],
      ["job", "職業"],
      ["school", "学校・学位"],
      ["age", "年齢"],
      ["gender", "性別"],
      ["origin", "出身"],
      ["mental", "精神的障害"],
    ],
  },
  {
    title: "外見・生活",
    open: true,
    fields: [
      ["height", "身長"],
      ["weight", "体重"],
      ["hair", "髪色"],
      ["eye", "瞳色"],
      ["skin", "肌色"],
      ["address", "住所"],
      ["family", "家族"],
      ["scars", "傷痕など"],
    ],
  },
  {
    title: "所持品・財産",
    open: false,
    fields: [
      ["income", "収入"],
      ["cash", "手持ちの現金"],
      ["savings", "預金・債券"],
      ["assets", "個人資産"],
      ["realestate", "不動産"],
      ["items", "所持品", "area"],
      ["money", "財産メモ", "area"],
    ],
  },
  {
    title: "背景",
    open: false,
    fields: [
      ["personal", "個人の記述", "area"],
      ["people", "重要な人々", "area"],
      ["places", "意味のある場所", "area"],
      ["treasures", "秘蔵の品", "area"],
      ["traits", "特徴", "area"],
    ],
  },
  {
    title: "記録",
    open: false,
    fields: [
      ["madness", "狂気の症状", "area"],
      ["tomes", "読んだ魔導書", "area"],
      ["mythos", "遭遇した神話生物", "area"],
      ["scenarios", "通過シナリオ", "area"],
    ],
  },
].map((sec) => ({ title: sec.title, open: sec.open, fields: sec.fields.map((f) => ({ key: f[0], label: f[1], area: f[2] === "area" })) }));
// 旧ラベル（以前の書き出し・他ツール）も読み込めるようにする
const PROFILE_LABEL_ALIASES = { 髪の色: "hair", 瞳の色: "eye", 肌の色: "skin", "財産・現金": "money", ふりがな: "kana" };
// 1行を6分割したときの幅（iachara風に、短い項目は3つ並べる）。ふりがな・タグは上のブロックに置く
const PROFILE_SPAN = {
  url: 6,
  kana: 6,
  tags: 3,
  job: 3,
  school: 3,
  age: 2,
  gender: 2,
  origin: 2,
  mental: 6,
  height: 2,
  weight: 2,
  hair: 2,
  eye: 2,
  skin: 2,
  address: 6,
  family: 6,
  scars: 6,
  income: 3,
  cash: 3,
  savings: 3,
  assets: 3,
  realestate: 6,
};
const PROFILE_STATIC = new Set(["kana", "tags"]);
const MEMO_SKIP = new Set(["kana", "url"]); // ふりがなは名前に、URLは外部URL欄に出すのでメモには書かない
const PROFILE_FIELDS = PROFILE_SECTIONS.flatMap((sec) => sec.fields);
