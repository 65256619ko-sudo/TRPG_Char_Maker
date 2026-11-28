document.getElementById("copy").onclick = async () => {
  const text = output.value;
  if (!text.trim()) {
    message.textContent = "先に「JSONを生成」を押してください。";
    document.getElementById("generate").focus();
    return;
  }
  if (await copyTextInGesture(text)) {
    message.textContent = "コピーしました";
    return;
  }
  message.textContent =
    "この画面ではブラウザがコピーを禁止しています。ファイルをChromeなどのブラウザで直接開いて、もう一度コピーを押してください。";
};
document.getElementById("download").onclick = () => {
  if (!output.value.trim()) document.getElementById("generate").click();
  if (!output.value.trim()) return;
  let u = URL.createObjectURL(new Blob([output.value], { type: "application/json;charset=utf-8" })),
    a = document.createElement("a");
  a.href = u;
  a.download = "trpg-character.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
};

function importCharacterJSON() {
  try {
    const rawInput = document.getElementById("jsonImport").value;
    // 「いあきゃら」などのテキスト形式なら、JSONではなくテキストとして読み込む
    if (!/^\s*[\[{]/.test(rawInput) && iaLooksLike(rawInput)) {
      try {
        importIacharaText(rawInput);
      } catch (e) {
        message.textContent = "テキスト読込エラー：" + (e.message || String(e));
      }
      return;
    }
    const obj = JSON.parse(rawInput);
    const d = obj.data || obj.character || obj;
    if (!d || typeof d !== "object") throw Error("キャラクターJSONを読み取れません");
    // 技能の「成功時に続けて出す行」は技能ごとの設定として戻すので、コマンドとしては二重に読み込まない
    if (obj.toolExtra && Array.isArray(obj.toolExtra.skills) && typeof d.commands === "string") {
      const follow = new Set();
      obj.toolExtra.skills.forEach((e) => textLines(e && e.osLines, true).forEach((l) => follow.add(l.trim().toLowerCase())));
      // 成功時のメモを出力していたJSONの「※…（成功時）：…」の行は、メモとして戻すのでコマンドには読み込まない
      d.commands = d.commands
        .split(/\r?\n/)
        .filter((l) => !/^※.+（成功時）：/.test(l.trim()))
        .join("\n");
      if (follow.size)
        d.commands = d.commands
          .split(/\r?\n/)
          .filter((l) => !follow.has(l.trim().toLowerCase()))
          .join("\n");
    }
    const params = Array.isArray(d.params) ? d.params : [];
    const status = Array.isArray(d.status) ? d.status : [];
    const byName = {};
    params.forEach((x) => {
      if (x && x.label != null) byName[String(x.label).toUpperCase()] = x.value;
    });
    clearStatDeltas();
    names.forEach((n) => {
      if (byName[n] != null) {
        const el = document.getElementById("base-" + n);
        if (el) el.value = String(byName[n]);
      }
    });
    const statusByName = {};
    status.forEach((x) => {
      if (x && x.label != null) statusByName[String(x.label).toUpperCase()] = x;
    });
    derivedStatuses.querySelectorAll(".derived-row").forEach((r) => {
      const n = r.dataset.derivedName.toUpperCase();
      if (statusByName[n]) r.querySelector(".derived-formula").value = String(statusByName[n].value ?? 0);
    });
    // JSONにDBが残っていれば復元（STR・SIZから自動計算した値と同じなら手入力欄は空のまま）
    let dbNeg = false;
    {
      const xs = statusByName["DB個数"],
        ys = statusByName["DB面"],
        ss = statusByName["DB符号"],
        legacy = statusByName["DB"];
      let dv = null;
      if (xs && ys) {
        const x = Number(xs.value),
          y = Number(ys.value);
        dbNeg = !!ss && Number(ss.value) < 0;
        dv = x === 0 ? "0" : (dbNeg ? "-" : "+") + (y === 1 ? String(x) : x + "D" + y);
      } else if (legacy) {
        dv = String(legacy.value ?? "").replace(/\s+/g, "");
        const q = dbLabelParts(dv);
        dbNeg = !!(q && q.neg);
      }
      if (dv !== null) {
        const sv = document.getElementById("base-STR").value.trim(),
          zv = document.getElementById("base-SIZ").value.trim();
        const auto = /^\d+$/.test(sv) && /^\d+$/.test(zv) ? calculateDB(Number(sv), Number(zv)) : null;
        document.getElementById("dbOverride").value = auto !== null && auto.toUpperCase() === dv.toUpperCase() ? "" : dv;
      }
    }
    // 読み込んだステータスのうち既定欄にないものは追加ステータスとして復元
    extras.innerHTML = "";
    const standard = new Set(["HP", "MP", "SAN", "アイデア", "幸運", "知識", "回避", "DB", "DB個数", "DB面", "DB符号"]);
    status.forEach((x) => {
      if (!x || x.label == null || standard.has(String(x.label).toUpperCase())) return;
      addExtra(String(x.label), String(x.value ?? 0));
    });
    const rawCmds = textLines(d.commands, true);
    const secretFlags = rawCmds.map((x) => SECRET_PREFIX_RE.test(x));
    const cmds = rawCmds.map((x) => x.replace(SECRET_PREFIX_RE, ""));

    // 既存フォームの技能値を退避。変数だけのパレットには数値が含まれないため、
    // 同名技能がフォームにあれば、その値を引き継ぐ。
    const previousSkillValues = {};
    skills.querySelectorAll(".row").forEach((r) => {
      const name = r.querySelector(".skill-name").value.trim();
      const value = r.querySelector(".skill-value").value.trim();
      if (name) previousSkillValues[name.toUpperCase()] = value;
    });
    // 旧形式の「※技能名は数値」コメントがあれば、そちらを優先して復元する。
    const skillValuesFromComments = {};
    cmds.forEach((line) => {
      const cm = line.match(/^※(.+?)は\s*(\d+)\s*$/);
      if (cm) skillValuesFromComments[cm[1].trim().toUpperCase()] = cm[2];
    });
    skills.innerHTML = "";
    let skillCount = 0,
      damageCount = 0;
    cmds.forEach((cmd, ci) => {
      let m = cmd.match(/^CCB?<=([^【]+)\s*【(.+?)】$/i);
      if (m && !/[×x]\s*5$/.test(m[2]) && !/^(アイデア|幸運|知識|回避)$/.test(m[2])) {
        const statusLabels = Object.values(statusByName).map((x) => String(x.label));
        const skillName = matchName(nameFromLabel(m[2].trim(), statusLabels), statusLabels);
        const statusValue = statusByName[skillName.toUpperCase()]?.value;
        const rawValue = /^\{[^{}]+\}$/.test(m[1].trim()) && statusValue != null ? String(statusValue) : m[1].trim();
        addSkill(skillName, rawValue, undefined, secretFlags[ci]);
        skillCount++;
        return;
      }
      if (/【(正気度ロール|一日の終わり|アイデア|幸運|知識|回避|.+ × 5)】$/.test(cmd)) return;
      const dm = cmd.match(/^(.*?)\s*【(.*?)】$/);
      if (dm && /(?:\d*d|\{[^}]+\}|DB|装甲|ダメージ)/i.test(dm[1])) {
        addDamage(
          matchName(
            nameFromLabel(dm[2]),
            Object.values(statusByName).map((x) => String(x.label)),
          ),
          restoreDBLabels(dm[1], dbNeg).replace(/\{DB\}/g, "DB"),
          secretFlags[ci],
        );
        damageCount++;
      }
    });
    // 技能は書き出し時にステータスにも入っているので、技能として読み込めたものは追加ステータスから外す（二重登録を防ぐ）
    {
      const sk = new Set([...skills.querySelectorAll(".skill-name")].map((i) => i.value.trim().toUpperCase()).filter(Boolean));
      [...extras.querySelectorAll(".row")].forEach((r) => {
        if (sk.has(r.querySelector(".extra-name").value.trim().toUpperCase())) r.remove();
      });
    }
    if (!skills.children.length) addSkill();
    applyDefaultDamage();
    const nk = splitNameKana(d.name);
    if (d.name != null) document.getElementById("charName").value = nk.name;
    const pm = parseMemoText(d.memo);
    document.getElementById("playerName").value = pm.player;
    if (nk.kana) pm.profile.kana = nk.kana;
    if (typeof d.externalUrl === "string" && d.externalUrl.trim()) pm.profile.url = d.externalUrl.trim();
    importIconUrls(d);
    importToolImages(obj);
    writeProfile(pm.profile);
    writeLists(pm.lists);
    restoreSecret(pm.secret);
    document.getElementById("memo").value = pm.memo;
    // JSONに含まれるコマンドを、そのまま単体チャットパレットにも反映
    paletteOutput.value = rawCmds.join("\n");
    paletteMode = "reflected";
    paletteOrderApplied = false;
    paletteOrderOverride = null;
    document.getElementById("output").value = JSON.stringify(obj, null, 2);
    applyToolExtra(obj.toolExtra);
    refreshDBDisplay();
    updateDerivedPreviews();
    refreshPaletteStatusOptions();
    filterSkillRows();
    // 反映が済んだら、貼り付けたJSONとファイル選択を空に戻す（次に開いたときに残らないように）
    document.getElementById("jsonImport").value = "";
    document.getElementById("jsonFile").value = "";
    document.getElementById("jsonImportPanel").classList.add("hidden");
  } catch (e) {
    message.textContent = "JSON読込エラー：" + (e.message || String(e));
  }
}
document.getElementById("importJSON").onclick = () => {
  importCharacterJSON();
};
document.getElementById("openJsonImport").onclick = () => {
  document.getElementById("jsonImportPanel").classList.toggle("hidden");
  if (!document.getElementById("jsonImportPanel").classList.contains("hidden")) {
    document.getElementById("jsonImportPanel").scrollIntoView({ block: "center", behavior: "smooth" });
    document.getElementById("jsonImport").focus({ preventScroll: true });
  }
};
document.getElementById("closeJsonImport").onclick = () => document.getElementById("jsonImportPanel").classList.add("hidden");
document.getElementById("jsonFile").addEventListener("change", async (e) => {
  const f = e.target.files && e.target.files[0];
  if (!f) return;
  document.getElementById("jsonImport").value = await f.text();
});
function generatePaletteAfterFix() {
  try {
    const issues = collectSkillReferenceIssues();
    if (issues.length) {
      offerSkillFix(issues, "palette");
      return false;
    }
    regeneratePaletteOutput();
    return true;
  } catch (e) {
    message.textContent = "生成エラー：" + (e.message || String(e));
    return false;
  }
}
document.getElementById("generatePalette").onclick = () => generatePaletteAfterFix();

// ===== 自動更新（ライブプレビュー）：フォームを編集すると、チャットパレットとJSONを自動で作り直す =====
let autoUpdate = true;
try {
  if (localStorage.getItem("trpgCharmakerAutoUpdate_v1") === "0") autoUpdate = false;
} catch (e) {}
let autoTimer = null;
function setAutoStatus(t) {
  const el = document.getElementById("autoUpdateStatus");
  if (el) el.textContent = t || "";
}
function updateAutoButton() {
  const b = document.getElementById("autoUpdateToggle");
  if (b) {
    b.textContent = "自動更新：" + (autoUpdate ? "ON" : "OFF");
    b.setAttribute("aria-pressed", String(autoUpdate));
    b.title =
      "ONにすると、フォームを編集するたびにチャットパレットとJSONを自動で作り直します（手動で編集・読み込みしたチャットパレットは上書きしません）";
  }
  if (!autoUpdate) setAutoStatus("");
}
updateAutoButton();
document.getElementById("autoUpdateToggle").addEventListener("click", () => {
  autoUpdate = !autoUpdate;
  try {
    localStorage.setItem("trpgCharmakerAutoUpdate_v1", autoUpdate ? "1" : "0");
  } catch (e) {}
  updateAutoButton();
  if (autoUpdate) runAutoUpdate();
});
// ダイス式のまま（振るたびに値が変わる）の項目があるときは、自動更新を止める
function formHasDice() {
  const els = [
    ...names.map((n) => document.getElementById("base-" + n)),
    ...document.querySelectorAll(".skill-value,.derived-formula,.extra-value"),
  ];
  return els.some((i) => i && /(^|[^A-Za-z0-9_])\d*[dD]\d+/.test(i.value));
}
function runAutoUpdate() {
  autoTimer = null;
  if (!autoUpdate) return;
  if (formHasDice()) {
    setAutoStatus("能力値などにダイス式が残っているため、自動更新を止めています（数値を確定すると再開します）");
    return;
  }
  try {
    if (collectSkillReferenceIssues().length) {
      setAutoStatus("技能名の表記ゆれがあります。「JSONを生成」を押すと修正候補が出ます");
      return;
    }
    const regenPalette = paletteMode === "generated" || (paletteOrderOverride && paletteOrderOverride.length);
    if (regenPalette) regeneratePaletteOutput();
    const data = makeDataWithPalette();
    output.value = JSON.stringify(data, null, 2);
    setAutoStatus(
      "自動更新しました" +
        (regenPalette ? "" : "（読み込み・手動編集したチャットパレットは更新していません。「パレット生成」で作り直せます）"),
    );
  } catch (e) {
    setAutoStatus("自動更新を一時停止：入力が未完成です（" + (e && e.message ? e.message : String(e)) + "）");
  }
}
const AUTO_IGNORE =
  "#secretMemoText,#output,#paletteOutput,#jsonImport,#jsonFile,#skillSearch,#presetSearch,#paletteStatusSearch,#paletteStatusSelect,#jsonImportPanel,#paletteOrderPanel,#skillCatBar,.skill-more,.ss-box,.free-cmd,#labelTools";
function scheduleAutoUpdate() {
  if (!autoUpdate || document.getElementById("editorView").classList.contains("hidden")) return;
  clearTimeout(autoTimer);
  autoTimer = setTimeout(runAutoUpdate, 400);
}
["input", "change"].forEach((t) =>
  document.getElementById("editorView").addEventListener(t, (e) => {
    if (e.target && e.target.closest && e.target.closest(AUTO_IGNORE)) return;
    scheduleAutoUpdate();
  }),
);
[skills, extras, derivedStatuses].forEach((c) => new MutationObserver(scheduleAutoUpdate).observe(c, { childList: true }));

document.getElementById("reflectPalette").onclick = () => {
  try {
    const orderWasCommitted = commitPaletteOrder();
    const sourceText = paletteOutput.value;
    const rawCmds = textLines(sourceText, true);
    const secretFlags = rawCmds.map((x) => SECRET_PREFIX_RE.test(x));
    const cmds = rawCmds.map((x) => x.replace(SECRET_PREFIX_RE, ""));
    if (!cmds.length) throw Error("先にチャットパレットを貼り付けてください");
    // まず内容を解析し、成功するまでフォームの既存行には一切触れない（途中エラーで全消去しない）。
    const previousSkillValues = {};
    skills.querySelectorAll(".row").forEach((r) => {
      const name = r.querySelector(".skill-name")?.value.trim();
      const value = r.querySelector(".skill-value")?.value.trim();
      if (name) previousSkillValues[name.toUpperCase()] = value;
    });
    const skillValuesFromComments = {};
    cmds.forEach((line) => {
      const cm = line.match(/^※(.+?)は\s*(\d+)\s*$/);
      if (cm) skillValuesFromComments[cm[1].trim().toUpperCase()] = cm[2];
    });
    const parsedSkills = [],
      parsedDamages = [];
    // フォームの内容から生成したチャパレと同じ行は「変更なし」とみなし、反映しない（数値に置き換わった式で技能値やDBの式を上書きしないため）。
    const unchangedLines = new Set();
    try {
      textLines(makeData({ standalonePalette: true, allowInvalidDamage: true }).data.commands, true).forEach((l) => unchangedLines.add(l));
    } catch (e) {}
    const formSkillNames = [...skills.querySelectorAll(".skill-name")].map((i) => i.value.trim()).filter(Boolean);
    cmds.forEach((cmd, ci) => {
      if (unchangedLines.has(rawCmds[ci])) return;
      const labelMatch = cmd.match(/【(.*?)】\s*$/);
      const label = labelMatch ? labelMatch[1].trim() : "";
      if (/^(正気度ロール|アイデア|幸運|知識|回避|.+\s*[×x]\s*5)$/i.test(label)) return;
      const m = cmd.match(/^CC(?:B)?<=([^【]+)\s*【(.+?)】$/i);
      if (m && !/^[A-Z]+ × 5$/i.test(m[2].trim())) {
        const skillName = matchName(nameFromLabel(m[2].trim()), formSkillNames);
        const key = skillName.toUpperCase();
        const val = m[1].trim();
        let value;
        if (/^\{[^{}]+\}$/.test(val)) {
          value = skillValuesFromComments[key] ?? previousSkillValues[key] ?? "";
        } else if (/^\d+$/.test(val)) {
          value = val;
        } else {
          value = val.replace(/\{([^{}]+)\}/g, "$1");
        }
        parsedSkills.push({ name: skillName, value, secret: secretFlags[ci] });
        return;
      }
      const dm = cmd.match(/^(.*?)\s*【(.*?)】$/);
      if (dm && /(?:\d*d|\{[^}]+\}|DB|装甲|ダメージ|C\()/i.test(dm[1])) {
        parsedDamages.push({
          name: matchName(nameFromLabel(dm[2]), formSkillNames),
          value: restoreDBLabels(dm[1].replace(/^C\((.*)\)$/i, "$1"), currentDBNeg()).replace(/\{DB\}/g, "DB"),
          secret: secretFlags[ci],
        });
      }
    });
    if (!parsedSkills.length && !parsedDamages.length) {
      message.textContent = orderWasCommitted
        ? "チャットパレットの順番を確定しました。フォームに反映する変更（フォームの内容と異なる技能・ダメージ式）はありませんでした。既存の技能・ダメージ欄は変更していません。"
        : "フォームに反映する変更（フォームの内容と異なる技能・ダメージ式）はありませんでした。既存の技能・ダメージ欄は変更していません。";
      return;
    }
    // 同名行は更新し、新しい名前だけ追加。パレットにない既存技能は削除しない。
    const skillRows = new Map();
    skills.querySelectorAll(".row").forEach((r) => {
      const n = r.querySelector(".skill-name")?.value.trim();
      if (n) skillRows.set(n.toUpperCase(), r);
    });
    parsedSkills.forEach((item) => {
      const key = item.name.toUpperCase();
      const existing = skillRows.get(key);
      if (existing) {
        // 変数のみのコマンドで値が分からない場合は、既存値をそのまま維持。
        if (item.value !== "") existing.querySelector(".skill-value").value = item.value;
        setRowSecret(existing, item.secret);
        recalcSkillRow(existing);
      } else {
        const added = addSkill(item.name, item.value, undefined, item.secret);
        skillRows.set(key, added.row);
      }
    });
    const damageRows = new Map();
    skills.querySelectorAll(".row").forEach((r) => {
      const n = r.querySelector(".skill-name")?.value.trim();
      if (!n) return;
      const k = n.toUpperCase(),
        prev = damageRows.get(k);
      if (!prev || (!prev.querySelector(".damage-value").value.trim() && r.querySelector(".damage-value").value.trim()))
        damageRows.set(k, r);
    });
    parsedDamages.forEach((item) => {
      const key = item.name.toUpperCase();
      const existing = damageRows.get(key);
      if (existing) {
        existing.querySelector(".damage-value").value = item.value;
        setRowSecretDmg(existing, item.secret);
        recalcSkillRow(existing);
      } else {
        const added = addDamage(item.name, item.value, item.secret);
        if (added) damageRows.set(key, added);
      }
    });
    paletteMode = "reflected";
    refreshPaletteStatusOptions();
    filterSkillRows();
    updatePointSummary();
    message.textContent = `フォームへ反映しました（技能 ${parsedSkills.length}件、ダメージ式 ${parsedDamages.length}件）。パレットにない既存技能は保持しています。`;
  } catch (e) {
    message.textContent = "チャパレ反映エラー：" + (e.message || String(e));
  }
};
document.getElementById("copyPalette").onclick = async () => {
  if (!paletteOutput.value.trim()) {
    try {
      paletteOutput.value = makeData({ standalonePalette: true }).data.commands;
    } catch (e) {
      message.textContent = "生成エラー：" + (e.message || String(e));
      return;
    }
  }
  message.textContent = (await copyTextInGesture(addPaletteHeadings(paletteOutput.value)))
    ? "コピーしました"
    : "コピーできませんでした。チャットパレット欄を長押ししてコピーしてください。";
};

