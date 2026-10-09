/* js/main.js / 起動処理・各操作の司令塔（RE.Main） / 仕様書 v2.8.2 5.3・9.6章 / 版 2.8.2 */
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

  function persist_() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      var St = RE.State;
      if (busy > 0 || restoring || (!St.fileName && !St.fileNameB)) return;
      RE.Store.saveMeta({
        mode: St.mode,
        A: St.fileName ? { s: St.startSec, e: St.endSec } : null,
        B: St.fileNameB ? { s: St.startSecB, e: St.endSecB } : null,
        savedAt: Date.now()
      });
    }, 400);
  }

  function onEngineStateChange_(state) {
    // ファイル読込中に届く状態通知は無視する（画面と State の食い違いを防ぐ）
    if (!RE.State.fileName && !RE.State.fileNameB && state !== S.NO_FILE) return;
    RE.State.playerState = state;
    render_();
    if (state === S.PLAYING) RE.MediaSession.register();
    RE.MediaSession.setPlaybackState(state);
  }

  function onEngineError_(errCode) {
    if (errCode === C.ERR.PLAY_BLOCKED) RE.UI.showMessage(C.MSG.PLAY_BLOCKED);
    else if (errCode === C.ERR.INTERRUPTED) RE.UI.showMessage(C.MSG.INTERRUPTED);
    else if (errCode === C.ERR.TOO_LONG) RE.UI.showMessage(C.MSG.DOUBLE_TOO_LONG);
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
    return (St.fileName || (St.mode === C.MODE.DOUBLE && St.fileNameB)) ? S.STOPPED : S.NO_FILE;
  }

  /** 現在位置の表示。再生に使っているスロットは実際の位置、もう一方は開始地点を出す */
  function refreshPosition_() {
    var St = RE.State;
    if (document.hidden || (!St.fileName && !St.fileNameB)) return;
    var act = RE.Engine.getActiveSlot();
    var pos = RE.Engine.getPositionSec();
    if (St.fileName) RE.UI.updatePosition(act === 'A' ? pos : St.startSec, 'A');
    if (St.fileNameB) RE.UI.updatePosition(act === 'B' ? pos : St.startSecB, 'B');
  }

  function setMetadata_() {
    var St = RE.State;
    var name = St.mode === C.MODE.DOUBLE && St.fileName && St.fileNameB ? St.fileName + ' / ' + St.fileNameB : (St.fileName || St.fileNameB);
    RE.MediaSession.setMetadata(name);
  }

  function applyMove_(n) {
    RE.State.moveSec = n;
    U.saveMoveSec(n);
    render_();   // 移動時間は区間・再生には影響しない（次の区間移動から反映）
  }

  /** 倍速で使う区間の長さの合計（シングル: A。ダブル: A+B） */
  function totalSectionSec_() {
    var St = RE.State, t = 0;
    if (St.fileName) t += St.endSec - St.startSec;
    if (St.mode === C.MODE.DOUBLE && St.fileNameB) t += St.endSecB - St.startSecB;
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
    var St = RE.State;
    if (slot === 'B') RE.Engine.setSection(St.startSecB, St.endSecB, 'B');
    else RE.Engine.setSection(St.startSec, St.endSec, 'A');
  }

  /** 開始地点を変える（終了地点は変えない）。slot は 'A' か 'B' */
  function applyStart_(sec, slot) {
    var St = RE.State;
    if (slot === 'B') St.startSecB = sec; else St.startSec = sec;
    enforceRateLimit_();
    pushSection_(slot);
    if (St.playerState === S.PLAYING) RE.Engine.playFromStart(); else RE.Engine.stop();
    render_();
  }

  /** 終了地点を変える（開始地点・移動時間は変えない） */
  function applyEnd_(sec, slot) {
    var St = RE.State;
    if (slot === 'B') St.endSecB = sec; else St.endSec = sec;
    enforceRateLimit_();
    pushSection_(slot);
    render_();
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
    if (slot === 'B') St.resetB(); else St.resetA();
    St.playerState = playableState_();
    RE.UI.render();
    return RE.Engine.loadFile(file, slot).then(function (r) {
      busy--;
      if (token !== loadToken) return false;
      if (slot === 'B') St.setFileB(file.name, r.durationSec); else St.setFile(file.name, r.durationSec);
      if (validSec_(opts.sec, r.durationSec)) {
        if (slot === 'B') { St.startSecB = opts.sec.s; St.endSecB = opts.sec.e; }
        else { St.startSec = opts.sec.s; St.endSec = opts.sec.e; }
      }
      if (slot === 'A') RE.Engine.setRate(St.rate);
      pushSection_(slot);
      enforceRateLimit_();
      St.playerState = S.STOPPED;
      RE.UI.clearMessage();
      render_();
      setMetadata_();
      RE.MediaSession.register();
      RE.MediaSession.setPlaybackState(S.STOPPED);
      if (!opts.noSave) RE.Store.saveFile(slot, file);
      return true;
    }).catch(function () {
      busy--;
      if (token !== loadToken) return false;
      if (slot === 'B') St.resetB(); else St.resetA();
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
      if (userTouched || !d || (!d.A && !d.B)) return;
      var meta = d.meta || {};
      var St = RE.State;
      var dbl = meta.mode === C.MODE.DOUBLE && !!d.B;
      restoring = true;
      setRestoreFlag_(true);
      if (dbl) { St.mode = C.MODE.DOUBLE; RE.Engine.setMode(St.mode); }
      function wrap(rec) { return { name: rec.name, arrayBuffer: function () { return readBlob_(rec.blob); } }; }
      function step(rec, slot) {
        if (userTouched || !rec || !rec.blob) return Promise.resolve(true);
        return loadInto_(wrap(rec), slot, { sec: meta[slot], noSave: true, restore: true });
      }
      return step(d.A, 'A').then(function (okA) {
        return okA ? step(dbl ? d.B : null, 'B') : false;
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

    onFileSelected: function (file) { userTouched = true; loadInto_(file, 'A'); },

    onFileSelectedB: function (file) { userTouched = true; loadInto_(file, 'B'); },

    /** シングル⇔ダブルの切り替え。再生は止まる。2つ目のファイルは切り替えても残す */
    onModeToggle: function () {
      var St = RE.State;
      userTouched = true;
      St.mode = St.mode === C.MODE.DOUBLE ? C.MODE.SINGLE : C.MODE.DOUBLE;
      RE.Engine.setMode(St.mode);
      St.playerState = playableState_();
      RE.UI.clearMessage();
      enforceRateLimit_();
      render_();
      if (St.fileName || St.fileNameB) { setMetadata_(); RE.MediaSession.setPlaybackState(St.playerState); }
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

    /** 全範囲選択: 読み込まれているスロット（ダブルモードならA・B）を 00:00〜ファイルの終わり にする */
    onSelectAll: function () {
      var St = RE.State;
      if (St.playerState === S.NO_FILE) return;
      var useA = !!St.fileName, useB = St.mode === C.MODE.DOUBLE && !!St.fileNameB;
      if (useA) { St.startSec = 0; St.endSec = St.durationSec; }
      if (useB) { St.startSecB = 0; St.endSecB = St.durationSecB; }
      enforceRateLimit_();
      if (useA) pushSection_('A');
      if (useB) pushSection_('B');
      render_();
      if (St.playerState === S.PLAYING) RE.Engine.playFromStart(); else RE.Engine.stop();
    },

    /** 区間移動: 開始・終了の両方を stepSec（移動時間−1秒）だけ進め、再生する。ダブルモードでは両方の区間を同時に進める */
    onNext: function () {
      var St = RE.State;
      if (St.playerState === S.NO_FILE) { RE.UI.showMessage(C.MSG.NO_FILE_SELECTED); return; }
      var step = U.calcStepSec(St.moveSec);
      var useA = !!St.fileName, useB = St.mode === C.MODE.DOUBLE && !!St.fileNameB;
      if ((useA && (St.endSec >= St.durationSec || St.startSec + step >= St.durationSec)) ||
          (useB && (St.endSecB >= St.durationSecB || St.startSecB + step >= St.durationSecB))) {
        RE.UI.showMessage(C.MSG.REACHED_END); return;
      }
      if (useA) { St.startSec += step; St.endSec = Math.min(St.endSec + step, St.durationSec); pushSection_('A'); }
      if (useB) { St.startSecB += step; St.endSecB = Math.min(St.endSecB + step, St.durationSecB); pushSection_('B'); }
      RE.UI.clearMessage();
      render_();
      RE.Engine.playFromStart();
    },

    /** 前の区間へ戻る: 開始・終了を stepSec だけ戻して再生する。2区間モードでは両方を同じだけ戻す */
    onPrev: function () {
      var St = RE.State;
      if (St.playerState === S.NO_FILE) { RE.UI.showMessage(C.MSG.NO_FILE_SELECTED); return; }
      var useA = !!St.fileName, useB = St.mode === C.MODE.DOUBLE && !!St.fileNameB;
      var delta = U.calcStepSec(St.moveSec);
      if (useA) delta = Math.min(delta, St.startSec);
      if (useB) delta = Math.min(delta, St.startSecB);
      if (!(delta > 0)) { RE.UI.showMessage(C.MSG.REACHED_START); return; }
      if (useA) { St.startSec -= delta; St.endSec -= delta; pushSection_('A'); }
      if (useB) { St.startSecB -= delta; St.endSecB -= delta; pushSection_('B'); }
      RE.UI.clearMessage();
      render_();
      RE.Engine.playFromStart();
    },

    /** 「ここを開始／終了」: 今鳴っている位置を、そのスロットの開始／終了地点にする */
    onMark: function (slot, which) {
      var St = RE.State;
      var isB = slot === 'B';
      if (!(isB ? St.fileNameB : St.fileName)) return;
      if (St.playerState !== S.PLAYING && St.playerState !== S.PAUSED) { RE.UI.showMessage(C.MSG.MARK_NEED_PLAY); return; }
      if (RE.Engine.getActiveSlot() !== slot) { RE.UI.showMessage(C.MSG.MARK_OTHER_SLOT); return; }
      var pos = RE.Engine.getPositionSec();
      var s0 = isB ? St.startSecB : St.startSec, e0 = isB ? St.endSecB : St.endSec, dur = isB ? St.durationSecB : St.durationSec;
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

    /** 開始地点の桁の ▲▼。deltaSec = ±600／±60／±10／±1。範囲の端では端の値に止める */
    onStartStep: function (deltaSec) {
      var St = RE.State;
      if (!St.fileName) return;
      var maxStart = Math.ceil(St.endSec) - 1;
      var n = U.clamp(St.startSec + deltaSec, 0, Math.max(maxStart, 0));
      if (n === St.startSec) return;
      RE.UI.clearMessage();
      applyStart_(n, 'A');
    },

    /** 終了地点の桁の ▲▼。開始地点・移動時間は変わらない */
    onEndStep: function (deltaSec) {
      var St = RE.State;
      if (!St.fileName) return;
      var n = U.clamp(Math.floor(St.endSec) + deltaSec, St.startSec + 1, St.durationSec);
      if (n === St.endSec) return;
      RE.UI.clearMessage();
      applyEnd_(n, 'A');
    },

    onStartStepB: function (deltaSec) {
      var St = RE.State;
      if (!St.fileNameB) return;
      var maxStart = Math.ceil(St.endSecB) - 1;
      var n = U.clamp(St.startSecB + deltaSec, 0, Math.max(maxStart, 0));
      if (n === St.startSecB) return;
      RE.UI.clearMessage();
      applyStart_(n, 'B');
    },

    onEndStepB: function (deltaSec) {
      var St = RE.State;
      if (!St.fileNameB) return;
      var n = U.clamp(Math.floor(St.endSecB) + deltaSec, St.startSecB + 1, St.durationSecB);
      if (n === St.endSecB) return;
      RE.UI.clearMessage();
      applyEnd_(n, 'B');
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
