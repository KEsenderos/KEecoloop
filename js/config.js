/* js/config.js / 定数（RE.Config） / 仕様書 v2.8 7章 / 版 2.8 */
(function () {
  'use strict';
  window.RE = window.RE || {};

  RE.Config = Object.freeze({
    APP_NAME: 'KEecoloop',
    APP_VERSION: '2.8',
    ENGINE_TYPE: 'WEB_AUDIO',
    MOVE_SEC_MIN: 1,
    MOVE_SEC_MAX: 60,
    MOVE_SEC_DEFAULT: 5,
    START_DEFAULT_SEC: 0,
    END_DEFAULT_SEC: 5,
    TIME_UNITS_SEC: Object.freeze([600, 60, 10, 1]),
    OVERLAP_SEC: 1,
    REMOTE_DEBOUNCE_MS: 300,
    PRESS_MIN_MS: 150,
    RATE_OPTIONS: Object.freeze([1.2, 1.1, 1.0, 0.9, 0.8]),
    RATE_DEFAULT: 1.0,
    STRETCH_FRAME_MS: 40,
    STRETCH_SEARCH_MS: 15,
    STRETCH_DECIMATE: 4,
    STRETCH_MAX_SECTION_SEC: 180,
    UPDATE_CHECK_MIN_MS: 600000,
    MODE: Object.freeze({ SINGLE: 'SINGLE', DOUBLE: 'DOUBLE' }),
    DOUBLE_MAX_SECTION_SEC: 2400,
    // 読み込み時の軽量化。ステレオは維持し、24kHzで展開（話し声ではほぼ差が出ない）。0にすると端末標準（最高音質・メモリ大）
    AUDIO_SAMPLE_RATE: 24000,
    AUDIO_MONO: false,
    // ファイル選択欄の accept 属性。音声だけに絞り、iPhoneで「写真ライブラリ」「写真またはビデオを撮る」を出さない。
    // 空文字 '' にすると accept 属性を付けない（iPhoneで音声が灰色になって選べない場合の戻し先）。
    ACCEPT_AUDIO: '.mp3,.m4a,.wav,.aac,.flac,.ogg,audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/x-wav,audio/aac,audio/flac,audio/ogg',
    GAP_OPTIONS: Object.freeze([0, 1, 2, 3, 5]),
    GAP_DEFAULT: 0,
    STORAGE_KEY_GAP: 're.gapSec',
    STORAGE_KEY_RESTORING: 're.restoring',
    DB_NAME: 'keecoloop-db',
    DB_VERSION: 1,
    SAVE_MAX_BYTES: 41943040,
    RESTORE_TIMEOUT_MS: 4000,
    // 説明文（画面の各所の小さい文字）。印を変えるときは PREFIX だけ直す
    HINT: Object.freeze({
      PREFIX: '※ ',
      NEXT: '指定した時間を移動させます',
      MOVE_NOTE_N: '区間移動: 開始・終了を1秒戻してから、{n}秒進めます（実質＋{step}秒）',
      MOVE_NOTE_1: '区間移動: 開始・終了をそのまま1秒進めます（移動時間が1秒のときだけの決まり）',
      GAP: '区間を1回聞くごとに、この秒数の無音を入れます（声に出して真似する時間に）',
      RATE: '声の高さはそのままで、速さだけ変えます。押すとすぐ再生（区間の合計3分まで）'
    }),
    UI_REFRESH_MS: 250,
    MINUTES_MAX_DIGITS: 2,
    BAR_MARKER_MIN_PX: 8,
    KEEPALIVE_SILENT_AUDIO: true,
    STORAGE_KEY_MOVE: 're.moveSec',
    PLAYER_STATE: Object.freeze({ NO_FILE: 'NO_FILE', STOPPED: 'STOPPED', PLAYING: 'PLAYING', PAUSED: 'PAUSED' }),
    ERR: Object.freeze({ DECODE: 'DECODE', PLAY_BLOCKED: 'PLAY_BLOCKED', INTERRUPTED: 'INTERRUPTED', TOO_LONG: 'TOO_LONG' }),
    MSG: Object.freeze({
      FILE_LOADING: 'ファイルを読み込み中…',
      FILE_ERROR: '読み込めませんでした。mp3・m4a・wav形式か確認してください',
      NO_FILE_SELECTED: 'まず ⏏ でファイルを選んでください',
      MOVE_SEC_INVALID: '移動時間は1〜60の数字で入力してください',
      MOVE_SEC_CLAMPED: '1〜60の範囲に直しました',
      REACHED_END: 'ファイルの終わりに達しました',
      PLAY_BLOCKED: '再生できませんでした。もう一度再生ボタンを押してください',
      INTERRUPTED: '再生が中断されました。再生ボタンで再開できます',
      RATE_TOO_LONG: '区間が長すぎるため、この倍速は使えません（3分以内にしてください）',
      RATE_RESET_LONG: '区間が長いため、倍速を1.0に戻しました',
      UPDATE_AVAILABLE: '新しい版があります。ここをタップして更新',
      UPDATE_NOTE: '選んだファイルは選び直しになります',
      DOUBLE_TOO_LONG: '区間の合計が長すぎます（40分以内にしてください）',
      REACHED_START: '最初の区間です',
      MARK_NEED_PLAY: '再生中に押してください',
      MARK_OTHER_SLOT: '今鳴っている側の「ここを」ボタンを押してください',
      RESTORE_FAILED: '前回のファイルを読み込めませんでした。⏏ で選んでください',
      RESTORE_SKIPPED: '前回の読み込みが途中で止まったため、自動再開をやめました。⏏ で選んでください',
      NO_B_FILE_SELECTED: '2つ目の音声を選ぶには、2つ目の ⏏ を押してください'
    })
  });
})();
