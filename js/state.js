/* js/state.js / 状態変数の保管（RE.State） / 仕様書 v3.2.0 8章・9.2章 / 版 3.2.0 */
(function () {
  'use strict';
  var C = RE.Config;

  RE.State = {
    fileName: '',
    durationSec: 0,
    moveSec: C.MOVE_SEC_DEFAULT,
    rate: C.RATE_DEFAULT,
    startSec: 0,
    endSec: 0,
    mode: C.MODE.SINGLE,
    fileNameB: '',
    durationSecB: 0,
    startSecB: 0,
    endSecB: 0,
    fileNameC: '',
    durationSecC: 0,
    startSecC: 0,
    endSecC: 0,
    gapSec: C.GAP_DEFAULT,
    fileKeyA: '',
    fileKeyB: '',
    fileKeyC: '',
    memosA: [],
    memosB: [],
    memosC: [],
    tab: 'play',
    tabScroll: { play: 0, edit: 0, memo: 0, settings: 0 },
    playerState: C.PLAYER_STATE.NO_FILE,

    /** 全変数を初期値へ（moveSecは保存値） */
    init: function () {
      this.fileName = '';
      this.durationSec = 0;
      this.moveSec = RE.Utils.loadMoveSec();
      this.rate = C.RATE_DEFAULT;
      this.gapSec = RE.Utils.loadGapSec();
      this.mode = C.MODE.SINGLE;
      this.fileNameB = '';
      this.durationSecB = 0;
      this.startSecB = 0;
      this.endSecB = 0;
      this.fileNameC = '';
      this.durationSecC = 0;
      this.startSecC = 0;
      this.endSecC = 0;
      this.fileKeyA = '';
      this.fileKeyB = '';
      this.fileKeyC = '';
      this.memosA = [];
      this.memosB = [];
      this.memosC = [];
      this.startSec = C.START_DEFAULT_SEC;
      this.endSec = 0;
      this.tab = 'play';
      this.tabScroll = { play: 0, edit: 0, memo: 0, settings: 0 };
      this.playerState = C.PLAYER_STATE.NO_FILE;
    },

    /** ファイル情報を設定し、startSec=0、endSec=min(END_DEFAULT_SEC, 全長) */
    setFile: function (fileName, durationSec) {
      this.fileName = fileName;
      this.rate = C.RATE_DEFAULT;
      this.durationSec = durationSec;
      this.startSec = C.START_DEFAULT_SEC;
      this.endSec = Math.min(C.END_DEFAULT_SEC, durationSec);
    },

    /** 2つ目のファイル情報を設定し、startSecB=0、endSecB=min(END_DEFAULT_SEC, 全長)。rate は変えない（v2.5） */
    setFileB: function (fileName, durationSec) {
      this.fileNameB = fileName;
      this.durationSecB = durationSec;
      this.startSecB = C.START_DEFAULT_SEC;
      this.endSecB = durationSec; // v3.1.4: 全範囲
    },

    /** 3つ目のファイル情報を設定し、startSecC=0、endSecC=min(END_DEFAULT_SEC, 全長)。rate は変えない（v2.10） */
    setFileC: function (fileName, durationSec) {
      this.fileNameC = fileName;
      this.durationSecC = durationSec;
      this.startSecC = C.START_DEFAULT_SEC;
      this.endSecC = durationSec; // v3.1.4: 全範囲
    },

    /** 3つ目だけを未選択に戻す */
    resetC: function () {
      this.fileNameC = '';
      this.durationSecC = 0;
      this.startSecC = 0;
      this.endSecC = 0;
      this.fileKeyC = '';
      this.memosC = [];
    },

    /** 1つ目だけを未選択に戻す（2つ目・モード・移動時間は残す。倍速は1.0に戻す） */
    resetA: function () {
      this.fileName = '';
      this.durationSec = 0;
      this.startSec = C.START_DEFAULT_SEC;
      this.endSec = 0;
      this.rate = C.RATE_DEFAULT;
      this.fileKeyA = '';
      this.memosA = [];
    },

    /** 2つ目だけを未選択に戻す */
    resetB: function () {
      this.fileNameB = '';
      this.durationSecB = 0;
      this.startSecB = 0;
      this.endSecB = 0;
      this.fileKeyB = '';
      this.memosB = [];
    },

    /** そのスロットの fileKey と区間メモを設定する（fileKey が空なら区間メモも空）。配列の順＝画面の上から下 */
    setMemos: function (slot, fileKey, items) {
      var list = fileKey ? (items || []).slice() : [];
      if (slot === 'C') { this.fileKeyC = fileKey || ''; this.memosC = list; }
      else if (slot === 'B') { this.fileKeyB = fileKey || ''; this.memosB = list; }
      else { this.fileKeyA = fileKey || ''; this.memosA = list; }
    }
  };
})();
