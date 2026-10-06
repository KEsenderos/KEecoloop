/* js/engine.js / 再生エンジン（RE.Engine）Web Audio方式 / 仕様書 v1.1 5.5・9.3章 / 版 1.0.0
 * 画面（DOM）にも RE.State にも触れない。状態の変化は callbacks.onStateChange で知らせるだけ。 */
(function () {
  'use strict';
  var C = RE.Config;
  var S = C.PLAYER_STATE;

  var callbacks = { onStateChange: function () {}, onError: function () {} };
  var ctx = null;
  var buffer = null;
  var source = null;
  var keepAudio = null;
  var state = S.NO_FILE;
  var secStart = 0;
  var secEnd = 0;
  var segCtx = 0;      // 再生開始時の ctx.currentTime
  var segOffset = 0;   // 再生開始位置（秒）
  var rate = 1;        // 倍速（State.rate と同じ値。Main が setRate で知らせる）
  var srcRate = 1;     // 現在の再生元を作ったときの倍速（位置の換算に使う）
  var stretched = null;     // 伸び縮み後の音声（rate≠1 のときだけ）
  var stretchedKey = '';    // stretched を作ったときの (startSec|endSec|rate)
  var segOffsetS = 0;       // stretched 上の再生開始位置（秒）
  var pausedPos = 0;   // 一時停止・停止中の位置（秒）

  function notify_() { callbacks.onStateChange(state); }

  function setState_(s) { state = s; notify_(); }

  function ensureContext_() {
    if (ctx) return true;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    ctx.onstatechange = onContextStateChange_;
    return true;
  }

  function onContextStateChange_() {
    if (state === S.PLAYING && ctx && ctx.state !== 'running') interrupt_();
  }

  function interrupt_() {
    pausedPos = getPositionSec();
    destroySource_();
    keepStop_();
    setState_(S.PAUSED);
    callbacks.onError(C.ERR.INTERRUPTED);
  }

  function makeSilentWavUrl_() {
    var n = 8000, b = new ArrayBuffer(44 + n), v = new DataView(b), i;
    function w(o, str) { for (var k = 0; k < str.length; k++) v.setUint8(o + k, str.charCodeAt(k)); }
    w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true);
    v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 8000, true); v.setUint32(28, 8000, true);
    v.setUint16(32, 1, true); v.setUint16(34, 8, true); w(36, 'data'); v.setUint32(40, n, true);
    for (i = 0; i < n; i++) v.setUint8(44 + i, 128);
    return URL.createObjectURL(new Blob([b], { type: 'audio/wav' }));
  }

  function keepStart_() {
    if (!C.KEEPALIVE_SILENT_AUDIO) return;
    if (!keepAudio) { keepAudio = new Audio(makeSilentWavUrl_()); keepAudio.loop = true; }
    var p = keepAudio.play();
    if (p && p.catch) p.catch(function () { /* 無音audioが鳴らせなくても本体の再生は続ける */ });
  }

  function keepStop_() {
    if (keepAudio) keepAudio.pause();
  }

  function destroySource_() {
    if (!source) return;
    try { source.onended = null; source.stop(); } catch (e) { /* すでに停止 */ }
    try { source.disconnect(); } catch (e2) { /* すでに切断 */ }
    source = null;
  }

  /** rate≠1 のとき、区間を伸び縮みさせた音声を用意する（同じ条件なら作り直さない）。rate==1 なら破棄 */
  function prepareStretched_() {
    if (rate === 1) { stretched = null; stretchedKey = ''; return; }
    var key = secStart + '|' + secEnd + '|' + rate;
    if (stretched && key === stretchedKey) return;
    try {
      stretched = RE.Stretch.render(ctx, buffer, secStart, secEnd, rate);
      stretchedKey = key;
    } catch (e) {
      stretched = null; stretchedKey = '';   // 作れなかった場合は、元の速度で再生を続ける
    }
  }

  function createSource_(offset) {
    destroySource_();
    prepareStretched_();
    var src = ctx.createBufferSource();
    source = src;
    segCtx = ctx.currentTime;
    segOffset = offset;
    if (stretched) {
      // 倍速: 伸び縮み後の音声を丸ごとループする（声の高さは変わらない）
      srcRate = rate;
      src.buffer = stretched;
      src.loopStart = 0;
      src.loopEnd = stretched.duration;
      src.loop = true;
      src.connect(ctx.destination);
      segOffsetS = Math.min(Math.max(0, (offset - secStart) / rate), Math.max(0, stretched.duration - 0.001));
      src.start(0, segOffsetS);
    } else {
      srcRate = 1;
      src.buffer = buffer;
      // ループ範囲を先に決めてから loop を有効にする（Safari対策）
      applyLoop_(src);
      src.connect(ctx.destination);
      src.start(0, offset);
      // 開始後にもう一度ループ範囲を確定させる（Safariが開始時の設定を無視する場合の対策）
      applyLoop_(src);
    }
    // 万一ループが効かずバッファの終わりまで再生された場合は、区間の頭から再生し直す
    src.onended = function () {
      if (source === src && state === S.PLAYING) createSource_(secStart);
    };
  }

  function applyLoop_(src) {
    try {
      var end = secEnd > secStart ? secEnd : Math.min(secStart + 1, buffer.duration);
      src.loopStart = secStart;
      src.loopEnd = end;
      src.loop = true;
    } catch (e) { /* 設定できない場合は無視 */ }
  }

  function inSection_(pos) { return pos >= secStart && pos < secEnd; }

  function getPositionSec() {
    if (state === S.PLAYING && ctx && srcRate !== 1 && stretched) {
      var runS = segOffsetS + (ctx.currentTime - segCtx);
      return secStart + (runS % stretched.duration) * srcRate;
    }
    if (state === S.PLAYING && ctx) {
      var len = secEnd - secStart;
      if (len <= 0) return secStart;
      var run = (segOffset - secStart) + (ctx.currentTime - segCtx) * rate;
      return secStart + (run % len);
    }
    return state === S.PAUSED ? pausedPos : secStart;
  }

  function init(cb) {
    callbacks = cb;
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* 未対応 */ }
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && state === S.PLAYING && ctx && ctx.state !== 'running') interrupt_();
    });
  }

  /** ファイルを読み込む。メモリ節約のため、先に前のファイルを破棄する。失敗時はNO_FILEに戻る。 */
  function loadFile(file) {
    destroySource_();
    keepStop_();
    buffer = null;
    stretched = null;
    stretchedKey = '';
    if (state !== S.NO_FILE) { state = S.NO_FILE; notify_(); }
    if (!ensureContext_()) return Promise.reject(new Error('NO_WEB_AUDIO'));
    return file.arrayBuffer().then(function (ab) {
      return new Promise(function (resolve, reject) {
        var p = ctx.decodeAudioData(ab, resolve, reject);
        if (p && p.then) p.then(resolve, reject);
      });
    }).then(function (decoded) {
      buffer = decoded;
      rate = C.RATE_DEFAULT;
      srcRate = 1;
      stretched = null;
      stretchedKey = '';
      secStart = 0;
      secEnd = Math.min(C.END_DEFAULT_SEC, decoded.duration);
      pausedPos = 0;
      setState_(S.STOPPED);
      return { durationSec: decoded.duration };
    });
  }

  /** 区間を更新。再生中は即時反映し、位置が区間外なら開始地点へ移す。 */
  function setSection(startSec, endSec) {
    var pos = getPositionSec();
    secStart = startSec;
    secEnd = endSec;
    if (state === S.PLAYING) {
      createSource_(inSection_(pos) ? pos : secStart);
    } else if (state === S.PAUSED && inSection_(pausedPos)) {
      /* 位置を維持 */
    } else if (state !== S.NO_FILE) {
      pausedPos = secStart;
      if (state !== S.STOPPED) setState_(S.STOPPED);
    }
  }

  function play() {
    if (!buffer || !ctx) return Promise.resolve();
    var offset = (state === S.PAUSED) ? pausedPos : secStart;
    if (!inSection_(offset)) offset = secStart;
    keepStart_();
    var go = function () {
      createSource_(offset);
      setState_(S.PLAYING);
    };
    if (ctx.state === 'running') {
      try { go(); } catch (e) { callbacks.onError(C.ERR.PLAY_BLOCKED); }
      return Promise.resolve();
    }
    return resumeContext_().then(go).catch(function () {
      // 再開できなかった場合は、音の出口（AudioContext）を作り直して1回だけ試す
      recreateContext_();
      return resumeContext_().then(go).catch(function () { callbacks.onError(C.ERR.PLAY_BLOCKED); });
    });
  }

  /** ctx.resume() を、1.5秒で見切りをつけて待つ（iOSで返事が来ないことがあるため） */
  function resumeContext_() {
    return Promise.race([
      ctx.resume(),
      new Promise(function (resolve, reject) { setTimeout(function () { reject(new Error('RESUME_TIMEOUT')); }, 1500); })
    ]).then(function () {
      if (ctx.state !== 'running') throw new Error('NOT_RUNNING');
    });
  }

  function recreateContext_() {
    destroySource_();
    try { if (ctx) { ctx.onstatechange = null; ctx.close(); } } catch (e) { /* 無視 */ }
    ctx = null;
    ensureContext_();
  }

  /** 開始地点へ移動して再生（区間移動・開始地点の編集で使う） */
  function playFromStart() {
    if (!buffer || !ctx) return Promise.resolve();
    pausedPos = secStart;
    if (state === S.PLAYING) { createSource_(secStart); return Promise.resolve(); }
    state = S.STOPPED;
    return play();
  }

  function pause() {
    if (state !== S.PLAYING) return;
    pausedPos = getPositionSec();
    destroySource_();
    // 一時停止中も無音audioは鳴らし続ける。止めてしまうと、iOSが「再生中のアプリ」から外し、
    // イヤホンやインカムの再生ボタンがアプリに届かなくなるため（v1.9）。
    keepStart_();
    setState_(S.PAUSED);
  }

  function stop() {
    if (state === S.NO_FILE) return;
    destroySource_();
    keepStop_();
    pausedPos = secStart;
    setState_(S.STOPPED);
  }

  /** 倍速を設定する。再生中は現在位置を保存しておく（実際の切り替えは、続く playFromStart で行う） */
  function setRate(r) {
    if (state === S.PLAYING && ctx && source) pausedPos = getPositionSec();
    rate = r;
  }

  function getState() { return state; }

  RE.Engine = {
    init: init,
    loadFile: loadFile,
    setSection: setSection,
    play: play,
    playFromStart: playFromStart,
    setRate: setRate,
    pause: pause,
    stop: stop,
    getPositionSec: getPositionSec,
    getState: getState
  };
})();
