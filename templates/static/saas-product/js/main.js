// Ledgerly landing page interactions
(function () {
  'use strict';

  // ----- Header shadow on scroll -----
  const header = document.getElementById('site-header');
  const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ----- Mobile menu -----
  const menuBtn = document.getElementById('menu-toggle');
  const mobileMenu = document.getElementById('mobile-menu');

  function setMenu(open) {
    menuBtn.setAttribute('aria-expanded', String(open));
    mobileMenu.classList.toggle('hidden', !open);
    menuBtn.querySelector('.icon-open').classList.toggle('hidden', open);
    menuBtn.querySelector('.icon-close').classList.toggle('hidden', !open);
    menuBtn.querySelector('.sr-only').textContent = open ? 'Close menu' : 'Open menu';
  }

  menuBtn.addEventListener('click', () => {
    setMenu(menuBtn.getAttribute('aria-expanded') !== 'true');
  });
  mobileMenu.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menuBtn.getAttribute('aria-expanded') === 'true') {
      setMenu(false);
      menuBtn.focus();
    }
  });
  window.addEventListener('resize', () => {
    if (window.innerWidth >= 768) setMenu(false);
  });

  // ----- Pricing toggle (monthly / yearly) -----
  const toggle = document.getElementById('billing-toggle');
  const labelMonthly = document.getElementById('label-monthly');
  const labelYearly = document.getElementById('label-yearly');
  const prices = document.querySelectorAll('.price');
  const notes = document.querySelectorAll('.billing-note');

  function setBilling(yearly) {
    const key = yearly ? 'yearly' : 'monthly';
    toggle.setAttribute('aria-checked', String(yearly));
    labelMonthly.classList.toggle('text-slate-900', !yearly);
    labelMonthly.classList.toggle('text-slate-500', yearly);
    labelYearly.classList.toggle('text-slate-900', yearly);
    labelYearly.classList.toggle('text-slate-500', !yearly);

    prices.forEach((el) => {
      el.classList.add('is-updating');
      setTimeout(() => {
        el.textContent = '$' + el.dataset[key];
        el.classList.remove('is-updating');
      }, 150);
    });
    notes.forEach((el) => {
      el.textContent = el.dataset[key];
    });
  }

  toggle.addEventListener('click', () => setBilling(toggle.getAttribute('aria-checked') !== 'true'));
  labelMonthly.addEventListener('click', () => setBilling(false));
  labelYearly.addEventListener('click', () => setBilling(true));
  labelMonthly.style.cursor = 'pointer';
  labelYearly.style.cursor = 'pointer';

  // ----- FAQ accordion (one open at a time) -----
  const triggers = document.querySelectorAll('.faq-trigger');

  function setPanel(btn, open) {
    const panel = document.getElementById(btn.getAttribute('aria-controls'));
    btn.setAttribute('aria-expanded', String(open));
    panel.hidden = !open;
    panel.classList.toggle('is-open', open);
  }

  triggers.forEach((btn, index) => {
    btn.addEventListener('click', () => {
      const willOpen = btn.getAttribute('aria-expanded') !== 'true';
      triggers.forEach((other) => {
        if (other !== btn) setPanel(other, false);
      });
      setPanel(btn, willOpen);
    });

    // Arrow-key navigation between questions
    btn.addEventListener('keydown', (e) => {
      let target = null;
      if (e.key === 'ArrowDown') target = triggers[(index + 1) % triggers.length];
      if (e.key === 'ArrowUp') target = triggers[(index - 1 + triggers.length) % triggers.length];
      if (e.key === 'Home') target = triggers[0];
      if (e.key === 'End') target = triggers[triggers.length - 1];
      if (target) {
        e.preventDefault();
        target.focus();
      }
    });
  });

  // ----- Email sign-up forms (front-end only) -----
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function wireForm(formId, msgId, successClass, errorClass) {
    const form = document.getElementById(formId);
    const msg = document.getElementById(msgId);
    if (!form || !msg) return;
    const input = form.querySelector('input[type="email"]');

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const value = input.value.trim();
      msg.classList.remove(successClass, errorClass);

      if (!emailPattern.test(value)) {
        msg.textContent = 'Please enter a valid email address.';
        msg.classList.add(errorClass);
        input.setAttribute('aria-invalid', 'true');
        input.focus();
        return;
      }

      input.removeAttribute('aria-invalid');
      msg.textContent = "You're in! Check " + value + ' for a link to set up your account.';
      msg.classList.add(successClass);
      form.reset();
    });
  }

  wireForm('hero-form', 'hero-form-msg', 'text-emerald-600', 'text-rose-600');
  wireForm('cta-form', 'cta-form-msg', 'text-white', 'text-rose-100');

  // ----- Footer year -----
  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
})();
