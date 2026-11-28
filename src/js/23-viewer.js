function viewerCompute(f) {
  const nums = {};
  names.forEach((n) => {
    const v = statTotal(f.base && f.base[n], f.baseAdd && f.baseAdd[n], f.baseOther && f.baseOther[n]);
    if (/^\d+$/.test(v)) nums[n] = Number(v);
  });
  const ctx = { ...nums },
    derived = [];
  const dl = (Array.isArray(f.derived) && f.derived.length ? f.derived : derivedDefinitions).slice();
  if (!dl.some((x) => x && x.name === "回避")) {
    const k = dl.findIndex((x) => x && x.name === "知識");
    dl.splice(k >= 0 ? k + 1 : dl.length, 0, { name: "回避", formula: "DEX*2" });
  }
  dl.forEach((d) => {
    if (!d || !String(d.name || "").trim()) return;
    let v = "—";
    try {
      const fm = String(d.formula || "").trim();
      if (fm && !VW_DICE_RE.test(fm)) {
        const r = /[A-Za-z]/.test(fm) ? resolveExpr(fm, ctx) : rollFormula(fm);
        v = String(r);
        ctx[d.name] = Number(r);
      }
    } catch (e) {}
    derived.push({ name: String(d.name).trim(), value: v, formula: String(d.formula || "").trim() });
  });
  const extras = [];
  (f.extras || []).forEach((x) => {
    const n = String((x && x.name) || "").trim();
    if (!n) return;
    const raw = String(x.value == null ? "" : x.value).trim();
    let v = raw;
    try {
      if (raw && !/^\d+$/.test(raw) && !VW_DICE_RE.test(raw) && /[A-Za-z]/.test(raw)) v = String(resolveExpr(raw, ctx));
    } catch (e) {}
    extras.push({ name: n, value: v || "—", raw });
  });
  const rows = (f.skills || [])
    .filter((s) => s && String(s.name || "").trim())
    .map((s) => ({
      name: String(s.name).trim(),
      raw: String(s.value == null ? "" : s.value).trim(),
      damage: String(s.damage || "").trim(),
      val: null,
      text: "",
      dice: false,
      pbase: String(s.base == null ? "" : s.base).trim(),
      occ: Math.max(0, Number(s.occ) || 0),
      int: Math.max(0, Number(s.int) || 0),
      other: Math.max(0, Number(s.other) || 0),
      otx: String(s.other == null ? "" : s.other).trim(),
      orl: s.otherRoll,
      cats: effectiveSkillCats(String(s.name).trim(), s.cats),
      osMemo: String(s.osMemo || "").trim(),
      osLines: textLines(s.osLines, true),
    }));
  const sv = { ...ctx };
  let pend = rows.filter((r) => r.raw);
  while (pend.length) {
    let prog = false;
    const nx = [];
    for (const r of pend) {
      if (VW_DICE_RE.test(r.raw)) {
        r.text = r.raw;
        r.dice = true;
        prog = true;
        continue;
      }
      try {
        const v = /^\d+$/.test(r.raw) ? Number(r.raw) : resolveExpr(r.raw, sv);
        if (!Number.isFinite(Number(v))) throw Error("x");
        r.val = Math.trunc(Number(v));
        r.text = String(r.val);
        sv[r.name] = r.val;
        sv[r.name.toUpperCase()] = r.val;
        prog = true;
      } catch (e) {
        nx.push(r);
      }
    }
    if (!prog) {
      nx.forEach((r) => {
        r.text = r.raw;
      });
      break;
    }
    pend = nx;
  }
  rows.forEach((r) => {
    if (!r.raw) r.text = "—";
  });
  let db = "";
  const ov = String(f.dbOverride || "").trim();
  if (ov) db = ov.replace(/\s+/g, "");
  else if (nums.STR != null && nums.SIZ != null) db = calculateDB(nums.STR, nums.SIZ);
  return { nums, derived, extras, skills: rows, db, ctx };
}
function vwSec(title, small, tag) {
  const d = vwEl(tag || "div", "vw-sec");
  const h = vwEl(tag === "details" ? "summary" : "h3");
  h.append(document.createTextNode(title));
  if (small) {
    h.append(vwEl("small", null, small));
  }
  d.append(h);
  return d;
}
function vwTile(label, val, big) {
  const t = vwEl("div", "vw-tile" + (big ? " big" : ""));
  t.append(vwEl("span", null, label), vwEl("b", null, val));
  return t;
}
// 式の中の名前を、いまの数値に置き換えた形（例：(CON+SIZ)/2 → (50+60)/2）
function vwSubst(formula, vals) {
  return String(formula).replace(NAME_TOKEN_RE, (n) => {
    const v = vals[n] != null ? vals[n] : vals[n.toUpperCase()];
    return v != null ? String(v) : n;
  });
}
// 成長記録のうち、この名前（技能・能力値・SANなど）に関わる変化の一覧：[[シナリオ名, 増減]]
function vwGrowthRows(f, name) {
  const key = nameKey(name),
    out = [];
  (f.growthLog || []).forEach((e) =>
    (e.growth || []).forEach((x) => {
      if (!x.skill || nameKey(x.skill) !== key) return;
      const amount = typeof x.delta === "number" ? (x.delta >= 0 ? "+" : "") + x.delta : String(x.amount == null ? "" : x.amount);
      out.push([(e.scenario || "（シナリオ名なし）") + (e.applied ? "" : "（未反映）"), amount]);
    }),
  );
  return out;
}
// タップで開く「内訳」の中身。rows: [[項目, 値]]、growth: [[シナリオ名, 増減]]
function vwDetailBody(rows, growth, notes) {
  const box = vwEl("div", "vw-detail-body");
  rows.forEach(([l, v]) => {
    const r = vwEl("div", "r");
    r.append(vwEl("span", null, l), vwEl("b", null, v));
    box.append(r);
  });
  if (growth && growth.length) {
    box.append(vwEl("h4", null, "成長記録"));
    growth.forEach(([l, v]) => {
      const r = vwEl("div", "r");
      r.append(vwEl("span", null, l), vwEl("b", null, v));
      box.append(r);
    });
  }
  (notes || []).forEach((n) => box.append(n));
  if (!box.childNodes.length) box.append(vwEl("div", "muted", "内訳の入力はありません"));
  return box;
}
// タイル（ステータス・能力値）を並べ、タップするとその下に内訳を出す。defs: [{label, val, big, rows, growth}]
function vwTapTiles(sec, defs) {
  const grid = vwEl("div", "vw-tiles"),
    panel = vwEl("div", "vw-detail hidden");
  let current = null;
  const close = () => {
    if (!current) return;
    current.classList.remove("open");
    current.setAttribute("aria-expanded", "false");
    current = null;
    panel.classList.add("hidden");
  };
  defs.forEach((d) => {
    const t = vwTile(d.label, d.val, d.big);
    t.classList.add("tap");
    t.setAttribute("role", "button");
    t.setAttribute("tabindex", "0");
    t.setAttribute("aria-expanded", "false");
    const toggle = () => {
      if (current === t) return close();
      close();
      current = t;
      t.classList.add("open");
      t.setAttribute("aria-expanded", "true");
      panel.replaceChildren(vwEl("h4", "vw-detail-title", d.label), vwDetailBody(d.rows || [], d.growth || []));
      panel.classList.remove("hidden");
    };
    t.addEventListener("click", toggle);
    t.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggle();
      }
    });
    grid.append(t);
  });
  sec.append(grid, panel);
}
// 技能の内訳：[[項目, 値]]、成長記録、補足の要素
function vwSkillDetail(r, f) {
  const rows = [];
  const od = !!r.otx && !/^\d+$/.test(r.otx);
  if (r.pbase && r.pbase !== "0") rows.push(["初期値", r.pbase]);
  if (r.occ) rows.push(["職業P", "＋" + r.occ]);
  if (r.int) rows.push(["興味P", "＋" + r.int]);
  if (od) rows.push(["その他", r.otx + (r.orl !== undefined && r.orl !== null && r.orl !== "" ? "→" + r.orl : "")]);
  else if (r.other) rows.push(["その他", "＋" + r.other]);
  if (r.raw && !/^\d+$/.test(r.raw)) rows.push(["値の式", r.raw]);
  rows.push(["合計", r.text]);
  if (r.cats && r.cats.length) rows.push(["分類", r.cats.join("・")]);
  const notes = [];
  if (r.osMemo || r.osLines.length) {
    const box = vwEl("div", "vw-os");
    box.append(vwEl("h4", null, "成功したとき"));
    if (r.osMemo) box.append(vwEl("div", "vw-os-memo", r.osMemo));
    if (r.osLines.length) box.append(vwEl("pre", "vw-os-lines", r.osLines.join("\n")));
    notes.push(box);
  }
  return [rows, vwGrowthRows(f, r.name), notes];
}
function renderViewer(c) {
  const f = c.form || {},
    host = document.getElementById("viewerBody");
  host.innerHTML = "";
  const k = viewerCompute(f),
    pf = f.profile || {};
  // 見出し：立ち絵・名前・ふりがな・要点
  const hero = vwEl("div", "vw-hero"),
    meta = vwEl("div", "vw-meta");
  if (f.imageId) {
    const im = vwEl("img", "vw-portrait");
    im.alt = (c.name || "") + "の立ち絵";
    hero.append(im);
    im.referrerPolicy = "no-referrer";
    im.onerror = () => im.remove();
    imageUrl(f.imageId).then((u) => {
      if (u) im.src = u;
      else im.remove();
    });
  }
  if (pf.kana) meta.append(vwEl("div", "vw-kana", pf.kana));
  meta.append(vwEl("h2", "vw-name", c.name || "名称未設定"));
  const chips = vwEl("div", "vw-chips");
  const chip = (label, val) => {
    if (val != null && String(val).trim())
      chips.append(
        (() => {
          const e = vwEl("span", "vw-chip");
          e.append(vwEl("b", null, label), document.createTextNode(String(val).trim()));
          return e;
        })(),
      );
  };
  chip("PL", f.playerName);
  chip("職業", pf.job);
  chip("年齢", pf.age);
  chip("性別", pf.gender);
  chip("出身", pf.origin);
  chip("学校・学位", pf.school);
  chip("精神的障害", pf.mental);
  String(pf.tags || "")
    .split(/[\s,、，]+/)
    .filter(Boolean)
    .forEach((t) => chip("＃", t));
  const url = String(pf.url || "").trim();
  if (/^https?:\/\//i.test(url)) {
    const a = vwEl("a", "vw-chip", "外部URL ↗");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    chips.append(a);
  }
  meta.append(chips);
  hero.append(meta);
  host.append(hero);
  // ステータス
  const st = vwSec("ステータス", "タップで内訳");
  const main = new Set(["HP", "MP", "SAN"]);
  const stDefs = k.derived.map((d) => {
    const rows = [];
    if (d.formula) {
      rows.push(["計算式", d.formula]);
      const sub = vwSubst(d.formula, k.ctx);
      if (sub !== d.formula) rows.push(["代入", sub]);
    }
    rows.push(["値", d.value]);
    return { label: d.name, val: d.value, big: main.has(d.name), rows, growth: vwGrowthRows(f, d.name) };
  });
  if (k.db !== "") {
    const rows = [];
    if (String(f.dbOverride || "").trim()) rows.push(["手入力", k.db]);
    else if (k.nums.STR != null && k.nums.SIZ != null)
      rows.push(["STR＋SIZ", k.nums.STR + "＋" + k.nums.SIZ + "＝" + (k.nums.STR + k.nums.SIZ)], ["ダメージボーナス", k.db]);
    stDefs.push({ label: "DB", val: k.db, rows, growth: [] });
  }
  k.extras.forEach((x) => {
    const rows = [];
    if (x.raw && x.raw !== x.value) {
      rows.push(["式", x.raw]);
      const sub = vwSubst(x.raw, k.ctx);
      if (sub !== x.raw) rows.push(["代入", sub]);
    }
    rows.push(["値", x.value]);
    stDefs.push({ label: x.name, val: x.value, rows, growth: vwGrowthRows(f, x.name) });
  });
  vwTapTiles(st, stDefs);
  host.append(st);
  // 能力値
  const ab = vwSec("能力値", "タップで内訳");
  vwTapTiles(
    ab,
    names.map((n) => {
      const b0 = f.base && f.base[n] != null ? String(f.base[n]).trim() : "",
        ad = f.baseAdd && f.baseAdd[n],
        ot = f.baseOther && f.baseOther[n];
      const tot = statTotal(b0, ad, ot);
      const v = tot !== "" ? tot : "—";
      const rows = [];
      if (statTotal(b0, ad, ot) !== b0) {
        rows.push(["初期値", b0]);
        if (statDelta(ad)) rows.push(["増加分", (statDelta(ad) > 0 ? "＋" : "−") + Math.abs(statDelta(ad))]);
        if (statDelta(ot)) rows.push(["その他", (statDelta(ot) > 0 ? "＋" : "−") + Math.abs(statDelta(ot))]);
        rows.push(["合計", v]);
      } else rows.push(["値", v]);
      if (k.nums[n] != null) rows.push(["×5", String(k.nums[n] * 5)]);
      return { label: n, val: v, rows, growth: vwGrowthRows(f, n) };
    }),
  );
  host.append(ab);
  // 技能（検索・並べ替え・職業/興味の絞り込み付き）
  if (k.skills.length) {
    const sk = vwSec("技能", k.skills.length + "件");
    const occN = k.skills.filter((r) => r.occ > 0).length,
      intN = k.skills.filter((r) => r.int > 0).length;
    let occUsed = 0,
      intUsed = 0;
    k.skills.forEach((r) => {
      occUsed += r.occ;
      intUsed += r.int;
    });
    if (f.spMode || occUsed || intUsed) {
      const lim = (fm) => {
        fm = String(fm || "").trim();
        if (!fm) return null;
        try {
          return /^[0-9+\-*/().\s]+$/.test(fm) ? rollFormula(fm) : resolveExpr(fm, k.nums);
        } catch (e) {
          return null;
        }
      };
      const pts = vwEl("div", "vw-pts");
      [
        ["職業P", occUsed, lim(f.spOccFormula)],
        ["興味P", intUsed, lim(f.spIntFormula)],
      ].forEach(([lb, used, lm]) => {
        const sp = vwEl("span");
        sp.append(document.createTextNode(lb + " 使用 "), vwEl("b", null, String(used)));
        if (lm !== null) {
          const rem = lm - used;
          sp.append(document.createTextNode(" ／ " + lm + " "));
          const rs = vwEl("span", rem < 0 ? "over" : "", rem < 0 ? "（" + -rem + " 超過）" : "（残り " + rem + "）");
          sp.append(rs);
        }
        pts.append(sp);
      });
      sk.append(pts);
    }
    let pf2 = "all";
    const fchips = vwEl("div", "vw-fchips");
    const tools = vwEl("div", "vw-tools"),
      q = document.createElement("input");
    q.type = "search";
    q.placeholder = "技能名で絞り込み";
    q.classList.add("has-search-ic");
    q.setAttribute("aria-label", "技能名で絞り込み");
    q.autocomplete = "off";
    const so = document.createElement("select");
    so.setAttribute("aria-label", "技能の並び順");
    [
      ["order", "登録順"],
      ["high", "値が高い順"],
      ["name", "名前順"],
    ].forEach(([v, l]) => {
      const o = document.createElement("option");
      o.value = v;
      o.textContent = l;
      so.append(o);
    });
    tools.append(q, so);
    const list = vwEl("div", "vw-skills");
    if (occN || intN) {
      [
        ["all", "すべて"],
        ["occ", "職業P振り " + occN],
        ["int", "興味P振り " + intN],
      ].forEach(([key, label]) => {
        if ((key === "occ" && !occN) || (key === "int" && !intN)) return;
        const b = vwEl("button", "chip" + (key === "all" ? " on" : ""), label);
        b.type = "button";
        b.onclick = () => {
          pf2 = key;
          fchips.querySelectorAll(".chip").forEach((x) => x.classList.toggle("on", x === b));
          draw();
        };
        fchips.append(b);
      });
      sk.append(fchips);
    }
    // 分類で絞り込む（もう一度押すと解除）
    let cf = "";
    const cchips = vwEl("div", "vw-fchips vw-cats"),
      catCount = new Map();
    k.skills.forEach((r) => r.cats.forEach((c) => catCount.set(c, (catCount.get(c) || 0) + 1)));
    allSkillCatsOrdered(catCount).forEach((c) => {
      const b = vwEl("button", "chip", c + " " + catCount.get(c));
      b.type = "button";
      b.onclick = () => {
        cf = cf === c ? "" : c;
        cchips.querySelectorAll(".chip").forEach((x) => x.classList.toggle("on", x === b && !!cf));
        draw();
      };
      cchips.append(b);
    });
    if (catCount.size) sk.append(cchips);
    sk.append(tools, list);
    const draw = () => {
      const kw = q.value.trim().toLowerCase();
      let rs = k.skills.filter(
        (r) =>
          (!kw || r.name.toLowerCase().includes(kw)) &&
          (!cf || r.cats.includes(cf)) &&
          (pf2 === "all" || (pf2 === "occ" && r.occ > 0) || (pf2 === "int" && r.int > 0)),
      );
      if (so.value === "high") rs = rs.slice().sort((a, b) => (b.val == null ? -1 : b.val) - (a.val == null ? -1 : a.val));
      else if (so.value === "name") rs = rs.slice().sort((a, b) => a.name.localeCompare(b.name, "ja"));
      list.innerHTML = "";
      if (!rs.length) {
        list.append(vwEl("div", "vw-empty", "該当する技能がありません"));
        return;
      }
      rs.forEach((r) => {
        const row = vwEl("div", "vw-skill" + (r.dice ? " dice" : "")),
          nm = vwEl("div", "n");
        nm.append(document.createTextNode(r.name));
        if (r.occ > 0) nm.append(vwEl("span", "tg occ", "職"));
        if (r.int > 0) nm.append(vwEl("span", "tg int", "興"));
        if (r.osMemo || r.osLines.length) nm.append(vwEl("span", "tg os", "成功時"));
        if (r.damage) nm.append(setIconText(vwEl("span", "d"), "sword", r.damage));
        row.append(nm, vwEl("div", "v", r.text));
        // タップで内訳（初期値・職業P・興味P・その他・成長記録）を開閉する
        const more = vwEl("div", "vw-detail more hidden");
        row.classList.add("tap");
        row.setAttribute("role", "button");
        row.setAttribute("tabindex", "0");
        row.setAttribute("aria-expanded", "false");
        const toggle = () => {
          const open = more.classList.contains("hidden");
          if (open) more.replaceChildren(vwDetailBody(...vwSkillDetail(r, f)));
          more.classList.toggle("hidden", !open);
          row.classList.toggle("open", open);
          row.setAttribute("aria-expanded", String(open));
        };
        row.addEventListener("click", (e) => {
          if (e.target.closest("a")) return;
          toggle();
        });
        row.addEventListener("keydown", (e) => {
          if (e.target === row && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            toggle();
          }
        });
        more.addEventListener("click", (e) => e.stopPropagation());
        row.append(more);
        list.append(row);
      });
    };
    q.addEventListener("input", draw);
    so.addEventListener("change", draw);
    draw();
    host.append(sk);
  }
  // 装備品・呪文・魔導書
  LIST_DEFS.forEach((def) => {
    const rows = (f.lists && Array.isArray(f.lists[def.key]) ? f.lists[def.key] : []).filter(
      (v) => v && Object.values(v).some((x) => String(x).trim()),
    );
    if (!rows.length) return;
    const sec = vwSec(def.title, rows.length + "件"),
      mid = def.cols[1],
      last = def.cols[def.cols.length - 1];
    rows.forEach((v) => {
      const it = vwEl("div", "vw-item"),
        t = vwEl("div", "t");
      t.append(document.createTextNode(String(v[def.cols[0][0]] || "（名前なし）").trim()));
      const mv = String(v[mid[0]] || "").trim();
      if (mv) t.append(vwEl("small", null, mid[0] === "qty" ? "×" + mv : mid[1] + "：" + mv));
      it.append(t);
      const nt = String(v[last[0]] || "").trim();
      if (nt) it.append(vwEl("div", "note", nt));
      sec.append(it);
    });
    host.append(sec);
  });
  // 外見・所持品・背景・記録（入力のある項目だけ）
  PROFILE_SECTIONS.forEach((sec, si) => {
    if (si === 0) return; // 探索者情報は見出しに出している
    const fields = sec.fields.filter((x) => String(pf[x.key] || "").trim());
    if (!fields.length) return;
    const box = vwSec(sec.title, null, "details");
    if (si === 1) box.open = true;
    const dl = vwEl("dl", "vw-dl");
    fields.forEach((x) => {
      const wide = x.area || String(pf[x.key]).length > 18;
      const dt = vwEl("dt", wide ? "wide" : "", x.label),
        dd = vwEl("dd", wide ? "wide" : "", String(pf[x.key]).trim());
      dl.append(dt, dd);
    });
    box.append(dl);
    host.append(box);
  });
  // 成長記録（通ったシナリオ）
  if (Array.isArray(f.growthLog) && f.growthLog.length) {
    const sec = vwSec("成長記録", f.growthLog.length + "本", null);
    f.growthLog
      .slice()
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
      .forEach((e) => {
        const it = vwEl("div", "vw-grow" + (e.applied ? "" : " pending"));
        const h = vwEl("div", "vw-grow-h");
        h.append(vwEl("b", null, e.scenario || "（シナリオ名なし）"), vwEl("small", null, (e.date || "") + (e.applied ? "" : "　未反映")));
        it.append(h);
        const g = (e.growth || [])
          .filter((x) => x.skill)
          .map((x) => x.skill + " " + (typeof x.delta === "number" ? (x.delta >= 0 ? "+" : "") + x.delta : x.amount));
        if (g.length) it.append(setIconText(vwEl("div", "vw-grow-l"), "growth", g.join("、")));
        const a = (e.gains || []).filter((x) => x.name).map((x) => x.name);
        if (a.length) it.append(setIconText(vwEl("div", "vw-grow-l"), "gift", a.join("、")));
        if (e.memo) it.append(vwEl("div", "vw-grow-l muted", e.memo));
        sec.append(it);
      });
    host.append(sec);
  }
  // メモ・ロックメモ
  const memo = String(f.memo || "").trim();
  if (memo) {
    const m = vwSec("メモ");
    m.append(vwEl("div", "vw-memo", memo));
    host.append(m);
  }
  if (f.secret) {
    const m = vwSec("ロックメモ");
    m.append(setIconText(vwEl("div", "vw-lock"), "lock", "パスワード付きのメモがあります（編集画面で開きます）"));
    host.append(m);
  }
}
let viewerSrc = "list",
  viewerForm = null,
  viewerEditorScroll = 0;
