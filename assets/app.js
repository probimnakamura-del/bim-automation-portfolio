/* ============================================================
   Python1 ツールカタログ — 共通JS（依存ゼロ / vanilla）
   file:// で動くこと。fetch/XHR は使わない。
   ============================================================ */

/* 状態: カテゴリタブAPI / IntersectionObserver（このファイル内で共有） */
var catTabsAPI = null;
var cardObserver = null;

/* ------------------------------------------------------------
   replay(btn)
   デモの「⟳ リプレイ」ボタンから呼ぶ。
   最寄りの .demo-wrap 内の .demo-svg を cloneNode(true) で
   丸ごと差し替える → CSSキーフレームアニメが先頭から再スタート。
   （SMILの<animate>を使っている場合も setCurrentTime(0) で保険）
   ------------------------------------------------------------ */
function replay(btn) {
  var wrap = btn && btn.closest ? btn.closest('.demo-wrap') : null;
  if (!wrap) { return; }
  var svg = wrap.querySelector('.demo-svg');
  if (!svg) { return; }

  // クローンを作って元のSVGと差し替える（アニメの完全リセット）
  var clone = svg.cloneNode(true);
  svg.parentNode.replaceChild(clone, svg);

  // SMILアニメが含まれる場合の保険（CSSキーフレームだけなら無害）
  if (typeof clone.setCurrentTime === 'function') {
    try { clone.setCurrentTime(0); } catch (e) { /* noop */ }
  }

  // 押した感のフィードバック（短時間だけ操作不能に）
  btn.classList.add('is-busy');
  btn.disabled = true;
  setTimeout(function () {
    btn.disabled = false;
    btn.classList.remove('is-busy');
  }, 350);
}

/* ------------------------------------------------------------
   filterCards(input)
   index.html の検索ボックス（oninput）から呼ぶ。
   .card をノード名(.card-name)・キャッチコピー(.card-catch)で絞り込む。
   data-search 属性があればそれを優先（実装側が付けても付けなくても動く）。
   ------------------------------------------------------------ */
function filterCards(input) {
  var q = (input && input.value ? input.value : '').trim().toLowerCase();

  // 検索中はカテゴリタブを「すべて」に戻す（.cat-section の display 管理を検索側へ一本化）
  if (catTabsAPI) { catTabsAPI.syncToAll(); }

  var cards = document.querySelectorAll('.card');
  var shown = 0;

  for (var i = 0; i < cards.length; i++) {
    var card = cards[i];
    var hay = card.getAttribute('data-search');
    if (!hay) {
      var name = card.querySelector('.card-name');
      var catch_ = card.querySelector('.card-catch');
      hay = (name ? name.textContent : '') + ' ' + (catch_ ? catch_.textContent : '');
    }
    hay = hay.toLowerCase();

    var hit = (q === '' || hay.indexOf(q) !== -1);
    if (hit) {
      card.classList.remove('is-hidden');
      shown++;
    } else {
      card.classList.add('is-hidden');
    }
  }

  // 中身が全部隠れたカテゴリ節は節ごと隠す
  var sections = document.querySelectorAll('.cat-section');
  for (var s = 0; s < sections.length; s++) {
    var sec = sections[s];
    var visible = sec.querySelectorAll('.card:not(.is-hidden)').length;
    sec.style.display = (visible === 0 && q !== '') ? 'none' : '';
  }

  // ヒット0件メッセージ
  var nore = document.querySelector('.no-result');
  if (nore) {
    if (shown === 0 && q !== '') { nore.classList.add('show'); }
    else { nore.classList.remove('show'); }
  }
}

/* ------------------------------------------------------------
   ちょっとした操作性の底上げ（任意・無くても動作に影響なし）
   ------------------------------------------------------------ */
document.addEventListener('DOMContentLoaded', function () {
  // ハンバーガーメニューを全ページに注入
  buildDrawer();

  // カテゴリタブ（index のみ・要素があれば有効化）
  catTabsAPI = initCatTabs();

  // カード出現アニメ（スクロールIN）
  setupReveal();

  // 検索ボックスで Esc → クリア
  var box = document.querySelector('.search-box');
  if (box) {
    box.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        box.value = '';
        filterCards(box);
        box.blur();
      }
    });
  }

  // 全体関係マップのカテゴリブロックをクリックで該当節へスクロール（＋タブ連動）
  var maps = document.querySelectorAll('[data-jump]');
  for (var i = 0; i < maps.length; i++) {
    maps[i].style.cursor = 'pointer';
    maps[i].addEventListener('click', function () {
      var id = this.getAttribute('data-jump');
      if (catTabsAPI) { catTabsAPI.activate(id); }
      var tgt = document.getElementById(id);
      if (tgt) { tgt.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    });
  }

  // ハッシュ #cat-xxx に追従（footerリンク・別ページからの遷移）
  handleCatHash();
  window.addEventListener('hashchange', handleCatHash);
});

