// 모든 화면이 쓰는 작은 동작: 좁은 화면 메뉴, 아래 메뉴 열기, 첫 화면 사진 넘기기, 옛 주소 넘기기.
// 이 파일은 회원 칸 서버를 부르지 않는다.
(function () {
  'use strict';

  function pageData() {
    var el = document.getElementById('page-data');
    if (!el) return {};
    try { return JSON.parse(el.textContent); } catch (e) { return {}; }
  }

  // 옛 주소(heconpol.org/?page_id=57 등)로 들어오면 새 화면으로 보낸다.
  function redirectOld(data) {
    if (!data.redirects) return false;
    var q = new URLSearchParams(location.search);
    var id = q.get('page_id');
    if (!id && !q.get('p') && !q.get('cat') && !q.get('feed')) return false;
    var to = (id && data.redirects[id]) || '/';
    if (!/^\/(?!\/)/.test(to)) to = '/';
    var dest = (data.base || '') + to;
    if (dest === location.pathname && !location.search) return false;
    location.replace(dest);
    return true;
  }

  function setupMenu() {
    var hdr = document.querySelector('.hdr');
    var btn = document.querySelector('.menu-btn');
    if (btn && hdr) {
      btn.addEventListener('click', function () {
        var open = hdr.classList.toggle('is-open');
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    }
    document.querySelectorAll('.sub-toggle').forEach(function (t) {
      t.addEventListener('click', function () {
        var li = t.closest('.has-sub');
        var open = li.classList.toggle('is-open');
        t.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      document.querySelectorAll('.has-sub.is-open').forEach(function (li) {
        li.classList.remove('is-open');
        var t = li.querySelector('.sub-toggle');
        if (t) t.setAttribute('aria-expanded', 'false');
      });
    });
  }

  function setupSlides() {
    var hero = document.querySelector('.hero');
    if (!hero) return;
    var slides = Array.prototype.slice.call(hero.querySelectorAll('.slide'));
    if (slides.length < 2) return;
    var now = hero.querySelector('.count-now');
    var bar = hero.querySelector('.count-bar');
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var idx = 0, timer = null, hovering = false, held = false;
    var step = 80 / Math.max(slides.length - 1, 1);

    function show(n) {
      idx = (n + slides.length) % slides.length;
      slides.forEach(function (s, i) {
        var on = i === idx;
        s.classList.toggle('is-on', on);
        if (on) { s.removeAttribute('aria-hidden'); s.removeAttribute('inert'); }
        else { s.setAttribute('aria-hidden', 'true'); s.setAttribute('inert', ''); }
      });
      if (now) now.textContent = String(idx + 1).padStart(2, '0');
      if (bar) bar.style.transform = 'translateX(' + (idx * step) + 'px)';
    }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }
    function start() {
      stop();
      if (reduce || hovering || held || document.hidden) return;
      timer = setInterval(function () { show(idx + 1); }, 7000);
    }
    hero.querySelectorAll('[data-slide]').forEach(function (b) {
      b.addEventListener('click', function () { show(idx + Number(b.getAttribute('data-slide'))); start(); });
    });
    hero.addEventListener('mouseenter', function () { hovering = true; stop(); });
    hero.addEventListener('mouseleave', function () { hovering = false; start(); });
    hero.addEventListener('focusin', function () { hovering = true; stop(); });
    hero.addEventListener('focusout', function () { hovering = false; start(); });
    document.addEventListener('visibilitychange', start);
    // WHO 판이 열려 있는 동안은 장면을 넘기지 않는다
    document.addEventListener('who-panel', function (e) { held = !!e.detail; if (held) stop(); else start(); });
    show(0);
    start();
  }

  // 첫 화면 지구본 장면의 '최근 활동 보기' → 오른쪽 판(2026-11-24). 스크립트가 없으면 단추가 교수 화면 절로 간다.
  function setupWhoPanel() {
    var panel = document.getElementById('who-panel');
    var dim = document.querySelector('.who-dim');
    if (!panel || !dim) return;
    var opener = null;
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    function focusables() {
      return Array.prototype.slice.call(panel.querySelectorAll('a[href], button'));
    }
    function hold(on) {
      var ev;
      try { ev = new CustomEvent('who-panel', { detail: on }); } catch (e) { return; }
      document.dispatchEvent(ev);
    }
    function open(e) {
      e.preventDefault();
      opener = e.currentTarget;
      hold(true);
      panel.hidden = false; dim.hidden = false;
      document.body.classList.add('who-open');
      opener.setAttribute('aria-expanded', 'true');
      requestAnimationFrame(function () { panel.classList.add('is-in'); });
      panel.querySelector('.who-x').focus();
    }
    function close() {
      if (panel.hidden) return;
      panel.classList.remove('is-in');
      dim.hidden = true;
      document.body.classList.remove('who-open');
      var done = function () { panel.hidden = true; };
      if (reduce) done(); else setTimeout(done, 300);
      if (opener) { opener.setAttribute('aria-expanded', 'false'); opener.focus(); }
      hold(false);
    }
    document.querySelectorAll('[data-who-open]').forEach(function (b) {
      b.setAttribute('aria-expanded', 'false');
      b.addEventListener('click', open);
    });
    panel.querySelector('.who-x').addEventListener('click', close);
    dim.addEventListener('click', close);
    document.addEventListener('keydown', function (e) {
      if (panel.hidden) return;
      if (e.key === 'Escape') { close(); return; }
      if (e.key !== 'Tab') return;
      var f = focusables();
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  }

  function setupAuthNav() {
    var loggedIn = false;
    try {
      if (localStorage.getItem('labFake.session')) loggedIn = true;
      var hc = localStorage.getItem('heconpol-auth');
      if (!loggedIn && hc && hc.indexOf('access_token') !== -1) loggedIn = true;
      for (var i = 0; !loggedIn && i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && /^sb-.*-auth-token$/.test(k)) {
          var raw = localStorage.getItem(k);
          if (raw && raw.indexOf('access_token') !== -1) loggedIn = true;
        }
      }
    } catch (e) {}
    if (!loggedIn) return;
    document.querySelectorAll('.nav-list > li > a').forEach(function (a) {
      var href = a.getAttribute('href') || '';
      if (/\/login\/join\/?$/.test(href)) {
        a.parentElement.remove();
      } else if (/\/login\/?$/.test(href)) {
        a.textContent = '내 정보';
        a.setAttribute('href', href.replace(/\/login\/?$/, '/lab/me/'));
      }
    });
  }

  var data = pageData();
  if (redirectOld(data)) return;
  document.addEventListener('DOMContentLoaded', function () {
    setupMenu();
    setupAuthNav();
    setupSlides();
    setupWhoPanel();
  });
})();
