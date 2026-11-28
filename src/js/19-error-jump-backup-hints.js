(function () {
  const more = document.getElementById("editorMore"),
    menu = document.getElementById("editorMenu");
  const close = () => {
    menu.classList.add("hidden");
    more.setAttribute("aria-expanded", "false");
    document.body.classList.remove("menu-open");
  };
  more.addEventListener("click", (e) => {
    e.stopPropagation();
    const open = menu.classList.toggle("hidden") === false;
    more.setAttribute("aria-expanded", String(open));
    document.body.classList.toggle("menu-open", open);
  });
  menu.addEventListener("click", close);
  document.addEventListener("click", (e) => {
    if (!menu.contains(e.target) && e.target !== more) close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });
  let t = null;
  new MutationObserver(() => {
    clearTimeout(t);
    if (message.textContent)
      t = setTimeout(
        () => {
          message.textContent = "";
        },
        message.querySelector(".jump-hint") ? 9000 : 3500,
      );
  }).observe(message, { childList: true, characterData: true, subtree: true });
})();
// ===== エラー文の「技能「鍵開け」の…」から、該当する入力行を探して飛ぶ =====
function findErrorTarget(text) {
  const m = /(技能|基本ステータス|ステータス)「(.+?)」/.exec(String(text || ""));
  if (!m) return null;
  const kind = m[1],
    name = m[2].trim();
  const inDerived = () => {
    const r = [...derivedStatuses.querySelectorAll(".derived-row")].find((x) => (x.dataset.derivedName || "").trim() === name);
    return r && { row: r, input: r.querySelector(".derived-formula"), name };
  };
  const inExtras = () => {
    const r = [...extras.querySelectorAll(".row")].find((x) => (x.querySelector(".extra-name")?.value || "").trim() === name);
    return r && { row: r, input: r.querySelector(".extra-value"), name };
  };
  if (kind === "技能") {
    const r = findRowByName(skills, ".skill-name", name);
    return r ? { row: r, input: r.querySelector(".skill-value"), name } : null;
  }
  return kind === "基本ステータス" ? inDerived() || inExtras() : inExtras() || inDerived();
}
function jumpToErrorTarget(t) {
  if (!t || !t.row.isConnected) return false;
  t.row.scrollIntoView({ block: "center", behavior: "smooth" });
  t.row.classList.remove("jump-hl");
  void t.row.offsetWidth;
  t.row.classList.add("jump-hl");
  setTimeout(() => t.row.classList.remove("jump-hl"), 2600);
  setTimeout(() => t.input && t.input.focus({ preventScroll: true }), 350);
  return true;
}
// メッセージ・自動更新の一時停止表示に「タップで該当行へ」を付ける
(function () {
  new MutationObserver(() => {
    if (!message.textContent || message.querySelector(".jump-hint")) return;
    const t = findErrorTarget(message.textContent);
    if (!t) return;
    const h = document.createElement("span");
    h.className = "jump-hint";
    h.textContent = "▶ タップで「" + t.name + "」の入力欄へ移動";
    message.append(h);
    message.classList.add("has-jump");
  }).observe(message, { childList: true, characterData: true, subtree: true });
  new MutationObserver(() => {
    if (!message.textContent) message.classList.remove("has-jump");
  }).observe(message, { childList: true, characterData: true, subtree: true });
  const st = document.getElementById("autoUpdateStatus");
  new MutationObserver(() => {
    if (!st.textContent || st.querySelector(".jump-link")) return;
    const t = findErrorTarget(st.textContent);
    if (!t) return;
    const b = document.createElement("button");
    b.type = "button";
    b.className = "small-btn jump-link";
    b.textContent = "「" + t.name + "」へ移動";
    b.onclick = () => jumpToErrorTarget(findErrorTarget(st.textContent.replace(b.textContent, "")));
    st.append(" ", b);
  }).observe(st, { childList: true, characterData: true });
})();
message.addEventListener("click", () => {
  const h = message.querySelector(".jump-hint");
  if (h) jumpToErrorTarget(findErrorTarget(message.textContent.replace(h.textContent, "")));
  message.textContent = "";
});
document.getElementById("backHome").addEventListener("click", (e) => {
  e.preventDefault();
  showHome();
});
document.getElementById("duplicateCharacter").onclick = duplicateCharacter;
document.getElementById("createBatch").onclick = createBatch;
document.getElementById("openBatch").onclick = () => {
  refreshBatchSelect();
  document.getElementById("batchMessage").textContent = "";
  document.getElementById("batchDialog").classList.remove("hidden");
};
document.getElementById("batchClose").onclick = closeBatchDialog;
document.getElementById("batchDialog").addEventListener("click", (e) => {
  if (e.target.id === "batchDialog") closeBatchDialog();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeBatchDialog();
});
document.getElementById("addCustomDerived").onclick = () => {
  addDerivedStatus({ name: "", formula: "0", custom: true });
};
// この端末だけの設定（円形メニューの並び・タブ表示・ヒント表示など）もバックアップに入れる。画像アップロードの設定（鍵を含みうる）は入れない
const BACKUP_SETTING_KEYS = [
  "trpg_ctx_layout",
  "trpg_ctx_hold",
  "trpg_quick_fab",
  "trpg_home_stats",
  "trpg_editor_tabs",
  "trpg_hints_all",
  "trpgCharmakerCollapsedSections_v1",
  "trpgCharmakerAutoUpdate_v1",
  "trpgCharmakerRollMode_v1",
  "trpgCharmakerHomeSort_v1",
];
function collectBackupSettings() {
  const o = {};
  BACKUP_SETTING_KEYS.forEach((k) => {
    try {
      const v = localStorage.getItem(k);
      if (v !== null) o[k] = v;
    } catch (e) {}
  });
  return o;
}
function restoreBackupSettings(st) {
  if (!st || typeof st !== "object") return 0;
  let n = 0;
  BACKUP_SETTING_KEYS.forEach((k) => {
    if (typeof st[k] !== "string") return;
    try {
      localStorage.setItem(k, st[k]);
      n++;
    } catch (e) {}
  });
  try {
    rollMode = localStorage.getItem("trpgCharmakerRollMode_v1") === "CC" ? "CC" : "CCB";
    autoUpdate = localStorage.getItem("trpgCharmakerAutoUpdate_v1") !== "0";
    homeSort = localStorage.getItem("trpgCharmakerHomeSort_v1") || "updated";
    applyEditorTabs();
    if (typeof syncHoldUi === "function") syncHoldUi();
    applyHintsAll();
    applyQuickFabMode();
  } catch (e) {}
  return n;
}
document.getElementById("backupAll").onclick = async () => {
  const images = await collectBackupImages();
  const blob = new Blob(
    [JSON.stringify({ format: "trpg-character-manager", version: 1, ...JSON.parse(serializeManager()), images, settings: collectBackupSettings() }, null, 2)],
    { type: "application/json;charset=utf-8" },
  );
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "trpg-character-backup.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};
document.getElementById("restoreAll").onclick = () => document.getElementById("backupFile").click();
document.getElementById("backupFile").addEventListener("change", async (e) => {
  const f = e.target.files && e.target.files[0];
  if (!f) return;
  try {
    const obj = JSON.parse(await f.text());
    if (!Array.isArray(obj.characters) || !Array.isArray(obj.groups)) throw Error("バックアップ形式が違います");
    if (
      !(await askDialog({
        title: "バックアップの復元",
        desc: "現在の保存データをバックアップ内容で置き換えます。続けますか？",
        okText: "置き換える",
        danger: true,
      }))
    )
      return;
    await restoreBackupImages(obj.images);
    managerData = { characters: obj.characters, groups: obj.groups, skillSets: Array.isArray(obj.skillSets) ? obj.skillSets : [] };
    persistManagerData();
    const nSet = restoreBackupSettings(obj.settings);
    renderHome();
    if (nSet) message.textContent = "復元しました（この端末の設定も戻しました）。";
  } catch (err) {
    message.textContent = "復元エラー：" + err.message;
  }
  e.target.value = "";
});
// h2見出しを押すと各セクションを折りたたみ。状態はブラウザに保存する。
function setupCollapsibleSections() {
  const key = "trpgCharmakerCollapsedSections_v1";
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(key) || "{}");
  } catch (e) {}
  document.querySelectorAll("section").forEach((section, index) => {
    if (section.classList.contains("no-collapse")) return;
    const heading = section.querySelector(":scope > h2, :scope > .palette-heading > h2");
    if (!heading) return;
    const id = section.id || "section-" + index + "-" + (heading.textContent || "").trim();
    const defaultCollapsed = section.id === "sec-groupmember";
    section.classList.add("collapsible");
    heading.tabIndex = 0;
    heading.setAttribute("role", "button");
    const collapsed = id in saved ? !!saved[id] : defaultCollapsed;
    section.classList.toggle("is-collapsed", collapsed);
    heading.setAttribute("aria-expanded", String(!collapsed));
    const toggle = () => {
      const next = !section.classList.contains("is-collapsed");
      section.classList.toggle("is-collapsed", next);
      heading.setAttribute("aria-expanded", String(!next));
      saved[id] = next;
      try {
        localStorage.setItem(key, JSON.stringify(saved));
      } catch (e) {}
    };
    heading.addEventListener("click", toggle);
    heading.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggle();
      }
    });
  });
}
setupCollapsibleSections();
// 1行に収まらない説明文だけ折りたたみ（1行表示）、タップで全文表示する。警告・状況表示は常に全文。
// 非表示の画面・折りたたみセクション内の説明文は測定できないため、表示されたタイミングで再計測する。
function refreshHints() {
  document.querySelectorAll(".hint").forEach((el) => {
    if (el.classList.contains("hint-fold")) {
      el.classList.remove("is-expandable", "is-expanded");
      return;
    }
    if (!el.getClientRects().length) return; // 非表示中は後で再計測
    if (!el.dataset.hintBound) {
      el.dataset.hintBound = "1";
      const toggle = () => {
        if (!el.classList.contains("is-expandable")) return;
        const open = el.classList.toggle("is-expanded");
        el.setAttribute("aria-expanded", String(open));
      };
      el.addEventListener("click", toggle);
      el.addEventListener("keydown", (e) => {
        if ((e.key === "Enter" || e.key === " ") && el.classList.contains("is-expandable")) {
          e.preventDefault();
          toggle();
        }
      });
    }
    const wasOpen = el.classList.contains("is-expanded");
    el.classList.remove("is-expandable", "is-expanded");
    const lh = parseFloat(getComputedStyle(el).lineHeight) || 24;
    if (el.scrollHeight > lh + 3 && !el.classList.contains("warn") && !el.hasAttribute("aria-live")) {
      el.classList.add("is-expandable");
      if (wasOpen) el.classList.add("is-expanded");
      el.setAttribute("role", "button");
      el.setAttribute("tabindex", "0");
      el.setAttribute("aria-expanded", String(wasOpen));
    } else {
      el.removeAttribute("role");
      el.removeAttribute("tabindex");
      el.removeAttribute("aria-expanded");
    }
  });
}
let hintRefreshQueued = false;
function queueHintRefresh() {
  if (hintRefreshQueued) return;
  hintRefreshQueued = true;
  requestAnimationFrame(() => {
    hintRefreshQueued = false;
    refreshHints();
  });
}
new MutationObserver((muts) => {
  if (muts.some((m) => !(m.target.classList && m.target.classList.contains("hint")))) queueHintRefresh();
}).observe(document.body, { subtree: true, attributes: true, childList: true, attributeFilter: ["class", "hidden"] });
window.addEventListener("resize", queueHintRefresh);
window.addEventListener("load", queueHintRefresh);
queueHintRefresh();

