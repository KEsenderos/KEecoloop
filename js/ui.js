/* js/ui.js / 画面の読み書き・イベント設定（RE.UI） / 仕様書 v3.2.0 4章・4.3章・9.5章 / 版 3.2.0 */
(function () {
  'use strict';
  var C = RE.Config;
  var S = C.PLAYER_STATE;
  var U = RE.Utils;
  var el = {};

  function $(id) { return document.getElementById(id); }

  /** スロット別の値の読み取り（v2.10）。pf は id の接頭辞（A='' / B='b-' / C='c-'） */
  function pfOf_(slot) { return slot === 'C' ? 'c-' : (slot === 'B' ? 'b-' : ''); }
  function nameOf_(slot) { var St = RE.State; return slot === 'C' ? St.fileNameC : (slot === 'B' ? St.fileNameB : St.fileName); }
  function durOf_(slot) { var St = RE.State; return slot === 'C' ? St.durationSecC : (slot === 'B' ? St.durationSecB : St.durationSec); }
  function startOf_(slot) { var St = RE.State; return slot === 'C' ? St.startSecC : (slot === 'B' ? St.startSecB : St.startSec); }
  function endOf_(slot) { var St = RE.State; return slot === 'C' ? St.endSecC : (slot === 'B' ? St.endSecB : St.endSec); }
  function memosOf_(slot) { var St = RE.State; return slot === 'C' ? St.memosC : (slot === 'B' ? St.memosB : St.memosA); }

  function tr_(key, params) { return RE.I18n.t(key, params); }

  function collectElements_() {
    ['btn-eject', 'input-file', 'txt-file-label', 'txt-filename', 'txt-file-hint', 'txt-position', 'txt-duration',
      'bar-track', 'bar-played', 'bar-marker', 'txt-bar-start', 'txt-bar-end', 
      'btn-move-minus', 'input-move', 'btn-move-plus', 'txt-move-note', 'txt-message', 'btn-stop', 'btn-play',
      'icon-play', 'icon-pause', 'btn-next', 'txt-next-hint', 'txt-version',
      'banner-update', 'txt-update-main', 'txt-update-note',
      'btn-all', 'b-btn-all', 'c-btn-all', 'txt-move-demo-hint', 'select-lang', 'btn-prev', 'txt-hint-next', 'txt-hint-gap', 'txt-hint-rate', 'input-file-b', 'input-file-c', 'pane-a', 'pane-b', 'pane-c', 'screen-play', 'screen-edit', 'screen-memo', 'screen-settings', 'tab-bar', 'dock', 'txt-next-detail', 'group-memo-a', 'b-btn-eject', 'b-txt-file-label', 'b-txt-filename', 'b-txt-file-hint',
      'b-txt-position', 'b-txt-duration', 'b-bar-track', 'b-bar-played', 'b-bar-marker', 'b-txt-bar-end',
      'c-btn-eject', 'c-txt-file-label', 'c-txt-filename', 'c-txt-file-hint', 'c-txt-position', 'c-txt-duration', 'c-bar-track', 'c-bar-played', 'c-bar-marker', 'c-txt-bar-end',
      'c-btn-memo-save', 'group-memo-c', 'memo-title-c', 'memo-list-c', 'txt-memo-empty-c',
      'btn-memo-save', 'b-btn-memo-save', 'txt-hint-memo', 'memo-title-a', 'memo-list-a', 'txt-memo-empty-a',
      'group-memo-b', 'memo-title-b', 'memo-list-b', 'txt-memo-empty-b'
    ].forEach(function (id) { el[id] = $(id); });
    ['a', 'b', 'c'].forEach(function (x) {
      ['row', 'label', 'name', 'range', 'pos', 'bar-fill', 'bar-marker', 'eject'].concat(x === 'a' ? [] : ['toggle']).forEach(function (k) { el['play-' + k + '-' + x] = $('play-' + k + '-' + x); });
      el['play-bar-' + x] = el['play-row-' + x].querySelector('.play-bar');
    });
    el.card = document.querySelector('.card');
    el.cardB = document.querySelector('#pane-b .card');
    el.cardC = document.querySelector('#pane-c .card');
    var acc = C.ACCEPT_AUDIO;
    ['input-file', 'input-file-b', 'input-file-c'].forEach(function (id) {
      if (acc) el[id].setAttribute('accept', acc); else el[id].removeAttribute('accept');
    });
  }

  /** handlers = RE.Main.handlers */
  function init(handlers) {
    collectElements_();
    bindEvents_(handlers);
    el['txt-version'].textContent = 'v' + C.APP_VERSION;
    el['select-lang'].value = RE.I18n.getPref();
    refreshLanguage();
  }

  function bindEvents_(h) {
    el['banner-update'].addEventListener('click', function () { h.onUpdateTap(); });
    el['select-lang'].addEventListener('change', function (ev) { h.onLangChange(ev.target.value); });
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
    ['b', 'c'].forEach(function (x) {
      el['play-toggle-' + x].addEventListener('click', function () { commitInput_(); h.onPlayToggle(x.toUpperCase()); });
    });
    el['b-btn-eject'].addEventListener('click', function () { h.onEjectB(); });
    el['input-file-b'].addEventListener('change', function (ev) {
      var f = ev.target.files && ev.target.files[0];
      ev.target.value = '';
      if (f) h.onFileSelectedB(f);
    });
    el['c-btn-eject'].addEventListener('click', function () { h.onEjectC(); });
    el['input-file-c'].addEventListener('change', function (ev) {
      var f = ev.target.files && ev.target.files[0];
      ev.target.value = '';
      if (f) h.onFileSelectedC(f);
    });
    el['btn-play'].addEventListener('click', function () { commitInput_(); h.onPlayPause(); });
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (t) {
      t.addEventListener('click', function () { commitInput_(); h.onTab(t.getAttribute('data-tab')); });
    });
    // 再生タブの各行の ⏏（区間タブを開かずにファイルを選べる）
    el['play-eject-a'].addEventListener('click', function () { h.onEject(); });
    el['play-eject-b'].addEventListener('click', function () { h.onEjectB(); });
    el['play-eject-c'].addEventListener('click', function () { h.onEjectC(); });
    // 文字の入力欄にカーソルがある間は、操作帯とタブを隠す（キーボードと重ならないように）
    document.addEventListener('focusin', function (ev) {
      var t = ev.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) document.body.classList.add('kb-open');
    });
    document.addEventListener('focusout', function () { document.body.classList.remove('kb-open'); });
    el['btn-stop'].addEventListener('click', function () { commitInput_(); h.onStop(); });
    el['btn-next'].addEventListener('click', function () { commitInput_(); h.onNext(); });
    el['btn-prev'].addEventListener('click', function () { commitInput_(); h.onPrev(); });
    Array.prototype.forEach.call(document.querySelectorAll('.all-btn'), function (btn) {
      btn.addEventListener('click', function () { commitInput_(); h.onSelectAll(btn.getAttribute('data-slot')); });
    });
    // タップした瞬間にボタンの色を変え、指を離すと戻す（iPhoneは :active だけでは確実に変わらないため）。
    // 一瞬のタップでも色の変化が見えるよう、最低 PRESS_MIN_MS は色を保つ。
    Array.prototype.forEach.call(document.querySelectorAll('.digit-btn, .rate-btn, .gap-btn, .mark-btn, .all-btn, .play-toggle, .memo-save-btn'), function (btn) {
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
        var t = btn.getAttribute('data-target');
        if (t === 'start') h.onStartStep(delta);
        else if (t === 'end') h.onEndStep(delta);
        else if (t === 'bstart') h.onStartStepB(delta);
        else if (t === 'bend') h.onEndStepB(delta);
        else if (t === 'cstart') h.onStartStepC(delta);
        else h.onEndStepC(delta);
      });
    });
    // 「ここを開始／終了」ボタン（data-slot / data-mark）
    Array.prototype.forEach.call(document.querySelectorAll('.mark-btn'), function (btn) {
      btn.addEventListener('click', function () { h.onMark(btn.getAttribute('data-slot'), btn.getAttribute('data-mark')); });
    });
    // 繰り返しの間の無音ボタン（data-gap）
    Array.prototype.forEach.call(document.querySelectorAll('.gap-btn'), function (btn) {
      btn.addEventListener('click', function () { commitInput_(); h.onGapSelect(Number(btn.getAttribute('data-gap'))); });
    });
    // 区間保存ボタン
    el['btn-memo-save'].addEventListener('click', function () { commitInput_(); h.onMemoSave('A'); });
    el['b-btn-memo-save'].addEventListener('click', function () { commitInput_(); h.onMemoSave('B'); });
    bindMemoList_(h, el['memo-list-a']);
    el['c-btn-memo-save'].addEventListener('click', function () { commitInput_(); h.onMemoSave('C'); });
    bindMemoList_(h, el['memo-list-b']);
    bindMemoList_(h, el['memo-list-c']);
    // 倍速ボタン（data-rate）
    Array.prototype.forEach.call(document.querySelectorAll('.rate-btn'), function (btn) {
      btn.addEventListener('click', function () { commitInput_(); h.onRateSelect(Number(btn.getAttribute('data-rate'))); });
    });
    el['input-move'].addEventListener('change', function () { h.onMoveCommitted(el['input-move'].value); });
    el['btn-move-minus'].addEventListener('click', function () { h.onMoveStep(-1); });
    el['btn-move-plus'].addEventListener('click', function () { h.onMoveStep(1); });
  }

  /** 区間メモ欄: タップ・削除（イベント委譲）と、「≡」のドラッグ並べ替え */
  var drag = null;

  function bindMemoList_(h, list) {
    list.addEventListener('click', function (ev) {
      var t = ev.target;
      var main = t.closest ? t.closest('.memo-chip-main') : null;
      var del = t.closest ? t.closest('.memo-chip-del') : null;
      var nameBox = t.closest ? t.closest('.memo-chip-name') : null;
      if (main && nameBox) h.onMemoRename(main.getAttribute('data-slot'), main.getAttribute('data-id'));   // v3.1.7: 名前の部分のタップ＝名前を付ける
      else if (main) h.onMemoTap(main.getAttribute('data-slot'), main.getAttribute('data-id'));
      else if (del) h.onMemoDelete(del.getAttribute('data-slot'), del.getAttribute('data-id'));
    });
    list.addEventListener('pointerdown', function (ev) {
      var grip = ev.target.closest ? ev.target.closest('.memo-chip-grip') : null;
      if (!grip || drag) return;
      var chips = Array.prototype.slice.call(list.querySelectorAll('.memo-chip'));
      var chip = grip.closest('.memo-chip');
      var from = chips.indexOf(chip);
      if (from < 0) return;
      var step = chips.length > 1 ? chips[1].offsetTop - chips[0].offsetTop : chip.offsetHeight + 6;
      drag = { h: h, slot: grip.getAttribute('data-slot'), list: list, chips: chips, chip: chip, from: from,
        target: from, startY: ev.clientY, step: step, pid: ev.pointerId };
      chip.classList.add('dragging');
      try { grip.setPointerCapture(ev.pointerId); } catch (e) { /* 無視 */ }
      ev.preventDefault();
    });
    list.addEventListener('pointermove', function (ev) {
      if (!drag || ev.pointerId !== drag.pid) return;
      var n = drag.chips.length;
      var dy = U.clamp(ev.clientY - drag.startY, -drag.from * drag.step, (n - 1 - drag.from) * drag.step);
      drag.chip.style.transform = 'translateY(' + dy + 'px)';
      var target = U.clamp(Math.round(drag.from + dy / drag.step), 0, n - 1);
      drag.target = target;
      drag.chips.forEach(function (c, i) {
        if (i === drag.from) return;
        var shift = 0;
        if (drag.from < target && i > drag.from && i <= target) shift = -drag.step;
        else if (drag.from > target && i < drag.from && i >= target) shift = drag.step;
        c.style.transform = shift ? 'translateY(' + shift + 'px)' : '';
      });
    });
    function finish(commit) {
      if (!drag) return;
      var d = drag;
      drag = null;
      d.chip.classList.remove('dragging');
      d.chips.forEach(function (c) { c.style.transform = ''; });
      if (commit && d.target !== d.from) d.h.onMemoMove(d.slot, d.from, d.target);
      else renderMemo_();
    }
    list.addEventListener('pointerup', function (ev) { if (drag && ev.pointerId === drag.pid) finish(true); });
    list.addEventListener('pointercancel', function (ev) { if (drag && ev.pointerId === drag.pid) finish(false); });
    list.addEventListener('lostpointercapture', function (ev) { if (drag && ev.pointerId === drag.pid) finish(false); });
  }

  /** 一覧（スロットごと）を作り直す。配列の順に上から並べる */
  function renderMemoList_(slot) {
    var sfx = slot === 'C' ? 'c' : (slot === 'B' ? 'b' : 'a');
    var items = memosOf_(slot);
    var list = el['memo-list-' + sfx];
    var curS = startOf_(slot), curE = endOf_(slot);
    var full = items.length >= C.MEMO_MAX_PER_FILE;
    // 内容が前回と同じなら作り直さない（名前のスライドがやり直しにならないように）
    var sig = JSON.stringify([items.map(function (m) { return [m.id, m.s, m.e, m.name || '']; }), curS, curE, full, RE.I18n.getLang()]);
    if (list.getAttribute('data-sig') === sig && list.firstChild) { slideNames_(list); return; }
    list.setAttribute('data-sig', sig);
    list.textContent = '';
    items.forEach(function (m, i) {
      var chip = document.createElement('div');
      chip.className = 'memo-chip';
      if (full && i === items.length - 1) chip.classList.add('memo-chip--last');
      if (m.s === curS && m.e === curE) chip.setAttribute('aria-current', 'true');
      var grip = document.createElement('button');
      grip.type = 'button'; grip.className = 'memo-chip-grip';
      grip.setAttribute('data-slot', slot); grip.setAttribute('data-index', String(i));
      grip.setAttribute('aria-label', tr_('aria.grip'));
      grip.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M5 7h14M5 12h14M5 17h14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
      var main = document.createElement('button');
      main.type = 'button'; main.className = 'memo-chip-main';
      main.setAttribute('data-slot', slot); main.setAttribute('data-id', m.id);
      var nb = document.createElement('span');
      nb.className = 'memo-chip-name';
      var ns = document.createElement('span');
      if (m.name) ns.textContent = m.name; else { ns.textContent = C.MEMO_NAME_PLACEHOLDER; ns.className = 'memo-name-empty'; }
      nb.appendChild(ns);
      main.appendChild(nb);
      if (full && i === items.length - 1) {
        var w = document.createElement('span');
        w.className = 'memo-chip-warn'; w.textContent = tr_('memo.warn');
        main.appendChild(w);
      }
      var t = document.createElement('span');
      t.className = 'memo-chip-time';
      t.textContent = tr_('range', { a: U.formatTime(m.s), b: U.formatTime(m.e) });
      main.appendChild(t);
      var del = document.createElement('button');
      del.type = 'button'; del.className = 'memo-chip-del';
      del.setAttribute('data-slot', slot); del.setAttribute('data-id', m.id);
      del.setAttribute('aria-label', tr_('aria.del'));
      del.textContent = '×';
      chip.appendChild(grip); chip.appendChild(main); chip.appendChild(del);
      list.appendChild(chip);
    });
    el['txt-memo-empty-' + sfx].hidden = items.length > 0;
    slideNames_(list);
  }

  /** v3.1.6: 名前が枠に入りきらないとき、一度だけ左へスライドして全文を見せる。画面に出ていない（幅0）ときは何もしない */
  function slideNames_(list) {
    var boxes = list.querySelectorAll('.memo-chip-name');
    for (var i = 0; i < boxes.length; i++) {
      var box = boxes[i], inner = box.firstChild;
      if (!inner || box.getAttribute('data-slid') === '1' || box.clientWidth <= 0) continue;
      box.setAttribute('data-slid', '1');
      var over = inner.scrollWidth - box.clientWidth;
      if (over > 2) {
        inner.style.setProperty('--slide', '-' + (over + 8) + 'px');
        inner.style.animationDuration = Math.max(1.2, over / 35) + 's';
        inner.classList.add('slide-once');
      }
    }
  }

  /** 区間メモ欄の表示を更新する（ドラッグ中は触らない）。3つとも常に表示する */
  function renderMemo_() {
    if (drag) return;
    ['A', 'B', 'C'].forEach(function (X, i) {
      var x = X.toLowerCase();
      el['memo-title-' + x].textContent = nameOf_(X) ? tr_('file.titleNamed', { n: i + 1, name: nameOf_(X) }) : tr_('file.' + (i + 1));
      el[(x === 'a' ? '' : x + '-') + 'btn-memo-save'].textContent = C.LABEL.MEMO_SAVE;
      renderMemoList_(X);
    });
  }

  function setControlsEnabled_(enabled) {
    var St = RE.State;
    var loadedA = !!St.fileName, loadedB = !!St.fileNameB, loadedC = !!St.fileNameC;
    Array.prototype.forEach.call(document.querySelectorAll('.rate-btn, .gap-btn'), function (b) { b.disabled = !enabled; });
    Array.prototype.forEach.call(document.querySelectorAll('.mark-btn'), function (b) {
      var sl = b.getAttribute('data-slot');
      b.disabled = sl === 'C' ? !loadedC : (sl === 'B' ? !loadedB : !loadedA);
    });
    el['btn-memo-save'].disabled = !loadedA;
    el['b-btn-memo-save'].disabled = !loadedB;
    el['c-btn-memo-save'].disabled = !loadedC;
    Array.prototype.forEach.call(document.querySelectorAll('.digit-btn'), function (b) {
      var t = b.getAttribute('data-target');
      b.disabled = (t === 'cstart' || t === 'cend') ? !loadedC : ((t === 'bstart' || t === 'bend') ? !loadedB : !loadedA);
    });
    ['btn-move-minus', 'input-move', 'btn-move-plus', 'btn-stop', 'btn-play', 'btn-prev', 'btn-next']
      .forEach(function (id) { el[id].disabled = !enabled; });
    el['btn-all'].disabled = !loadedA;
    el['b-btn-all'].disabled = !loadedB;
    el['c-btn-all'].disabled = !loadedC;
    el.card.classList.toggle('disabled', !loadedA);
    el.cardB.classList.toggle('disabled', !loadedB);
    el.cardC.classList.toggle('disabled', !loadedC);
  }

  function renderRate_() {
    Array.prototype.forEach.call(document.querySelectorAll('.rate-btn'), function (b) {
      var on = Number(b.getAttribute('data-rate')) === RE.State.rate;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function renderGap_() {
    Array.prototype.forEach.call(document.querySelectorAll('.gap-btn'), function (b) {
      var on = Number(b.getAttribute('data-gap')) === RE.State.gapSec;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  /** 言語を切り替えたとき・起動時: 静的な文字と説明文を書き直し、画面を描き直す（v3.2.0） */
  function refreshLanguage() {
    RE.I18n.applyDom();
    renderHints_();
    if (el['select-lang']) el['select-lang'].value = RE.I18n.getPref();
    try { render(); } catch (e) { /* 起動直後で状態が未準備なら無視 */ }
  }

  /** 固定の説明文を書き込む（起動時と言語切り替え時） */
  function renderHints_() {
    var H = C.HINT;
    el['txt-hint-next'].textContent = H.PREFIX + H.NEXT;
    el['txt-hint-gap'].textContent = H.PREFIX + H.GAP;
    el['txt-hint-rate'].textContent = H.PREFIX + H.RATE;
    el['txt-hint-memo'].textContent = H.PREFIX + H.MEMO;
  }

  function setPlayButtonLook_(isPlaying) {
    // SVG要素には hidden 属性が効かないため、style.display で切り替える
    el['icon-play'].style.display = isPlaying ? 'none' : '';
    el['icon-pause'].style.display = isPlaying ? '' : 'none';
    el['btn-play'].setAttribute('aria-label', isPlaying ? tr_('aria.pause') : tr_('aria.play'));
  }

  var DIGIT_KEYS = ['m10', 'm1', 's10', 's1'];

  /** 開始・終了の8つの数字（スロットごと）を更新 */
  function renderDigits_(slot) {
    var pf = pfOf_(slot);
    var noFile = !nameOf_(slot);
    var st = startOf_(slot);
    var en = endOf_(slot);
    var pairs = [['start', st], ['end', noFile ? C.END_DEFAULT_SEC : en]];
    pairs.forEach(function (p) {
      var d = U.splitDigits(p[1]);
      DIGIT_KEYS.forEach(function (k) {
        var node = $(pf + 'txt-' + p[0] + '-' + k);
        node.textContent = String(d[k]);
        node.classList.toggle('empty', noFile);
      });
    });
  }

  function renderBar_(slot) {
    var pf = pfOf_(slot);
    var dur = durOf_(slot);
    var start = startOf_(slot);
    var endLabel = el[pf + 'txt-bar-end'], played = el[pf + 'bar-played'], marker = el[pf + 'bar-marker'], track = el[pf + 'bar-track'];
    var hasFile = dur > 0;
    endLabel.textContent = hasFile ? U.formatTime(dur) : '--:--';
    if (!hasFile) {
      marker.style.display = 'none';
      played.style.width = '0';
      return;
    }
    var ratio = Math.min(1, start / dur);
    var trackW = track.clientWidth || 300;
    var maxLeft = Math.max(0, trackW - C.BAR_MARKER_MIN_PX);
    var left = Math.min(maxLeft, ratio * trackW);
    played.style.width = left + 'px';
    marker.style.left = left + 'px';
    marker.style.display = 'block';
  }

  function updateNextHint_() {
    var St = RE.State;
    var step = U.calcStepSec(St.moveSec);
    el['txt-move-demo-hint'].textContent = tr_('plus.sec', { n: step });
    if (St.playerState !== S.NO_FILE && (St.endSec >= St.durationSec || St.startSec + step >= St.durationSec)) {
      el['txt-next-hint'].textContent = tr_('next.last');
      el['txt-next-detail'].textContent = tr_('next.lastDetail');
    } else if (St.playerState === S.NO_FILE) {
      el['txt-next-hint'].textContent = tr_('plus.sec', { n: step });
      el['txt-next-detail'].textContent = '';
    } else {
      el['txt-next-hint'].textContent = tr_('plus.sec', { n: step });
      el['txt-next-detail'].textContent = tr_('next.detail', { a: U.formatTime(St.startSec + step), b: U.formatTime(Math.min(St.endSec + step, St.durationSec)), n: step });
    }
  }

  var TABS = ['play', 'edit', 'memo', 'settings'];

  /** 画面（screen）の表示・タブの印 */
  function renderTabsAndPanes_() {
    var St = RE.State;
    TABS.forEach(function (t) {
      el['screen-' + t].hidden = St.tab !== t;
      var tb = $('tab-' + t);
      if (St.tab === t) tb.setAttribute('aria-current', 'page'); else tb.removeAttribute('aria-current');
    });
  }

  /** 再生タブの「今の区間の一覧」を更新する */
  function renderPlayRows_() {
    var St = RE.State, n = St.mode === C.MODE.TRIPLE ? 3 : (St.mode === C.MODE.DOUBLE ? 2 : 1);
    ['A', 'B', 'C'].forEach(function (X, i) {
      var x = X.toLowerCase(), has = !!nameOf_(X), dur = durOf_(X), start = startOf_(X);
      var on = i < n;
      el['play-row-' + x].classList.toggle('off', !on);
      if (i > 0) {
        el['play-toggle-' + x].textContent = on ? C.LABEL.PLAY_ON : C.LABEL.PLAY_OFF;
        el['play-toggle-' + x].classList.toggle('on', on);
        el['play-toggle-' + x].setAttribute('aria-pressed', on ? 'true' : 'false');
      }
      el['play-name-' + x].textContent = has ? nameOf_(X) : tr_('file.none');
      el['play-name-' + x].classList.toggle('empty', !has);
      el['play-eject-' + x].classList.toggle('attention', !has);
      el['play-range-' + x].textContent = has ? tr_('range', { a: U.formatTime(start), b: U.formatTime(endOf_(X)) }) : tr_('range', { a: '--:--', b: '--:--' });
      el['play-pos-' + x].classList.toggle('empty', !has);
      if (!has) el['play-pos-' + x].textContent = '00:00';
      var track = el['play-bar-' + x], marker = el['play-bar-marker-' + x], fill = el['play-bar-fill-' + x];
      if (!(dur > 0)) { marker.style.display = 'none'; fill.style.width = '0'; return; }
      var w = track.clientWidth || 300, left = Math.min(Math.max(0, w - 6), Math.min(1, start / dur) * w);
      fill.style.width = left + 'px'; marker.style.left = left + 'px'; marker.style.display = 'block';
    });
  }

  /** RE.Stateを読み、全表示を更新する。入力中の欄を書き換えるため、一定時間ごとには呼ばない。 */
  function render() {
    var St = RE.State;
    var noFile = St.playerState === S.NO_FILE;
    var noA = !St.fileName, noB = !St.fileNameB, noC = !St.fileNameC;
    renderTabsAndPanes_();
    el['txt-filename'].textContent = noA ? tr_('file.none') : St.fileName;
    el['txt-filename'].classList.toggle('empty', noA);
    el['txt-file-hint'].hidden = !noA;
    el['btn-eject'].classList.toggle('attention', noA);
    el['txt-duration'].textContent = tr_('total', { t: noA ? '--:--' : U.formatTime(St.durationSec) });
    if (noA) el['txt-position'].textContent = '00:00';
    el['txt-position'].classList.toggle('empty', noA);
    el['b-txt-filename'].textContent = noB ? tr_('file.none') : St.fileNameB;
    el['b-txt-filename'].classList.toggle('empty', noB);
    el['b-txt-file-hint'].hidden = !noB;
    el['b-btn-eject'].classList.toggle('attention', noB);
    el['b-txt-duration'].textContent = tr_('total', { t: noB ? '--:--' : U.formatTime(St.durationSecB) });
    if (noB) el['b-txt-position'].textContent = '00:00';
    el['b-txt-position'].classList.toggle('empty', noB);
    el['c-txt-filename'].textContent = noC ? tr_('file.none') : St.fileNameC;
    el['c-txt-filename'].classList.toggle('empty', noC);
    el['c-txt-file-hint'].hidden = !noC;
    el['c-btn-eject'].classList.toggle('attention', noC);
    el['c-txt-duration'].textContent = tr_('total', { t: noC ? '--:--' : U.formatTime(St.durationSecC) });
    if (noC) el['c-txt-position'].textContent = '00:00';
    el['c-txt-position'].classList.toggle('empty', noC);
    renderDigits_('A');
    renderDigits_('B');
    renderDigits_('C');
    el['input-move'].value = St.moveSec;
    var stepNow = U.calcStepSec(St.moveSec);
    el['txt-move-note'].textContent = C.HINT.PREFIX + (St.moveSec <= C.OVERLAP_SEC
      ? C.HINT.MOVE_NOTE_1
      : C.HINT.MOVE_NOTE_N.replace('{n}', St.moveSec).replace('{step}', stepNow));
    renderRate_();
    renderGap_();
    setControlsEnabled_(!noFile);
    setPlayButtonLook_(St.playerState === S.PLAYING);
    renderBar_('A');
    renderBar_('B');
    renderBar_('C');
    renderPlayRows_();
    updateNextHint_();
    renderMemo_();
  }

  function openFilePicker() { el['input-file'].click(); }
  function openFilePickerB() { el['input-file-b'].click(); }
  function openFilePickerC() { el['input-file-c'].click(); }

  function showMessage(text) {
    el['txt-message'].textContent = text || '';
    el['txt-message'].classList.toggle('show', !!text);
  }

  function clearMessage() { showMessage(''); }

  function updatePosition(sec, slot) {
    el[pfOf_(slot) + 'txt-position'].textContent = U.formatTime(sec);
    var x = slot.toLowerCase();
    el['play-pos-' + x].textContent = U.formatTime(sec);
    var act = RE.Engine.getState() === S.PLAYING || RE.Engine.getState() === S.PAUSED ? RE.Engine.getActiveSlot() : '';
    el['play-row-' + x].classList.toggle('active', act === slot);
  }

  /** 更新のお知らせ帯を表示する（一度出したら消さない） */
  function showUpdateBanner() {
    el['txt-update-main'].textContent = C.MSG.UPDATE_AVAILABLE;
    el['txt-update-note'].textContent = C.MSG.UPDATE_NOTE;
    el['banner-update'].hidden = false;
  }

  RE.UI = {
    init: init,
    refreshLanguage: refreshLanguage,
    showUpdateBanner: showUpdateBanner,
    render: render,
    openFilePicker: openFilePicker,
    openFilePickerB: openFilePickerB,
    openFilePickerC: openFilePickerC,
    showMessage: showMessage,
    clearMessage: clearMessage,
    updatePosition: updatePosition
  };
})();
