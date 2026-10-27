/* js/config.js / 定数（RE.Config） / 仕様書 v3.3.0 7章 / 版 3.3.0 */
(function () {
  'use strict';
  window.RE = window.RE || {};

  /** 画面の文言（v3.3.0）。読むたびに、いまの言語の文言を返す（RE.I18n.t(prefix + 名前)）。plain は言語に関係ない値 */
  function tr_(prefix, names, plain) {
    var o = {}, k;
    names.forEach(function (n) {
      Object.defineProperty(o, n, { enumerable: true, get: function () { return RE.I18n.t(prefix + n); } });
    });
    for (k in (plain || {})) o[k] = plain[k];
    return Object.freeze(o);
  }

  RE.Config = Object.freeze({
    APP_NAME: 'KEecoloop',
    APP_VERSION: '3.3.0',
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
    MODE: Object.freeze({ SINGLE: 'SINGLE', DOUBLE: 'DOUBLE', TRIPLE: 'TRIPLE' }),
    DOUBLE_MAX_SECTION_SEC: 2400,
    TRIPLE_MAX_SECTION_SEC: 3600,   // 3区間モードの区間合計の上限（秒＝60分）
    TRIPLE_STEREO_MAX_MB: 450,      // 3区間モードで、展開後サイズの合計がこれ以下ならステレオのまま、超えたらモノラル
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
    DB_VERSION: 2,
    // 区間メモ（v2.9）
    MEMO_MAX_PER_FILE: 10,
    MEMO_NAME_MAX: 20,          // v3.1.6: 区間メモの名前の最大文字数
    get MEMO_NAME_PLACEHOLDER() { return RE.I18n.t('memo.placeholder'); },   // v3.1.7: 名前が空のときの表示（v3.2.0: 言語対応）
    MEMO_MAX_FILES: 50,
    SAVE_MAX_BYTES: 41943040,
    RESTORE_TIMEOUT_MS: 4000,
    // 説明文（画面の各所の小さい文字）。印を変えるときは PREFIX だけ直す
    HINT: tr_('hint.', ['NEXT', 'MOVE_NOTE_N', 'MOVE_NOTE_1', 'GAP', 'RATE', 'MEMO'], { PREFIX: '※ ' }),
    LABEL: tr_('label.', ['MEMO_SAVE', 'PLAY_ON', 'PLAY_OFF']),
    UI_REFRESH_MS: 250,
    MINUTES_MAX_DIGITS: 2,
    BAR_MARKER_MIN_PX: 8,
    KEEPALIVE_SILENT_AUDIO: true,
    STORAGE_KEY_MOVE: 're.moveSec',
    // ご意見・ご要望のGoogleフォームのURL。空のままなら、設定タブのこの枠は出ない。https://docs.google.com/forms/ か https://forms.gle/ で始まるURLだけ使われる
    FEEDBACK_URL: '',
    STORAGE_KEY_LANG: 're.lang',   // v3.2.0: 言語の選び（auto / ja / en / es / fil）
    PLAYER_STATE: Object.freeze({ NO_FILE: 'NO_FILE', STOPPED: 'STOPPED', PLAYING: 'PLAYING', PAUSED: 'PAUSED' }),
    ERR: Object.freeze({ DECODE: 'DECODE', PLAY_BLOCKED: 'PLAY_BLOCKED', INTERRUPTED: 'INTERRUPTED', TOO_LONG: 'TOO_LONG' }),
    MSG: tr_('msg.', ['FILE_LOADING', 'FILE_ERROR', 'NO_FILE_SELECTED', 'MOVE_SEC_INVALID', 'MOVE_SEC_CLAMPED', 'REACHED_END', 'PLAY_BLOCKED', 'INTERRUPTED', 'RATE_TOO_LONG', 'RATE_RESET_LONG', 'UPDATE_AVAILABLE', 'UPDATE_NOTE', 'DOUBLE_TOO_LONG', 'TRIPLE_TOO_LONG', 'TRIPLE_MONO_NOTICE', 'REACHED_START', 'MARK_NEED_PLAY', 'MARK_OTHER_SLOT', 'RESTORE_FAILED', 'RESTORE_SKIPPED', 'NO_B_FILE_SELECTED', 'MEMO_SAVED', 'MEMO_DUP', 'MEMO_REPLACED', 'MEMO_NAME_PROMPT', 'MEMO_SOLO', 'MEMO_OUT_OF_RANGE'])
  });
})();
