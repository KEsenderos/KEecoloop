/* js/state.js / 状態変数の保管（RE.State） / 仕様書 v1.1 8章・9.2章 / 版 1.9.0 */
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
    playerState: C.PLAYER_STATE.NO_FILE,

    /** 全変数を初期値へ（moveSecは保存値） */
    init: function () {
      this.fileName = '';
      this.durationSec = 0;
      this.moveSec = RE.Utils.loadMoveSec();
      this.rate = C.RATE_DEFAULT;
      this.mode = C.MODE.SINGLE;
      this.fileNameB = '';
      this.durationSecB = 0;
      this.startSecB = 0;
      this.endSecB = 0;
      this.startSec = C.START_DEFAULT_SEC;
      this.endSec = 0;
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
      this.endSecB = Math.min(C.END_DEFAULT_SEC, durationSec);
    },

    /** 1つ目だけを未選択に戻す（2つ目・モード・移動時間は残す。倍速は1.0に戻す） */
    resetA: function () {
      this.fileName = '';
      this.durationSec = 0;
      this.startSec = C.START_DEFAULT_SEC;
      this.endSec = 0;
      this.rate = C.RATE_DEFAULT;
    },

    /** 2つ目だけを未選択に戻す */
    resetB: function () {
      this.fileNameB = '';
      this.durationSecB = 0;
      this.startSecB = 0;
      this.endSecB = 0;
    }
  };
})();
