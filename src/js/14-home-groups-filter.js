function askDialog({ title, desc = "", value = null, okText = "OK", danger = false, cancelText = "キャンセル" }) {
  return new Promise((resolve) => {
    const dlg = document.getElementById("inputDialog"),
      field = document.getElementById("inputDialogField"),
      ok = document.getElementById("inputDialogOk"),
      cancel = document.getElementById("inputDialogCancel");
    document.getElementById("inputDialogTitle").textContent = title;
    const d = document.getElementById("inputDialogDesc");
    d.textContent = desc;
    d.classList.toggle("hidden", !desc);
    field.classList.toggle("hidden", value === null);
    field.value = value === null ? "" : value;
    ok.textContent = okText;
    cancel.textContent = cancelText;
    ok.classList.toggle("danger", !!danger);
    ok.classList.toggle("primary", !danger);
    const done = (r) => {
      dlg.classList.add("hidden");
      ok.onclick = cancel.onclick = dlg.onclick = null;
      document.removeEventListener("keydown", onKey, true);
      resolve(r);
    };
    const accept = () => done(value === null ? true : field.value);
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        done(null);
      } else if (e.key === "Enter" && e.target !== cancel) {
        e.preventDefault();
        accept();
      }
    };
    ok.onclick = accept;
    cancel.onclick = () => done(null);
    dlg.onclick = (e) => {
      if (e.target === dlg) done(null);
    };
    document.addEventListener("keydown", onKey, true);
    dlg.classList.remove("hidden");
    (value === null ? cancel : field).focus();
    if (value !== null) field.select();
  });
}
let viewGroupId = null;

