document.getElementById("saveCharacter").addEventListener("click", (e) => {
  e.preventDefault();
  try {
    if (saveCurrentCharacter()) showHome();
    else {
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
// ---- ダイスを振る（NdX 形式。2d6+3 / 1d100 / 3d6+1d4-2 などの式に対応）
function rollDetailed(raw) {
  let s = String(raw).normalize("NFKC").trim().toLowerCase().replace(/\s+/g, "").replace(/d%/g, "d100");
  if (!s) throw Error("式を入力してください（例：1d100、2d6+3）");
  if (s.length > 80) throw Error("式が長すぎます");
  if (!/^[0-9d+\-*/().]+$/.test(s)) throw Error("使える文字は数字・d・+ - * / ( ) のみです");
  const shown = [];
  let dice = 0;
  const numeric = s.replace(/(\d*)d(\d+)/g, (_, ct, st) => {
    const c = ct === "" ? 1 : Number(ct),
      d = Number(st);
    if (!Number.isInteger(c) || c < 1 || c > 10000) throw Error("ダイスの数は1〜10000にしてください");
    if (!Number.isInteger(d) || d < 1 || d > 1000000) throw Error("面数は1〜1000000にしてください");
    const rolls = [];
    for (let i = 0; i < c; i++) rolls.push(Math.floor(Math.random() * d) + 1);
    dice += c;
    shown.push(
      rolls.length > 30
        ? "[" + rolls.slice(0, 30).join(",") + ",…ほか" + (rolls.length - 30) + "個]"
        : rolls.length > 1
          ? "[" + rolls.join(",") + "]"
          : String(rolls[0]),
    );
    return "(" + rolls.reduce((a, b) => a + b, 0) + ")";
  });
  if (!dice) throw Error("ダイスの式になっていません（例：1d100、2d6+3）");
  const total = rollFormula(numeric);
  let i = 0;
  const detail = s.replace(/(\d*)d(\d+)/g, () => shown[i++]);
  return { formula: s, total, detail };
}
(function () {
  const dlg = document.getElementById("diceDialog"),
    field = document.getElementById("diceFormula"),
    resEl = document.getElementById("diceResult"),
    detEl = document.getElementById("diceDetail"),
    hist = document.getElementById("diceHistory");
  const KEY = "trpgCharmakerLastDice_v1";
  let history = [];
  const load = () => {
    try {
      const v = localStorage.getItem(KEY);
      if (v) field.value = v;
    } catch (e) {}
  };
  const save = () => {
    try {
      localStorage.setItem(KEY, field.value);
    } catch (e) {}
  };
  const renderHistory = () => {
    hist.innerHTML = "";
    history.forEach((h) => {
      const d = document.createElement("div");
      const b = document.createElement("b");
      b.textContent = h.total;
      d.append(h.formula + " → ", b);
      if (h.detail !== String(h.total)) {
        const sm = document.createElement("span");
        sm.textContent = "　" + h.detail;
        d.append(sm);
      }
      hist.append(d);
    });
  };
  const roll = () => {
    try {
      const r = rollDetailed(field.value);
      resEl.classList.remove("is-error");
      resEl.textContent = String(r.total);
      detEl.textContent = r.detail === String(r.total) ? "" : r.formula + " = " + r.detail;
      history.unshift(r);
      history = history.slice(0, 12);
      renderHistory();
      save();
    } catch (e) {
      resEl.classList.add("is-error");
      resEl.textContent = e.message;
      detEl.textContent = "";
    }
  };
  const open = () => {
    load();
    dlg.classList.remove("hidden");
    field.focus();
    field.select();
  };
  const close = () => dlg.classList.add("hidden");
  document.getElementById("openDice").addEventListener("click", open);
  document.getElementById("diceRoll").addEventListener("click", roll);
  field.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      roll();
    }
  });
  document.getElementById("diceChips").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-f]");
    if (!b) return;
    field.value = b.dataset.f;
    roll();
  });
  document.getElementById("diceClear").addEventListener("click", () => {
    history = [];
    renderHistory();
    resEl.classList.remove("is-error");
    resEl.textContent = "—";
    detEl.textContent = "";
  });
  document.getElementById("diceClose").addEventListener("click", close);
  dlg.addEventListener("click", (e) => {
    if (e.target === dlg) close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !dlg.classList.contains("hidden")) close();
  });
})();

