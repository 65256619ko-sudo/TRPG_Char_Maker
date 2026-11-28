function viewerBarMode(fromEditor) {
  const bar = document.getElementById("viewerBar");
  bar.classList.toggle("from-editor", fromEditor);
  document.getElementById("viewerBack").classList.toggle("primary", fromEditor);
  document.getElementById("viewerBack").textContent = fromEditor ? "← 編集に戻る" : viewGroupId ? "← グループ" : "← ホーム";
}
function showViewer(id) {
  const c = managerData.characters.find((x) => x.id === id);
  if (!c) return;
  viewerSrc = "list";
  viewerForm = null;
  viewerId = id;
  renderViewer(c);
  document.getElementById("homeView").classList.add("hidden");
  document.getElementById("groupView").classList.add("hidden");
  document.getElementById("editorView").classList.add("hidden");
  viewerBarMode(false);
  setScreen("viewer");
  window.scrollTo(0, 0);
}
// 編集画面の「その他」から：保存前の入力内容をそのまま閲覧する（編集画面の状態は残したまま戻れる）
function showViewerFromEditor() {
  const form = captureForm();
  viewerSrc = "editor";
  viewerForm = form;
  viewerEditorScroll = window.scrollY || 0;
  renderViewer({ name: (form.charName || "").trim() || "名称未設定", form });
  document.getElementById("editorView").classList.add("hidden");
  viewerBarMode(true);
  setScreen("viewer");
  window.scrollTo(0, 0);
}
function returnToEditorFromViewer() {
  document.getElementById("editorView").classList.remove("hidden");
  setScreen("editor", document.getElementById("editingLabel").textContent || "キャラクター編集", "");
  window.scrollTo(0, viewerEditorScroll || 0);
  scheduleDirtyCheck();
}
document.getElementById("openViewerFromEditor").onclick = showViewerFromEditor;
document.getElementById("viewerBack").onclick = () => {
  if (viewerSrc === "editor") returnToEditorFromViewer();
  else showHome();
};
document.getElementById("viewerEdit").onclick = () => {
  if (viewerSrc === "list" && viewerId) openCharacter(viewerId);
};
document.getElementById("viewerJson").onclick = () => {
  if (viewerSrc === "editor") {
    if (viewerForm) copyCharacterJSON({ form: viewerForm });
    return;
  }
  const c = managerData.characters.find((x) => x.id === viewerId);
  if (c) copyCharacterJSON(c);
};