// ===== 説明文は、各セクション右上の「？ヒント」ボタンで開く =====
const HINTS_ALL_KEY = "trpg_hints_all";
function hintsAllOn() {
  try {
    return localStorage.getItem(HINTS_ALL_KEY) === "1";
  } catch (e) {
    return false;
  }
}
function applyHintsAll() {
  const on = hintsAllOn();
  document.body.classList.toggle("hints-all", on);
  const l = document.getElementById("hintsAllLabel");
  if (l) l.textContent = on ? "ヒントを全部表示：ON" : "ヒントを全部表示：OFF";
  queueHintRefresh();
}
function setupHintFolds() {
  const sel = "#editorView > section p.hint, #editorView > section .pal-lead, #editorView > section details#paletteHow, #skillViewHelp, #labelViewHelp";
  document.querySelectorAll(sel).forEach((el) => {
    if (el.hasAttribute("aria-live") || el.classList.contains("warn") || el.id === "paletteLabelInfo" || el.closest("#paletteCommandList, .row")) return;
    if (el.tagName === "P" && el.classList.contains("hint") && !el.id && el.textContent.trim().length < 28) return;
    el.classList.add("hint-fold");
  });
  editorSections().forEach((sec) => {
    sec.dataset.tab = tabOfSection(sec);
    const h = sec.querySelector("h2");
    if (!h || h.querySelector(".hint-btn") || !sec.querySelector(".hint-fold")) return;
    const b = document.createElement("button");
    b.type = "button";
    b.className = "hint-btn";
    b.textContent = "？ヒント";
    b.title = "このセクションの説明を出す・隠す";
    b.setAttribute("aria-pressed", "false");
    b.addEventListener("keydown", (e) => e.stopPropagation());
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      const on = sec.classList.toggle("hints-open");
      b.setAttribute("aria-pressed", String(on));
    });
    h.append(b);
  });
  document.querySelectorAll("#editorTabs button[data-tab]").forEach((b) => b.setAttribute("data-acc", b.dataset.tab));
}
setupHintFolds();
document.getElementById("hintsAllToggle").addEventListener("click", () => {
  try {
    localStorage.setItem(HINTS_ALL_KEY, hintsAllOn() ? "0" : "1");
  } catch (e) {}
  applyHintsAll();
  document.getElementById("editorMenu").classList.add("hidden");
  toast(hintsAllOn() ? "説明文を全部表示します" : "説明文は「？ヒント」で開く形に戻しました");
});
applyHintsAll();

