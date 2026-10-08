/* js/main.js / 起動処理・各操作の司令塔（RE.Main） / 仕様書 v1.1 5.3・9.6章 / 版 1.8.0 */
(function () {
  'use strict';
  var C = RE.Config;
  var S = C.PLAYER_STATE;
  var U = RE.Utils;
  var loadToken = 0;

  function onEngineStateChange_(state) {
    // ファイル読込中に届く状態通知は無視する（画面と State の食い違いを防ぐ）
    if (!RE.State.fileName && !RE.State.fileNameB && state !== S.NO_FILE) return;
    RE.State.playerState = state;
    RE.UI.render();
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
    RE.UI.render();   // 移動時間は区間・再生には影響しない（次の区間移動から反映）
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
    RE.UI.render();
  }

  /** 終了地点を変える（開始地点・移動時間は変えない） */
  function applyEnd_(sec, slot) {
    var St = RE.State;
    if (slot === 'B') St.endSecB = sec; else St.endSec = sec;
    enforceRateLimit_();
    pushSection_(slot);
    RE.UI.render();
  }

  function loadInto_(file, slot) {
    var St = RE.State;
    var token = ++loadToken;
    RE.UI.showMessage(C.MSG.FILE_LOADING);
    if (slot === 'B') St.resetB(); else St.resetA();
    St.playerState = playableState_();
    RE.UI.render();
    RE.Engine.loadFile(file, slot).then(function (r) {
      if (token !== loadToken) return;
      if (slot === 'B') St.setFileB(file.name, r.durationSec); else St.setFile(file.name, r.durationSec);
      if (slot === 'A') RE.Engine.setRate(St.rate);
      pushSection_(slot);
      enforceRateLimit_();
      St.playerState = S.STOPPED;
      RE.UI.clearMessage();
      RE.UI.render();
      setMetadata_();
      RE.MediaSession.register();
      RE.MediaSession.setPlaybackState(S.STOPPED);
    }).catch(function () {
      if (token !== loadToken) return;
      if (slot === 'B') St.resetB(); else St.resetA();
      St.playerState = playableState_();
      RE.UI.showMessage(C.MSG.FILE_ERROR);
      RE.UI.render();
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

    onFileSelected: function (file) { loadInto_(file, 'A'); },

    onFileSelectedB: function (file) { loadInto_(file, 'B'); },

    /** シングル⇔ダブルの切り替え。再生は止まる。2つ目のファイルは切り替えても残す */
    onModeToggle: function () {
      var St = RE.State;
      St.mode = St.mode === C.MODE.DOUBLE ? C.MODE.SINGLE : C.MODE.DOUBLE;
      RE.Engine.setMode(St.mode);
      St.playerState = playableState_();
      RE.UI.clearMessage();
      enforceRateLimit_();
      RE.UI.render();
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
      RE.UI.render();
      RE.Engine.playFromStart();
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
      RE.UI.render();
      RE.Engine.playFromStart();
    },

    onMoveCommitted: function (text) {
      if (RE.State.playerState === S.NO_FILE) return;
      var raw = String(text).trim();
      var n = Math.round(Number(raw));
      if (raw === '' || !isFinite(Number(raw))) {
        RE.UI.showMessage(C.MSG.MOVE_SEC_INVALID);
        RE.UI.render();
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
    RE.UI.render();
    registerServiceWorker_();
    setInterval(refreshPosition_, C.UI_REFRESH_MS);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) { refreshPosition_(); RE.UI.render(); checkUpdate_(); }
    });
  }

  RE.Main = { start: start, handlers: handlers };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
