/* js/store.js / 前回のファイルと区間の保存・読み出し（RE.Store） / 仕様書 v3.1.4 / 版 3.1.4
 * 端末内のデータベース（IndexedDB）に保存する。使えない・失敗した場合も、エラーにせず「保存なし」として扱う。
 * どの関数も、失敗しても reject しない（呼び出し側は結果が空でも困らない）。 */
(function () {
  'use strict';
  var C = RE.Config;
  var dbPromise = null;

  function open_() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      try {
        if (!window.indexedDB) { reject(new Error('NO_IDB')); return; }
        var req = window.indexedDB.open(C.DB_NAME, C.DB_VERSION);
        req.onupgradeneeded = function () {
          var db = req.result;
          if (!db.objectStoreNames.contains('files')) db.createObjectStore('files');
          if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
          if (!db.objectStoreNames.contains('memos')) db.createObjectStore('memos', { keyPath: 'fileKey' });
        };
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function () { reject(req.error || new Error('IDB_ERROR')); };
        req.onblocked = function () { reject(new Error('IDB_BLOCKED')); };
      } catch (e) { reject(e); }
    });
    dbPromise.catch(function () { dbPromise = null; });
    return dbPromise;
  }

  /** 1回の読み書き。結果（get の値）を返す。失敗したら reject */
  function run_(storeName, mode, fn) {
    return open_().then(function (db) {
      return new Promise(function (resolve, reject) {
        var t = db.transaction(storeName, mode);
        var req = fn(t.objectStore(storeName));
        t.oncomplete = function () { resolve(req ? req.result : undefined); };
        t.onerror = function () { reject(t.error || new Error('IDB_TX_ERROR')); };
        t.onabort = function () { reject(t.error || new Error('IDB_ABORT')); };
      });
    });
  }

  /** ファイルを保存する（slot は "A"・"B"・"C"）。SAVE_MAX_BYTES を超える場合は保存しない。成功なら true */
  function saveFile(slot, file) {
    if (!file || file.size > C.SAVE_MAX_BYTES) return Promise.resolve(false);
    return run_('files', 'readwrite', function (st) {
      return st.put({ name: file.name, type: file.type || '', blob: file, savedAt: Date.now() }, slot);
    }).then(function () { return true; }, function () { return false; });
  }

  /** 区間・モードなどの記録を保存する */
  function saveMeta(meta) {
    return run_('meta', 'readwrite', function (st) { return st.put(meta, 'session'); })
      .then(function () { return true; }, function () { return false; });
  }

  /** 保存されている内容をまとめて読む。{A, B, meta}（無いものは null）。RESTORE_TIMEOUT_MS で見切りをつける */
  function loadAll() {
    var work = Promise.all([
      run_('files', 'readonly', function (st) { return st.get('A'); }),
      run_('files', 'readonly', function (st) { return st.get('B'); }),
      run_('files', 'readonly', function (st) { return st.get('C'); }),
      run_('meta', 'readonly', function (st) { return st.get('session'); })
    ]).then(function (r) { return { A: r[0] || null, B: r[1] || null, C: r[2] || null, meta: r[3] || null }; });
    var timeout = new Promise(function (resolve) { setTimeout(function () { resolve(null); }, C.RESTORE_TIMEOUT_MS); });
    return Promise.race([work, timeout]).catch(function () { return null; });
  }

  /** 片方のファイルの記録を消す */
  function clearSlot(slot) {
    return run_('files', 'readwrite', function (st) { return st.delete(slot); })
      .then(function () { return true; }, function () { return false; });
  }

  /** 保存内容をすべて消す */
  function clearAll() {
    return run_('files', 'readwrite', function (st) { return st.clear(); })
      .then(function () { return run_('meta', 'readwrite', function (st) { return st.clear(); }); })
      .then(function () { return true; }, function () { return false; });
  }

  /** 区間メモを読む（その fileKey の1件だけ）。無い・失敗・時間切れは [] */
  function getMemos(fileKey) {
    if (!fileKey) return Promise.resolve([]);
    var work = run_('memos', 'readonly', function (st) { return st.get(fileKey); })
      .then(function (rec) { return rec && rec.items ? rec.items : []; });
    var timeout = new Promise(function (resolve) { setTimeout(function () { resolve([]); }, C.RESTORE_TIMEOUT_MS); });
    return Promise.race([work, timeout]).catch(function () { return []; });
  }

  /** 区間メモを保存する（配列の順のまま）。items が空なら記録を削除。記録するファイル数が上限を超えたら、最も古いものを消す */
  function putMemos(fileKey, name, items) {
    if (!fileKey) return Promise.resolve(false);
    var step;
    if (!items || !items.length) {
      step = run_('memos', 'readwrite', function (st) { return st.delete(fileKey); });
    } else {
      step = run_('memos', 'readwrite', function (st) {
        return st.put({ fileKey: fileKey, name: name, items: items, updatedAt: Date.now() });
      }).then(function () {
        return run_('memos', 'readonly', function (st) { return st.count(); });
      }).then(function (n) {
        if (n <= C.MEMO_MAX_FILES) return null;
        return run_('memos', 'readonly', function (st) { return st.getAll(); }).then(function (all) {
          all.sort(function (a, b) { return a.updatedAt - b.updatedAt; });
          var drop = all.slice(0, all.length - C.MEMO_MAX_FILES);
          return run_('memos', 'readwrite', function (st) {
            drop.forEach(function (r) { st.delete(r.fileKey); });
            return null;
          });
        });
      });
    }
    return step.then(function () { return true; }, function () { return false; });
  }

  /** 保存領域を勝手に消されにくくするお願い（できなくても問題なし） */
  function requestPersist() {
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {}); } catch (e) { /* 無視 */ }
  }

  RE.Store = { saveFile: saveFile, saveMeta: saveMeta, loadAll: loadAll, clearSlot: clearSlot, clearAll: clearAll, requestPersist: requestPersist, getMemos: getMemos, putMemos: putMemos };
})();
