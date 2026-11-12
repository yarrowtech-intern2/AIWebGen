// Brightline Home Services: site interactions (vanilla JS)
(function () {
  'use strict';

  /* ---------- Header shadow on scroll ---------- */
  const header = document.getElementById('site-header');
  const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- Mobile menu ---------- */
  const toggle = document.getElementById('menu-toggle');
  const menu = document.getElementById('mobile-menu');

  function setMenu(open) {
    menu.classList.toggle('hidden', !open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    toggle.querySelector('.icon-open').classList.toggle('hidden', open);
    toggle.querySelector('.icon-close').classList.toggle('hidden', !open);
  }

  toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
  menu.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
      setMenu(false);
      toggle.focus();
    }
  });
  window.addEventListener('resize', () => {
    if (window.innerWidth >= 1024) setMenu(false);
  });

  /* ---------- Active nav link on scroll ---------- */
  const navLinks = document.querySelectorAll('.nav-link');
  const sections = Array.from(navLinks)
    .map((link) => document.querySelector(link.getAttribute('href')))
    .filter(Boolean);

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          navLinks.forEach((link) => {
            const active = link.getAttribute('href') === '#' + entry.target.id;
            link.classList.toggle('is-active', active);
            if (active) link.setAttribute('aria-current', 'true');
            else link.removeAttribute('aria-current');
          });
        });
      },
      { rootMargin: '-45% 0px -50% 0px' }
    );
    sections.forEach((s) => observer.observe(s));
  }

  /* ---------- Business hours: highlight today + open status ---------- */
  const rows = document.querySelectorAll('#hours-table tr');
  const status = document.getElementById('open-status');
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours() + now.getMinutes() / 60;

  rows.forEach((row) => {
    const days = row.dataset.days.split(',').map(Number);
    if (!days.includes(day)) return;
    row.classList.add('is-today');

    const open = Number(row.dataset.open);
    const close = Number(row.dataset.close);
    const isOpen = row.dataset.open !== undefined && hour >= open && hour < close;

    status.textContent = isOpen ? 'Open now' : 'Emergency line open';
    status.className = isOpen
      ? 'rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800'
      : 'rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900';
  });

  /* ---------- Contact form (front-end only demo) ---------- */
  // NOTE: This form doesn't send data anywhere yet. Connect it to your
  // form handler or CRM (e.g. replace the setTimeout below with a fetch call).
  const form = document.getElementById('contact-form');
  const success = document.getElementById('form-success');
  const successName = document.getElementById('success-name');
  const resetBtn = document.getElementById('form-reset');
  const submitBtn = document.getElementById('submit-btn');
  const btnLabel = submitBtn.querySelector('.btn-label');

  const validators = {
    name: (v) => v.trim().length >= 2,
    phone: (v) => v.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '').length === 10,
    service: (v) => v !== ''
  };

  function validateField(field) {
    const check = validators[field.name];
    if (!check) return true;
    const valid = check(field.value);
    const error = document.getElementById(field.name + '-error');
    field.setAttribute('aria-invalid', valid ? 'false' : 'true');
    if (error) error.classList.toggle('hidden', valid);
    return valid;
  }

  // Format phone as (555) 123-4567 while typing
  const phone = form.elements.phone;
  phone.addEventListener('input', () => {
    const digits = phone.value.replace(/\D/g, '').slice(0, 10);
    let out = digits;
    if (digits.length > 6) out = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    else if (digits.length > 3) out = `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    else if (digits.length > 0) out = `(${digits}`;
    phone.value = out;
  });

  Object.keys(validators).forEach((name) => {
    const field = form.elements[name];
    field.addEventListener('blur', () => {
      if (field.value) validateField(field);
    });
    field.addEventListener('input', () => {
      if (field.getAttribute('aria-invalid') === 'true') validateField(field);
    });
    field.addEventListener('change', () => {
      if (field.getAttribute('aria-invalid') === 'true') validateField(field);
    });
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const fields = Object.keys(validators).map((n) => form.elements[n]);
    const results = fields.map(validateField);
    const firstInvalid = fields[results.indexOf(false)];
    if (firstInvalid) {
      firstInvalid.focus();
      return;
    }

    submitBtn.disabled = true;
    btnLabel.textContent = 'Sending…';
    const spinner = document.createElement('span');
    spinner.className = 'spinner';
    spinner.setAttribute('aria-hidden', 'true');
    submitBtn.prepend(spinner);

    // Simulated network request
    setTimeout(() => {
      const first = form.elements.name.value.trim().split(/\s+/)[0];
      successName.textContent = first || "we've got it";
      form.classList.add('hidden');
      success.classList.remove('hidden');
      success.focus();

      form.reset();
      spinner.remove();
      submitBtn.disabled = false;
      btnLabel.textContent = 'Request a call back';
    }, 900);
  });

  resetBtn.addEventListener('click', () => {
    success.classList.add('hidden');
    form.classList.remove('hidden');
    fields().forEach((f) => f.setAttribute('aria-invalid', 'false'));
    form.elements.name.focus();
  });

  function fields() {
    return Object.keys(validators).map((n) => form.elements[n]);
  }

  /* ---------- Footer year ---------- */
  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
})();
