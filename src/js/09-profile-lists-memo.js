(function buildProfileFields() {
  const host = document.getElementById("profileFields");
  if (!host) return;
  PROFILE_SECTIONS.forEach((sec) => {
    const d = document.createElement("details");
    d.className = "profile-block";
    if (sec.open) d.open = true;
    const sm = document.createElement("summary");
    sm.textContent = sec.title;
    d.append(sm);
    const short = document.createElement("div");
    short.className = "grid profile-short";
    const long = document.createElement("div");
    long.className = "profile-long";
    sec.fields.forEach((f) => {
      if (PROFILE_STATIC.has(f.key)) return;
      const w = document.createElement("div"),
        l = document.createElement("label");
      if (!f.area) {
        w.className = "pf-pair";
        w.style.setProperty("--sp", PROFILE_SPAN[f.key] || 3);
      }
      l.textContent = f.label;
      l.htmlFor = "prof-" + f.key;
      const i = document.createElement(f.area ? "textarea" : "input");
      i.id = "prof-" + f.key;
      i.className = "profile-input";
      i.dataset.key = f.key;
      if (f.area) {
        i.rows = 2;
      } else {
        i.type = "text";
      }
      w.append(l, i);
      (f.area ? long : short).append(w);
    });
    if (short.children.length) d.append(short);
    if (long.children.length) d.append(long);
    host.append(d);
  });
})();
function readProfile() {
  const o = {};
  PROFILE_FIELDS.forEach((f) => {
    const el = document.getElementById("prof-" + f.key);
    o[f.key] = el ? el.value : "";
  });
  return o;
}
function writeProfile(o) {
  o = o || {};
  PROFILE_FIELDS.forEach((f) => {
    const el = document.getElementById("prof-" + f.key);
    if (el) el.value = o[f.key] == null ? "" : String(o[f.key]);
  });
}
// ===== v67：装備品・呪文・魔導書の追加リスト（メモに「・名前｜…」の行として書き出し、読み込みで戻す） =====
const LIST_DEFS = [
  {
    key: "gear",
    title: "装備品",
    cols: [
      ["name", "名前", 3],
      ["qty", "数", 1],
      ["note", "備考", 3],
    ],
  },
  {
    key: "spells",
    title: "呪文・魔術",
    cols: [
      ["name", "名前", 3],
      ["cost", "コスト", 2],
      ["note", "効果・備考", 3],
    ],
  },
  {
    key: "books",
    title: "魔導書",
    cols: [
      ["name", "名前", 3],
      ["san", "SAN減少", 2],
      ["note", "備考", 3],
    ],
  },
];
(function buildLists() {
  const host = document.getElementById("listFields");
  if (!host) return;
  LIST_DEFS.forEach((def) => {
    const d = document.createElement("details");
    d.className = "profile-block";
    d.dataset.list = def.key;
    const sm = document.createElement("summary");
    sm.textContent = def.title;
    d.append(sm);
    const cols = "24px " + def.cols.map((c) => c[2] + "fr").join(" ");
    const head = document.createElement("div");
    head.className = "list-head";
    head.style.setProperty("--cols", cols);
    head.append(document.createElement("span"));
    def.cols.forEach((c) => {
      const h = document.createElement("span");
      h.textContent = c[1];
      head.append(h);
    });
    const body = document.createElement("div");
    body.className = "list-body";
    const add = document.createElement("button");
    add.type = "button";
    add.className = "small-btn list-add";
    add.textContent = "＋ " + def.title + "を追加";
    add.onclick = () => {
      addListRow(def, body, {});
      const last = body.lastElementChild;
      if (last) {
        const f = last.querySelector("input");
        if (f) f.focus();
      }
    };
    d.append(body, add);
    host.append(d);
  });
})();
function addListRow(def, body, vals) {
  const r = document.createElement("div");
  r.className = "list-row";
  const short = def.cols.slice(0, -1),
    last = def.cols[def.cols.length - 1];
  r.style.setProperty("--cols", "26px " + short.map((c) => c[2] + "fr").join(" "));
  short.forEach((c) => {
    const i = document.createElement("input");
    i.type = "text";
    i.dataset.col = c[0];
    i.placeholder = c[1];
    i.value = vals && vals[c[0]] != null ? String(vals[c[0]]) : "";
    i.setAttribute("aria-label", def.title + " " + c[1]);
    r.append(i);
  });
  const x = document.createElement("button");
  x.type = "button";
  x.className = "danger";
  x.textContent = "削除";
  x.onclick = () => {
    r.remove();
    scheduleAutoUpdate();
  };
  r.append(x);
  const t = document.createElement("textarea");
  t.className = "list-note";
  t.dataset.col = last[0];
  t.rows = 2;
  t.placeholder = last[1] + "（複数行OK）";
  t.value = vals && vals[last[0]] != null ? String(vals[last[0]]) : "";
  t.setAttribute("aria-label", def.title + " " + last[1]);
  const fit = () => {
    t.style.height = "auto";
    t.style.height = Math.max(54, t.scrollHeight + 2) + "px";
  };
  t.addEventListener("input", fit);
  r.append(t);
  body.append(r);
  requestAnimationFrame(fit);
  return r;
}
function readLists() {
  const o = {};
  LIST_DEFS.forEach((def) => {
    const body = document.querySelector('#listFields details[data-list="' + def.key + '"] .list-body');
    if (!body) return;
    const rows = [...body.querySelectorAll(".list-row")]
      .map((r) => {
        const v = {};
        def.cols.forEach((c) => {
          v[c[0]] = r.querySelector('[data-col="' + c[0] + '"]').value;
        });
        return v;
      })
      .filter((v) => Object.values(v).some((x) => String(x).trim()));
    if (rows.length) o[def.key] = rows;
  });
  return o;
}
function writeLists(o) {
  o = o || {};
  LIST_DEFS.forEach((def) => {
    const d = document.querySelector('#listFields details[data-list="' + def.key + '"]');
    if (!d) return;
    const body = d.querySelector(".list-body");
    body.innerHTML = "";
    const rows = Array.isArray(o[def.key]) ? o[def.key] : [];
    rows.forEach((v) => addListRow(def, body, v));
    d.open = rows.length > 0;
  });
}
function secretMemoBlock() {
  return secretBlob && secretBlob.c ? "【ロックメモ】\nSM1:" + secretBlob.s + "." + secretBlob.i + "." + secretBlob.c : "";
}
function listMemoBlocks() {
  const lists = readLists(),
    blocks = [];
  LIST_DEFS.forEach((def) => {
    const rows = lists[def.key];
    if (!rows) return;
    const lines = rows.map((v) => {
      const parts = def.cols.map((c) =>
        String(v[c[0]] || "")
          .trim()
          .replace(/[｜]/g, " ")
          .replace(/\r?\n/g, " / "),
      );
      while (parts.length && !parts[parts.length - 1]) parts.pop();
      return "・" + parts.join("｜");
    });
    blocks.push("【" + def.title + "】\n" + lines.join("\n"));
  });
  return blocks;
}
const MEMO_RULE = "━━━━━━━━━━━━━━";
// 入力内容から、ココフォリアのメモ欄に入れる文章を作る。項目が1つも無ければ従来どおり「PL：名前」と自由メモだけ。
// ココフォリアの名前は「名前(ふりがな)」の形にする（いあきゃらと同じ）。読み込み時は逆に分けて戻す。
function composeName() {
  const n = document.getElementById("charName").value.trim(),
    k = (document.getElementById("prof-kana")?.value || "").trim();
  return n && k ? n + "(" + k + ")" : n;
}
// 末尾の（…）を「ふりがな」として分ける。かな・半角かな・英字（ローマ字）なども受け付け、漢字を含むときだけ名前の一部として残す（例：田中(旧姓)）。
// 書き出し時は名前(ふりがな)に組み直すので、どちらに分けても書き出し結果は変わらない。
const NAME_KANA_RE = /^(.+?)\s*[（(]\s*([^()（）\u3400-\u4DBF\u4E00-\u9FFF々〆]+?)\s*[)）]$/;
function splitNameKana(raw) {
  const t = String(raw == null ? "" : raw).trim();
  const m = t.match(NAME_KANA_RE);
  return m ? { name: m[1].trim(), kana: m[2].trim() } : { name: t, kana: "" };
}
function buildMemoText() {
  const player = document.getElementById("playerName").value.trim();
  const free = document.getElementById("memo").value.trim();
  const prof = readProfile();
  const blocks = [];
  PROFILE_SECTIONS.forEach((sec) => {
    const ls = [];
    sec.fields.forEach((f) => {
      if (MEMO_SKIP.has(f.key)) return;
      const v = String(prof[f.key] || "").trim();
      if (v) ls.push(f.label + "：" + v);
    });
    if (ls.length) blocks.push("【" + sec.title + "】\n" + ls.join("\n"));
  });
  const out = [];
  if (player) out.push("PL：" + player);
  const lb = listMemoBlocks(),
    sb = secretMemoBlock();
  if (!blocks.length && !lb.length && !sb) {
    if (free) out.push(free);
    return out.join("\n");
  }

  blocks.push(...listMemoBlocks());
  if (sb) blocks.push(sb);
  if (free) blocks.push("【メモ】\n" + free);
  out.push(MEMO_RULE);
  out.push(blocks.join("\n\n"));
  return out.join("\n");
}
// buildMemoText の逆変換。【見出し】とラベル付きの行から各欄を復元する。見出しが無い文章は、PL行を除いて自由メモとして扱う。
function parseMemoText(text) {
  const res = { player: "", profile: {}, memo: "", lists: {}, secret: null };
  const lines = String(text || "").split(/\r?\n/);
  const hasHeaders = lines.some((l) => /^【.+】\s*$/.test(l));
  const labelToKey = new Map([...Object.entries(PROFILE_LABEL_ALIASES), ...PROFILE_FIELDS.map((f) => [f.label, f.key])]);
  if (!hasHeaders) {
    const rest = [];
    lines.forEach((l) => {
      const m = l.match(/^PL：(.*)$/);
      if (m && !res.player) res.player = m[1].trim();
      else rest.push(l);
    });
    res.memo = rest.join("\n").trim();
    return res;
  }
  let section = null,
    curKey = null,
    freeLines = [];
  lines.forEach((l) => {
    const pl = l.match(/^PL：(.*)$/);
    if (pl && section === null) {
      res.player = pl[1].trim();
      return;
    }
    if (/^[━─=\-]{5,}\s*$/.test(l)) {
      return;
    }
    const hd = l.match(/^【(.+)】\s*$/);
    if (hd) {
      section = hd[1];
      curKey = null;
      return;
    }
    if (section === "メモ") {
      freeLines.push(l);
      return;
    }
    if (section === "ロックメモ") {
      const sm = l.match(/^SM1:([^.\s]+)\.([^.\s]+)\.([^.\s]+)/);
      if (sm) res.secret = { v: 1, s: sm[1], i: sm[2], c: sm[3] };
      return;
    }
    const ld = LIST_DEFS.find((x) => x.title === section);
    if (ld) {
      const lm2 = l.match(/^・(.*)$/);
      if (lm2) {
        const parts = lm2[1].split("｜"),
          v = {};
        ld.cols.forEach((c, i) => {
          v[c[0]] = parts[i] || "";
        });
        (res.lists[ld.key] = res.lists[ld.key] || []).push(v);
        return;
      }
      if (!l.trim()) return;
    }
    const lm = l.match(/^([^：\n]{1,12})：(.*)$/);
    if (lm && labelToKey.has(lm[1])) {
      curKey = labelToKey.get(lm[1]);
      res.profile[curKey] = lm[2];
      return;
    }
    if (curKey) {
      res.profile[curKey] += "\n" + l;
      return;
    }
    freeLines.push(l);
  });
  Object.keys(res.profile).forEach((k) => {
    res.profile[k] = String(res.profile[k]).replace(/\s+$/, "");
  });
  res.memo = freeLines.join("\n").trim();
  return res;
}
// 入力そのまま（初期値の欄）。保存用
function readBaseRaw() {
  const obj = {};
  base.querySelectorAll("input[data-stat]").forEach((i) => (obj[i.dataset.stat] = i.value.trim()));
  return obj;
}
// 計算・出力に使う値（初期値＋増加分＋その他）
function readBase() {
  const obj = readBaseRaw();
  names.forEach((n) => {
    const a = statDeltaInput(n, "add"),
      o = statDeltaInput(n, "other");
    obj[n] = statTotal(obj[n], a && a.value, o && o.value);
  });
  return obj;
}
// 保存用：入力のあった能力値だけ { STR: "2" } の形で返す
function statDeltaData() {
  const out = {};
  [
    ["baseAdd", "add"],
    ["baseOther", "other"],
  ].forEach(([field, key]) => {
    const o = {};
    names.forEach((n) => {
      const i = statDeltaInput(n, key);
      if (i && i.value.trim()) o[n] = i.value.trim();
    });
    if (Object.keys(o).length) out[field] = o;
  });
  return out;
}
// 検索・誤字予想用：全角半角・大文字小文字・カタカナ/ひらがなの違いを無視する。
function fmtDate(v) {
  const d = new Date(v);
  if (isNaN(d)) return "不明";
  const pad = (n) => String(n).padStart(2, "0"),
    now = new Date();
  return (
    (d.getFullYear() !== now.getFullYear() ? d.getFullYear() + "/" : "") +
    (d.getMonth() + 1) +
    "/" +
    d.getDate() +
    " " +
    pad(d.getHours()) +
    ":" +
    pad(d.getMinutes())
  );
}
function kanaFold(s) {
  return String(s == null ? "" : s)
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[\u30a1-\u30f6]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}
function formulaNameDistance(a, b) {
  a = kanaFold(a);
  b = kanaFold(b);
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    for (let j = 0; j <= b.length; j++) prev[j] = cur[j];
  }
  return prev[b.length];
}
// 名前の参照を値に置き換える正規表現（ダイスの個数・面の位置にある名前も含める）
function nameRefRegex(name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name)
    ? new RegExp("(^|[^A-Za-z0-9_]|(?<=\\d)d)" + escaped + "(?=$|[^A-Za-z0-9_]|d\\d)", "gi")
    : new RegExp(escaped, "g");
}
function resolveExpr(raw, baseValues) {
  let s = normalizeFormula(String(raw).trim());
  const entries = Object.entries(baseValues)
    .filter(([n]) => n)
    .sort((a, b) => b[0].length - a[0].length);
  for (const [n, v] of entries) {
    if (hasUncertain(v)) throw Error("ステータス " + n + " が未確定です");
    const escaped = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const ascii = /^[A-Za-z_][A-Za-z0-9_]*$/.test(n);
    // 「1dMP」「MPd6」のように、ダイスの個数・面の部分に名前を書いても置き換える
    const re = ascii ? new RegExp("(^|[^A-Za-z0-9_]|(?<=\\d)d)" + escaped + "(?=$|[^A-Za-z0-9_]|d\\d)", "gi") : new RegExp(escaped, "g");
    s = s.replace(re, ascii ? (_, prefix) => (prefix || "") + "(" + v + ")" : () => "(" + v + ")");
  }
  s = s.replace(/\((\d+)\)(?=d\d)/gi, "$1").replace(/(\d)d\((\d+)\)/gi, "$1d$2");
  const withoutDice = s.replace(/\d*d\d+/gi, "");
  const unknown = [...withoutDice.matchAll(/[A-Za-z_][A-Za-z0-9_]*|[\u3040-\u30ff\u3400-\u9fff々ー]+/g)].map((m) => m[0]);
  if (unknown.length) {
    const known = [...new Set(entries.map(([n]) => n))];
    const token = unknown[0];
    const ranked = known.map((n) => ({ name: n, distance: formulaNameDistance(token, n) })).sort((a, b) => a.distance - b.distance);
    const best = ranked[0];
    const threshold = Math.max(1, Math.floor(Array.from(token).length * 0.25));
    if (best && best.distance <= threshold) throw Error("未定義の名前「" + token + "」があります。もしかして「" + best.name + "」ですか？");
    throw Error("未定義の名前「" + token + "」があります。技能名・ステータス名を確認してください");
  }
  return rollFormula(s);
}
