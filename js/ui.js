/* js/ui.js / 画面の読み書き・イベント設定（RE.UI） / 仕様書 v1.1 4章・9.5章 / 版 1.6.0 */
(function () {
  'use strict';
  var C = RE.Config;
  var S = C.PLAYER_STATE;
  var U = RE.Utils;
  var el = {};

  function $(id) { return document.getElementById(id); }

  function collectElements_() {
    ['btn-eject', 'input-file', 'txt-file-label', 'txt-filename', 'txt-file-hint', 'txt-position', 'txt-duration',
      'bar-track', 'bar-played', 'bar-marker', 'txt-bar-start', 'txt-bar-end', 
      'btn-move-minus', 'input-move', 'btn-move-plus', 'txt-move-note', 'txt-message', 'btn-stop', 'btn-play',
      'icon-play', 'icon-pause', 'btn-next', 'txt-next-hint', 'txt-version'
    ].forEach(function (id) { el[id] = $(id); });
    el.card = document.querySelector('.card');
  }

  /** handlers = RE.Main.handlers */
  function init(handlers) {
    collectElements_();
    bindEvents_(handlers);
    el['txt-version'].textContent = 'v' + C.APP_VERSION;
  }

  function bindEvents_(h) {
    el['btn-eject'].addEventListener('click', function () { h.onEject(); });
    el['input-file'].addEventListener('change', function (ev) {
      var f = ev.target.files && ev.target.files[0];
      ev.target.value = '';
      if (f) h.onFileSelected(f);
    });
    // 入力欄に文字を打った直後にボタンを押しても、先に入力を確定させる（iPhoneは自動では確定しない）
    function commitInput_() {
      var a = document.activeElement;
      if (a && a.tagName === 'INPUT' && a.blur) a.blur();
    }
    el['btn-play'].addEventListener('click', function () { commitInput_(); h.onPlayPause(); });
    el['btn-stop'].addEventListener('click', function () { commitInput_(); h.onStop(); });
    el['btn-next'].addEventListener('click', function () { commitInput_(); h.onNext(); });
    // タップした瞬間にボタンの色を変え、指を離すと戻す（iPhoneは :active だけでは確実に変わらないため）。
    // 一瞬のタップでも色の変化が見えるよう、最低 PRESS_MIN_MS は色を保つ。
    Array.prototype.forEach.call(document.querySelectorAll('.digit-btn, .rate-btn'), function (btn) {
      var downAt = 0, timer = null;
      function release() {
        if (!downAt) return;
        var wait = Math.max(0, C.PRESS_MIN_MS - (Date.now() - downAt));
        downAt = 0;
        timer = setTimeout(function () { btn.classList.remove('pressed'); }, wait);
      }
      btn.addEventListener('pointerdown', function () {
        clearTimeout(timer);
        downAt = Date.now();
        btn.classList.add('pressed');
      });
      ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) { btn.addEventListener(ev, release); });
    });

    // 桁ごとの ▲▼（data-target / data-unit / data-dir）
    Array.prototype.forEach.call(document.querySelectorAll('.digit-btn'), function (btn) {
      btn.addEventListener('click', function () {
        var delta = Number(btn.getAttribute('data-unit')) * Number(btn.getAttribute('data-dir'));
        if (btn.getAttribute('data-target') === 'start') h.onStartStep(delta); else h.onEndStep(delta);
      });
    });
    // 倍速ボタン（data-rate）
    Array.prototype.forEach.call(document.querySelectorAll('.rate-btn'), function (btn) {
      btn.addEventListener('click', function () { commitInput_(); h.onRateSelect(Number(btn.getAttribute('data-rate'))); });
    });
    el['input-move'].addEventListener('change', function () { h.onMoveCommitted(el['input-move'].value); });
    el['btn-move-minus'].addEventListener('click', function () { h.onMoveStep(-1); });
    el['btn-move-plus'].addEventListener('click', function () { h.onMoveStep(1); });
  }

  function setControlsEnabled_(enabled) {
    Array.prototype.forEach.call(document.querySelectorAll('.digit-btn, .rate-btn'), function (b) { b.disabled = !enabled; });
    ['btn-move-minus', 'input-move', 'btn-move-plus', 'btn-stop', 'btn-play', 'btn-next']
      .forEach(function (id) { el[id].disabled = !enabled; });
    el.card.classList.toggle('disabled', !enabled);
  }

  function renderRate_() {
    Array.prototype.forEach.call(document.querySelectorAll('.rate-btn'), function (b) {
      var on = Number(b.getAttribute('data-rate')) === RE.State.rate;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function setPlayButtonLook_(isPlaying) {
    // SVG要素には hidden 属性が効かないため、style.display で切り替える
    el['icon-play'].style.display = isPlaying ? 'none' : '';
    el['icon-pause'].style.display = isPlaying ? '' : 'none';
    el['btn-play'].setAttribute('aria-label', isPlaying ? '一時停止' : '再生');
  }

  var DIGIT_KEYS = ['m10', 'm1', 's10', 's1'];

  /** 開始・終了の8つの数字と、▲▼の有効/無効を更新 */
  function renderDigits_(noFile) {
    var St = RE.State;
    var pairs = [['start', St.startSec], ['end', noFile ? C.END_DEFAULT_SEC : St.endSec]];
    pairs.forEach(function (p) {
      var d = U.splitDigits(p[1]);
      DIGIT_KEYS.forEach(function (k) {
        var node = $('txt-' + p[0] + '-' + k);
        node.textContent = String(d[k]);
        node.classList.toggle('empty', noFile);
      });
    });
  }

  function renderBar_() {
    var St = RE.State;
    var hasFile = St.durationSec > 0;
    el['txt-bar-end'].textContent = hasFile ? U.formatTime(St.durationSec) : '--:--';
    if (!hasFile) {
      el['bar-marker'].style.display = 'none';
      el['bar-played'].style.width = '0';
      return;
    }
    var ratio = Math.min(1, St.startSec / St.durationSec);
    var trackW = el['bar-track'].clientWidth || 300;
    var maxLeft = Math.max(0, trackW - C.BAR_MARKER_MIN_PX);
    var left = Math.min(maxLeft, ratio * trackW);
    el['bar-played'].style.width = left + 'px';
    el['bar-marker'].style.left = left + 'px';
    el['bar-marker'].style.display = 'block';
  }

  function updateNextHint_() {
    var St = RE.State;
    var step = U.calcStepSec(St.moveSec);
    if (St.playerState !== S.NO_FILE && (St.endSec >= St.durationSec || St.startSec + step >= St.durationSec)) {
      el['txt-next-hint'].textContent = '最後の区間です';
    } else if (St.playerState === S.NO_FILE) {
      el['txt-next-hint'].textContent = '＋' + step + '秒';
    } else {
      el['txt-next-hint'].textContent = '次は ' + U.formatTime(St.startSec + step) + '〜' + U.formatTime(Math.min(St.endSec + step, St.durationSec)) + '\n（＋' + step + '秒）';
    }
  }

  /** RE.Stateを読み、全表示を更新する。入力中の欄を書き換えるため、一定時間ごとには呼ばない。 */
  function render() {
    var St = RE.State;
    var noFile = St.playerState === S.NO_FILE;
    el['txt-filename'].textContent = noFile ? 'ファイル未選択' : St.fileName;
    el['txt-filename'].classList.toggle('empty', noFile);
    el['txt-file-label'].textContent = noFile ? 'ファイル' : '再生中のファイル';
    el['txt-file-hint'].hidden = !noFile;
    el['btn-eject'].classList.toggle('attention', noFile);
    el['txt-duration'].textContent = '全体 ' + (noFile ? '--:--' : U.formatTime(St.durationSec));
    if (noFile) {
      el['txt-position'].textContent = '00:00';
    }
    el['txt-position'].classList.toggle('empty', noFile);
    renderDigits_(noFile);
    el['input-move'].value = St.moveSec;
    var stepNow = U.calcStepSec(St.moveSec);
    el['txt-move-note'].textContent = St.moveSec <= C.OVERLAP_SEC
      ? '区間移動: 開始・終了をそのまま1秒進めます（移動時間が1秒のときだけの決まり）'
      : '区間移動: 開始・終了を1秒戻してから、' + St.moveSec + '秒進めます（実質＋' + stepNow + '秒）';
    renderRate_();
    setControlsEnabled_(!noFile);
    setPlayButtonLook_(St.playerState === S.PLAYING);
    renderBar_();
    updateNextHint_();
  }

  function openFilePicker() { el['input-file'].click(); }

  function showMessage(text) {
    el['txt-message'].textContent = text || '';
    el['txt-message'].classList.toggle('show', !!text);
  }

  function clearMessage() { showMessage(''); }

  function updatePosition(sec) {
    el['txt-position'].textContent = U.formatTime(sec);
  }

  RE.UI = {
    init: init,
    render: render,
    openFilePicker: openFilePicker,
    showMessage: showMessage,
    clearMessage: clearMessage,
    updatePosition: updatePosition
  };
})();
