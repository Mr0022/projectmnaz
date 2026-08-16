/* =========================================================
   کاردرمانی ذهنی کودکان | مهرناز افشار
   منطق تعاملی صفحه: پیمایش، انیمیشن ورود و بازی‌های آموزشی
   ========================================================= */
(function () {
  'use strict';

  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /** تبدیل عدد لاتین به فارسی */
  const fa = (n) => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);

  const scroller = $('#scroller');
  const sections = $$('.sec');

  /* ---------------------------------------------------------
     پیمایش: نوار پیشرفت، نقطه‌ها، منو، صفحه‌کلید
     --------------------------------------------------------- */

  const goTo = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  };

  // نوار پیشرفت
  const bar = $('#progressBar');
  const updateProgress = () => {
    const max = scroller.scrollHeight - scroller.clientHeight;
    bar.style.width = (max > 0 ? (scroller.scrollTop / max) * 100 : 0) + '%';
  };
  scroller.addEventListener('scroll', updateProgress, { passive: true });
  window.addEventListener('resize', updateProgress);
  updateProgress();

  // ناوبری نقطه‌ای + منوی تمام‌صفحه
  const dots = $('#dots');
  const menuList = $('#menuList');
  sections.forEach((sec, i) => {
    const label = sec.dataset.title || sec.id;

    const dot = document.createElement('button');
    dot.type = 'button';
    dot.dataset.label = label;
    dot.setAttribute('aria-label', label);
    dot.addEventListener('click', () => goTo(sec.id));
    dots.appendChild(dot);

    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    btn.addEventListener('click', () => { closeMenu(); goTo(sec.id); });
    li.appendChild(btn);
    menuList.appendChild(li);

    sec.dataset.index = String(i);
  });
  const dotEls = $$('button', dots);

  // بخش فعال
  const activeObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const i = Number(entry.target.dataset.index);
      sections.forEach((s, k) => s.classList.toggle('is-active', k === i));
      dotEls.forEach((d, k) => d.classList.toggle('is-active', k === i));
      const cs = getComputedStyle(entry.target);
      document.documentElement.style.setProperty('--a', cs.getPropertyValue('--a'));
      document.documentElement.style.setProperty('--b', cs.getPropertyValue('--b'));
    });
    // بخشی فعال است که از میانه‌ی صفحه عبور می‌کند (مستقل از ارتفاع بخش)
  }, { root: scroller, rootMargin: '-45% 0px -45% 0px', threshold: 0 });
  sections.forEach((s) => activeObserver.observe(s));

  // منو
  const menuBtn = $('#menuBtn');
  const menuPanel = $('#menuPanel');
  const openMenu  = () => { menuPanel.classList.add('is-open'); menuBtn.setAttribute('aria-expanded', 'true'); };
  const closeMenu = () => { menuPanel.classList.remove('is-open'); menuBtn.setAttribute('aria-expanded', 'false'); };
  menuBtn.addEventListener('click', () =>
    menuPanel.classList.contains('is-open') ? closeMenu() : openMenu()
  );

  // دکمه‌های پرش
  $$('[data-goto]').forEach((b) => b.addEventListener('click', () => goTo(b.dataset.goto)));

  /* ---------------------------------------------------------
     هر اسکرول = یک بخش
     (تنها زمانی فعال است که همه‌ی بخش‌ها در یک صفحه جا شوند)
     --------------------------------------------------------- */

  let oneByOne = true;
  const updateMode = () => {
    oneByOne = sections.every((s) => s.getBoundingClientRect().height <= scroller.clientHeight + 4);
  };
  updateMode();
  window.addEventListener('resize', () => setTimeout(updateMode, 200));

  // نزدیک‌ترین بخش به موقعیت فعلی
  const nearestIndex = () => {
    const y = scroller.scrollTop;
    let best = 0, bestDist = Infinity;
    sections.forEach((s, i) => {
      const d = Math.abs(s.offsetTop - y);
      if (d < bestDist) { bestDist = d; best = i; }
    });
    return best;
  };

  let locked = false, lockTimer = null;
  const lockNav = (ms = 780) => {
    locked = true;
    clearTimeout(lockTimer);
    lockTimer = setTimeout(() => { locked = false; }, ms);
  };

  const step = (dir) => {
    const next = sections[nearestIndex() + dir];
    if (!next) return false;
    lockNav();
    goTo(next.id);
    return true;
  };

  scroller.addEventListener('wheel', (e) => {
    if (!oneByOne || e.ctrlKey) return;                       // زوم یا حالت متن بلند
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;      // اسکرول افقی (نوار اهداف)
    if (Math.abs(e.deltaY) < 4) return;
    e.preventDefault();
    if (locked) { lockNav(); return; }                        // اینرسی تاچ‌پد بخش رد نکند
    step(e.deltaY > 0 ? 1 : -1);
  }, { passive: false });

  // صفحه‌کلید
  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input, textarea, canvas')) return;
    if (e.key === 'Escape') return closeMenu();
    const dir = { ArrowDown: 1, PageDown: 1, ' ': 1, ArrowUp: -1, PageUp: -1 }[e.key];
    if (dir === undefined || !oneByOne) return;
    if (e.key === ' ' && e.target.closest('button, a, [tabindex]')) return;  // فاصله = فعال‌کردن دکمه
    if (sections[nearestIndex() + dir]) { e.preventDefault(); step(dir); }
  });

  /* ---------------------------------------------------------
     انیمیشن ورود عناصر
     --------------------------------------------------------- */

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-in');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { root: scroller, threshold: 0.15 });
  $$('.reveal').forEach((el) => revealObserver.observe(el));

  /* ---------------------------------------------------------
     جلوه‌ی جشن
     --------------------------------------------------------- */

  const EMOJI = ['🎉', '⭐', '✨', '🎈', '🥳', '💫'];
  function celebrate(target, count = 14) {
    if (reduceMotion || !target) return;
    // اگر عنصر پنهان بود، از کارت دربرگیرنده استفاده کن
    let r = target.getBoundingClientRect();
    if (!r.width || !r.height) {
      const host = target.closest('.card') || target.closest('.sec');
      if (!host) return;
      r = host.getBoundingClientRect();
    }
    for (let i = 0; i < count; i++) {
      const p = document.createElement('span');
      p.className = 'confetti';
      p.textContent = EMOJI[Math.floor(Math.random() * EMOJI.length)];
      p.style.left = r.left + r.width * Math.random() + 'px';
      p.style.top = r.top + r.height * Math.random() + 'px';
      p.style.setProperty('--tx', (Math.random() * 220 - 110) + 'px');
      p.style.setProperty('--ty', (-90 - Math.random() * 150) + 'px');
      p.style.setProperty('--rot', (Math.random() * 720 - 360) + 'deg');
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 1000);
    }
  }

  /* ---------------------------------------------------------
     صدا (فقط پس از اولین تعامل کاربر)
     --------------------------------------------------------- */

  let audioCtx = null;
  function tone(freq, duration = 0.28, type = 'sine') {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      audioCtx = audioCtx || new Ctx();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.22, audioCtx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration + 0.02);
    } catch (_) { /* صدا اختیاری است */ }
  }

  /* =========================================================
     ۱ | دست‌ورزی: تخته‌ی نقاشی
     ========================================================= */
  (function drawing() {
    const canvas = $('#drawCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const COLORS = ['#ff5d8f', '#ffb02e', '#37c8c0', '#6c8bff', '#8b5cf6', '#1d1b2e'];
    let color = COLORS[0];
    let size = 12;
    let drawing = false;
    let last = null;

    // پالت رنگ
    const swatches = $('#swatches');
    COLORS.forEach((c, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.style.background = c;
      b.setAttribute('aria-label', 'رنگ ' + fa(i + 1));
      if (i === 0) b.classList.add('is-active');
      b.addEventListener('click', () => {
        color = c;
        $$('button', swatches).forEach((x) => x.classList.toggle('is-active', x === b));
      });
      swatches.appendChild(b);
    });

    // خط‌چین راهنما برای تمرین ترسیم
    function guide() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      ctx.save();
      ctx.setLineDash([9, 11]);
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(29,27,46,.22)';
      ctx.lineCap = 'round';
      // موج
      ctx.beginPath();
      for (let x = 20; x <= w - 20; x += 4) {
        const y = h * 0.34 + Math.sin((x / w) * Math.PI * 3) * (h * 0.14);
        x === 20 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
      // زیگزاگ
      ctx.beginPath();
      const steps = 6, segW = (w - 40) / steps;
      for (let i = 0; i <= steps; i++) {
        const x = 20 + i * segW;
        const y = h * 0.78 - (i % 2 === 0 ? 0 : h * 0.2);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
    }

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineJoin = ctx.lineCap = 'round';
      guide();
    }

    const pos = (e) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    canvas.addEventListener('pointerdown', (e) => {
      drawing = true;
      last = pos(e);
      canvas.setPointerCapture(e.pointerId);
      // نقطه‌ی اولیه تا یک ضربه‌ی ساده هم اثر بگذارد
      ctx.beginPath();
      ctx.fillStyle = color;
      ctx.arc(last.x, last.y, size / 2, 0, Math.PI * 2);
      ctx.fill();
    });

    canvas.addEventListener('pointermove', (e) => {
      if (!drawing) return;
      const p = pos(e);
      ctx.strokeStyle = color;
      ctx.lineWidth = size;
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      last = p;
    });

    ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) =>
      canvas.addEventListener(ev, () => { drawing = false; })
    );

    $('#brushSize').addEventListener('input', (e) => { size = Number(e.target.value); });
    $('#clearCanvas').addEventListener('click', () => {
      ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
      guide();
    });

    window.addEventListener('resize', resize);
    resize();
    // اندازه‌ی درست پس از بارگذاری فونت/چیدمان
    setTimeout(resize, 300);
  })();

  /* =========================================================
     ۲ | شناختی: بازی حافظه
     ========================================================= */
  (function memory() {
    const board = $('#memory');
    if (!board) return;
    const status = $('#memoryStatus');
    const FACES = ['🐢', '🦋', '🐙'];
    let open = [], found = 0, lock = false;

    const shuffle = (arr) => arr.map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);

    function build() {
      board.innerHTML = '';
      open = []; found = 0; lock = false;
      status.textContent = `${fa(0)} از ${fa(FACES.length)} جفت`;

      shuffle([...FACES, ...FACES]).forEach((face) => {
        const card = document.createElement('div');
        card.className = 'mcard';
        card.setAttribute('role', 'button');
        card.tabIndex = 0;
        card.setAttribute('aria-label', 'کارت پنهان');
        const inner = document.createElement('span');
        inner.dataset.face = face;
        card.appendChild(inner);
        card.dataset.face = face;
        card.addEventListener('click', () => pick(card));
        card.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(card); }
        });
        board.appendChild(card);
      });
    }

    function pick(card) {
      if (lock || card.classList.contains('is-open') || card.classList.contains('is-done')) return;
      card.classList.add('is-open');
      card.setAttribute('aria-label', card.dataset.face);
      tone(520, 0.12, 'triangle');
      open.push(card);
      if (open.length < 2) return;

      const [a, b] = open;
      if (a.dataset.face === b.dataset.face) {
        open = [];
        found++;
        [a, b].forEach((c) => { c.classList.remove('is-open'); c.classList.add('is-done'); });
        status.textContent = `${fa(found)} از ${fa(FACES.length)} جفت`;
        tone(760, 0.2, 'triangle');
        if (found === FACES.length) {
          status.textContent = 'آفرین! همه را پیدا کردی 🎉';
          celebrate(board);
          setTimeout(() => tone(980, 0.3, 'triangle'), 140);
        }
      } else {
        lock = true;
        setTimeout(() => {
          [a, b].forEach((c) => { c.classList.remove('is-open'); c.setAttribute('aria-label', 'کارت پنهان'); });
          open = []; lock = false;
        }, 750);
      }
    }

    $('#memoryReset').addEventListener('click', build);
    build();
  })();

  /* =========================================================
     ۳ | بینایی ـ شنیداری: ببین، بشنو، تکرار کن
     ========================================================= */
  (function simon() {
    const board = $('#simon');
    if (!board) return;
    const status = $('#simonStatus');
    const startBtn = $('#simonStart');
    const pads = $$('.pad', board);
    const FREQ = [330, 392, 494, 587];
    let seq = [], step = 0, playing = false;

    const light = (i, ms = 420) => {
      const pad = pads[i];
      pad.classList.add('is-lit');
      tone(FREQ[i], ms / 1000 * 0.8, 'sine');
      setTimeout(() => pad.classList.remove('is-lit'), ms * 0.7);
    };

    function playSeq() {
      playing = true;
      board.classList.add('is-locked');
      status.textContent = 'خوب نگاه کن و گوش بده…';
      seq.forEach((v, i) => setTimeout(() => light(v), 560 * i + 350));
      setTimeout(() => {
        playing = false;
        board.classList.remove('is-locked');
        status.textContent = `نوبت توست — ${fa(seq.length)} حرکت`;
      }, 560 * seq.length + 400);
    }

    function nextRound() {
      seq.push(Math.floor(Math.random() * pads.length));
      step = 0;
      playSeq();
    }

    pads.forEach((pad, i) => pad.addEventListener('click', () => {
      if (playing || seq.length === 0) return;
      light(i, 260);
      if (seq[step] === i) {
        step++;
        if (step === seq.length) {
          if (seq.length >= 5) {
            status.textContent = `عالی بود! ${fa(seq.length)} حرکت را درست زدی 🎉`;
            celebrate(board);
            seq = [];
            startBtn.textContent = 'دوباره';
            return;
          }
          status.textContent = 'درست بود! مرحله‌ی بعد…';
          setTimeout(nextRound, 800);
        }
      } else {
        status.textContent = 'اشکالی ندارد، دوباره تلاش کن';
        tone(160, 0.3, 'sawtooth');
        seq = [];
        startBtn.textContent = 'شروع دوباره';
      }
    }));

    startBtn.addEventListener('click', () => {
      if (playing) return;
      seq = [];
      startBtn.textContent = 'شروع دوباره';
      nextRound();
    });
  })();

  /* =========================================================
     ۴ | مهارت‌های اجتماعی: کارت‌های احساس
     ========================================================= */
  (function feelings() {
    const wrap = $('#flips');
    if (!wrap) return;
    const status = $('#flipStatus');
    const CARDS = [
      { e: '😊', t: 'خوشحال',  d: 'وقتی چیزی خوب پیش می‌رود' },
      { e: '😢', t: 'ناراحت',  d: 'می‌توانم بگویم دلم گرفته' },
      { e: '😠', t: 'عصبانی',  d: 'نفس عمیق می‌کشم و حرف می‌زنم' },
      { e: '😨', t: 'ترسیده',  d: 'کمک خواستن اشکالی ندارد' },
      { e: '😳', t: 'خجالتی',  d: 'آرام‌آرام وارد جمع می‌شوم' },
      { e: '🤩', t: 'هیجان‌زده', d: 'نوبتم را رعایت می‌کنم' }
    ];
    let seen = 0;

    CARDS.forEach((c) => {
      // از div استفاده می‌شود چون preserve-3d داخل <button> در برخی مرورگرها کار نمی‌کند
      const btn = document.createElement('div');
      btn.className = 'flip';
      btn.setAttribute('role', 'button');
      btn.tabIndex = 0;
      btn.setAttribute('aria-label', c.t);
      btn.innerHTML =
        '<div class="flip__inner">' +
          '<div class="flip__face flip__front"><b>' + c.e + '</b></div>' +
          '<div class="flip__face flip__back"><strong>' + c.t + '</strong><small>' + c.d + '</small></div>' +
        '</div>';
      btn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); btn.click(); }
      });
      btn.addEventListener('click', () => {
        const was = btn.classList.contains('is-flipped');
        btn.classList.toggle('is-flipped');
        btn.setAttribute('aria-pressed', String(!was));
        tone(was ? 380 : 560, 0.14, 'triangle');
        if (!was && !btn.dataset.seen) {
          btn.dataset.seen = '1';
          seen++;
          status.textContent = `${fa(seen)} از ${fa(CARDS.length)} کارت`;
          if (seen === CARDS.length) {
            status.textContent = 'همه‌ی احساس‌ها را شناختی 🎉';
            celebrate(wrap);
          }
        }
      });
      wrap.appendChild(btn);
    });
    status.textContent = `${fa(0)} از ${fa(CARDS.length)} کارت`;
  })();

  /* =========================================================
     ۵ | بازی‌درمانی: ترکاندن حباب
     ========================================================= */
  (function bubbles() {
    const box = $('#bubbles');
    if (!box) return;
    const scoreEl = $('#bubbleScore');
    const COLORS = ['#ff5d8f', '#ffb02e', '#37c8c0', '#6c8bff', '#8b5cf6'];
    let score = 0, timer = null;

    function spawn() {
      if (box.childElementCount > 14) return;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bubble';
      const size = 26 + Math.random() * 34;
      const dur = 6 + Math.random() * 4;
      b.style.width = b.style.height = size + 'px';
      b.style.left = Math.random() * (box.clientWidth - size) + 'px';
      b.style.animationDuration = dur + 's';
      b.style.setProperty('--c', COLORS[Math.floor(Math.random() * COLORS.length)]);
      b.style.setProperty('--drift', (Math.random() * 60 - 30) + 'px');
      b.setAttribute('aria-label', 'حباب');
      b.addEventListener('click', () => {
        if (b.classList.contains('is-pop')) return;
        b.classList.add('is-pop');
        tone(500 + Math.random() * 500, 0.1, 'sine');
        score++;
        scoreEl.textContent = 'امتیاز: ' + fa(score);
        if (score % 10 === 0) celebrate(box, 10);
        setTimeout(() => b.remove(), 320);
      });
      b.addEventListener('animationend', () => b.remove());
      box.appendChild(b);
    }

    const start = () => { if (!timer) timer = setInterval(spawn, 850); };
    const stop  = () => { clearInterval(timer); timer = null; };

    // فقط وقتی بخش دیده می‌شود حباب بساز
    new IntersectionObserver((entries) => {
      entries.forEach((e) => (e.isIntersecting ? start() : stop()));
    }, { root: scroller, threshold: 0.35 }).observe(box);

    $('#bubbleReset').addEventListener('click', () => {
      score = 0;
      scoreEl.textContent = 'امتیاز: ' + fa(0);
      box.innerHTML = '';
    });
  })();

  /* =========================================================
     ۶ | درکی ـ حرکتی: هر شکل سر جای خودش
     ========================================================= */
  (function shapes() {
    const zone = $('#dnd');
    if (!zone) return;
    const status = $('#dndStatus');
    const tray = $('#tray');
    const slots = $$('.slot', zone);
    const pieces = $$('.shape', tray);
    let done = 0;

    const setStatus = () => { status.textContent = `${fa(done)} از ${fa(pieces.length)}`; };

    function place(piece, slot) {
      slot.classList.add('is-filled');
      slot.appendChild(piece);
      piece.classList.remove('is-dragging');
      piece.classList.add('is-placed');
      piece.style.cssText = '';
      piece.setAttribute('aria-disabled', 'true');
      piece.tabIndex = -1;
      done++;
      setStatus();
      tone(660, 0.16, 'triangle');
      if (done === pieces.length) {
        status.textContent = 'همه سر جای خودشان! 🎉';
        celebrate(zone);
      }
    }

    pieces.forEach((piece) => {
      let dx = 0, dy = 0, w = 0, h = 0, dragging = false;

      const moveTo = (x, y) => {
        piece.style.left = (x - dx) + 'px';
        piece.style.top = (y - dy) + 'px';
      };

      piece.addEventListener('pointerdown', (e) => {
        if (piece.classList.contains('is-placed')) return;
        dragging = true;
        const r = piece.getBoundingClientRect();
        w = r.width; h = r.height;
        dx = e.clientX - r.left;          // فاصله‌ی نشانگر تا گوشه‌ی شکل
        dy = e.clientY - r.top;
        piece.classList.add('is-dragging');
        piece.style.position = 'fixed';
        piece.style.width = w + 'px';
        piece.style.height = h + 'px';
        moveTo(e.clientX, e.clientY);
        piece.setPointerCapture(e.pointerId);
      });

      piece.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        moveTo(e.clientX, e.clientY);
        slots.forEach((s) => {
          const b = s.getBoundingClientRect();
          const hot = e.clientX > b.left && e.clientX < b.right && e.clientY > b.top && e.clientY < b.bottom;
          s.classList.toggle('is-hot', hot && s.dataset.shape === piece.dataset.shape && !s.classList.contains('is-filled'));
        });
      });

      piece.addEventListener('pointerup', (e) => {
        if (!dragging) return;
        dragging = false;
        slots.forEach((s) => s.classList.remove('is-hot'));
        const hit = slots.find((s) => {
          const b = s.getBoundingClientRect();
          return e.clientX > b.left && e.clientX < b.right && e.clientY > b.top && e.clientY < b.bottom;
        });
        if (hit && hit.dataset.shape === piece.dataset.shape && !hit.classList.contains('is-filled')) {
          place(piece, hit);
        } else {
          // برگرد سر جای اول
          piece.classList.remove('is-dragging');
          piece.style.cssText = '';
          if (hit) tone(200, 0.18, 'sawtooth');
        }
      });

      // دسترسی با صفحه‌کلید: Enter شکل را در جای درست می‌گذارد
      piece.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        const slot = slots.find((s) => s.dataset.shape === piece.dataset.shape && !s.classList.contains('is-filled'));
        if (slot) place(piece, slot);
      });
    });

    $('#dndReset').addEventListener('click', () => {
      done = 0;
      pieces.forEach((p) => {
        p.classList.remove('is-placed');
        p.style.cssText = '';
        p.removeAttribute('aria-disabled');
        p.tabIndex = 0;
        tray.appendChild(p);
      });
      slots.forEach((s) => s.classList.remove('is-filled'));
      setStatus();
    });

    setStatus();
  })();

  /* =========================================================
     ۷ | رفتاردرمانی: جدول ستاره
     ========================================================= */
  (function starChart() {
    const list = $('#tasks');
    if (!list) return;
    const starsBox = $('#stars');
    const status = $('#starStatus');
    const buttons = $$('[data-task]', list);
    const TOTAL = buttons.length;

    buttons.forEach(() => {
      const i = document.createElement('i');
      i.textContent = '⭐';
      starsBox.appendChild(i);
    });
    const starEls = $$('i', starsBox);

    function render() {
      const n = buttons.filter((b) => b.classList.contains('is-done')).length;
      starEls.forEach((s, i) => s.classList.toggle('on', i < n));
      if (n === TOTAL) {
        status.textContent = 'جایزه‌ات را بگیر! 🎉';
        celebrate(starsBox);
        setTimeout(() => tone(880, 0.3, 'triangle'), 100);
      } else {
        status.textContent = `${fa(n)} ستاره از ${fa(TOTAL)}`;
      }
    }

    buttons.forEach((b) => {
      b.type = 'button';
      b.addEventListener('click', () => {
        b.classList.toggle('is-done');
        tone(b.classList.contains('is-done') ? 700 : 320, 0.14, 'triangle');
        render();
      });
    });

    $('#starReset').addEventListener('click', () => {
      buttons.forEach((b) => b.classList.remove('is-done'));
      render();
    });

    render();
  })();

  // بخش نخست از همان ابتدا فعال باشد
  sections[0].classList.add('is-active');
})();
