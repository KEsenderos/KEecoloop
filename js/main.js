/* js/main.js / 起動処理・各操作の司令塔（RE.Main） / 仕様書 v1.1 5.3・9.6章 / 版 1.4.1 */
(function () {
  'use strict';
  var C = RE.Config;
  var S = C.PLAYER_STATE;
  var U = RE.Utils;
  var loadToken = 0;

  function onEngineStateChange_(state) {
    // ファイル読込中に届く状態通知は無視する（画面と State の食い違いを防ぐ）
    if (!RE.State.fileName && state !== S.NO_FILE) return;
    RE.State.playerState = state;
    RE.UI.render();
    if (state === S.PLAYING) RE.MediaSession.register();
    RE.MediaSession.setPlaybackState(state);
  }

  function onEngineError_(errCode) {
    if (errCode === C.ERR.PLAY_BLOCKED) RE.UI.showMessage(C.MSG.PLAY_BLOCKED);
    else if (errCode === C.ERR.INTERRUPTED) RE.UI.showMessage(C.MSG.INTERRUPTED);
  }

  function registerServiceWorker_() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('./sw.js').catch(function () { /* 登録できなくても動作は続ける */ });
  }

  function refreshPosition_() {
    if (document.hidden || !RE.State.fileName) return;
    RE.UI.updatePosition(RE.Engine.getPositionSec());
  }

  function applyMove_(n) {
    RE.State.moveSec = n;
    U.saveMoveSec(n);
    RE.UI.render();   // 移動時間は区間・再生には影響しない（次の区間移動から反映）
  }

  /** 開始地点を変える（終了地点は変えない） */
  function applyStart_(sec) {
    var St = RE.State;
    St.startSec = sec;
    RE.Engine.setSection(St.startSec, St.endSec);
    if (St.playerState === S.PLAYING) RE.Engine.playFromStart(); else RE.Engine.stop();
    RE.UI.render();
  }

  /** 終了地点を変える（開始地点・移動時間は変えない） */
  function applyEnd_(sec) {
    var St = RE.State;
    St.endSec = sec;
    RE.Engine.setSection(St.startSec, St.endSec);
    RE.UI.render();
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

    onFileSelected: function (file) {
      var token = ++loadToken;
      RE.UI.showMessage(C.MSG.FILE_LOADING);
      RE.State.init();
      RE.UI.render();
      RE.Engine.loadFile(file).then(function (r) {
        if (token !== loadToken) return;
        RE.State.setFile(file.name, r.durationSec);
        RE.Engine.setSection(RE.State.startSec, RE.State.endSec);
        RE.State.playerState = S.STOPPED;
        RE.UI.clearMessage();
        RE.UI.render();
        RE.MediaSession.setMetadata(file.name);
        RE.MediaSession.register();
        RE.MediaSession.setPlaybackState(S.STOPPED);
      }).catch(function () {
        if (token !== loadToken) return;
        RE.State.init();
        RE.UI.showMessage(C.MSG.FILE_ERROR);
        RE.UI.render();
      });
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

    /** 区間移動: 開始地点と終了地点の両方を stepSec（移動時間−1秒）だけ進め、その区間を再生する */
    onNext: function () {
      var St = RE.State;
      if (St.playerState === S.NO_FILE) { RE.UI.showMessage(C.MSG.NO_FILE_SELECTED); return; }
      var step = U.calcStepSec(St.moveSec);
      var newStart = St.startSec + step;
      if (St.endSec >= St.durationSec || newStart >= St.durationSec) { RE.UI.showMessage(C.MSG.REACHED_END); return; }
      St.startSec = newStart;
      St.endSec = Math.min(St.endSec + step, St.durationSec);
      RE.Engine.setSection(St.startSec, St.endSec);
      RE.UI.clearMessage();
      RE.UI.render();
      RE.Engine.playFromStart();
    },

    /** 開始地点の桁の ▲▼。deltaSec = ±600／±60／±10／±1。範囲の端では端の値に止める */
    onStartStep: function (deltaSec) {
      var St = RE.State;
      if (St.playerState === S.NO_FILE) return;
      var maxStart = Math.ceil(St.endSec) - 1;
      var n = U.clamp(St.startSec + deltaSec, 0, Math.max(maxStart, 0));
      if (n === St.startSec) return;
      RE.UI.clearMessage();
      applyStart_(n);
    },

    /** 終了地点の桁の ▲▼。開始地点・移動時間は変わらない */
    onEndStep: function (deltaSec) {
      var St = RE.State;
      if (St.playerState === S.NO_FILE) return;
      var n = U.clamp(Math.floor(St.endSec) + deltaSec, St.startSec + 1, St.durationSec);
      if (n === St.endSec) return;
      RE.UI.clearMessage();
      applyEnd_(n);
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
      if (!document.hidden) { refreshPosition_(); RE.UI.render(); }
    });
  }

  RE.Main = { start: start, handlers: handlers };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
