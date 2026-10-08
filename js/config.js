/* js/config.js / 定数（RE.Config） / 仕様書 v1.1 7章 / 版 1.8.0 */
(function () {
  'use strict';
  window.RE = window.RE || {};

  RE.Config = Object.freeze({
    APP_NAME: 'KEecoloop',
    APP_VERSION: '1.8.0',
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
    ACCEPT_AUDIO: 'audio/*,.mp3,.m4a,.wav,.aac,.flac,.ogg',
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
      DOUBLE_TOO_LONG: '2つの区間の合計が長すぎます（40分以内にしてください）',
      NO_B_FILE_SELECTED: '2つ目の音声を選ぶには、2つ目の ⏏ を押してください'
    })
  });
})();