/* ------------------------------------------------------------
   buildDrawer()
   全ページ共通のハンバーガーメニュー（ドロワー）を動的注入。
   nodes/ 配下からの相対リンクは '../' を付ける（file://・http両対応）。
   ------------------------------------------------------------ */
function buildDrawer() {
  if (document.querySelector('.hb-btn')) { return; }  // 二重注入ガード
  var inNodes = location.pathname.indexOf('/nodes/') !== -1;
  var p = inNodes ? '../' : '';

  var cats = [
    ['cat-m2d',   '図面化パイプライン',        '#22d3ee'],
    ['cat-steel', '鉄骨モデリング支援',        '#fbbf24'],
    ['cat-ifc',   'IFC・データ連携',           '#a78bfa'],
    ['cat-rhino', 'Rhinoコマンド・配布ツール', '#34d399'],
    ['cat-ai',    '開発・AI基盤',              '#f472b6'],
    ['cat-ops',   '運用・監視・事務',          '#a3e635']
  ];
  var catLinks = '';
  for (var i = 0; i < cats.length; i++) {
    catLinks += '<a href="' + p + 'index.html#' + cats[i][0] + '">' +
                '<span class="hb-dot" style="--tab:' + cats[i][2] + '"></span>' +
                cats[i][1] + '</a>';
  }

  var html = '' +
    '<button class="hb-btn" type="button" aria-label="メニューを開く" aria-expanded="false">☰</button>' +
    '<div class="hb-overlay"></div>' +
    '<aside class="hb-drawer" role="dialog" aria-label="サイトメニュー" aria-hidden="true">' +
      '<div class="hb-drawer-head">' +
        '<span class="hb-title">メニュー</span>' +
        '<button class="hb-close" type="button" aria-label="メニューを閉じる">×</button>' +
      '</div>' +
      '<nav class="hb-nav">' +
        '<div class="hb-sec-label">ナビ</div>' +
        '<a href="' + p + 'index.html">🏠 トップ</a>' +
        '<a href="' + p + 'pipeline.html">🔀 Make2Dパイプライン図</a>' +
        catLinks +
        '<div class="hb-sec-label">製作者</div>' +
        '<div class="hb-author">中村 勇太</div>' +
        '<p class="hb-note">本サイトは AI（Claude）をディレクションして構築（調査・執筆・アニメデモ・実装まで AI エージェント活用）</p>' +
      '</nav>' +
    '</aside>';

  var holder = document.createElement('div');
  holder.className = 'hb-root';
  holder.innerHTML = html;
  document.body.appendChild(holder);

  var btn     = holder.querySelector('.hb-btn');
  var overlay = holder.querySelector('.hb-overlay');
  var drawer  = holder.querySelector('.hb-drawer');
  var closeB  = holder.querySelector('.hb-close');

  function openMenu() {
    drawer.classList.add('is-open');
    overlay.classList.add('is-open');
    btn.setAttribute('aria-expanded', 'true');
    drawer.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }
  function closeMenu() {
    drawer.classList.remove('is-open');
    overlay.classList.remove('is-open');
    btn.setAttribute('aria-expanded', 'false');
    drawer.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }
  btn.addEventListener('click', openMenu);
  overlay.addEventListener('click', closeMenu);
  closeB.addEventListener('click', closeMenu);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && drawer.classList.contains('is-open')) { closeMenu(); }
  });
  // メニュー内リンクを押したら閉じる（同ページ内ハッシュ移動でも閉じる）
  var links = drawer.querySelectorAll('a');
  for (var k = 0; k < links.length; k++) {
    links[k].addEventListener('click', closeMenu);
  }
}

/* ------------------------------------------------------------
   initCatTabs()
   index.html のカテゴリタブ。クリックで該当 .cat-section のみ表示。
   検索との display 競合を避けるため、タブ切替時は検索をクリアする。
   戻り値: { activate, syncToAll } / タブが無ければ null。
   ------------------------------------------------------------ */