// ===== v85：他ツールから来たキャラの標準ダメージ／いあきゃらテキストの読み込み =====
// 「基本技能」の定番技能（こぶし・キック・頭突き）に標準のダメージ式を付ける。技能名の末尾の（…）は無視して照合する（例：こぶし（パンチ））。
function presetDamageFor(name) {
  const raw = String(name || "").trim();
  if (!raw) return null;
  const cand = [raw, raw.replace(/\s*[（(].*[）)]\s*$/, "")];
  for (const c of cand) {
    const k = kanaFold(c);
    if (!k) continue;
    for (const cat of presetCatalog) for (const it of cat.items) if (it.damage && kanaFold(it.name) === k) return it.damage;
  }
  return null;
}
function applyDefaultDamage() {
  const rows = [...skills.querySelectorAll(".row")];
  let n = 0;
  rows.forEach((r) => {
    const dv = r.querySelector(".damage-value");
    if (!dv || dv.value.trim()) return;
    const nm = r.querySelector(".skill-name").value.trim(),
      d = presetDamageFor(nm);
    if (!d) return;
    // 同名で別の行にすでにダメージ式があるときは重ねない
    if (rows.some((o) => o !== r && o.querySelector(".skill-name").value.trim() === nm && o.querySelector(".damage-value").value.trim()))
      return;
    dv.value = d;
    dv.dispatchEvent(new Event("input", { bubbles: true }));
    r.classList.add("dmg-open");
    n++;
  });
  return n;
}
const IA_PROFILE_LABELS = {
  職業: "job",
  学校: "school",
  "学校・学位": "school",
  年齢: "age",
  性別: "gender",
  出身: "origin",
  精神的障害: "mental",
  身長: "height",
  体重: "weight",
  髪の色: "hair",
  髪色: "hair",
  瞳の色: "eye",
  瞳色: "eye",
  肌の色: "skin",
  肌色: "skin",
  住所: "address",
  家族: "family",
  傷痕など: "scars",
  傷跡: "scars",
  タグ: "tags",
  収入: "income",
  手持ち現金: "cash",
  手持ちの現金: "cash",
  預金: "savings",
  "預金・債券": "savings",
  個人資産: "assets",
  不動産: "realestate",
};
function iaLooksLike(t) {
  t = String(t || "");
  return /いあきゃらテキスト|【基本情報】/.test(t) && /【能力値】|【技能値】/.test(t);
}
// 全角は2、半角は1として表示幅を数える（表形式の列位置の判定に使う）
function iaWidth(s) {
  let w = 0;
  for (const ch of String(s)) {
    const c = ch.codePointAt(0);
    w +=
      c >= 0x1100 &&
      (c <= 0x115f ||
        (c >= 0x2e80 && c <= 0xa4cf) ||
        (c >= 0xac00 && c <= 0xd7a3) ||
        (c >= 0xf900 && c <= 0xfaff) ||
        (c >= 0xfe30 && c <= 0xfe6f) ||
        (c >= 0xff00 && c <= 0xff60) ||
        (c >= 0xffe0 && c <= 0xffe6))
        ? 2
        : 1;
  }
  return w;
}
function iaTrimBlock(lines) {
  const a = lines.map((x) => x.replace(/\s+$/, ""));
  while (a.length && !a[0].trim()) a.shift();
  while (a.length && !a[a.length - 1].trim()) a.pop();
  return a.join("\n");
}
function iaGearRow(line) {
  const m = line.match(/^(\S.*?)(?=\s{2,}|\s*$)/);
  if (!m) return null;
  const name = m[1].trim();
  if (!name) return null;
  const restStart = m[0].length;
  let qty = "",
    unit = "",
    price = "",
    noteFrom = -1;
  const re = /\S+/g;
  re.lastIndex = restStart;
  let t;
  while ((t = re.exec(line))) {
    const st = iaWidth(line.slice(0, t.index)),
      en = st + iaWidth(t[0]);
    if (st >= 63) {
      noteFrom = t.index;
      break;
    } // 「効果、備考など」の列
    if (!qty && /^\d+$/.test(t[0]) && en > 40 && en <= 60) qty = t[0];
    else if (en <= 40) unit = t[0];
    else price = t[0];
  }
  let note = noteFrom >= 0 ? line.slice(noteFrom).trim() : "";
  const money = [
    ["単価", unit],
    ["価格", price],
  ]
    .filter(([, v]) => v && !/^(なし|-|ー|0)$/.test(v))
    .map(([k, v]) => k + " " + v)
    .join("／");
  if (money) note = note ? "（" + money + "）" + note : "（" + money + "）";
  return { name, qty, note };
}
function iaWeaponRow(line, cols) {
  const m = line.match(/^(\S.*?)(?=\s{2,}|\s*$)/);
  if (!m) return null;
  const name = m[1].trim();
  if (!name) return null;
  const cell = {},
    n = cols ? cols.length : 0;
  if (cols && n >= 4) {
    const last = cols[n - 1],
      re = /\S+/g;
    re.lastIndex = m[0].length;
    let t;
    while ((t = re.exec(line))) {
      const st = iaWidth(line.slice(0, t.index)),
        en = st + iaWidth(t[0]);
      if (st >= last.st - 6) {
        cell[n - 1] = line.slice(t.index).trim();
        break;
      } // 最後の「故障その他」は左揃えの自由記入
      let best = 1,
        bd = 1e9;
      for (let i = 1; i < n - 1; i++) {
        const d = Math.abs(en - cols[i].en);
        if (d < bd) {
          bd = d;
          best = i;
        }
      }
      cell[best] = (cell[best] ? cell[best] + " " : "") + t[0];
    }
  } else {
    line
      .trim()
      .split(/\s{2,}/)
      .forEach((v, i) => {
        if (i > 0) cell[i] = v;
      });
  }
  const c = (i) => String(cell[i] || "").trim();
  return {
    name,
    rate: /^\d+$/.test(c(1)) ? c(1) : "",
    damage: c(2).replace(/\bdb\b/gi, "DB"),
    range: c(3),
    attacks: c(4),
    ammo: c(5),
    durability: c(6),
    misc: c(7),
  };
}
// いあきゃらのテキスト出力を読み取る（純粋な解析。画面には触れない）
function parseIacharaText(text) {
  const lines = String(text).replace(/\r\n?/g, "\n").split("\n");
  const sec = {};
  let cur = "";
  lines.forEach((l) => {
    const m = l.match(/^【(.+?)】\s*$/);
    if (m) {
      cur = m[1];
      sec[cur] = [];
      return;
    }
    if (cur) sec[cur].push(l);
  });
  const out = {
    name: "",
    profile: {},
    stats: {},
    db: null,
    sanMax: null,
    occTotal: null,
    intTotal: null,
    hasPoints: false,
    skills: [],
    dodge: null,
    weapons: [],
    gear: [],
    spells: [],
    memo: "",
    icons: [],
  };
  // 基本情報
  (sec["基本情報"] || []).forEach((l) => {
    const nm = l.match(/^名前\s*[:：]\s*(.*)$/);
    if (nm) {
      out.name = nm[1].trim();
      return;
    }
    l.split(/\s+\/\s+/).forEach((part) => {
      const m = part.match(/^([^:：]+?)\s*[:：]\s*(.*)$/);
      if (!m) return;
      const key = IA_PROFILE_LABELS[m[1].trim()];
      if (key && m[2].trim()) out.profile[key] = m[2].trim();
    });
  });
  (sec["アイコン"] || []).forEach((l) => {
    const m = l.match(/^\s*:?\s*(https?:\/\/\S+)/);
    if (m) out.icons.push(m[1]);
  });
  // 能力値
  (sec["能力値"] || []).forEach((l) => {
    const m = l.match(/^(\S+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s*$/);
    if (m) {
      out.stats[m[1].toUpperCase()] = { cur: Number(m[2]), base: Number(m[3]), inc: Number(m[4]), tmp: Number(m[5]) };
      return;
    }
    const sn = l.match(/^正気度\s+(-?\d+)\s*\/\s*(-?\d+)/);
    if (sn) {
      out.sanMax = Number(sn[2]);
      return;
    }
    const db = l.match(/^DB\s+(\S+)/i);
    if (db) out.db = db[1];
  });
  // 技能値
  (sec["技能値"] || []).forEach((l) => {
    const po = l.match(/^(職業|興味)ポイント\s*[:：]\s*(\d+)\s*\/\s*(\d+)/);
    if (po) {
      if (po[1] === "職業") out.occTotal = Number(po[3]);
      else out.intTotal = Number(po[3]);
      return;
    }
    const m = l.match(/^(\S.*?)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s*$/);
    if (!m) return;
    const total = Number(m[2]),
      base = Number(m[3]),
      occ = Number(m[4]),
      int = Number(m[5]),
      growth = Number(m[6]),
      other = Number(m[7]);
    let oth = growth + other;
    const diff = total - (base + occ + int + oth);
    if (diff) oth += diff; // 合計と合わない分は「その他」に寄せる
    out.skills.push({ name: m[1].trim(), total, base, occ, int, other: oth });
  });
  const dg = out.skills.findIndex((x) => x.name === "回避");
  if (dg >= 0) {
    out.dodge = out.skills[dg].total;
    out.dodgeRow = out.skills[dg];
    out.skills.splice(dg, 1);
  }
  out.hasPoints =
    out.skills.some((x) => x.occ || x.int) ||
    !!(out.dodgeRow && (out.dodgeRow.occ || out.dodgeRow.int)) ||
    out.occTotal > 0 ||
    out.intTotal > 0;
  // 武器：見出し行の列位置（右揃え）から、名前・成功率・ダメージ・射程・攻撃回数・装弾数・耐久力・故障その他を読み分ける
  {
    const ws = sec["武器"] || [],
      wh = ws.find((l) => /^名前\s+成功率/.test(l));
    let cols = null;
    if (wh) {
      cols = [];
      const re = /\S+/g;
      let t;
      while ((t = re.exec(wh))) {
        const st = iaWidth(wh.slice(0, t.index));
        cols.push({ st, en: st + iaWidth(t[0]) });
      }
    }
    ws.forEach((l) => {
      if (!l.trim() || l === wh) return;
      const r = iaWeaponRow(l, cols);
      if (r) out.weapons.push(r);
    });
  }
  // 装備
  (sec["冒険の装備とその他の所持品"] || []).forEach((l) => {
    if (!l.trim() || /^名称\s+単価/.test(l)) return;
    const r = iaGearRow(l);
    if (r) out.gear.push(r);
  });
  // 収入と財産
  (sec["収入と財産"] || []).forEach((l) => {
    const m = l.match(/^([^:：]+?)\s*[:：]\s*(.*)$/);
    if (!m) return;
    const key = IA_PROFILE_LABELS[m[1].trim()];
    if (key && m[2].trim()) out.profile[key] = m[2].trim();
  });
  // 新たに得た知識・経験
  const kn = sec["新たに得た知識・経験"] || [];
  const subs = {};
  let sc = "";
  kn.forEach((l) => {
    const m = l.match(/^〈(.+?)〉\s*$/);
    if (m) {
      sc = m[1];
      subs[sc] = [];
      return;
    }
    if (sc) subs[sc].push(l);
  });
  Object.keys(subs).forEach((k) => {
    const body = subs[k];
    if (/魔導書|呪文|アーティファクト/.test(k)) {
      let curE = null;
      body.forEach((l) => {
        const m = l.match(/^\[(.+)\]\s*$/);
        if (m) {
          curE = { name: m[1].trim(), lines: [] };
          out.spells.push(curE);
          return;
        }
        if (curE) curE.lines.push(l);
      });
      out.spells = out.spells.map((e) => {
        if (!e.lines) return e;
        let cost = "";
        const rest = [];
        e.lines.forEach((l) => {
          const m = !cost && l.match(/^コスト\s*[:：]\s*(.+)$/);
          if (m) cost = m[1].trim();
          else rest.push(l);
        });
        return { name: e.name, cost, note: iaTrimBlock(rest) };
      });
    } else if (/超自然/.test(k)) {
      const t = iaTrimBlock(body);
      if (t) out.profile.mythos = t;
    } else if (/シナリオ/.test(k)) {
      const t = iaTrimBlock(body);
      if (t) out.profile.scenarios = t;
    }
  });
  out.memo = iaTrimBlock(sec["メモ"] || []);
  return out;
}
function importIacharaText(text) {
  const p = parseIacharaText(text);
  if (!Object.keys(p.stats).length && !p.skills.length) throw Error("いあきゃらテキストから能力値・技能を読み取れませんでした");
  skills.innerHTML = "";
  extras.innerHTML = "";
  // 能力値（現在値）
  // 何も振っていない（能力値が全部0）白紙のテキストなら、能力値・派生値・DB・ポイント上限は触らず、既定のダイス式のままにする
  const anyStat = names.some((n) => p.stats[n] && (p.stats[n].cur || p.stats[n].base));
  clearStatDeltas();
  names.forEach((n) => {
    const s = p.stats[n],
      el = document.getElementById("base-" + n);
    if (!el) return;
    el.value = statFormulas[n];
    if (anyStat && s && (s.cur || s.base)) el.value = String(s.cur);
  });
  document.getElementById("dbOverride").value = "";
  const nums = {};
  names.forEach((n) => {
    const v = document.getElementById("base-" + n).value.trim();
    if (/^\d+$/.test(v)) nums[n] = Number(v);
  });
  // HP・MP・SAN・アイデア・幸運・知識・回避：自動計算の値と違うものだけ、現在値を書き込む
  const dmap = { HP: "HP", MP: "MP", 正気度: "SAN", SAN: "SAN", IDE: "アイデア", アイデア: "アイデア", 幸運: "幸運", 知識: "知識" };
  const dv = {};
  Object.keys(dmap).forEach((k) => {
    if (p.stats[k]) dv[dmap[k]] = p.stats[k].cur;
  });
  if (p.dodge != null) dv["回避"] = p.dodge;
  derivedStatuses.querySelectorAll(".derived-row").forEach((r) => {
    const n = r.dataset.derivedName,
      def = derivedDefinitions.find((d) => d.name === n),
      inp = r.querySelector(".derived-formula");
    if (def) inp.value = def.formula;
    if (anyStat && dv[n] != null) {
      let auto = null;
      try {
        auto = Number(resolveExpr(inp.value, nums));
      } catch (e) {}
      if (auto !== dv[n]) {
        // 回避は「DEX*2＋振ったポイント」の式にしておく（DEXが変わっても追従する）
        const dr = p.dodgeRow;
        if (n === "回避" && dr && nums.DEX != null && dr.base === nums.DEX * 2) {
          const add = dr.occ + dr.int + dr.other;
          inp.value = "DEX*2" + (add ? "+" + add : "");
        } else inp.value = String(dv[n]);
      }
    }
  });
  // ダメージボーナス：自動計算と同じなら手入力欄は空のまま
  if (anyStat && p.db) {
    const dbn = String(p.db)
      .replace(/\s+/g, "")
      .toUpperCase()
      .replace(/^[+-]0$/, "0");
    const auto = nums.STR != null && nums.SIZ != null ? calculateDB(nums.STR, nums.SIZ) : null;
    document.getElementById("dbOverride").value = auto !== null && String(auto).toUpperCase() === dbn ? "" : dbn;
  }
  // 技能（初期値・職業P・興味P・その他に分けて入れる。成長分はその他へ）
  p.skills.forEach((k) => {
    addSkill(k.name, String(k.total), {
      base: String(k.base),
      occ: k.occ ? String(k.occ) : "",
      int: k.int ? String(k.int) : "",
      other: k.other ? String(k.other) : "",
    });
  });
  // 武器：同名の技能があればダメージ式だけ入れ、なければ新しい行にする
  const weaponGear = [];
  p.weapons.forEach((w) => {
    const wx = [
      ["射程", w.range],
      ["攻撃回数", w.attacks],
      ["装弾数", w.ammo],
      ["耐久力", w.durability],
      ["故障その他", w.misc],
    ].filter(([, v]) => v);
    if (wx.length) weaponGear.push({ name: w.name, qty: "", note: "［武器］" + wx.map(([k, v]) => k + " " + v).join("／") });
    const hit = [...skills.querySelectorAll(".row")].find(
      (r) => r.querySelector(".skill-name").value.trim() === w.name && !r.querySelector(".damage-value").value.trim(),
    );
    if (hit && w.damage) {
      hit.querySelector(".damage-value").value = w.damage;
    } else addSkill(w.name, w.rate, undefined, false, w.damage);
  });
  if (!skills.children.length) addSkill();
  // 職業・興味ポイントの上限（既定の式と違うときだけ数値で入れる）
  const occAuto = nums.EDU != null ? nums.EDU * 20 : null,
    intAuto = nums.INT != null ? nums.INT * 10 : null;
  document.getElementById("spOccFormula").value = anyStat && p.occTotal != null && p.occTotal !== occAuto ? String(p.occTotal) : "EDU*20";
  document.getElementById("spIntFormula").value = anyStat && p.intTotal != null && p.intTotal !== intAuto ? String(p.intTotal) : "INT*10";
  setSkillPointMode(!!p.hasPoints);
  // 名前・基本情報・装備・呪文・メモ（PL名とロックメモは触らない）
  const nameRaw = p.name.replace(/\s*[（(]\s*[)）]\s*$/, "");
  const nk = splitNameKana(nameRaw);
  if (nk.name) document.getElementById("charName").value = nk.name;
  const prof = Object.assign({}, p.profile);
  if (nk.kana) prof.kana = nk.kana;
  writeProfile(prof);
  writeLists({
    gear: p.gear.map((g) => ({ name: g.name, qty: g.qty, note: g.note })).concat(weaponGear),
    spells: p.spells.map((e) => ({ name: e.name, cost: e.cost, note: e.note })),
    books: [],
  });
  document.getElementById("memo").value = p.memo;
  // 【アイコン】のURL（複数あるときは1つ目）を、画像のURLとして設定
  const iconUrls = (p.icons || []).filter((u) => /^https?:\/\/\S+$/i.test(u));
  const iconUrl = iconUrls[0];
  if (iconUrl) setPortrait(IMG_URL_PREFIX + iconUrl, [...currentImageList, ...iconUrls.map((u) => IMG_URL_PREFIX + u)]);
  const dmgN = applyDefaultDamage();
  paletteOutput.value = "";
  paletteMode = "generated";
  paletteOrderApplied = false;
  paletteOrderOverride = null;
  refreshDBDisplay();
  updateDerivedPreviews();
  refreshPaletteStatusOptions();
  filterSkillRows();
  updatePointSummary();
  regenPaletteIfEmpty();
  document.getElementById("jsonImport").value = "";
  document.getElementById("jsonFile").value = "";
  document.getElementById("jsonImportPanel").classList.add("hidden");
  toast(
    "いあきゃらテキストを反映しました（技能" +
      (p.skills.length + p.weapons.length) +
      "件・装備" +
      (p.gear.length + weaponGear.length) +
      "件・呪文" +
      p.spells.length +
      "件" +
      (iconUrl ? "・画像URL" + (iconUrls.length > 1 ? iconUrls.length + "件" : "") : "") +
      "）",
  );
  scheduleDirtyCheck();
}

loadManagerData();
refreshBatchSelect();
setScreen("home", "ホーム", "グループや保存済みキャラクターを管理します。");
setTimeout(handleShareHash, 400);
window.addEventListener("hashchange", () => setTimeout(handleShareHash, 50));
