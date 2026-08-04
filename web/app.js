/* Stevi landing — progressive enhancement only.
   The page is fully readable without JS; this adds scroll-reveal motion
   and a subtle sticky-header shadow. No dependencies. */
(function () {
  'use strict';

  // Sinal de vida para o desarme do index.html: enquanto isto não roda, quem
  // esconde o conteúdo (`.js .reveal { opacity: 0 }`) está sem ninguém para
  // revelá-lo. Tem que ser a PRIMEIRA linha — qualquer erro abaixo (navegador
  // velho, API faltando) deixaria a bandeira por levantar e a página seria
  // desarmada e mostrada inteira, que é o desfecho certo.
  window.__steviApp = true;

  var reduceMotion = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

  var revealables = document.querySelectorAll('.reveal');

  function revealAll() {
    for (var i = 0; i < revealables.length; i++) {
      revealables[i].classList.add('is-visible');
    }
  }

  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealAll();
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
  }

  // Sticky header: strengthen shadow once the page is scrolled.
  var header = document.querySelector('.site-header');
  if (header) {
    var onScroll = function () {
      if (window.scrollY > 8) header.classList.add('is-scrolled');
      else header.classList.remove('is-scrolled');
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }
})();
