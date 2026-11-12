(function () {
  'use strict';

  /* ---------- Header: solid on scroll ---------- */
  const header = document.getElementById('site-header');
  const menu = document.getElementById('mobile-menu');
  const toggle = document.getElementById('menu-toggle');

  function updateHeader() {
    const menuOpen = toggle.getAttribute('aria-expanded') === 'true';
    header.classList.toggle('is-solid', window.scrollY > 40 || menuOpen);
  }
  window.addEventListener('scroll', updateHeader, { passive: true });
  updateHeader();

  /* ---------- Mobile menu ---------- */
  function setMenu(open) {
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    menu.classList.toggle('hidden', !open);
    toggle.querySelector('.icon-open').classList.toggle('hidden', open);
    toggle.querySelector('.icon-close').classList.toggle('hidden', !open);
    updateHeader();
  }
  toggle.addEventListener('click', function () {
    setMenu(toggle.getAttribute('aria-expanded') !== 'true');
  });
  menu.querySelectorAll('a').forEach(function (link) {
    link.addEventListener('click', function () { setMenu(false); });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
      setMenu(false);
      toggle.focus();
    }
  });

  /* ---------- Gallery filter ---------- */
  const filterButtons = document.querySelectorAll('.filter-btn');
  const items = document.querySelectorAll('.gallery-item');
  const status = document.getElementById('gallery-status');

  filterButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      const filter = btn.dataset.filter;

      filterButtons.forEach(function (b) {
        const active = b === btn;
        b.classList.toggle('is-active', active);
        b.setAttribute('aria-pressed', String(active));
      });

      let shown = 0;
      items.forEach(function (item) {
        const match = filter === 'all' || item.dataset.category === filter;
        if (match) {
          shown++;
          item.classList.remove('is-hidden');
          // allow display change to apply before fading in
          requestAnimationFrame(function () {
            requestAnimationFrame(function () { item.classList.remove('is-hiding'); });
          });
        } else {
          item.classList.add('is-hiding');
          setTimeout(function () {
            if (item.classList.contains('is-hiding')) item.classList.add('is-hidden');
          }, 350);
        }
      });

      status.textContent = 'Showing ' + shown + ' ' + (filter === 'all' ? 'photos' : filter + ' photos');
    });
  });

  /* ---------- Package "Enquire" preselects form ---------- */
  const packageSelect = document.getElementById('package');
  document.querySelectorAll('[data-package]').forEach(function (link) {
    link.addEventListener('click', function () {
      packageSelect.value = link.dataset.package;
    });
  });

  /* ---------- Enquiry form ---------- */
  const form = document.getElementById('enquiry-form');
  const success = document.getElementById('form-success');

  function setError(field, message) {
    const el = document.getElementById(field.id + '-error');
    field.setAttribute('aria-invalid', message ? 'true' : 'false');
    if (el) {
      el.textContent = message || '';
      if (message) field.setAttribute('aria-describedby', el.id);
      else field.removeAttribute('aria-describedby');
    }
  }

  function validate() {
    let firstInvalid = null;
    const name = form.elements.name;
    const email = form.elements.email;
    const message = form.elements.message;

    if (!name.value.trim()) { setError(name, 'Please tell me your name.'); firstInvalid = firstInvalid || name; }
    else setError(name, '');

    if (!email.value.trim()) { setError(email, 'Please add an email so I can reply.'); firstInvalid = firstInvalid || email; }
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) { setError(email, 'That email address doesn’t look quite right.'); firstInvalid = firstInvalid || email; }
    else setError(email, '');

    if (message.value.trim().length < 10) { setError(message, 'A few words about your plans would help.'); firstInvalid = firstInvalid || message; }
    else setError(message, '');

    return firstInvalid;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    const invalid = validate();
    if (invalid) { invalid.focus(); return; }

    const firstName = form.elements.name.value.trim().split(/[\s&]+/)[0];
    success.textContent = 'Thank you, ' + firstName + ' — your enquiry is on its way. I’ll be in touch within two working days.';
    success.classList.remove('hidden');
    success.focus();
    form.reset();
    form.querySelectorAll('[aria-invalid]').forEach(function (f) { f.setAttribute('aria-invalid', 'false'); });
  });

  /* ---------- Reveal on scroll ---------- */
  const revealTargets = document.querySelectorAll('section:not(#top) > div');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });
    revealTargets.forEach(function (el) { el.classList.add('reveal'); io.observe(el); });
  }

  /* ---------- Footer year ---------- */
  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
})();
