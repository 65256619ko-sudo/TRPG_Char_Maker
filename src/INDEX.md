# src の目次（python3 build.py --index で作り直し）

## CSS

- `css/01-base-layout.css`（609行）: 
- `css/02-hint-sections-skills.css`（485行）: 
- `css/03-home-groups.css`（519行）: 
- `css/04-v65-damage-memo.css`（516行）: 【v75 見た目の整理】
- `css/05-editor-compact.css`（486行）: 
- `css/06-batch-summary.css`（503行）: 【v83：閲覧モード】 【v87：編集画面「その他」メニューを見やすく】
- `css/07-cards-images.css`（450行）: 【v90：右利きの親指に合わせ、よく使うボタンを右】 【v90：削除ボタンは左端へ（右端は親指でスクロー】 【v91：その他のダイス用の🎲ボタン（割り振り方式】 【v92：成長記録】 【アイコン（SVG）】 【閲覧モード：タップで内訳】
- `css/08-error-jump.css`（547行）: 【エラーから該当行へ飛ぶ】 【技能の分類・成功時の処理】 【基本能力値の表（初期値／増加分／その他／合計）】 【JSON出力：ステータスにする技能の選択】 【自由コマンド・ラベル整理】
- `css/09-compact-ui.css`（512行）: 【画面のコンパクト化：余白・文字・ボタンを詰めて、】 【編集画面のタブと、右下のクイックメニュー】 【パソコン用：右クリックで出る円形（放射状）メニュ】
- `css/10-colors-images.css`（511行）: 【色の差をはっきりさせる・画像を大きく】 【チェック項目は、押せるボタン（ON＝緑、OFF＝】 【ヒントは「？ヒント」ボタンで開く】 【全体を、はっきりした色に。タブごとに色分け】 【密度：余白を詰める】 【やりたいこと一覧・案内】
- `css/11-radial-menu.css`（260行）: 

## JS

- `js/01-icons-roll-basics.js`（461行）: 【アイコン（24x24の線画。色は文字色に従う）】 icon setIconText fillIcons rollCommandPrefix updateRollModeButton textLines mapLines
- `js/02-palette-reorder.js`（495行）: reorderGroup markSelectionBar moveOneLine renderOrderList jsonizePalette generatedPaletteText regeneratePaletteOutput manualPaletteCommands
- `js/03-editor-tabs.js`（482行）: 【編集画面のタブ（基本／能力値／技能／出力）と、右】 editorTabsOn tabOfSection editorSections activeTab updateEditorTabCounts updateTabsH applyEditorTabs
- `js/04-radial-menu-labels.js`（434行）: ctxScreenOk ctxAllowed ctxTab 【スマホ：空いている所を0.5秒長押しすると、同じ】 renderQuickPanel 【ラベル（分類）の名前変更・削除】 catUsage openCatManager
- `js/05-free-commands-stats.js`（421行）: commitPaletteOrder knownRefNames freeCommandLine freeCommandWarnings updateFreeCommandPreview statDelta statTotal statDeltaInput
- `js/06-skill-status-cats.js`（437行）: 【JSON出力：技能の成功値をステータスにするか】 skillStatusExcluded setSkillStatusMode renderSkillStatusPanel skillBaseName defaultSkillCats effectiveSkillCats rowCatsExplicit
- `js/07-skill-rows-presets.js`（447行）: recalcSkillRow updatePointSummary setSkillPointMode addDamage 【基本技能（定番技能・戦闘機能）のカタログ】 【技能欄の並べ替えとチャパレの並べ替えを連動させる】 skillLineOwners paletteSkillSeq
- `js/08-skill-autocomplete-lists.js`（486行）: 【技能名・判定名の予測入力：基本技能カタログから候】 findRowByName removeBlankSkillRows applyDodge applyPresetItem applyPresetItems allPresetItems presetDesc
- `js/09-profile-lists-memo.js`（439行）: readProfile writeProfile 【v67：装備品・呪文・魔導書の追加リスト（メモに】 addListRow readLists writeLists secretMemoBlock listMemoBlocks
- `js/10-derived-status-db.js`（434行）: updateDerivedPreviews calculateDB dbLabelParts replaceDBWithLabels restoreDBLabels currentDBNeg pushDBStatuses literalizeNames
- `js/11-make-data-json.js`（432行）: makeData prepareGeneratedName collectSkillReferenceIssues closeSkillFix openSkillFixDialog applySkillFix offerSkillFix generateJSON
- `js/12-import-palette-autoupdate.js`（429行）: importCharacterJSON generatePaletteAfterFix 【自動更新（ライブプレビュー）：フォームを編集する】 setAutoStatus updateAutoButton formHasDice runAutoUpdate scheduleAutoUpdate
- `js/13-storage-lz.js`（430行）: 【キャラクター保存・ホーム・グループ管理】 characterGroupIds uid 【保存の圧縮（LZW：バイト列→1文字1コード、辞】 lzEncode lzDecode packStore unpackStore
- `js/14-home-groups-filter.js`（463行）: askDialog 【ホームの整理：グループ絞り込み・並び順・まとめて】 sortCharacters setCharacterGroups renderFilterChips visibleHomeCharacters batchGroupItems updateBulkBar
- `js/15-home-cards-batch.js`（466行）: copyCharacterJSON makeHomeTutorial homeStatsOn makeHomeStats makeCharacterCard setBatchImage renderBatchImage makeBatchRow
- `js/16-group-select-batch.js`（424行）: refreshCharacterGroupSelect createGroupFromCharacterSelect confirmCreateCharacterGroup refreshBatchSelect batchMsg closeBatchDialog substDiceNames liveStatCtx
- `js/17-images-share.js`（427行）: setImgUrl uploadOneImage ensureImagesUploaded configureImageUpload 【v99：共有リンク。キャラクターを圧縮して、リン】 b64urlEncode b64urlDecode streamBytes
- `js/18-growth-record.js`（712行）: rollDetailed 【v92：成長記録（通ったシナリオ・技能の成長・獲】
- `js/19-error-jump-backup-hints.js`（425行）: 【エラー文の「技能「鍵開け」の…」から、該当する入】 findErrorTarget jumpToErrorTarget collectBackupSettings restoreBackupSettings setupCollapsibleSections refreshHints queueHintRefresh
- `js/20-guide-radial-settings.js`（475行）: closeGuideBar runGuide 【円形メニューの設定】 rsPersist rsSlotOf rsRender rsAssign openRadialSettings
- `js/21-notifications-secret-memo.js`（428行）: applySkillSet 【v69：ロックメモ（パスワードで暗号化：PBKD】 secretDerive secretEncryptNow secretQueue askPassword restoreSecret renderSecret
- `js/22-portraits.js`（423行）: portraitStep portraitFull scheduleImageGc formImageIds allSavedImageIds gcImages collectBackupImages restoreBackupImages
- `js/23-viewer.js`（551行）: viewerCompute vwSec vwTile vwSubst vwGrowthRows vwDetailBody vwTapTiles vwSkillDetail
- `js/24-viewer-nav-presets.js`（549行）: viewerBarMode showViewer showViewerFromEditor returnToEditorFromViewer 【v85：他ツールから来たキャラの標準ダメージ／い】 presetDamageFor applyDefaultDamage iaLooksLike