function initCatTabs() {
  var tabs = document.querySelectorAll('.cat-tab');
  if (!tabs.length) { return null; }
  var sections = document.querySelectorAll('.cat-section');
  var box = document.querySelector('.search-box');

  function setActive(catId) {
    for (var t = 0; t < tabs.length; t++) {
      if (tabs[t].getAttribute('data-cat-filter') === catId) { tabs[t].classList.add('is-active'); }
      else { tabs[t].classList.remove('is-active'); }
    }
  }
  function clearCardHidden() {
    var cards = document.querySelectorAll('.card');
    for (var c = 0; c < cards.length; c++) { cards[c].classList.remove('is-hidden'); }
    var nore = document.querySelector('.no-result');
    if (nore) { nore.classList.remove('show'); }
  }
  function applyFilter(catId) {
    for (var s = 0; s < sections.length; s++) {
      var sec = sections[s];
      var show = (catId === 'all' || sec.id === catId);
      sec.style.display = show ? '' : 'none';
      if (show) { staggerCards(sec.querySelectorAll('.card')); }
    }
  }
  function activate(catId) {
    setActive(catId);
    if (box) { box.value = ''; }   // 検索状態を解除（displayをタブ側で管理）
    clearCardHidden();
    applyFilter(catId);
  }
  // タブクリック
  for (var t = 0; t < tabs.length; t++) {
    tabs[t].addEventListener('click', function () {
      activate(this.getAttribute('data-cat-filter'));
    });
  }
  // 検索側から呼ぶ: タブ表示だけ「すべて」に戻す（displayは検索側が管理）
  function syncToAll() { setActive('all'); }

  return { activate: activate, syncToAll: syncToAll };
}

/* ------------------------------------------------------------
   handleCatHash()
   URLハッシュ #cat-xxx に追従して該当タブをアクティブ化＋スクロール。
   ------------------------------------------------------------ */
function handleCatHash() {
  if (!catTabsAPI) { return; }
  var h = location.hash ? location.hash.replace('#', '') : '';
  if (h && h.indexOf('cat-') === 0) {
    catTabsAPI.activate(h);
    var tgt = document.getElementById(h);
    if (tgt) { tgt.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  }
}

/* ------------------------------------------------------------
   setupReveal() / staggerCards()
   .card のスクロール出現（IntersectionObserver）と
   タブ切替時のstagger出現を、同じ pre-reveal / revealing クラスで扱う。
   ------------------------------------------------------------ */
function setupReveal() {
  var cards = document.querySelectorAll('.card');
  if (!cards.length) { return; }
  if (!('IntersectionObserver' in window)) { return; }  // 非対応環境は素の表示のまま

  var i;
  for (i = 0; i < cards.length; i++) { cards[i].classList.add('pre-reveal'); }

  cardObserver = new IntersectionObserver(function (entries) {
    for (var e = 0; e < entries.length; e++) {
      if (entries[e].isIntersecting) {
        var c = entries[e].target;
        cardObserver.unobserve(c);
        c.classList.remove('pre-reveal');
        c.classList.add('revealing');
        bindRevealEnd(c);
      }
    }
  }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

  for (i = 0; i < cards.length; i++) { cardObserver.observe(cards[i]); }
}
function bindRevealEnd(c) {
  c.addEventListener('animationend', function handler() {
    c.classList.remove('revealing');
    c.style.animationDelay = '';
    c.removeEventListener('animationend', handler);
  });
}
function staggerCards(cards) {
  if (!cards || !cards.length) { return; }
  if (!('IntersectionObserver' in window)) { return; }
  var i, c;
  // 一旦リセット（observerからも外して二重発火を防ぐ）
  for (i = 0; i < cards.length; i++) {
    c = cards[i];
    if (cardObserver) { cardObserver.unobserve(c); }
    c.classList.remove('revealing');
    c.classList.add('pre-reveal');
  }
  void document.body.offsetWidth;  // 強制リフローでアニメを確実に再起動
  for (i = 0; i < cards.length; i++) {
    (function (card, idx) {
      card.classList.remove('pre-reveal');
      card.style.animationDelay = (idx * 45) + 'ms';
      card.classList.add('revealing');
      bindRevealEnd(card);
    })(cards[i], i);
  }
}