// ===== v92：成長記録（通ったシナリオ・技能の成長・獲得物を書いて、シートに反映／取り消し） =====
(function () {
  const dlg = document.getElementById("growthDialog"),
    listEl = document.getElementById("growthList"),
    editEl = document.getElementById("growthEdit"),
    titleEl = document.getElementById("growthTitle");
  const KINDS = [
    ["gear", "装備品"],
    ["spells", "呪文・魔術"],
    ["books", "魔導書"],
    ["other", "その他（メモに追記）"],
  ];
  const kindName = (k) => (KINDS.find((x) => x[0] === k) || KINDS[3])[1].replace("（メモに追記）", "");
  const el = (t, c, x) => {
    const e = document.createElement(t);
    if (c) e.className = c;
    if (x != null) e.textContent = x;
    return e;
  };
  const today = () => {
    const d = new Date(),
      p = (n) => String(n).padStart(2, "0");
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  };
  const uid2 = () => "g" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const sgn = (n) => (n >= 0 ? "+" : "") + n;
  const findSkillRow = (name) =>
    [...skills.querySelectorAll(".row")].find(
      (r) => r.querySelector(".skill-name").value.trim().toLowerCase() === String(name).trim().toLowerCase(),
    );
  const fire = (inp) => inp.dispatchEvent(new Event("input", { bubbles: true }));
  function changed() {
    try {
      scheduleDirtyCheck();
    } catch (e) {}
  }
  function evalAmount(a) {
    const t = normalizeFormula(String(a == null ? "" : a));
    if (/^[+-]?\d+$/.test(t)) return Number(t);
    // 「1dMP」「-1dPOW」「POW/5」のように、能力値・ステータスの名前も書ける
    if (/[A-Za-z\u3040-\u30ff\u3400-\u9fff々ー]/.test(t.replace(/\d*d\d+/gi, "")) || DICE_ANY_RE.test(t)) {
      const ctx = liveStatCtx();
      extras.querySelectorAll(".row").forEach((r) => {
        const n = r.querySelector(".extra-name").value.trim(),
          v = r.querySelector(".extra-value").value.trim();
        if (n && /^\d+$/.test(v)) ctx[n] = Number(v);
      });
      return Number(resolveExpr(t, ctx));
    }
    return rollFormula(t);
  }
  // 成長の対象を探す：技能 → 能力値（STR…）→ ステータス（SAN・HP・MP・幸運…）→ 追加ステータス の順。見つからなければ新しい技能になる
  const lc = (x) => String(x).trim().toLowerCase();
  function findTarget(name, kind, key) {
    const n = lc(name);
    if (kind === "skill" || !kind) {
      const r = findSkillRow(name);
      if (r) return { kind: "skill", key: r.querySelector(".skill-name").value.trim(), row: r };
    }
    if (kind === "stat" || !kind) {
      const k = names.find((x) => lc(x) === n);
      if (k) {
        const i = document.getElementById("base-" + k);
        if (i) return { kind: "stat", key: k, inp: i };
      }
    }
    if (kind === "derived" || !kind) {
      const r = [...derivedStatuses.querySelectorAll(".derived-row")].find((r) => lc(r.dataset.derivedName) === n);
      if (r) return { kind: "derived", key: r.dataset.derivedName, inp: r.querySelector(".derived-formula") };
    }
    if (kind === "extra" || !kind) {
      const r = [...extras.querySelectorAll(".row")].find((r) => lc(r.querySelector(".extra-name").value) === n);
      if (r) return { kind: "extra", key: r.querySelector(".extra-name").value.trim(), inp: r.querySelector(".extra-value") };
    }
    return null;
  }
  // 入力欄の数字（または式）に増減を加える。式のときは末尾に「+3」「-2」を足す
  function bumpInput(inp, delta) {
    const cur = inp.value.trim();
    let mode,
      next,
      suffix = "";
    if (cur === "" || /^[+-]?\d+$/.test(cur)) {
      mode = "num";
      next = String((cur === "" ? 0 : Number(cur)) + delta);
    } else {
      mode = "suffix";
      suffix = sgn(delta);
      next = cur + suffix;
    }
    inp.value = next;
    fire(inp);
    return { mode, suffix, before: cur === "" ? "（空）" : cur, after: next };
  }
  function unbumpInput(inp, g, delta) {
    const cur = inp.value.trim();
    if (g.mode === "num" && /^[+-]?\d+$/.test(cur)) {
      const n = Number(cur) - delta;
      inp.value = n === 0 && g.before === "（空）" ? "" : String(n);
      fire(inp);
      return true;
    }
    if (g.mode === "suffix" && cur.endsWith(g.suffix)) {
      inp.value = cur.slice(0, cur.length - g.suffix.length);
      fire(inp);
      return true;
    }
    return false;
  }
  // 技能に増減を加える。あとで戻せるよう、やり方を記録して返す
  function bumpSkill(name, delta) {
    const t = findTarget(name);
    if (!t) {
      addSkill(String(name).trim(), String(delta));
      return { kind: "new", mode: "new", before: "（なし）", after: String(delta) };
    }
    if (t.kind !== "skill") {
      const r = bumpInput(t.inp, delta);
      r.kind = t.kind;
      r.key = t.key;
      return r;
    }
    const r = t.row,
      sp = document.body.classList.contains("sp-on");
    const inp = r.querySelector(sp ? ".skill-other" : ".skill-value"),
      cur = inp.value.trim();
    const before = r.querySelector(".skill-value").value;
    let mode,
      next,
      suffix = "";
    if (cur === "" && sp) {
      mode = "num";
      next = String(delta);
    } else if (/^[+-]?\d+$/.test(cur)) {
      mode = "num";
      next = String(Number(cur) + delta);
    } else {
      mode = "suffix";
      suffix = sgn(delta);
      next = cur + suffix;
      if (sp && r.dataset.otherRoll !== undefined && r.dataset.otherSrc === cur) {
        r.dataset.otherRoll = String(Number(r.dataset.otherRoll) + delta);
        r.dataset.otherSrc = next;
      }
    }
    inp.value = next;
    fire(inp);
    return { kind: "skill", key: t.key, mode, suffix, sp, before, after: r.querySelector(".skill-value").value };
  }
  function unbumpSkill(g, delta) {
    const kind = g.kind === "new" ? "skill" : g.kind || "skill";
    const t = findTarget(g.key || g.skill, kind);
    if (!t) return false;
    if (g.mode === "new") {
      t.row.remove();
      refreshPaletteStatusOptions();
      updatePointSummary();
      return true;
    }
    if (t.kind !== "skill") return unbumpInput(t.inp, g, delta);
    const r = t.row,
      sp = document.body.classList.contains("sp-on");
    const inp = r.querySelector(sp ? ".skill-other" : ".skill-value"),
      cur = inp.value.trim();
    if (g.mode === "num" && /^[+-]?\d+$/.test(cur)) {
      const n = Number(cur) - delta;
      inp.value = sp && n === 0 ? "" : String(n);
      fire(inp);
      return true;
    }
    if (g.mode === "suffix" && cur.endsWith(g.suffix)) {
      const nt = cur.slice(0, cur.length - g.suffix.length);
      if (sp && r.dataset.otherRoll !== undefined && r.dataset.otherSrc === cur) {
        r.dataset.otherRoll = String(Number(r.dataset.otherRoll) - delta);
        r.dataset.otherSrc = nt;
      }
      inp.value = nt;
      fire(inp);
      return true;
    }
    return false;
  }
  function listBody(key) {
    return document.querySelector('#listFields details[data-list="' + key + '"] .list-body');
  }
  function addGain(e, x) {
    if (x.kind === "other") {
      const line = "・" + (e.scenario || "成長記録") + "：" + x.name + (x.note ? "（" + x.note + "）" : "");
      const m = document.getElementById("memo");
      m.value = m.value.trim() ? m.value.replace(/\s+$/, "") + "\n" + line : line;
      x.memoLine = line;
      return;
    }
    const def = LIST_DEFS.find((d) => d.key === x.kind),
      body = listBody(x.kind);
    if (!def || !body) return;
    const v = { name: x.name, note: x.note || "" };
    if (x.kind === "gear") v.qty = "1";
    addListRow(def, body, v);
    body.closest("details").open = true;
  }
  function removeGain(x) {
    if (x.kind === "other") {
      const m = document.getElementById("memo");
      if (x.memoLine && m.value.includes(x.memoLine)) {
        m.value = m.value
          .replace("\n" + x.memoLine, "")
          .replace(x.memoLine + "\n", "")
          .replace(x.memoLine, "");
        return true;
      }
      return false;
    }
    const body = listBody(x.kind);
    if (!body) return false;
    const row = [...body.querySelectorAll(".list-row")].find((r) => r.querySelector('[data-col="name"]').value.trim() === x.name.trim());
    if (row) {
      row.remove();
      return true;
    }
    return false;
  }
  function applyEntry(e) {
    if (e.applied) return;
    const done = [];
    try {
      (e.growth || []).forEach((g) => {
        if (typeof g.delta !== "number") g.delta = evalAmount(g.amount);
        const r = bumpSkill(g.skill, g.delta);
        Object.assign(g, r);
        done.push(g);
      });
    } catch (er) {
      toast("反映できませんでした：" + er.message);
      done.reverse().forEach((g) => unbumpSkill(g, g.delta));
      return false;
    }
    (e.gains || []).forEach((x) => addGain(e, x));
    e.applied = true;
    e.appliedAt = new Date().toISOString();
    updatePointSummary();
    changed();
    return true;
  }
  function revertEntry(e) {
    if (!e.applied) return;
    let miss = 0;
    (e.growth || [])
      .slice()
      .reverse()
      .forEach((g) => {
        if (typeof g.delta === "number" && !unbumpSkill(g, g.delta)) miss++;
      });
    (e.gains || []).forEach((x) => {
      if (!removeGain(x)) miss++;
    });
    e.applied = false;
    delete e.appliedAt;
    updatePointSummary();
    changed();
    if (miss) toast("取り消しました（" + miss + "件は手で変更されていたため、そのまま残しています）");
  }
  const sortLog = () =>
    growthLog.slice().sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")) || String(b.id).localeCompare(String(a.id)));
  function summaryOf(e) {
    const g = (e.growth || [])
      .filter((x) => x.skill)
      .map(
        (x) =>
          x.skill +
          " " +
          (typeof x.delta === "number" ? sgn(x.delta) : x.amount) +
          (e.applied && x.before != null && x.mode !== "new"
            ? "（" + x.before + "→" + x.after + "）"
            : x.mode === "new" && e.applied
              ? "（新規）"
              : ""),
      );
    const a = (e.gains || []).filter((x) => x.name).map((x) => kindName(x.kind) + "：" + x.name);
    return { g, a };
  }
  function renderList() {
    setIconText(titleEl, "growth", "成長記録");
    editEl.classList.add("hidden");
    listEl.classList.remove("hidden");
    listEl.innerHTML = "";
    const top = el("div", "growth-bar");
    top.append(el("span", "muted", "通ったシナリオ " + growthLog.length + "本"));
    const nb = el("button", "primary", "＋ 新しい記録");
    nb.type = "button";
    nb.onclick = () => renderEdit(null);
    top.append(nb);
    listEl.append(top);
    if (!growthLog.length)
      listEl.append(
        el(
          "p",
          "hint",
          "まだ記録がありません。「＋ 新しい記録」から、通ったシナリオ・成長した技能・獲得したものを書いて、シートに反映できます。反映した記録は「取り消し」で元に戻せます。",
        ),
      );
    sortLog().forEach((e) => {
      const c = el("div", "growth-item" + (e.applied ? " applied" : ""));
      const h = el("div", "growth-h");
      h.append(el("b", null, e.scenario || "（シナリオ名なし）"), el("span", "muted", e.date || ""));
      const bd = el("span", "growth-badge" + (e.applied ? " on" : ""), e.applied ? "反映済み" : "未反映");
      h.append(bd);
      c.append(h);
      const sm = summaryOf(e);
      if (sm.g.length) c.append(setIconText(el("div", "growth-line"), "growth", sm.g.join("、")));
      if (sm.a.length) c.append(setIconText(el("div", "growth-line"), "gift", sm.a.join("、")));
      if (e.memo) c.append(el("div", "growth-line muted", e.memo));
      const ac = el("div", "growth-actions");
      const del = el("button", "danger", "削除");
      del.type = "button";
      del.onclick = () => {
        if (e.applied) {
          toast("反映済みの記録です。先に「取り消し」してください");
          return;
        }
        if (!confirm("この記録を削除します。よろしいですか？")) return;
        growthLog = growthLog.filter((x) => x !== e);
        changed();
        renderList();
      };
      ac.append(del);
      if (e.applied) {
        const rv = setIconText(el("button"), "undo", "取り消し");
        rv.type = "button";
        rv.title = "反映した成長・獲得物をシートから戻します";
        rv.onclick = () => {
          revertEntry(e);
          renderList();
          toast("反映を取り消しました");
        };
        ac.append(rv);
      } else {
        const ed = el("button", null, "編集");
        ed.type = "button";
        ed.onclick = () => renderEdit(e);
        ac.append(ed);
        const ap = el("button", "primary", "反映する");
        ap.type = "button";
        ap.onclick = () => {
          if (applyEntry(e)) {
            renderList();
            toast("シートに反映しました。保存すると確定します");
          }
        };
        ac.append(ap);
      }
      c.append(ac);
      listEl.append(c);
    });
  }
  function renderEdit(e) {
    const isNew = !e;
    const w = e
      ? JSON.parse(JSON.stringify(e))
      : { id: uid2(), date: today(), scenario: "", memo: "", growth: [{ skill: "", amount: "" }], gains: [], applied: false };
    setIconText(titleEl, "growth", isNew ? "新しい記録" : "記録を編集");
    listEl.classList.add("hidden");
    editEl.classList.remove("hidden");
    editEl.innerHTML = "";
    const lab = (t, node) => {
      const l = el("label", "growth-lab");
      l.append(el("span", null, t), node);
      return l;
    };
    const sc = el("input");
    sc.type = "text";
    sc.placeholder = "例：月下の迷い家";
    sc.value = w.scenario || "";
    sc.maxLength = 80;
    const dt = el("input");
    dt.type = "date";
    dt.value = w.date || today();
    editEl.append(lab("通ったシナリオ", sc), lab("日付", dt));
    const dl = document.createElement("datalist");
    dl.id = "growthSkillNames";
    [
      ...new Set(
        [
          ...[...skills.querySelectorAll(".skill-name")].map((i) => i.value.trim()),
          ...names,
          ...[...derivedStatuses.querySelectorAll(".derived-row")].map((r) => r.dataset.derivedName),
          ...[...extras.querySelectorAll(".extra-name")].map((i) => i.value.trim()),
        ].filter(Boolean),
      ),
    ].forEach((n) => {
      const o = document.createElement("option");
      o.value = n;
      dl.append(o);
    });
    editEl.append(dl);
    // 技能の成長
    editEl.append(setIconText(el("h3", "growth-sub"), "growth", "成長・変化（技能・能力値・SANなど）"));
    editEl.append(
      el(
        "p",
        "hint",
        "技能名のほか、STR などの能力値、SAN・HP・MP・幸運などのステータス、追加ステータスの名前も書けます。増減は数字かダイス式で、減らすときはマイナス（例：-3、-1d6）。ダイスは反映するときに振られます（ダイスのボタンで先に振っておけます）。シートにない名前は、新しい技能として追加されます。",
      ),
    );
    const gh = el("div", "growth-rows");
    editEl.append(gh);
    const addG = (g) => {
      const r = el("div", "growth-row");
      const x = el("button", "danger", "×");
      x.type = "button";
      x.setAttribute("aria-label", "この行を削除");
      x.onclick = () => {
        r.remove();
      };
      const n = el("input");
      n.type = "text";
      n.placeholder = "技能名・SAN・STR など";
      n.value = g.skill || "";
      n.setAttribute("list", "growthSkillNames");
      n.className = "g-skill";
      const a = el("input");
      a.type = "text";
      a.placeholder = "増減（5、1d10、-3）";
      a.value = g.amount != null ? String(g.amount) : "";
      a.className = "g-amount";
      a.inputMode = "text";
      const d = setIconText(el("button"), "dice");
      d.type = "button";
      d.title = "ダイス式を今振って、数字にする";
      d.onclick = () => {
        try {
          const t = a.value.trim();
          const v = evalAmount(t);
          a.value = String(v);
          toast((/^[+-]?\d+$/.test(t) ? "" : t + " → ") + v);
        } catch (er) {
          toast("振れません：" + er.message);
        }
      };
      r.append(x, n, a, d);
      gh.append(r);
      return r;
    };
    (w.growth && w.growth.length ? w.growth : [{}]).forEach(addG);
    const ag = el("button", "small-btn", "＋ 技能を足す");
    ag.type = "button";
    ag.onclick = () => {
      const r = addG({});
      r.querySelector("input").focus();
    };
    editEl.append(ag);
    // 獲得物
    editEl.append(setIconText(el("h3", "growth-sub"), "gift", "獲得したもの"));
    editEl.append(el("p", "hint", "装備品・呪文・魔導書は、反映すると各一覧に追加されます。「その他」はメモ欄に1行追記します。"));
    const xh = el("div", "growth-rows");
    editEl.append(xh);
    const addX = (g) => {
      const r = el("div", "growth-row gain");
      const x = el("button", "danger", "×");
      x.type = "button";
      x.setAttribute("aria-label", "この行を削除");
      x.onclick = () => {
        r.remove();
      };
      const k = el("select", "g-kind");
      KINDS.forEach(([v, t]) => {
        const o = el("option", null, t);
        o.value = v;
        if (v === (g.kind || "gear")) o.selected = true;
        k.append(o);
      });
      const n = el("input");
      n.type = "text";
      n.placeholder = "名前";
      n.value = g.name || "";
      n.className = "g-name";
      const m = el("input");
      m.type = "text";
      m.placeholder = "備考（任意）";
      m.value = g.note || "";
      m.className = "g-note";
      r.append(x, k, n, m);
      xh.append(r);
      return r;
    };
    (w.gains || []).forEach(addX);
    const ax = el("button", "small-btn", "＋ 獲得物を足す");
    ax.type = "button";
    ax.onclick = () => {
      const r = addX({});
      r.querySelector("input").focus();
    };
    editEl.append(ax);
    const mm = el("textarea");
    mm.rows = 3;
    mm.placeholder = "自由メモ（報酬、SANの増減、NPCとの関係など。シートには反映されません）";
    mm.value = w.memo || "";
    editEl.append(lab("この記録のメモ", mm));
    const read = () => {
      w.scenario = sc.value.trim();
      w.date = dt.value || today();
      w.memo = mm.value.trim();
      w.growth = [...gh.querySelectorAll(".growth-row")]
        .map((r) => ({ skill: r.querySelector(".g-skill").value.trim(), amount: r.querySelector(".g-amount").value.trim() }))
        .filter((g) => g.skill || g.amount);
      w.gains = [...xh.querySelectorAll(".growth-row")]
        .map((r) => ({
          kind: r.querySelector(".g-kind").value,
          name: r.querySelector(".g-name").value.trim(),
          note: r.querySelector(".g-note").value.trim(),
        }))
        .filter((g) => g.name);
      const bad = w.growth.find((g) => !g.skill || !g.amount);
      if (bad) {
        toast("名前と増減は、両方入れてください");
        return false;
      }
      for (const g of w.growth) {
        try {
          if (!/^[+-]?\d+$/.test(normalizeFormula(g.amount))) evalAmount(g.amount);
        } catch (er) {
          toast("増減「" + g.amount + "」が読めません：" + er.message);
          return false;
        }
      }
      if (!w.scenario && !w.growth.length && !w.gains.length && !w.memo) {
        toast("何か書いてください");
        return false;
      }
      w.applied = false;
      return true;
    };
    const save = (thenApply) => {
      if (!read()) return;
      if (isNew) growthLog.push(w);
      else {
        const i = growthLog.findIndex((x) => x.id === e.id);
        if (i >= 0) growthLog[i] = w;
        else growthLog.push(w);
      }
      changed();
      if (thenApply) {
        const ref = growthLog.find((x) => x.id === w.id);
        if (applyEntry(ref)) toast("シートに反映しました。保存すると確定します");
      }
      renderList();
    };
    const ac = el("div", "growth-actions");
    const cn = el("button", null, "キャンセル");
    cn.type = "button";
    cn.onclick = renderList;
    const s1 = el("button", null, "記録だけ保存");
    s1.type = "button";
    s1.onclick = () => save(false);
    const s2 = el("button", "primary", "保存して反映");
    s2.type = "button";
    s2.onclick = () => save(true);
    ac.append(cn, s1, s2);
    editEl.append(ac);
    (isNew ? sc : sc).focus();
  }
  const open = () => {
    renderList();
    dlg.classList.remove("hidden");
  };
  const close = () => dlg.classList.add("hidden");
  document.getElementById("openGrowth").addEventListener("click", open);
  document.getElementById("growthClose").addEventListener("click", () => {
    if (!editEl.classList.contains("hidden")) renderList();
    else close();
  });
  dlg.addEventListener("click", (ev) => {
    if (ev.target === dlg) close();
  });
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && !dlg.classList.contains("hidden")) close();
  });
  window.__growth = { apply: applyEntry, revert: revertEntry, open, renderList };
})();
