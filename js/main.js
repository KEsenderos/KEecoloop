/* js/main.js / 起動処理・各操作の司令塔（RE.Main） / 仕様書 v3.3.0 4.3・5.3・5.15・9.6章 / 版 3.3.0 */
(function () {
  'use strict';
  var C = RE.Config;
  var S = C.PLAYER_STATE;
  var U = RE.Utils;
  var loadToken = 0;
  var busy = 0;            // 読み込み中のファイル数（読み込み中は保存しない）
  var restoring = false;   // 前回の続きを読み込み中
  var userTouched = false; // 起動後に本人がファイル選択・モード切替をした（自動再開を打ち切る）
  var saveTimer = null;

  /** 画面を更新し、区間・モードの記録を（少し待ってから）保存する */
  function render_() {
    RE.UI.render();
    persist_();
  }

  var SLOTS = ['A', 'B', 'C'];

  /** スロットの値の読み書き（A=従来の変数、B・C=末尾に B／C が付く変数）。v2.10 */
  function nm_(slot) { var St = RE.State; return slot === 'C' ? St.fileNameC : (slot === 'B' ? St.fileNameB : St.fileName); }
  function du_(slot) { var St = RE.State; return slot === 'C' ? St.durationSecC : (slot === 'B' ? St.durationSecB : St.durationSec); }
  function st_(slot) { var St = RE.State; return slot === 'C' ? St.startSecC : (slot === 'B' ? St.startSecB : St.startSec); }
  function en_(slot) { var St = RE.State; return slot === 'C' ? St.endSecC : (slot === 'B' ? St.endSecB : St.endSec); }
  function setSec_(slot, s, e) {
    var St = RE.State;
    if (slot === 'C') { St.startSecC = s; St.endSecC = e; }
    else if (slot === 'B') { St.startSecB = s; St.endSecB = e; }
    else { St.startSec = s; St.endSec = e; }
  }
  function setStart_(slot, v) { setSec_(slot, v, en_(slot)); }
  function setEnd_(slot, v) { setSec_(slot, st_(slot), v); }
  function resetSlot_(slot) { var St = RE.State; if (slot === 'C') St.resetC(); else if (slot === 'B') St.resetB(); else St.resetA(); }
  function setFileOf_(slot, name, dur) { var St = RE.State; if (slot === 'C') St.setFileC(name, dur); else if (slot === 'B') St.setFileB(name, dur); else St.setFile(name, dur); }
  /** いまのモードで再生に使うスロット（読み込まれているものだけ） */
  function activeSlots_() {
    var St = RE.State, list = [];
    if (St.fileName) list.push('A');
    if (St.mode !== C.MODE.SINGLE && St.fileNameB) list.push('B');
    if (St.mode === C.MODE.TRIPLE && St.fileNameC) list.push('C');
    return list;
  }
  function anyFile_() { var St = RE.State; return !!(St.fileName || St.fileNameB || St.fileNameC); }

  function persist_() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      var St = RE.State;
      if (busy > 0 || restoring || !anyFile_()) return;
      RE.Store.saveMeta({
        mode: St.mode,
        A: St.fileName ? { s: St.startSec, e: St.endSec } : null,
        B: St.fileNameB ? { s: St.startSecB, e: St.endSecB } : null,
        C: St.fileNameC ? { s: St.startSecC, e: St.endSecC } : null,
        savedAt: Date.now()
      });
    }, 400);
  }

  function onEngineStateChange_(state) {
    // ファイル読込中に届く状態通知は無視する（画面と State の食い違いを防ぐ）
    if (!anyFile_() && state !== S.NO_FILE) return;
    RE.State.playerState = state;
    render_();
    if (state === S.PLAYING) RE.MediaSession.register();
    RE.MediaSession.setPlaybackState(state);
  }

  function onEngineError_(errCode) {
    if (errCode === C.ERR.PLAY_BLOCKED) RE.UI.showMessage(C.MSG.PLAY_BLOCKED);
    else if (errCode === C.ERR.INTERRUPTED) RE.UI.showMessage(C.MSG.INTERRUPTED);
    else if (errCode === C.ERR.TOO_LONG) RE.UI.showMessage(RE.State.mode === C.MODE.TRIPLE ? C.MSG.TRIPLE_TOO_LONG : C.MSG.DOUBLE_TOO_LONG);
  }

  var swReg = null;
  var lastUpdateCheck = Date.now();

  function registerServiceWorker_() {
    if (!('serviceWorker' in navigator)) return;
    // 起動時にすでにサービスワーカーが働いていた場合だけ、「新しい版に切り替わった」を知らせる（初回は出さない）
    var hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (hadController) RE.UI.showUpdateBanner();
    });
    navigator.serviceWorker.register('./sw.js').then(function (reg) { swReg = reg; })
      .catch(function () { /* 登録できなくても動作は続ける */ });
  }

  /** 前面に戻ったとき、前回から UPDATE_CHECK_MIN_MS 以上たっていれば、新しい版がないか確認する */
  function checkUpdate_() {
    if (!swReg || Date.now() - lastUpdateCheck < C.UPDATE_CHECK_MIN_MS) return;
    lastUpdateCheck = Date.now();
    try { swReg.update().catch(function () { /* 無視 */ }); } catch (e) { /* 無視 */ }
  }

  function playableState_() {
    var St = RE.State;
    return (St.fileName || (St.mode !== C.MODE.SINGLE && St.fileNameB) || (St.mode === C.MODE.TRIPLE && St.fileNameC)) ? S.STOPPED : S.NO_FILE;
  }

  /** 現在位置の表示。再生に使っているスロットは実際の位置、もう一方は開始地点を出す */
  function refreshPosition_() {
    var St = RE.State;
    if (document.hidden || !anyFile_()) return;
    var act = RE.Engine.getActiveSlot();
    var pos = RE.Engine.getPositionSec();
    for (var i = 0; i < SLOTS.length; i++) {
      var sl = SLOTS[i];
      if (nm_(sl)) RE.UI.updatePosition(act === sl ? pos : st_(sl), sl);
    }
  }

  function setMetadata_() {
    var St = RE.State;
    var names = activeSlots_().map(nm_);
    var name = names.length > 1 ? names.join(' / ') : (names[0] || St.fileName || St.fileNameB || St.fileNameC);
    RE.MediaSession.setMetadata(name);
  }

  function applyMove_(n) {
    RE.State.moveSec = n;
    U.saveMoveSec(n);
    render_();   // 移動時間は区間・再生には影響しない（次の区間移動から反映）
  }

  /** 倍速で使う区間の長さの合計（シングル: A。ダブル: A+B） */
  function totalSectionSec_() {
    var t = 0;
    activeSlots_().forEach(function (sl) { t += en_(sl) - st_(sl); });
    return t;
  }

  /** 倍速中に区間の合計が長すぎる（STRETCH_MAX_SECTION_SEC超）なら、倍速を1.0に戻してメッセージを出す */
  function enforceRateLimit_() {
    var St = RE.State;
    if (St.rate !== C.RATE_DEFAULT && totalSectionSec_() > C.STRETCH_MAX_SECTION_SEC) {
      St.rate = C.RATE_DEFAULT;
      RE.Engine.setRate(C.RATE_DEFAULT);
      RE.UI.showMessage(C.MSG.RATE_RESET_LONG);
      return true;
    }
    return false;
  }

  function pushSection_(slot) {
    RE.Engine.setSection(st_(slot), en_(slot), slot);
  }

  /** 開始地点を変える（終了地点は変えない）。slot は 'A' か 'B' */
  function applyStart_(sec, slot) {
    var St = RE.State;
    setStart_(slot, sec);
    enforceRateLimit_();
    pushSection_(slot);
    if (St.playerState === S.PLAYING) RE.Engine.playFromStart(); else RE.Engine.stop();
    render_();
  }

  /** 終了地点を変える（開始地点・移動時間は変えない） */
  function applyEnd_(sec, slot) {
    var St = RE.State;
    setEnd_(slot, sec);
    enforceRateLimit_();
    pushSection_(slot);
    render_();
  }

  // ---- 区間メモ（v2.9）。配列の順＝画面の上から下（先頭＝最上部＝最新）----
  function memosOf_(slot) { var St = RE.State; return slot === 'C' ? St.memosC : (slot === 'B' ? St.memosB : St.memosA); }
  function keyOf_(slot) { var St = RE.State; return slot === 'C' ? St.fileKeyC : (slot === 'B' ? St.fileKeyB : St.fileKeyA); }
  function nameOf_(slot) { return nm_(slot); }

  /** ファイルを読み込めたとき: そのファイルの区間メモを端末内から読む（1件だけ。非同期。完了を待たずに操作できる） */
  function loadMemos_(slot, key) {
    RE.State.setMemos(slot, key, []);
    RE.Store.getMemos(key).then(function (items) {
      if (keyOf_(slot) !== key) return;     // その間にファイルが変わっていたら捨てる
      RE.State.setMemos(slot, key, items);
      RE.UI.render();
    });
  }

  /** 同じ音声を1つ目と2つ目の両方に読み込んでいるとき、もう一方のメモも同じ内容にする */
  function syncMemos_(slot) {
    var key = keyOf_(slot);
    if (!key) return;
    SLOTS.forEach(function (other) {
      if (other !== slot && keyOf_(other) === key) RE.State.setMemos(other, key, memosOf_(slot));
    });
  }

  /** 区間メモの変更を端末内へ保存し（そのファイルの1件だけ）、同じ音声のもう一方の欄にも反映する */
  function saveMemos_(slot) {
    RE.Store.putMemos(keyOf_(slot), nameOf_(slot), memosOf_(slot).slice());
    syncMemos_(slot);
  }

  /** 区間の記録が使えるか（0 <= s < e <= 全長） */
  function validSec_(sec, dur) {
    return !!sec && isFinite(sec.s) && isFinite(sec.e) && sec.s >= 0 && sec.e > sec.s && sec.e <= dur + 0.001;
  }

  /**
   * ファイルを読み込む。opts = { sec: 復元する区間 {s,e} | undefined, noSave: true なら保存し直さない, restore: true なら自動再開 }
   * 成功なら true、失敗・無効なら false を返す Promise。
   */
  function loadInto_(file, slot, opts) {
    opts = opts || {};
    var St = RE.State;
    var token = ++loadToken;
    busy++;
    RE.UI.showMessage(C.MSG.FILE_LOADING);
    resetSlot_(slot);
    St.playerState = playableState_();
    RE.UI.render();
    return RE.Engine.loadFile(file, slot).then(function (r) {
      busy--;
      if (token !== loadToken) return false;
      setFileOf_(slot, file.name, r.durationSec);
      if (validSec_(opts.sec, r.durationSec)) setSec_(slot, opts.sec.s, opts.sec.e);
      if (r.monoApplied) RE.UI.showMessage(C.MSG.TRIPLE_MONO_NOTICE);
      if (slot === 'A') RE.Engine.setRate(St.rate);
      pushSection_(slot);
      enforceRateLimit_();
      St.playerState = S.STOPPED;
      if (!r.monoApplied) RE.UI.clearMessage();
      loadMemos_(slot, U.makeFileKey(file));
      render_();
      setMetadata_();
      RE.MediaSession.register();
      RE.MediaSession.setPlaybackState(S.STOPPED);
      if (!opts.noSave) RE.Store.saveFile(slot, file);
      return true;
    }).catch(function () {
      busy--;
      if (token !== loadToken) return false;
      resetSlot_(slot);
      St.playerState = playableState_();
      RE.UI.showMessage(opts.restore ? C.MSG.RESTORE_FAILED : C.MSG.FILE_ERROR);
      render_();
      if (opts.restore) RE.Store.clearSlot(slot);
      return false;
    });
  }

  function readBlob_(blob) {
    if (blob.arrayBuffer) return blob.arrayBuffer();
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () { resolve(fr.result); };
      fr.onerror = function () { reject(fr.error); };
      fr.readAsArrayBuffer(blob);
    });
  }

  function setRestoreFlag_(on) {
    try {
      if (on) window.localStorage.setItem(C.STORAGE_KEY_RESTORING, '1');
      else window.localStorage.removeItem(C.STORAGE_KEY_RESTORING);
    } catch (e) { /* 無視 */ }
  }

  /**
   * 前回のファイル・区間を自動で読み込む（安全設計）。
   * ・前回の自動再開が途中で止まっていた（印が残っている）場合は、やらずに記録を消す（強制終了のくり返しを防ぐ）。
   * ・保存が無い／読み出せない／ファイルが壊れている場合は、何もしない、またはメッセージを出して⏏に任せる。
   * ・本人が先にファイルを選んだら、自動再開は打ち切る。
   */
  function restoreLast_() {
    var flag = null;
    try { flag = window.localStorage.getItem(C.STORAGE_KEY_RESTORING); } catch (e) { /* 無視 */ }
    if (flag === '1') {
      setRestoreFlag_(false);
      RE.Store.clearAll();
      RE.UI.showMessage(C.MSG.RESTORE_SKIPPED);
      return;
    }
    RE.Store.loadAll().then(function (d) {
      if (userTouched || !d || (!d.A && !d.B && !d.C)) return;
      var meta = d.meta || {};
      var St = RE.State;
      var tri = meta.mode === C.MODE.TRIPLE && !!d.B;
      var dbl = (meta.mode === C.MODE.DOUBLE || tri) && !!d.B;   // 再生ON/OFFの記録（旧モードの記録をそのまま読む）
      restoring = true;
      setRestoreFlag_(true);
      if (tri) { St.mode = C.MODE.TRIPLE; RE.Engine.setMode(St.mode); }
      else if (dbl) { St.mode = C.MODE.DOUBLE; RE.Engine.setMode(St.mode); }
      function wrap(rec) { return { name: rec.name, size: rec.blob.size, arrayBuffer: function () { return readBlob_(rec.blob); } }; }
      function step(rec, slot) {
        if (userTouched || !rec || !rec.blob) return Promise.resolve(true);
        return loadInto_(wrap(rec), slot, { sec: meta[slot], noSave: true, restore: true });
      }
      return step(d.A, 'A').then(function (okA) {
        return okA || !d.A ? step(d.B, 'B') : false;
      }).then(function (okB) {
        return okB ? step(d.C, 'C') : false;
      }).then(function () {
        restoring = false;
        setRestoreFlag_(false);
        render_();
      });
    }).catch(function () {
      restoring = false;
      setRestoreFlag_(false);
    });
  }

  var lastRemoteAt = 0;

  /** 外部操作の連打（同じボタンで2回届く機器がある）を無視する */
  function remoteAllowed_() {
    var now = Date.now();
    if (now - lastRemoteAt < C.REMOTE_DEBOUNCE_MS) return false;
    lastRemoteAt = now;
    return true;
  }

  /** 外部（ロック画面・イヤホン・インカム）からの再生／一時停止。実際の状態で切り替える */
  function remoteToggle_() {
    if (RE.State.playerState === S.NO_FILE || !remoteAllowed_()) return;
    if (RE.State.playerState === S.PLAYING) RE.Engine.pause(); else RE.Engine.play();
  }

  var handlers = {
    onEject: function () { RE.UI.openFilePicker(); },

    /** 更新のお知らせ帯のタップ: 再読み込みして新しい版にする */
    onUpdateTap: function () { location.reload(); },

    onEjectB: function () { RE.UI.openFilePickerB(); },

    onEjectC: function () { RE.UI.openFilePickerC(); },

    onFileSelected: function (file) { userTouched = true; loadInto_(file, 'A'); },

    onFileSelectedB: function (file) { userTouched = true; loadInto_(file, 'B'); },

    onFileSelectedC: function (file) { userTouched = true; loadInto_(file, 'C'); },

    /** 2つ目・3つ目の「再生ON／OFF」。ONにすると、旧2区間モード（2つ目）／旧3区間モード（3つ目：2つ目も同時にON）と同じ状態。再生は止まる */
    onPlayToggle: function (slot) {
      var St = RE.State;
      userTouched = true;
      if (slot === 'B') St.mode = St.mode === C.MODE.SINGLE ? C.MODE.DOUBLE : C.MODE.SINGLE;
      else St.mode = St.mode === C.MODE.TRIPLE ? C.MODE.DOUBLE : C.MODE.TRIPLE;
      var mr = RE.Engine.setMode(St.mode);
      St.playerState = playableState_();
      RE.UI.clearMessage();
      if (mr && mr.monoApplied) RE.UI.showMessage(C.MSG.TRIPLE_MONO_NOTICE);
      enforceRateLimit_();
      render_();
      if (anyFile_()) { setMetadata_(); RE.MediaSession.setPlaybackState(St.playerState); }
    },

    /** 下のタブ（仕様 4.3.8）。再生は止めない。スクロール位置はタブごとに覚える */
    onTab: function (name) {
      var St = RE.State;
      if (['play', 'edit', 'memo', 'settings'].indexOf(name) < 0 || name === St.tab) return;
      St.tabScroll[St.tab] = window.scrollY || 0;
      St.tab = name;
      RE.UI.render();
      window.scrollTo(0, St.tabScroll[name] || 0);
    },

    onPlayPause: function () {
      if (RE.State.playerState === S.NO_FILE) { RE.UI.showMessage(C.MSG.NO_FILE_SELECTED); return; }
      RE.UI.clearMessage();
      if (RE.State.playerState === S.PLAYING) RE.Engine.pause(); else RE.Engine.play();
    },

    onStop: function () {
      if (RE.State.playerState === S.NO_FILE) return;
      RE.UI.clearMessage();
      RE.Engine.stop();
    },

    /** 全範囲: そのパネルの区間を 00:00〜ファイルの終わり にする（他のパネルは変えない） */
    onSelectAll: function (slot) {
      var St = RE.State;
      if (!nm_(slot)) return;
      setSec_(slot, 0, du_(slot));
      enforceRateLimit_();
      pushSection_(slot);
      render_();
      if (St.playerState === S.PLAYING) RE.Engine.playFromStart(); else if (St.playerState !== S.NO_FILE) RE.Engine.stop();
    },

    /** 区間移動: 開始・終了の両方を stepSec（移動時間−1秒）だけ進め、再生する。ダブルモードでは両方の区間を同時に進める */
    onNext: function () {
      var St = RE.State;
      if (St.playerState === S.NO_FILE) { RE.UI.showMessage(C.MSG.NO_FILE_SELECTED); return; }
      var step = U.calcStepSec(St.moveSec);
      var act = activeSlots_();
      var atEnd = act.some(function (sl) { return en_(sl) >= du_(sl) || st_(sl) + step >= du_(sl); });
      if (atEnd) { RE.UI.showMessage(C.MSG.REACHED_END); return; }
      act.forEach(function (sl) { setSec_(sl, st_(sl) + step, Math.min(en_(sl) + step, du_(sl))); pushSection_(sl); });
      RE.UI.clearMessage();
      render_();
      RE.Engine.playFromStart();
    },

    /** 前の区間へ戻る: 開始・終了を stepSec だけ戻して再生する。2区間モードでは両方を同じだけ戻す */
    onPrev: function () {
      var St = RE.State;
      if (St.playerState === S.NO_FILE) { RE.UI.showMessage(C.MSG.NO_FILE_SELECTED); return; }
      var act = activeSlots_();
      var delta = U.calcStepSec(St.moveSec);
      act.forEach(function (sl) { delta = Math.min(delta, st_(sl)); });
      if (!(delta > 0)) { RE.UI.showMessage(C.MSG.REACHED_START); return; }
      act.forEach(function (sl) { setSec_(sl, st_(sl) - delta, en_(sl) - delta); pushSection_(sl); });
      RE.UI.clearMessage();
      render_();
      RE.Engine.playFromStart();
    },

    /** 「ここを開始／終了」: 今鳴っている位置を、そのスロットの開始／終了地点にする */
    onMark: function (slot, which) {
      var St = RE.State;
      if (!nm_(slot)) return;
      if (St.playerState !== S.PLAYING && St.playerState !== S.PAUSED) { RE.UI.showMessage(C.MSG.MARK_NEED_PLAY); return; }
      if (RE.Engine.getActiveSlot() !== slot) { RE.UI.showMessage(C.MSG.MARK_OTHER_SLOT); return; }
      var pos = RE.Engine.getPositionSec();
      var s0 = st_(slot), e0 = en_(slot), dur = du_(slot);
      RE.UI.clearMessage();
      if (which === 'start') {
        var n = U.clamp(Math.floor(pos), 0, Math.max(Math.ceil(e0) - 1, 0));
        if (n !== s0) applyStart_(n, slot);
      } else {
        var m = U.clamp(Math.ceil(pos), s0 + 1, dur);
        if (m !== e0) applyEnd_(m, slot);
      }
    },

    /** 繰り返しの間の無音（秒）を選ぶ。再生中なら、今の位置から切り替わる */
    onGapSelect: function (g) {
      var St = RE.State;
      if (St.playerState === S.NO_FILE) { RE.UI.showMessage(C.MSG.NO_FILE_SELECTED); return; }
      St.gapSec = g;
      U.saveGapSec(g);
      RE.Engine.setGap(g);
      RE.UI.clearMessage();
      render_();
    },

    /** 開始地点の桁の ▲▼（スロット別）。deltaSec = ±600／±60／±10／±1。範囲の端では端の値に止める */
    onStartStepSlot: function (slot, deltaSec) {
      if (!nm_(slot)) return;
      var maxStart = Math.ceil(en_(slot)) - 1;
      var n = U.clamp(st_(slot) + deltaSec, 0, Math.max(maxStart, 0));
      if (n === st_(slot)) return;
      RE.UI.clearMessage();
      applyStart_(n, slot);
    },

    /** 終了地点の桁の ▲▼（スロット別）。開始地点・移動時間は変わらない */
    onEndStepSlot: function (slot, deltaSec) {
      if (!nm_(slot)) return;
      var n = U.clamp(Math.floor(en_(slot)) + deltaSec, st_(slot) + 1, du_(slot));
      if (n === en_(slot)) return;
      RE.UI.clearMessage();
      applyEnd_(n, slot);
    },

    onStartStep: function (d) { handlers.onStartStepSlot('A', d); },
    onEndStep: function (d) { handlers.onEndStepSlot('A', d); },
    onStartStepB: function (d) { handlers.onStartStepSlot('B', d); },
    onEndStepB: function (d) { handlers.onEndStepSlot('B', d); },
    onStartStepC: function (d) { handlers.onStartStepSlot('C', d); },
    onEndStepC: function (d) { handlers.onEndStepSlot('C', d); },

    /** 区間保存: 今の開始・終了を、区間メモの最上部に加える。10件を超えたら最下部の1件を消す */
    onMemoSave: function (slot) {
      var St = RE.State;
      if (!nm_(slot) || !keyOf_(slot)) return;
      var list = memosOf_(slot);
      var s0 = st_(slot), e0 = en_(slot);
      for (var i = 0; i < list.length; i++) {
        if (list[i].s === s0 && list[i].e === e0) { RE.UI.showMessage(C.MSG.MEMO_DUP); return; }
      }
      list.unshift({ id: U.makeMemoId(), s: s0, e: e0, savedAt: Date.now() });
      var replaced = false;
      while (list.length > C.MEMO_MAX_PER_FILE) { list.pop(); replaced = true; }
      saveMemos_(slot);
      render_();
      RE.UI.showMessage(replaced ? C.MSG.MEMO_REPLACED : C.MSG.MEMO_SAVED);
    },

    /** 区間メモをタップ: その区間を開始・終了に反映し、その区間だけを単独でくり返し再生する（v3.1.5） */
    onMemoTap: function (slot, id) {
      var St = RE.State;
      if (!nm_(slot)) return;
      var m = null, list = memosOf_(slot);
      for (var i = 0; i < list.length; i++) { if (list[i].id === id) m = list[i]; }
      if (!m) return;
      var dur = du_(slot);
      var newStart = m.s, newEnd = Math.min(m.e, dur);
      if (newStart >= dur - 0.001 || newEnd <= newStart) { RE.UI.showMessage(C.MSG.MEMO_OUT_OF_RANGE); return; }
      setSec_(slot, newStart, newEnd);
      enforceRateLimit_();
      pushSection_(slot);
      RE.UI.clearMessage();
      render_();
      RE.Engine.playSolo(slot);   // v3.1.5: そのメモの区間だけを単独でくり返す（他のスロットへ移らない）
      RE.UI.showMessage(C.MSG.MEMO_SOLO);
    },

    /** 言語の切り替え（v3.2.0）。value は "auto"・"ja"・"en"・"es"・"fil"。選びは端末に保存し、画面を書き直す */
    onLangChange: function (value) {
      RE.I18n.setPref(value);
      RE.UI.clearMessage();
      RE.UI.refreshLanguage();
    },

    /** 区間メモの名前を付ける・変える（v3.1.6）。名前の部分のタップで呼ばれる（v3.1.7）。キャンセルなら何もしない。空欄なら名前を消す */
    onMemoRename: function (slot, id) {
      var list = memosOf_(slot), m = null, i;
      for (i = 0; i < list.length; i++) { if (list[i].id === id) m = list[i]; }
      if (!m) return;
      var v;
      try { v = window.prompt(C.MSG.MEMO_NAME_PROMPT, m.name || ''); } catch (e) { return; }
      if (v === null || v === undefined) return;
      v = Array.from(String(v).replace(/[\r\n]+/g, ' ').trim()).slice(0, C.MEMO_NAME_MAX).join('');
      if (v) m.name = v; else delete m.name;
      saveMemos_(slot);
      render_();
    },

    /** 区間メモの削除（確認なし・元に戻せない） */
    onMemoDelete: function (slot, id) {
      var list = memosOf_(slot);
      for (var i = 0; i < list.length; i++) {
        if (list[i].id === id) {
          list.splice(i, 1);
          saveMemos_(slot);
          RE.UI.clearMessage();
          render_();
          return;
        }
      }
    },

    /** 区間メモの並べ替え（「≡」のドラッグ）。fromIndex の1件を toIndex の位置へ。区間・再生は変えない */
    onMemoMove: function (slot, fromIndex, toIndex) {
      var list = memosOf_(slot);
      var n = list.length;
      if (fromIndex < 0 || fromIndex >= n || toIndex < 0 || toIndex >= n || fromIndex === toIndex) return;
      var item = list.splice(fromIndex, 1)[0];
      list.splice(toIndex, 0, item);
      saveMemos_(slot);
      render_();
    },

    /** 倍速ボタン: その倍速で、開始地点から区間ループ再生を始める（再生ボタン不要） */
    onRateSelect: function (rate) {
      var St = RE.State;
      if (St.playerState === S.NO_FILE) { RE.UI.showMessage(C.MSG.NO_FILE_SELECTED); return; }
      if (rate !== C.RATE_DEFAULT && totalSectionSec_() > C.STRETCH_MAX_SECTION_SEC) { RE.UI.showMessage(C.MSG.RATE_TOO_LONG); return; }
      St.rate = rate;
      RE.Engine.setRate(rate);
      RE.UI.clearMessage();
      render_();
      RE.Engine.playFromStart();
    },

    onMoveCommitted: function (text) {
      if (RE.State.playerState === S.NO_FILE) return;
      var raw = String(text).trim();
      var n = Math.round(Number(raw));
      if (raw === '' || !isFinite(Number(raw))) {
        RE.UI.showMessage(C.MSG.MOVE_SEC_INVALID);
        render_();
        return;
      }
      var clamped = U.clamp(n, C.MOVE_SEC_MIN, C.MOVE_SEC_MAX);
      if (clamped !== n) RE.UI.showMessage(C.MSG.MOVE_SEC_CLAMPED); else RE.UI.clearMessage();
      applyMove_(clamped);
    },

    /** −／＋ボタン。範囲の端で止まる（メッセージは出さない） */
    onMoveStep: function (delta) {
      if (RE.State.playerState === S.NO_FILE) return;
      var n = U.clamp(RE.State.moveSec + delta, C.MOVE_SEC_MIN, C.MOVE_SEC_MAX);
      if (n === RE.State.moveSec) return;
      RE.UI.clearMessage();
      applyMove_(n);
    }
  };

  function start() {
    RE.State.init();
    RE.UI.init(handlers);
    RE.Engine.init({ onStateChange: onEngineStateChange_, onError: onEngineError_ });
    RE.Engine.setGap(RE.State.gapSec);
    RE.Store.requestPersist();
    RE.MediaSession.init({
      // イヤホン・インカムのボタンは「再生／一時停止」を1つで兼ねる。iOSが現在の状態を取り違えて
      // 逆の命令を送ってくることがあるため、命令の名前ではなく、アプリの実際の状態で切り替える（v1.9）。
      onPlay: function () { remoteToggle_(); },
      onPause: function () { remoteToggle_(); },
      // ロック画面・イヤホンの「停止」は、再生中なら一時停止として扱う（完全に止めると再生ボタンが届かなくなるため）
      onStop: function () {
        if (!remoteAllowed_()) return;
        if (RE.State.playerState === S.PLAYING) RE.Engine.pause(); else RE.Engine.stop();
      },
      onNext: function () { handlers.onNext(); }
    });
    render_();
    registerServiceWorker_();
    restoreLast_();
    setInterval(refreshPosition_, C.UI_REFRESH_MS);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) { refreshPosition_(); render_(); checkUpdate_(); }
    });
  }

  RE.Main = { start: start, handlers: handlers };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
