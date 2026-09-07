/* Stevi — movimento da landing (v2, set/2026). Sem dependências.
   A página inteira é legível sem isto; aqui entra só o que o scroll dirige:
   revelação, seções pinadas (--p), contadores, tema do header e o vídeo do
   hero escolhido pelo tamanho da tela. Ver web/README.md, "Movimento". */
(function () {
  'use strict';

  // Sinal de vida para o desarme do index.html: enquanto isto não roda, quem
  // esconde o conteúdo (`.js .reveal { opacity: 0 }`) está sem ninguém para
  // revelá-lo. Tem que ser a PRIMEIRA linha — qualquer erro abaixo (navegador
  // velho, API faltando) deixaria a bandeira por levantar e a página seria
  // desarmada e mostrada inteira, que é o desfecho certo.
  window.__steviApp = true;

  var doc = document.documentElement;
  var reduceMotion = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
  var isMobile = window.matchMedia
    ? window.matchMedia('(max-width: 767.98px)').matches
    : false;
  var saveData = !!(navigator.connection && navigator.connection.saveData);

  /* ── Vídeo do hero: uma fonte só, escolhida pela tela ───────────────── */
  // O HTML não traz <source>: o poster já é a imagem de fallback. Aqui entra
  // o 9:16 (0,5 MB) no celular e o 16:9 (1,5 MB) no desktop. Com "economia
  // de dados" ligada, fica no poster — 2G rural não paga vídeo decorativo.
  var hero = document.querySelector('.hero__bg video');
  if (hero && !saveData) {
    var addSource = function (src, type) {
      if (!src) return;
      var s = document.createElement('source');
      s.src = src;
      s.type = type;
      hero.appendChild(s);
    };
    if (isMobile) {
      hero.poster = hero.getAttribute('data-mobile-poster') || hero.poster;
      addSource(hero.getAttribute('data-mobile-mp4'), 'video/mp4');
    } else {
      addSource(hero.getAttribute('data-desktop-webm'), 'video/webm');
      addSource(hero.getAttribute('data-desktop-mp4'), 'video/mp4');
    }
    hero.load();
    if (!reduceMotion) {
      var p = hero.play();
      if (p && p.catch) p.catch(function () {});
    }
  }

  // Vídeos secundários só baixam quando a seção deles se aproxima.
  var lazyVideos = document.querySelectorAll('video[data-lazy-mp4]');
  function carregarVideo(v) {
    if (v.getAttribute('data-loaded') || saveData) return;
    v.setAttribute('data-loaded', '1');
    var s = document.createElement('source');
    s.src = v.getAttribute('data-lazy-mp4');
    s.type = 'video/mp4';
    v.appendChild(s);
    v.load();
    if (!reduceMotion) {
      var pp = v.play();
      if (pp && pp.catch) pp.catch(function () {});
    }
  }

  /* ── Revelação ───────────────────────────────────────────────────────── */
  var revealables = document.querySelectorAll('.reveal, .mask');

  function revealAll() {
    for (var i = 0; i < revealables.length; i++) {
      revealables[i].classList.add('is-visible');
    }
  }

  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealAll();
    for (var lv = 0; lv < lazyVideos.length; lv++) carregarVideo(lazyVideos[lv]);
  } else {
    var io = new IntersectionObserver(
      function (entries, obs) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
    );
    revealables.forEach(function (el) { io.observe(el); });

    var ioVideo = new IntersectionObserver(
      function (entries, obs) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            carregarVideo(entry.target);
            obs.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '60% 0px' }
    );
    lazyVideos.forEach(function (v) { ioVideo.observe(v); });
  }

  /* ── Contadores ──────────────────────────────────────────────────────── */
  var counters = document.querySelectorAll('[data-count]');
  function contar(el) {
    var alvo = parseInt(el.getAttribute('data-count'), 10) || 0;
    if (reduceMotion || alvo === 0) { el.textContent = String(alvo); return; }
    var inicio = null;
    var dur = 900;
    function passo(ts) {
      if (inicio === null) inicio = ts;
      var t = Math.min(1, (ts - inicio) / dur);
      var e = 1 - Math.pow(1 - t, 3);
      el.textContent = String(Math.round(alvo * e));
      if (t < 1) requestAnimationFrame(passo);
    }
    requestAnimationFrame(passo);
  }
  if (counters.length && 'IntersectionObserver' in window && !reduceMotion) {
    var ioCount = new IntersectionObserver(
      function (entries, obs) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            contar(entry.target);
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.6 }
    );
    counters.forEach(function (c) { c.textContent = '0'; ioCount.observe(c); });
  }

  /* ── Driver de scroll: [data-pin] → --p e passos ─────────────────────── */
  // Para cada wrapper pinado, o progresso 0→1 do scroll dentro dele vira a
  // variável CSS --p; se tiver data-steps, o passo ativo (floor(p * n)) liga
  // `.is-active` em todo [data-i] do wrapper. O CSS faz o resto.
  var pins = [];
  var pinEls = document.querySelectorAll('[data-pin]');
  for (var k = 0; k < pinEls.length; k++) {
    var el = pinEls[k];
    var steps = parseInt(el.getAttribute('data-steps'), 10) || 0;
    var itens = {};
    if (steps) {
      var nodes = el.querySelectorAll('[data-i]');
      for (var n = 0; n < nodes.length; n++) {
        var idx = nodes[n].getAttribute('data-i');
        (itens[idx] = itens[idx] || []).push(nodes[n]);
      }
    }
    pins.push({ el: el, steps: steps, itens: itens, ativo: 0, scroll: el.hasAttribute('data-scroll') });
  }

  function aplicarPasso(pin, i) {
    if (i === pin.ativo) return;
    var antes = pin.itens[String(pin.ativo)] || [];
    var depois = pin.itens[String(i)] || [];
    for (var a = 0; a < antes.length; a++) antes[a].classList.remove('is-active');
    for (var d = 0; d < depois.length; d++) depois[d].classList.add('is-active');
    pin.ativo = i;
  }

  var vh = window.innerHeight;
  function medir() {
    vh = window.innerHeight;
    for (var i = 0; i < pins.length; i++) {
      var r = pins[i].el.getBoundingClientRect();
      var p;
      if (pins[i].scroll) {
        // Seção não-pinada que só quer saber quanto já cruzou a viewport.
        p = (vh - r.top) / (vh + r.height);
      } else {
        // Wrapper pinado: 0 quando o topo encosta, 1 quando o fundo solta.
        p = -r.top / Math.max(1, r.height - vh);
      }
      p = Math.max(0, Math.min(1, p));
      if (reduceMotion) p = 1;
      pins[i].el.style.setProperty('--p', p.toFixed(4));
      if (pins[i].steps) {
        var s = Math.min(pins[i].steps - 1, Math.floor(p * pins[i].steps));
        aplicarPasso(pins[i], reduceMotion ? 0 : s);
      }
    }
  }

  /* ── Header: tema por seção ──────────────────────────────────────────── */
  var header = document.querySelector('.site-header');
  var temas = document.querySelectorAll('[data-theme]');
  function temaDoHeader() {
    if (!header) return;
    header.classList.toggle('is-scrolled', window.scrollY > 8);
    var linha = (header.offsetHeight || 72) / 2;
    var atual = 'dark';
    for (var i = 0; i < temas.length; i++) {
      var r = temas[i].getBoundingClientRect();
      if (r.top <= linha && r.bottom > linha) { atual = temas[i].getAttribute('data-theme'); break; }
    }
    header.classList.toggle('is-light', atual === 'light');
  }

  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      medir();
      temaDoHeader();
      ticking = false;
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  medir();
  temaDoHeader();
})();