// ===== やりたいこと一覧（案内） =====
const GUIDE_GOALS = [
  { g: "キャラを作る", t: "能力値を3d6で決めたい", d: "STR・CONなどをまとめて振る", tab: "stats", sel: "#rollStats", steps: ["「3d6で能力値を振る」を押す", "気に入らなければ、もう一度押す", "数字は手で直してもOK"], act: ["いま振る", () => quickClick("rollStats")], k: "ダイス 振る 能力値 ステータス" },
  { g: "キャラを作る", t: "画像（立ち絵）を設定したい", d: "写真を選ぶか、URLを貼る", tab: "basic", sel: "#portraitPick", steps: ["「画像を選ぶ」を押して写真を選ぶ", "URLを貼って設定もできます", "複数枚あれば左右で切り替え"], k: "画像 立ち絵 写真 アイコン" },
  { g: "キャラを作る", t: "名前・職業などを入れたい", d: "基本のキャラ情報", tab: "basic", sel: "#charName", steps: ["名前・プレイヤー名などを入力", "職業・年齢などは下の欄へ"], k: "名前 職業 年齢 プロフィール" },
  { g: "キャラを作る", t: "HP・MP・SANなどのステータスを増やしたい", d: "能力値に準ずる項目を追加", tab: "stats", sel: "#addCustomDerived", steps: ["「＋ ステータスを追加」を押す", "名前と式（例：POW*5）を入れる", "「まとめて適用」で数値を更新"], act: ["追加する", () => quickClick("addCustomDerived")], k: "HP MP SAN ステータス 追加" },
  { g: "技能", t: "技能を追加したい", d: "1行ずつ増やす", tab: "skills", sel: "#addSkill", steps: ["「＋ 技能を追加」を押す", "技能名と成功値を入力", "ラベルで絞り込み中なら、そのラベルが付きます"], act: ["追加する", () => { addSkillHere(); const r = [...skills.querySelectorAll(".row")].pop(); if (r) quickFocus(r.querySelector(".skill-name")); }], k: "技能 追加 増やす" },
  { g: "技能", t: "基本技能をまとめて入れたい", d: "ルールブックの初期値つき一覧", tab: "skills", sel: "#openPresetDialog", steps: ["「基本技能を適用」を押す", "全部／戦闘だけ／チェックしたものから選ぶ"], act: ["開く", () => quickClick("openPresetDialog")], k: "基本技能 初期値 プリセット" },
  { g: "技能", t: "自分の技能セットを使いたい", d: "お気に入りの組み合わせを保存・呼び出し", tab: "skills", sel: "#openSkillSets", steps: ["「お気に入りセット」を押す", "いまの技能を保存、または保存済みを呼び出す"], act: ["開く", () => quickClick("openSkillSets")], k: "お気に入り セット 保存" },
  { g: "技能", t: "職業P・興味Pを割り振りたい", d: "初期値＋職業P＋興味P＋その他で合計", tab: "skills", sel: "#spMode", steps: ["「技能ポイント割り振り方式」をONにする", "上限の式を入れ、技能ごとに職業P・興味Pを入力", "残りポイントが上に出ます"], act: ["ONにする", () => { const c = document.getElementById("spMode"); if (!c.checked) c.click(); }], k: "ポイント 職業P 興味P 割り振り" },
  { g: "技能", t: "技能をラベル（分類）で整理したい", d: "戦闘・探索などで絞り込み・まとめる", tab: "skills", sel: "#skillSearch", steps: ["技能名の右のタグで、ラベルを付け替え", "上に並ぶラベルのボタンで、その分類だけ表示", "ラベル名の変更・削除は「並べ替えを編集」の中"], k: "ラベル 分類 絞り込み カテゴリ" },
  { g: "技能", t: "技能の順番を並べ替えたい", d: "1件ずつ・ラベルごとに移動", tab: "skills", sel: "#skillOrderSwitch", steps: ["「並べ替えを編集」をONにする", "左端の⠿を長押しして上下へドラッグ", "もう一度押すと終了"], act: ["ONにする", () => { const c = document.getElementById("skillOrderSwitch"); if (!c.checked) c.click(); }], k: "並べ替え 順番 移動 ドラッグ" },
  { g: "技能", t: "武器のダメージ式を設定したい", d: "例：1d3+DB", tab: "skills", sel: "#skills .dmg-toggle", steps: ["技能の右端の剣ボタンを押す", "ダメージ式を入れる（例：1d3）", "「+DB」でダメージボーナスの有無を切り替え"], k: "ダメージ 武器 剣 DB" },
  { g: "技能", t: "技能名を相手に隠したい", d: "シークレット設定", tab: "skills", sel: "#secretEditToggleSkills", steps: ["「シークレット設定」をONにする", "隠したい技能の行を押して印を付ける"], act: ["ONにする", () => document.getElementById("secretEditToggleSkills").click()], k: "シークレット 隠す 秘密" },
  { g: "チャットパレット", t: "チャットパレットを作ってコピーしたい", d: "ココフォリアに貼る用", tab: "out", sel: "#generatePalette", steps: ["「生成」でいまのキャラから作る", "必要なら並べ替える", "「コピー」を押して、ココフォリアに貼る"], act: ["生成する", () => quickClick("generatePalette")], k: "チャパレ チャットパレット コピー 生成" },
  { g: "チャットパレット", t: "チャパレの順番を変えたい", d: "優先順位の編集", tab: "out", sel: "#priorityEditSwitch", steps: ["「優先順位を編集」をONにする", "⠿を押したまま上下へ動かす", "ラベルごと・【名前】ごとにまとめて動かせます"], act: ["ONにする", () => { const c = document.getElementById("priorityEditSwitch"); if (!c.checked) c.click(); }], k: "チャパレ 順番 優先順位 並べ替え" },
  { g: "チャットパレット", t: "ラベルごとに見出し行を入れたい", d: "―――― 戦闘 ―――― のように区切る", tab: "out", sel: "#paletteHeads", steps: ["「ラベル見出し行」をONにする", "チャパレ欄・コピー・JSONに見出しが入ります"], act: ["ONにする", () => { const c = document.getElementById("paletteHeads"); if (!c.checked) c.click(); }], k: "見出し ラベル 区切り" },
  { g: "チャットパレット", t: "成功時のメモも出したい", d: "技能ごとの成功時メモを出力に含める", tab: "out", sel: "#includeSuccessMemo", steps: ["「成功時のメモも出力」をONにする"], act: ["ONにする", () => { const c = document.getElementById("includeSuccessMemo"); if (!c.checked) c.click(); }], k: "成功時 メモ" },
  { g: "出力・共有", t: "ココフォリア用のJSONをコピーしたい", d: "キャラクターのコマ用", tab: "out", sel: "#copy", steps: ["「JSONコピー」を押す", "ココフォリアで貼り付ける"], act: ["コピーする", () => quickClick("copy")], k: "JSON ココフォリア コピー 出力" },
  { g: "出力・共有", t: "友達にキャラを共有したい", d: "リンクまたはファイルで渡す", tab: "", sel: "#editorMore", steps: ["下の「その他」を開く", "「共有リンクをコピー」か「画像つきで共有（ファイル）」を選ぶ"], act: ["その他を開く", () => quickClick("editorMore")], k: "共有 リンク 友達 送る" },
  { g: "出力・共有", t: "JSON・テキストを取り込みたい", d: "ココフォリア／いあきゃらから反映", tab: "", sel: "#editorMore", steps: ["「その他」→「JSON・テキストを反映」", "貼り付けて「反映」"], act: ["開く", () => quickClick("openJsonImport")], k: "取り込み インポート いあきゃら JSON 反映" },
  { g: "遊ぶ・育てる", t: "シナリオ後の成長を記録したい", d: "成長・獲得物をシートに反映", tab: "", sel: "#editorMore", steps: ["「成長記録」を開く", "通ったシナリオと増えた技能を記録"], act: ["開く", () => quickClick("openGrowth")], k: "成長 記録 シナリオ 経験" },
  { g: "遊ぶ・育てる", t: "閲覧画面で見たい", d: "読み取り専用の見やすい表示", tab: "", sel: "#editorMore", steps: ["「閲覧で見る」を押す", "技能をタップするとダイスも振れます"], act: ["開く", () => quickClick("openViewerFromEditor")], k: "閲覧 見る ビューア" },
  { g: "遊ぶ・育てる", t: "ダイスを振りたい", d: "1d100、2d6+3 など", tab: "", sel: "#editorMore", steps: ["「ダイスを振る」を開く", "式を入れて「振る」"], act: ["開く", () => quickClick("openDice")], k: "ダイス 振る" },
  { g: "遊ぶ・育てる", t: "同じ設定でNPCを何体も作りたい", d: "能力値を振り直してまとめて作る", tab: "", sel: "#editorMore", steps: ["「連続生成」を開く", "名前と体数を決めて作成"], act: ["開く", () => quickClick("openBatch")], k: "連続生成 NPC まとめて" },
  { g: "遊ぶ・育てる", t: "右クリック・長押しの円形メニューを自分用に並べ替えたい", d: "パソコンは右クリック、スマホは空いている所を0.5秒長押し。よく使う操作を好きな向きへ", tab: "", sel: "#editorMore", steps: ["「その他」→「円形メニューの設定」", "位置を選んで、入れたい操作を押す", "タブごとに変えられます"], act: ["開く", () => openRadialSettings()], k: "円形 右クリック メニュー カスタム 設定" },
  { g: "保存", t: "保存したい", d: "いまの内容を残す", tab: "", sel: "#saveStay", steps: ["「保存」で、この画面のまま保存", "「保存してホームへ」で保存して戻る"], act: ["保存する", () => quickClick("saveStay")], k: "保存 セーブ" },
];
let guideCurrent = null;
function openGuide(q) {
  const d = document.getElementById("guideDialog"),
    host = document.getElementById("guideList"),
    inp = document.getElementById("guideSearch");
  closeGuideBar();
  if (typeof q === "string") inp.value = q;
  renderGuideList();
  d.classList.remove("hidden");
  inp.focus({ preventScroll: true });
}
function closeGuide() {
  document.getElementById("guideDialog").classList.add("hidden");
}
function renderGuideList() {
  const host = document.getElementById("guideList"),
    q = kanaFold(document.getElementById("guideSearch").value.trim());
  host.textContent = "";
  let last = "",
    n = 0;
  GUIDE_GOALS.forEach((g, i) => {
    if (q && !kanaFold(g.t + g.d + (g.k || "") + g.g).includes(q)) return;
    n++;
    if (g.g !== last) {
      const h = document.createElement("div");
      h.className = "gd-group";
      h.textContent = g.g;
      host.append(h);
      last = g.g;
    }
    const b = document.createElement("button");
    b.type = "button";
    b.className = "gd-item";
    const t = document.createElement("b");
    t.textContent = g.t;
    const sm = document.createElement("small");
    sm.textContent = g.d;
    b.append(t, sm);
    b.onclick = () => runGuide(i);
    host.append(b);
  });
  if (!n) {
    const p = document.createElement("p");
    p.className = "hint";
    p.textContent = "見つかりませんでした。別の言葉で探してみてください。";
    host.append(p);
  }
}
