/* js/state.js / 状態変数の保管（RE.State） / 仕様書 v1.1 8章・9.2章 / 版 1.6.0 */
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
    playerState: C.PLAYER_STATE.NO_FILE,

    /** 全変数を初期値へ（moveSecは保存値） */
    init: function () {
      this.fileName = '';
      this.durationSec = 0;
      this.moveSec = RE.Utils.loadMoveSec();
      this.rate = C.RATE_DEFAULT;
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
    }
  };
})();