// ===== ホームの整理：グループ絞り込み・並び順・まとめて選択 =====
let homeFilter = "all"; // all | none | グループID
let homeSort = "updated";
try {
  homeSort = localStorage.getItem("trpgCharmakerHomeSort_v1") || "updated";
} catch (e) {}
let bulkMode = false;
const bulkSel = new Set();
function sortCharacters(list) {
  const t = (v) => (v ? new Date(v).getTime() || 0 : 0);
  const arr = list.slice();
  if (homeSort === "name") arr.sort((a, b) => kanaFold(a.name || "").localeCompare(kanaFold(b.name || ""), "ja"));
  else if (homeSort === "created") arr.sort((a, b) => t(b.createdAt) - t(a.createdAt));
  else if (homeSort === "created-asc") arr.sort((a, b) => t(a.createdAt) - t(b.createdAt));
  else arr.sort((a, b) => t(b.updatedAt) - t(a.updatedAt));
  return arr;
}
function setCharacterGroups(c, ids) {
  c.groupIds = [...new Set(ids)];
  c.groupId = c.groupIds[0] || null;
}
function renderFilterChips() {
  const host = document.getElementById("charFilter");
  if (!host) return;
  host.innerHTML = "";
  const mk = (key, label, n) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip";
    b.setAttribute("aria-pressed", String(homeFilter === key));
    b.append(document.createTextNode(label));
    const sp = document.createElement("span");
    sp.className = "n";
    sp.textContent = n;
    b.append(sp);
    b.onclick = () => {
      homeFilter = key;
      renderHome();
    };
    host.append(b);
  };
  mk("all", "すべて", managerData.characters.filter((c) => !inBatchOnly(c)).length + managerData.groups.filter((g) => g.batch).length);
  mk("none", "未所属", managerData.characters.filter((c) => !characterGroupIds(c).length).length);
  if (managerData.groups.some((g) => g.batch)) mk("batch", "連続生成", managerData.groups.filter((g) => g.batch).length);
  managerData.groups
    .filter((g) => !g.batch)
    .forEach((g) => mk(g.id, groupPath(g), managerData.characters.filter((c) => characterGroupIds(c).includes(g.id)).length));
}
const isBatchGroup = (id) => {
  const g = managerData.groups.find((x) => x.id === id);
  return !!(g && g.batch);
};
const inBatchOnly = (c) => {
  const ids = characterGroupIds(c);
  return ids.length > 0 && ids.every(isBatchGroup);
};
function visibleHomeCharacters() {
  const q = kanaFold((document.getElementById("homeSearch")?.value || "").trim());
  let list = managerData.characters.slice();
  if (q)
    list = list.filter(
      (c) =>
        !inBatchOnly(c) && (kanaFold(c.name).includes(q) || kanaFold((c.form && c.form.profile && c.form.profile.kana) || "").includes(q)),
    );
  else if (homeFilter === "batch") list = [];
  else if (homeFilter === "none") list = list.filter((c) => !characterGroupIds(c).length);
  else if (homeFilter === "all") list = list.filter((c) => !inBatchOnly(c));
  else if (homeFilter !== "all") list = list.filter((c) => characterGroupIds(c).includes(homeFilter));
  return sortCharacters(list);
}
// 連続生成のまとめ：キャラクター欄に1枚のカードとして並べる
function batchGroupItems() {
  const q = kanaFold((document.getElementById("homeSearch")?.value || "").trim());
  if (!q && homeFilter !== "all" && homeFilter !== "batch") return [];
  const t = (v) => (v ? new Date(v).getTime() || 0 : 0);
  return managerData.groups
    .filter((g) => g.batch)
    .filter((g) => {
      if (!q) return true;
      const ms = managerData.characters.filter((c) => characterGroupIds(c).includes(g.id));
      return (
        kanaFold(g.name).includes(q) ||
        ms.some((c) => kanaFold(c.name).includes(q) || kanaFold((c.form && c.form.profile && c.form.profile.kana) || "").includes(q))
      );
    })
    .map((g) => {
      const ms = managerData.characters.filter((c) => characterGroupIds(c).includes(g.id));
      const latest = ms.reduce((m, c) => Math.max(m, t(c.updatedAt)), 0);
      return { __batch: g, name: g.name, createdAt: g.createdAt, updatedAt: latest ? new Date(latest).toISOString() : g.createdAt };
    });
}
function updateBulkBar() {
  const live = new Set(managerData.characters.map((c) => c.id));
  [...bulkSel].forEach((id) => {
    if (!live.has(id)) bulkSel.delete(id);
  });
  const n = document.getElementById("bulkCount");
  if (n) n.textContent = bulkSel.size + "体選択中";
  const bar = document.getElementById("bulkBar");
  if (bar) bar.classList.toggle("hidden", !bulkMode);
  const t = document.getElementById("bulkToggle");
  if (t) {
    t.textContent = "まとめて選択：" + (bulkMode ? "ON" : "OFF");
    t.setAttribute("aria-pressed", String(bulkMode));
  }
  const sel = document.getElementById("bulkGroupSelect");
  if (sel) {
    const old = sel.value;
    sel.innerHTML = "";
    const none = document.createElement("option");
    none.value = "__none__";
    none.textContent = "（未所属）";
    sel.append(none);
    managerData.groups
      .filter((g) => !g.batch)
      .forEach((g) => {
        const o = document.createElement("option");
        o.value = g.id;
        o.textContent = g.name;
        sel.append(o);
      });
    if ([...sel.options].some((o) => o.value === old)) sel.value = old;
    else if (managerData.groups.some((g) => !g.batch)) sel.value = managerData.groups.find((g) => !g.batch).id;
  }
}
function bulkStatus(t) {
  const el = document.getElementById("bulkStatus");
  if (el) el.textContent = t;
}
function bulkApply(kind) {
  const ids = [...bulkSel];
  if (!ids.length) {
    bulkStatus("先にキャラクターを選んでください。");
    return;
  }
  const target = document.getElementById("bulkGroupSelect").value;
  const chars = managerData.characters.filter((c) => bulkSel.has(c.id));
  let label = "";
  if (kind === "add") {
    if (target === "__none__") {
      bulkStatus("追加先のグループを選んでください。");
      return;
    }
    chars.forEach((c) => setCharacterGroups(c, [...characterGroupIds(c), target]));
    label = "追加しました";
  } else if (kind === "move") {
    chars.forEach((c) => setCharacterGroups(c, target === "__none__" ? [] : [target]));
    label = target === "__none__" ? "未所属にしました" : "移動しました";
  } else if (kind === "remove") {
    if (target === "__none__") {
      bulkStatus("外すグループを選んでください。");
      return;
    }
    chars.forEach((c) =>
      setCharacterGroups(
        c,
        characterGroupIds(c).filter((id) => id !== target),
      ),
    );
    label = "外しました";
  }
  if (!persistManagerData()) return;
  renderHome();
  if (viewGroupId) renderGroupView();
  refreshBatchSelect();
  refreshCharacterGroupSelect();
  bulkStatus(chars.length + "体を" + label + "。");
}
document.getElementById("bulkToggle").onclick = () => {
  bulkMode = !bulkMode;
  if (!bulkMode) bulkSel.clear();
  bulkStatus("");
  renderHome();
};
document.getElementById("bulkAll").onclick = () => {
  visibleHomeCharacters().forEach((c) => bulkSel.add(c.id));
  renderHome();
};
document.getElementById("bulkNone").onclick = () => {
  bulkSel.clear();
  renderHome();
};
document.getElementById("bulkAdd").onclick = () => bulkApply("add");
document.getElementById("bulkMove").onclick = () => bulkApply("move");
document.getElementById("bulkRemove").onclick = () => bulkApply("remove");
document.getElementById("bulkDelete").onclick = async () => {
  const ids = [...bulkSel];
  if (!ids.length) {
    bulkStatus("先にキャラクターを選んでください。");
    return;
  }
  if (
    !(await askDialog({
      title: "キャラクターの削除",
      desc: "選択した" + ids.length + "体を削除しますか？（元に戻せません）",
      okText: "削除",
      danger: true,
    }))
  )
    return;
  managerData.characters = managerData.characters.filter((c) => !bulkSel.has(c.id));
  bulkSel.clear();
  if (!persistManagerData()) return;
  renderHome();
  if (viewGroupId) renderGroupView();
  bulkStatus(ids.length + "体を削除しました。");
};
document.getElementById("charSort").value = homeSort;
document.getElementById("charSort").addEventListener("change", (e) => {
  homeSort = e.target.value;
  try {
    localStorage.setItem("trpgCharmakerHomeSort_v1", homeSort);
  } catch (_) {}
  renderHome();
  if (viewGroupId) renderGroupView();
});
function moveGroupOrder(id, dir) {
  const sibs = topGroups(),
    si = sibs.findIndex((g) => g.id === id),
    sj = si + dir;
  if (si < 0 || sj < 0 || sj >= sibs.length) return;
  const arr = managerData.groups,
    i = arr.indexOf(sibs[si]),
    j = arr.indexOf(sibs[sj]);
  [arr[i], arr[j]] = [arr[j], arr[i]];
  if (!persistManagerData()) return;
  renderHome();
  refreshBatchSelect();
  refreshCharacterGroupSelect();
}
// ホームのカードに立ち絵を付ける。画像が読めなかったら外す
function addCardPortrait(card, imageId, alt) {
  const im = document.createElement("img");
  im.className = "card-portrait";
  im.alt = alt;
  card.classList.add("has-portrait");
  card.append(im);
  im.referrerPolicy = "no-referrer";
  const drop = () => {
    im.remove();
    card.classList.remove("has-portrait");
  };
  im.onerror = drop;
  imageUrl(imageId).then((u) => {
    if (u) im.src = u;
    else drop();
  });
}
function makeGroupCard(g, opts) {
  opts = opts || {};
  const members = managerData.characters.filter((c) => characterGroupIds(c).includes(g.id));
  const card = document.createElement("div");
  card.className = "home-card";
  card.classList.add("group-card");
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-label", "グループ「" + g.name + "」を開く");
  const top = document.createElement("div");
  top.className = "card-top";
  const h = document.createElement("h3");
  setIconText(h, g.batch ? "dice" : "folder", g.batch ? g.name + " ×" + members.length : g.name);
  const go = document.createElement("span");
  go.className = "go";
  go.textContent = "開く ›";
  top.append(h, go);
  const p = document.createElement("p");
  const subN = childGroups(g.id).length;
  p.textContent = g.batch ? "連続生成　" + members.length + "体" : members.length + "キャラクター" + (subN ? "・サブグループ" + subN : "");
  if (g.batch) card.classList.add("batch-card");
  if (g.batch) {
    const lat = members.reduce((m, c) => (c.updatedAt && c.updatedAt > m ? c.updatedAt : m), "");
    p.textContent = "連続生成　" + members.length + "体" + (lat ? "　更新 " + fmtDate(lat) : "");
  }
  card.append(top, p);
  if (g.batch) {
    const withImg = members.find((c) => c.form && c.form.imageId);
    if (withImg) addCardPortrait(card, withImg.form.imageId, g.name + "の立ち絵");
  }
  if (members.length) {
    const pv = document.createElement("p");
    pv.className = "preview";
    const names3 = sortCharacters(members)
      .slice(0, 3)
      .map((c) => c.name || "名称未設定");
    pv.textContent = names3.join("、") + (members.length > 3 ? " ほか" + (members.length - 3) + "体" : "");
    card.append(pv);
  }
  const sibs = topGroups();
  if (opts.reorder && sibs.length > 1) {
    const ro = document.createElement("div");
    ro.className = "reorder";
    const idx = sibs.indexOf(g);
    const up = document.createElement("button");
    up.type = "button";
    up.className = "small-btn";
    up.textContent = "↑";
    up.disabled = idx === 0;
    up.setAttribute("aria-label", "グループを上へ");
    up.onclick = (e) => {
      e.stopPropagation();
      moveGroupOrder(g.id, -1);
    };
    const dn = document.createElement("button");
    dn.type = "button";
    dn.className = "small-btn";
    dn.textContent = "↓";
    dn.disabled = idx === sibs.length - 1;
    dn.setAttribute("aria-label", "グループを下へ");
    dn.onclick = (e) => {
      e.stopPropagation();
      moveGroupOrder(g.id, 1);
    };
    ro.append(up, dn);
    ro.addEventListener("click", (e) => e.stopPropagation());
    ro.addEventListener("keydown", (e) => e.stopPropagation());
    top.insertBefore(ro, go);
  }
  {
    const act = document.createElement("div");
    act.className = "actions";
    const dp = document.createElement("button");
    dp.type = "button";
    dp.textContent = "複製";
    dp.title = g.batch ? "この連続生成のキャラクターを、まとめて複製します" : "このグループを、キャラクターとサブグループごと複製します";
    dp.setAttribute("aria-label", "グループ「" + g.name + "」を複製");
    dp.onclick = (e) => {
      e.stopPropagation();
      duplicateGroupTree(g.id);
    };
    const dl = document.createElement("button");
    dl.type = "button";
    dl.textContent = "削除";
    dl.className = "danger";
    dl.setAttribute("aria-label", "グループ「" + g.name + "」を削除");
    dl.onclick = (e) => {
      e.stopPropagation();
      deleteGroup(g.id);
    };
    act.append(dl, dp);
    act.addEventListener("click", (e) => e.stopPropagation());
    act.addEventListener("keydown", (e) => e.stopPropagation());
    card.append(act);
  }
  const openIt = () => showGroupView(g.id);
  card.addEventListener("click", openIt);
  card.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openIt();
    }
  });
  return card;
}
function renderHome() {
  const gl = document.getElementById("groupList"),
    cl = document.getElementById("characterList");
  if (!gl || !cl) return;
  gl.innerHTML = "";
  cl.innerHTML = "";
  const searchEl = document.getElementById("homeSearch");
  const q = searchEl ? kanaFold(searchEl.value.trim()) : "";
  const matchName = (s) => kanaFold(s).includes(q);
  const normal = managerData.groups.filter((g) => !g.batch);
  const visibleGroups = q
    ? normal.filter(
        (g) =>
          matchName(g.name) ||
          managerData.characters.some(
            (c) =>
              characterGroupIds(c).includes(g.id) &&
              (matchName(c.name) || matchName((c.form && c.form.profile && c.form.profile.kana) || "")),
          ),
      )
    : topGroups().filter((g) => !g.batch);
  if (!normal.length) gl.innerHTML = '<p class="muted">グループはまだありません。</p>';
  else if (!visibleGroups.length) gl.innerHTML = '<p class="muted">該当するグループはありません。</p>';
  visibleGroups.forEach((g) => gl.append(makeGroupCard(g, { reorder: !q })));
  if (homeFilter === "batch" && !managerData.groups.some((g) => g.batch)) homeFilter = "all";
  if (
    !q &&
    homeFilter !== "all" &&
    homeFilter !== "none" &&
    homeFilter !== "batch" &&
    !managerData.groups.some((g) => g.id === homeFilter)
  ) {
    homeFilter = "all";
  }
  renderFilterChips();
  updateBulkBar();
  const items = sortCharacters([...visibleHomeCharacters(), ...batchGroupItems()]);
  if (q) {
    const t = document.createElement("p");
    t.className = "muted";
    t.textContent = "検索結果：" + items.length + "件";
    cl.append(t);
  } else if (!managerData.characters.length) cl.append(makeHomeTutorial());
  else {
    const gname =
      homeFilter === "all"
        ? "すべて"
        : homeFilter === "none"
          ? "グループ未所属"
          : homeFilter === "batch"
            ? "連続生成"
            : (managerData.groups.find((g) => g.id === homeFilter) || {}).name;
    const title = document.createElement("p");
    title.className = "muted";
    title.textContent = gname + "：" + items.length + (homeFilter === "batch" ? "件" : "体");
    cl.append(title);
    if (!items.length) {
      const e = document.createElement("p");
      e.className = "muted";
      e.textContent = "該当するキャラクターはいません。";
      cl.append(e);
    }
  }
  items.forEach((it) => cl.append(it.__batch ? makeGroupCard(it.__batch, { inList: true }) : makeCharacterCard(it, { select: bulkMode })));
}
