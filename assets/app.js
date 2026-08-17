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
     موتور پیمایش: نوار پیشرفت، نقطه‌ها، منو، صفحه‌کلید

     همه‌ی جابه‌جایی‌های عمودی از همین‌جا انجام می‌شود و در حالت
     کنترل‌شده، اسنپِ خودِ مرورگر خاموش است؛ هم‌زمانی اسنپ و اسکرول نرمِ
     مرورگر با انیمیشن اسکریپت باعث می‌شد صفحه لحظه‌ای میان دو بخش
     بایستد و گاهی اسکرول تا اولین کلیک کاربر قفل بماند.
     --------------------------------------------------------- */

  const STEP_MS   = 520;    // مدت انیمیشن جابه‌جایی یک بخش
  const SETTLE_MS = 140;    // مکثی که «پایان اسکرول» شمرده می‌شود

  let index = 0;            // بخش جاری
  let controlled = true;    // آیا پیمایش در اختیار اسکریپت است؟
  let animating = false, dragging = false, resizing = false;
  let animRaf = 0, animGuard = 0, settleTimer = 0;

  const clampIndex = (i) => Math.max(0, Math.min(sections.length - 1, i));
  const maxScroll  = () => Math.max(0, scroller.scrollHeight - scroller.clientHeight);

  /** فاصله‌ی بالای بخش i تا ابتدای اسکرولر */
  const topOf = (i) => {
    const s = sections[clampIndex(i)];
    const y = scroller.scrollTop + s.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
    return Math.max(0, Math.min(Math.round(y), maxScroll()));
  };

  /** نزدیک‌ترین بخش به لبه‌ی بالای اسکرولر */
  const nearestIndex = () => {
    const edge = scroller.getBoundingClientRect().top;
    let best = 0, bestDist = Infinity;
    sections.forEach((s, i) => {
      const d = Math.abs(s.getBoundingClientRect().top - edge);
      if (d < bestDist) { bestDist = d; best = i; }
    });
    return best;
  };

  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  function stopAnim() {
    if (animRaf) cancelAnimationFrame(animRaf);
    clearTimeout(animGuard);
    animRaf = 0; animGuard = 0; animating = false;
  }

  /** انیمیشن دستی اسکرول؛ چون scroll-behavior نرم نیست، مقدار scrollTop
      بی‌درنگ می‌نشیند و می‌توان انیمیشن را در هر لحظه قطع کرد. */
  function animateTo(top, ms) {
    stopAnim();
    const from = scroller.scrollTop;
    const dist = top - from;
    if (!ms || Math.abs(dist) < 2) { scroller.scrollTop = top; return; }

    const t0 = performance.now();
    animating = true;
    // اگر فریم‌ها متوقف شوند (مثلاً تب پنهان شود) این نگهبان قفل را باز می‌کند
    animGuard = setTimeout(() => { stopAnim(); scroller.scrollTop = top; }, ms + 600);

    const frame = (now) => {
      const p = Math.min(1, (now - t0) / ms);
      scroller.scrollTop = from + dist * ease(p);
      if (p < 1) { animRaf = requestAnimationFrame(frame); return; }
      stopAnim();
      scroller.scrollTop = top;
    };
    animRaf = requestAnimationFrame(frame);
  }

  /** رفتن به بخش شماره‌ی i؛ خروجی می‌گوید جابه‌جایی انجام شد یا نه */
  function go(i) {
    const next = clampIndex(i);
    const top  = topOf(next);
    const move = next !== index || Math.abs(scroller.scrollTop - top) > 2;
    index = next;
    if (!move) return false;
    if (controlled) animateTo(top, reduceMotion ? 0 : STEP_MS);
    else scroller.scrollTo({ top, behavior: reduceMotion ? 'auto' : 'smooth' });
    return true;
  }

  const goTo = (id) => {
    const i = sections.findIndex((s) => s.id === id);
    if (i >= 0) go(i);
  };

  // نوار پیشرفت
  const bar = $('#progressBar');
  const updateProgress = () => {
    const max = maxScroll();
    bar.style.width = (max > 0 ? (scroller.scrollTop / max) * 100 : 0) + '%';
  };

  /** پیمایش بخش‌به‌بخش تنها وقتی معنا دارد که هر بخش در یک صفحه جا شود */
  function applyMode() {
    controlled = sections.every((s) => s.getBoundingClientRect().height <= scroller.clientHeight + 4);
    scroller.style.scrollSnapType = controlled ? 'none' : '';
    // پیمایش عمودی دست اسکریپت است، ولی نوار افقی اهداف و بزرگ‌نمایی آزادند
    scroller.style.touchAction = '';
    if (!controlled) return;
    scroller.style.touchAction = 'pan-x pinch-zoom';
    if (!scroller.style.touchAction) scroller.style.touchAction = 'pan-x';   // مرورگر قدیمی
  }

  // پس از هر توقف اسکرول، موقعیت با نزدیک‌ترین بخش هم‌تراز می‌شود؛
  // این تور ایمنی، اسکرول‌های بیرون از کنترل اسکریپت را هم جمع می‌کند
  scroller.addEventListener('scroll', () => {
    updateProgress();
    if (animating || dragging || resizing) return;
    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => {
      if (animating || dragging || resizing) return;
      index = nearestIndex();
      const top = topOf(index);
      if (controlled && Math.abs(scroller.scrollTop - top) > 2) animateTo(top, reduceMotion ? 0 : 260);
    }, SETTLE_MS);
  }, { passive: true });

  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    // تا پایان تغییر ابعاد، شماره‌ی بخش دست‌نخورده می‌ماند تا کاربر
    // همان‌جایی که بود بماند (وگرنه جابه‌جاییِ مرزها او را جلو می‌برد)
    resizing = true;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      resizing = false;
      applyMode();
      updateProgress();
      if (!dragging) { stopAnim(); scroller.scrollTop = topOf(index); }
    }, 160);
  });

  // اندازه‌ها پس از بارگذاری فونت‌ها تغییر می‌کند
  window.addEventListener('load', () => { applyMode(); updateProgress(); });

  applyMode();
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
    // شماره‌ی منو با رقم فارسی و دو رقمی: ۰۱ … ۱۱
    btn.dataset.num = fa(String(i + 1).padStart(2, '0'));
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

  // پیوندهای درون‌صفحه‌ای (مثل نشان بالای صفحه) هم از همین موتور رد شوند
  $$('a[href^="#"]').forEach((a) => {
    const id = a.getAttribute('href').slice(1);
    if (!id || !sections.some((s) => s.id === id)) return;
    a.addEventListener('click', (e) => { e.preventDefault(); goTo(id); });
  });

  /* ---------------------------------------------------------
     چرخ ماوس و تاچ‌پد: هر حرکت = یک بخش

     رویدادهای دنباله‌دارِ اینرسیِ تاچ‌پد بلعیده می‌شوند تا یک حرکت
     چند بخش را رد نکند، اما این مهار همیشه زمان‌دار است: هیچ رویدادی
     قفل را تمدید نمی‌کند، پس اسکرولِ پیوسته هرگز به بن‌بست نمی‌رسد.
     --------------------------------------------------------- */

  const WHEEL_MIN  = 40;    // کمینه‌ی چرخش برای یک بخش
  const WHEEL_GAP  = 160;   // سکوت لازم میان دو حرکت مستقل
  const WHEEL_TAIL = 180;   // بیشینه‌ی مهار دنباله‌ی اینرسی پس از هر پرش

  let wheelSum = 0, wheelAt = 0, wheelPrev = 0, stepAt = 0, tailing = false;

  const wheelDelta = (e) =>
    e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? scroller.clientHeight : 1);

  scroller.addEventListener('wheel', (e) => {
    if (!controlled || e.ctrlKey) return;                     // زوم یا حالت متن بلند
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;      // اسکرول افقی (نوار اهداف)
    const d = wheelDelta(e);
    if (Math.abs(d) < 1) return;
    e.preventDefault();

    const now = performance.now();
    const gap = now - wheelAt;
    const abs = Math.abs(d);
    wheelAt = now;

    if (gap > WHEEL_GAP) { wheelSum = 0; tailing = false; }   // حرکت تازه‌ی کاربر

    // در میانه‌ی جابه‌جایی، رویداد فقط بلعیده می‌شود
    if (animating || dragging) { wheelPrev = abs; return; }

    if (tailing) {
      // دنباله‌ی اینرسی تاچ‌پد پرشتاب و رو به کاهش است؛ تا اوج‌گرفتن دوباره،
      // ضربه‌ی مستقلِ چرخ ماوس، یا سررسید مهار نادیده گرفته می‌شود
      if (abs > wheelPrev * 1.2 + 1 ||
          (gap > 90 && abs >= 50) ||
          now - stepAt > STEP_MS + WHEEL_TAIL) tailing = false;
      else { wheelPrev = abs; return; }
    }
    wheelPrev = abs;

    wheelSum += d;
    if (Math.abs(wheelSum) < WHEEL_MIN) return;
    const dir = wheelSum > 0 ? 1 : -1;
    wheelSum = 0;
    if (go(nearestIndex() + dir)) { stepAt = performance.now(); tailing = true; }
  }, { passive: false });

  /* ---------------------------------------------------------
     لمس: هر کشش یا تلنگر = یک بخش

     انگشت مستقیم روی اسکرول می‌نشیند اما بیش از یک بخش جلو نمی‌رود،
     و بخش مقصد فقط یک‌بار و هنگام رهاکردن انگشت انتخاب می‌شود؛
     پس تغییر جهت وسط حرکت، دیگر میان دو بخش سرگردان نمی‌ماند.
     --------------------------------------------------------- */

  const SWIPE_MIN = 0.15;   // کشش لازم برای پذیرش (کسری از ارتفاع صفحه)
  const SWIPE_VEL = 0.35;   // سرعت لازم برای تلنگر (پیکسل بر میلی‌ثانیه)
  const AXIS_MIN  = 8;      // جابه‌جایی لازم برای تشخیص محور حرکت
  const TOUCH_FREE = 'canvas, input, textarea, select, .shape';  // خودشان انگشت را می‌خواهند

  let touchId = null, vertical = false;
  let tx0 = 0, ty0 = 0, top0 = 0, baseIdx = 0, baseTop = 0, maxTop = 0;
  let lastY = 0, lastT = 0, vel = 0;

  const touchById = (list, id) => {
    for (let i = 0; i < list.length; i++) if (list[i].identifier === id) return list[i];
    return null;
  };

  const endDrag = () => { touchId = null; vertical = false; dragging = false; };

  scroller.addEventListener('touchstart', (e) => {
    if (!controlled) return;
    if (e.touches.length > 1) {                       // دو انگشت: بزرگ‌نمایی
      const was = dragging, base = baseIdx;
      endDrag();
      if (was) go(base);
      return;
    }
    const t = e.changedTouches[0];
    if (t.target.closest && t.target.closest(TOUCH_FREE)) { touchId = null; return; }
    touchId = t.identifier;
    vertical = false;
    tx0 = t.clientX; ty0 = lastY = t.clientY;
    lastT = performance.now();
    vel = 0;
    // اگر انیمیشنی در جریان است، مبنا مقصدِ همان انیمیشن است
    baseIdx = animating ? index : nearestIndex();
  }, { passive: true });

  scroller.addEventListener('touchmove', (e) => {
    if (touchId === null) return;
    if (!controlled) { endDrag(); return; }           // ابعاد وسط کار عوض شد
    const t = touchById(e.changedTouches, touchId);
    if (!t) return;

    if (!vertical) {
      const dx = Math.abs(t.clientX - tx0), dy = Math.abs(t.clientY - ty0);
      if (dx < AXIS_MIN && dy < AXIS_MIN) return;
      if (dx > dy) { touchId = null; return; }        // حرکت افقی، به مرورگر واگذار
      vertical = true;
      dragging = true;
      stopAnim();                                     // از همین‌جا که هست ادامه بده
      lastY = t.clientY;
      lastT = performance.now();
      // مبدأ اندازه‌گیری همان نقطه‌ی آغاز لمس می‌ماند؛ برای اینکه صفحه
      // در لحظه‌ی گرفتن کنترل نپرد، مقدار پایه با همان اختلاف جبران می‌شود
      top0 = scroller.scrollTop + (t.clientY - ty0);
      baseTop = topOf(baseIdx);
      maxTop = maxScroll();
    }

    const now = performance.now();
    const dt = now - lastT;
    if (dt > 0) {
      vel = vel * 0.6 + ((lastY - t.clientY) / dt) * 0.4;
      lastY = t.clientY;
      lastT = now;
    }

    // جز روی مرورگرهای قدیمی، touch-action جلوی اسکرول بومی را گرفته است؛
    // این خط تضمین می‌کند حرکت دوباره روی اسکرول ما سوار نشود
    if (e.cancelable) e.preventDefault();

    // انگشت را دنبال کن، اما بیش از یک بخش جلوتر نرو
    const h = scroller.clientHeight;
    const y = top0 - (t.clientY - ty0);
    scroller.scrollTop = Math.max(0, Math.min(maxTop,
      Math.max(baseTop - h, Math.min(baseTop + h, y))));
  }, { passive: false });

  scroller.addEventListener('touchend', (e) => {
    if (touchId === null) return;
    const t = touchById(e.changedTouches, touchId);
    if (!t) return;
    const was = dragging, base = baseIdx;
    const moved = ty0 - t.clientY;                    // مثبت = انگشت بالا رفت = بخش بعد
    const idle = performance.now() - lastT;
    endDrag();
    if (!was) return;                                 // ضربه‌ی ساده بود، نه کشش

    const h = scroller.clientHeight;
    const v = idle > 80 ? 0 : vel;                    // انگشت پیش از رهاشدن ایستاده بود
    const byMove = Math.abs(moved) > h * SWIPE_MIN ? Math.sign(moved) : 0;
    const byVel  = Math.abs(v) > SWIPE_VEL ? Math.sign(v) : 0;
    // اگر جهت کشش و جهت تلنگر یکی نبود یعنی کاربر منصرف شده: به جای اول برگرد
    const dir = (byMove && byVel) ? (byMove === byVel ? byMove : 0) : (byMove || byVel);
    go(base + dir);
  }, { passive: true });

  scroller.addEventListener('touchcancel', () => {
    if (touchId === null) return;
    const was = dragging, base = baseIdx;
    endDrag();
    if (was) go(base);
  }, { passive: true });

  // صفحه‌کلید
  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input, textarea, canvas')) return;
    if (e.key === 'Escape') return closeMenu();
    if (!controlled) return;
    if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      return void go(e.key === 'Home' ? 0 : sections.length - 1);
    }
    const dir = { ArrowDown: 1, PageDown: 1, ' ': 1, ArrowUp: -1, PageUp: -1 }[e.key];
    if (dir === undefined) return;
    if (e.key === ' ' && e.target.closest('button, a, [tabindex]')) return;  // فاصله = فعال‌کردن دکمه
    const to = (animating ? index : nearestIndex()) + dir;
    if (!sections[to]) return;
    e.preventDefault();
    go(to);
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

  let audioCtx = null, master = null, noiseBuf = null;
  const SAT = 3;   // شدت اشباع نرم خروجی

  /** ساخت (یا بیدارکردن) موتور صدا.
      خروجی از یک اشباع‌کننده‌ی نرم (tanh) رد می‌شود: دامنه‌ی بلند به‌جای بریدگی
      و صدای خش‌دار، نرم فشرده می‌شود. با گین master = ۱/SAT، دامنه‌ی هر صدا
      دقیقاً به tanh(دامنه) نگاشت می‌شود؛ یعنی صداهای کم‌دامنه بدون تغییر
      می‌مانند و صدای طبل می‌تواند تا نزدیک بیشینه‌ی ممکن بلند شود. */
  function audio() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      if (!audioCtx) {
        audioCtx = new Ctx();
        const shaper = audioCtx.createWaveShaper();
        const n = 2048, curve = new Float32Array(n);
        for (let i = 0; i < n; i++) curve[i] = Math.tanh(SAT * ((i / (n - 1)) * 2 - 1));
        shaper.curve = curve;
        shaper.oversample = '4x';
        master = audioCtx.createGain();
        master.gain.value = 1 / SAT;
        master.connect(shaper).connect(audioCtx.destination);
      }
      if (audioCtx.state === 'suspended') audioCtx.resume();
      return audioCtx;
    } catch (_) { return null; }
  }

  function tone(freq, duration = 0.28, type = 'sine', peak = 0.22) {
    const ctx = audio();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain).connect(master);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  /** صدای طبل: بدنه‌ی افت‌کننده + ضربه‌ی نویزی.
      عمداً پرانرژی در فرکانس‌های میانی است تا روی بلندگوی گوشی هم رسا باشد.
      peak اینجا «شدت تحریک» است؛ اشباع‌کننده آن را به بیشینه‌ی بی‌بریدگی می‌رساند. */
  function drumHit(peak = 3.5) {
    const ctx = audio();
    if (!ctx) return;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(700, t);
    osc.frequency.exponentialRampToValueAtTime(150, t + 0.17);
    const body = ctx.createGain();
    body.gain.setValueAtTime(0.0001, t);
    body.gain.exponentialRampToValueAtTime(peak, t + 0.005);
    body.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    osc.connect(body).connect(master);
    osc.start(t);
    osc.stop(t + 0.34);

    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.06), ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      }
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1900;
    bp.Q.value = 0.7;
    const click = ctx.createGain();
    click.gain.setValueAtTime(peak * 0.7, t);
    click.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    noise.connect(bp).connect(click).connect(master);
    noise.start(t);
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
     ۳ | ادراک بینایی: ببین، بشنو، تکرار کن
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
     ۴ | پردازش شنیداری: ریتم را تکرار کن
     ========================================================= */
  (function rhythm() {
    const drum = $('#drum');
    if (!drum) return;
    const tapsBox = $('#taps');
    const status = $('#rhythmStatus');
    const playBtn = $('#rhythmPlay');

    const SHORT = 340, LONG = 760;      // فاصله‌ی کوتاه و بلند میان ضربه‌ها
    const SPLIT = (SHORT + LONG) / 2;   // مرز تشخیص کوتاه از بلند
    const PATTERNS = [
      [SHORT, SHORT],
      [SHORT, LONG, SHORT],
      [LONG, SHORT, SHORT, LONG]
    ];

    let level = 0, taps = [], listening = false, quietTimer = null, playTimers = [];

    const beat = () => drumHit();       // بلندترین حالت ممکن بدون بریدگی صدا
    const shape = (gaps) => gaps.map((g) => (g < SPLIT ? 'ک' : 'ب')).join('');

    // نمایش ضربه‌ها به‌صورت نقطه؛ نقطه‌ی پس از فاصله‌ی بلند کشیده‌تر است
    function renderDots(gaps, count) {
      tapsBox.innerHTML = '';
      for (let i = 0; i < count; i++) {
        const d = document.createElement('i');
        d.className = 'on' + (i > 0 && gaps[i - 1] >= SPLIT ? ' long' : '');
        tapsBox.appendChild(d);
      }
    }

    function stopTimers() {
      playTimers.forEach(clearTimeout);
      playTimers = [];
      clearTimeout(quietTimer);
    }

    function play() {
      stopTimers();
      listening = false;
      taps = [];
      tapsBox.innerHTML = '';
      drum.disabled = true;
      drum.classList.add('is-playing');
      status.textContent = 'فقط گوش کن…';

      const pattern = PATTERNS[level];
      let t = 300;
      playTimers.push(setTimeout(beat, t));
      pattern.forEach((gap) => {
        t += gap;
        playTimers.push(setTimeout(beat, t));
      });

      playTimers.push(setTimeout(() => {
        drum.classList.remove('is-playing');
        drum.disabled = false;
        listening = true;
        status.textContent = 'حالا نوبت توست، بزن!';
      }, t + 450));
    }

    function evaluate() {
      listening = false;
      drum.disabled = true;
      clearTimeout(quietTimer);

      const pattern = PATTERNS[level];
      const gaps = taps.slice(1).map((t, i) => t - taps[i]);

      if (gaps.length !== pattern.length) {
        status.textContent = `تعداد ضربه‌ها ${fa(pattern.length + 1)} تا بود؛ دوباره گوش کن`;
        tone(160, 0.3, 'sawtooth', 0.5);
        playBtn.textContent = 'پخش دوباره';
        setTimeout(() => renderDots(pattern, pattern.length + 1), 600);
        return;
      }

      if (shape(gaps) === shape(pattern)) {
        tone(880, 0.24, 'triangle', 0.5);
        level++;
        if (level >= PATTERNS.length) {
          level = 0;
          status.textContent = 'عالی بود! همه‌ی ریتم‌ها را درست زدی 🎉';
          playBtn.textContent = 'از اول';
          celebrate(drum);
        } else {
          status.textContent = 'آفرین! ریتم سخت‌تر…';
          playTimers.push(setTimeout(play, 1100));
        }
      } else {
        status.textContent = 'نزدیک بود! ریتم درست این بود';
        tone(200, 0.26, 'sawtooth', 0.5);
        playBtn.textContent = 'پخش دوباره';
        setTimeout(() => renderDots(pattern, pattern.length + 1), 600);
      }
    }

    function hit() {
      if (!listening) return;
      beat();
      drum.classList.add('is-hit');
      setTimeout(() => drum.classList.remove('is-hit'), 130);

      taps.push(performance.now());
      const gaps = taps.slice(1).map((t, i) => t - taps[i]);
      renderDots(gaps, taps.length);

      // به‌محض کامل شدن تعداد ضربه‌ها نتیجه اعلام می‌شود
      if (taps.length >= PATTERNS[level].length + 1) return evaluate();
      clearTimeout(quietTimer);
      quietTimer = setTimeout(evaluate, 1600);   // اگر ضربه‌ها کم بود، با سکوت تمام می‌شود
    }

    drum.addEventListener('pointerdown', hit);
    drum.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); hit(); }
    });
    playBtn.addEventListener('click', play);

    // با خروج از بخش، صدا و زمان‌سنج‌ها متوقف شوند
    new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) return;
        stopTimers();
        listening = false;
        drum.disabled = true;
        drum.classList.remove('is-playing');
      });
    }, { root: scroller, threshold: 0.2 }).observe(drum);
  })();

  /* =========================================================
     ۵ | مهارت‌های اجتماعی: کارت‌های احساس
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
     ۶ | بازی‌درمانی: ترکاندن حباب
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
     ۷ | درکی ـ حرکتی: هر شکل سر جای خودش
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
      let sx = 0, sy = 0, dragging = false;

      // جابه‌جایی با transform انجام می‌شود تا مستقل از عنصرهای بالادست
      // (که ممکن است مرجع position:fixed را عوض کنند) دقیقاً زیر نشانگر بماند
      const moveTo = (x, y) => {
        piece.style.transform = `translate(${x - sx}px, ${y - sy}px) scale(1.08)`;
      };

      piece.addEventListener('pointerdown', (e) => {
        if (piece.classList.contains('is-placed')) return;
        dragging = true;
        sx = e.clientX;
        sy = e.clientY;
        piece.classList.add('is-dragging');
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
     ۸ | سنجش مدرسه: ایستگاه سنجش
     ========================================================= */
  (function screening() {
    const box = $('#quiz');
    if (!box) return;
    const ask      = $('#quizAsk');
    const show     = $('#quizShow');
    const opts     = $('#quizOpts');
    const track    = $('#quizTrack');
    const status   = $('#quizStatus');
    const resetBtn = $('#quizReset');

    // هر پرسش یک حیطه‌ی آمادگی را نشان می‌دهد: شمارش، رنگ، شکل، مفهوم پایه و رفتار
    // a = شماره‌ی گزینه‌ی درست، l = برچسب برای صفحه‌خوان، t = زیرنویس گزینه
    const QUESTIONS = [
      { q: 'چند تا مداد می‌بینی؟', show: '✏️✏️✏️✏️', a: 1,
        o: [{ e: '۳', l: 'سه' }, { e: '۴', l: 'چهار' }, { e: '۵', l: 'پنج' }] },
      { q: 'کدام‌یک زرد است؟', show: '🎨', a: 2,
        o: [{ e: '🔴', l: 'قرمز' }, { e: '🟢', l: 'سبز' }, { e: '🟡', l: 'زرد' }] },
      { q: 'کدام‌یک مثلث است؟', show: '🧩', a: 0,
        o: [{ e: '🔺', l: 'مثلث' }, { e: '🟦', l: 'مربع' }, { e: '🔵', l: 'دایره' }] },
      { q: 'کدام‌یک بزرگ‌تر است؟', show: '📏', a: 1,
        o: [{ e: '🐜', l: 'مورچه' }, { e: '🐘', l: 'فیل' }] },
      { q: 'در کلاس، برای حرف زدن چه می‌کنیم؟', show: '🏫', a: 0,
        o: [
          { e: '✋', l: 'دست بلند می‌کنیم', t: 'دست بلند می‌کنیم' },
          { e: '📣', l: 'داد می‌زنیم',      t: 'داد می‌زنیم' },
          { e: '🏃', l: 'از جا بلند می‌شویم', t: 'بلند می‌شویم' }
        ] }
    ];

    let step = 0, solved = 0, locked = false;

    const pips = QUESTIONS.map(() => track.appendChild(document.createElement('i')));
    const setStatus = () => { status.textContent = `${fa(solved)} از ${fa(QUESTIONS.length)}`; };

    function render() {
      const item = QUESTIONS[step];
      ask.textContent = item.q;
      show.textContent = item.show;
      opts.innerHTML = '';
      opts.classList.remove('is-done');
      opts.classList.toggle('is-two', item.o.length === 2);

      item.o.forEach((o, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'qopt';
        b.setAttribute('aria-label', o.l);
        b.innerHTML = '<b aria-hidden="true">' + o.e + '</b>' +
                      (o.t ? '<small aria-hidden="true">' + o.t + '</small>' : '');
        b.addEventListener('click', () => answer(b, i === item.a));
        opts.appendChild(b);
      });
    }

    // پاسخ نادرست پایان بازی نیست؛ کودک دوباره تلاش می‌کند
    function answer(btn, right) {
      if (locked) return;
      if (!right) {
        btn.classList.add('is-wrong');
        tone(200, 0.22, 'sawtooth');
        setTimeout(() => btn.classList.remove('is-wrong'), 430);
        return;
      }

      locked = true;
      btn.classList.add('is-right');
      tone(720, 0.18, 'triangle');
      pips[step].classList.add('on');
      solved++;
      setStatus();

      setTimeout(() => {
        locked = false;
        if (step < QUESTIONS.length - 1) { step++; return render(); }
        finish();
      }, 640);
    }

    function finish() {
      ask.textContent = 'پرونده‌ی آمادگی‌ات کامل شد!';
      show.textContent = '🎒🌟';
      opts.classList.remove('is-two');
      opts.classList.add('is-done');
      opts.innerHTML = '<p class="qdone">همه‌ی ایستگاه‌ها را رد کردی؛ حالا با خیال راحت به کلاس اول فکر کن.</p>';
      status.textContent = 'آماده‌ی کلاس اول 🎉';
      celebrate(box);
      setTimeout(() => tone(980, 0.3, 'triangle'), 140);
    }

    resetBtn.addEventListener('click', () => {
      step = 0; solved = 0; locked = false;
      pips.forEach((p) => p.classList.remove('on'));
      setStatus();
      render();
    });

    setStatus();
    render();
  })();

  /* =========================================================
     ۹ | رفتاردرمانی: جدول ستاره
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
