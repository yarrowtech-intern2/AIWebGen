(function () {
  'use strict';

  /* ---------- Mobile navigation ---------- */
  const toggle = document.getElementById('nav-toggle');
  const mobileNav = document.getElementById('mobile-nav');

  function setMobileNav(open) {
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    mobileNav.classList.toggle('hidden', !open);
    toggle.querySelector('.icon-open').classList.toggle('hidden', open);
    toggle.querySelector('.icon-close').classList.toggle('hidden', !open);
  }

  if (toggle && mobileNav) {
    toggle.addEventListener('click', function () {
      setMobileNav(toggle.getAttribute('aria-expanded') !== 'true');
    });
    mobileNav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () { setMobileNav(false); });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        setMobileNav(false);
        toggle.focus();
      }
    });
  }

  /* ---------- Header shadow + active nav link ---------- */
  const header = document.getElementById('site-header');
  const navLinks = document.querySelectorAll('.nav-link');
  const sections = Array.from(navLinks)
    .map(function (link) { return document.querySelector(link.getAttribute('href')); })
    .filter(Boolean);

  function onScroll() {
    header.classList.toggle('is-scrolled', window.scrollY > 10);
    let current = null;
    sections.forEach(function (section) {
      if (section.getBoundingClientRect().top <= 120) current = section.id;
    });
    navLinks.forEach(function (link) {
      link.classList.toggle('is-active', link.getAttribute('href') === '#' + current);
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- Menu tabs ---------- */
  const tabs = Array.from(document.querySelectorAll('#menu-tabs [role="tab"]'));

  function selectTab(tab, setFocus) {
    tabs.forEach(function (t) {
      const selected = t === tab;
      t.setAttribute('aria-selected', String(selected));
      t.tabIndex = selected ? 0 : -1;
      const panel = document.getElementById(t.getAttribute('aria-controls'));
      panel.hidden = !selected;
      if (selected) {
        panel.classList.remove('is-entering');
        void panel.offsetWidth; // restart animation
        panel.classList.add('is-entering');
      }
    });
    if (setFocus) tab.focus();
  }

  tabs.forEach(function (tab, i) {
    tab.addEventListener('click', function () { selectTab(tab, false); });
    tab.addEventListener('keydown', function (e) {
      let next = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = tabs[(i + 1) % tabs.length];
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = tabs[(i - 1 + tabs.length) % tabs.length];
      if (e.key === 'Home') next = tabs[0];
      if (e.key === 'End') next = tabs[tabs.length - 1];
      if (next) {
        e.preventDefault();
        selectTab(next, true);
      }
    });
  });

  /* ---------- Highlight today's opening hours ---------- */
  const todayRow = document.querySelector('#hours-table tr[data-day="' + new Date().getDay() + '"]');
  if (todayRow) todayRow.classList.add('is-today');

  /* ---------- Reservation form ---------- */
  const form = document.getElementById('reserve-form');
  const dateInput = document.getElementById('date');
  const timeSelect = document.getElementById('time');
  const status = document.getElementById('form-status');

  function toISODate(d) {
    const tz = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tz).toISOString().slice(0, 10);
  }

  const todayISO = toISODate(new Date());
  dateInput.min = todayISO;
  dateInput.value = todayISO;

  // Opening hours per weekday (24h). Last booking is 1 hour before closing.
  const hours = { 0: [8, 20], 1: [7.5, 21], 2: [7.5, 21], 3: [7.5, 21], 4: [7.5, 21], 5: [7.5, 22], 6: [8, 22] };

  function formatTime(h) {
    const hr = Math.floor(h);
    const min = h % 1 ? '30' : '00';
    const suffix = hr >= 12 ? 'pm' : 'am';
    const display = hr % 12 === 0 ? 12 : hr % 12;
    return display + ':' + min + ' ' + suffix;
  }

  function populateTimes() {
    const previous = timeSelect.value;
    const parts = (dateInput.value || todayISO).split('-').map(Number);
    const day = new Date(parts[0], parts[1] - 1, parts[2]).getDay();
    const range = hours[day];
    const now = new Date();
    const isToday = dateInput.value === todayISO;
    const nowH = now.getHours() + now.getMinutes() / 60;

    timeSelect.innerHTML = '<option value="">Select a time</option>';
    let count = 0;
    for (let h = range[0]; h <= range[1] - 1; h += 0.5) {
      if (isToday && h <= nowH + 0.5) continue;
      const opt = document.createElement('option');
      opt.value = formatTime(h);
      opt.textContent = formatTime(h);
      timeSelect.appendChild(opt);
      count++;
    }
    if (count === 0) {
      timeSelect.innerHTML = '<option value="">No slots left today. Try another date</option>';
    }
    if (previous && timeSelect.querySelector('option[value="' + previous + '"]')) {
      timeSelect.value = previous;
    }
  }

  dateInput.addEventListener('change', populateTimes);
  populateTimes();

  function setError(input, errorId, show) {
    const err = document.getElementById(errorId);
    input.setAttribute('aria-invalid', show ? 'true' : 'false');
    err.hidden = !show;
    return !show;
  }

  function validate() {
    const name = form.name.value.trim();
    const phone = form.phone.value.replace(/[\s\-()]/g, '').replace(/^(\+91|0)/, '');
    const results = [
      setError(form.name, 'name-error', name.length < 2),
      setError(form.phone, 'phone-error', !/^[6-9]\d{9}$/.test(phone)),
      setError(dateInput, 'date-error', !dateInput.value || dateInput.value < todayISO),
      setError(timeSelect, 'time-error', !timeSelect.value)
    ];
    return results.every(Boolean);
  }

  ['input', 'change'].forEach(function (evt) {
    form.addEventListener(evt, function (e) {
      if (e.target.getAttribute('aria-invalid') === 'true') validate();
    });
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    status.innerHTML = '';
    if (!validate()) {
      const firstInvalid = form.querySelector('[aria-invalid="true"]');
      if (firstInvalid) firstInvalid.focus();
      return;
    }

    const name = form.name.value.trim().split(' ')[0];
    const guests = form.guests.value;
    const dateText = new Date(dateInput.value + 'T00:00:00').toLocaleDateString('en-IN', {
      weekday: 'long', day: 'numeric', month: 'long'
    });

    status.innerHTML =
      '<div class="form-success">' +
        '<svg class="w-6 h-6 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m8 12 3 3 5-6"/></svg>' +
        '<p><strong>Thanks, ' + escapeHTML(name) + '!</strong> We\'ve noted a table for ' + guests +
        (guests === '1' ? ' guest' : ' guests') + ' on ' + dateText + ' at ' + timeSelect.value +
        '. We\'ll call you shortly to confirm.</p>' +
      '</div>';

    form.reset();
    dateInput.value = todayISO;
    populateTimes();
  });

  function escapeHTML(str) {
    return str.replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------- Footer year ---------- */
  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
})();
