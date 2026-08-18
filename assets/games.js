/* =========================================================
   کاردرمانی ذهنی کودکان | مهرناز افشار
   بازی‌های تعاملی دست‌ورزی؛ هر بازی صفحه‌ی خودش را دارد و
   صفت data-game روی <body> می‌گوید کدام‌یک باید اجرا شود.

   این فایل میان هر پنج صفحه مشترک است: یک بار دانلود می‌شود و
   در جابه‌جایی میان بازی‌ها از حافظه‌ی نهان می‌آید.
   ========================================================= */
(function () {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const fa = (n) => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  /* رنگ‌ها از همان متغیرهای صفحه خوانده می‌شوند تا بوم و بقیه‌ی
     صفحه یک پالت داشته باشند */
  const cssVar = (name, fallback) =>
    (getComputedStyle(document.body).getPropertyValue(name).trim() || fallback);
  const A = cssVar('--a', '#ff7043');
  const B = cssVar('--b', '#ffc46b');
  const INK = '#1d1b2e', SOFT = '#55516e', LINE = 'rgba(29,27,46,.16)';

  /* ---------------- صدا ----------------
     نسخه‌ی کوچک‌شده‌ی موتور صدای app.js؛ صفحه‌های بازی آن فایل را
     بار نمی‌کنند چون به #scroller صفحه‌ی اصلی وابسته است.
     مثل آنجا، صدا فقط پس از اولین تعامل کاربر ساخته می‌شود. */
  let actx = null, master = null;
  function audio() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      if (!actx) {
        actx = new Ctx();
        master = actx.createGain();
        master.gain.value = 0.9;
        master.connect(actx.destination);
      }
      if (actx.state === 'suspended') actx.resume();
      return actx;
    } catch (_) { return null; }
  }
  function tone(freq, dur = 0.24, type = 'sine', peak = 0.2) {
    const ctx = audio();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }
  const sPop  = () => tone(720, 0.14, 'triangle');
  const sStep = (i) => tone(430 + i * 48, 0.1, 'triangle', 0.17);
  const sNope = () => tone(190, 0.2, 'sawtooth', 0.22);
  const sWin  = () => { tone(660, 0.16, 'triangle'); setTimeout(() => tone(990, 0.26, 'triangle'), 130); };

  /* ---------------- نوار وضعیت مشترک ---------------- */

  const elState = $('#state'), elScore = $('#score'), elDone = $('#done');
  const say   = (t) => { if (elState) elState.textContent = t; };
  const score = (t) => { if (elScore) elScore.textContent = t; };
  const hideDone = () => { if (elDone) elDone.hidden = true; };

  function finish(title, detail) {
    if (!elDone) return;
    elDone.textContent = '';
    const b = document.createElement('b');
    b.textContent = title;
    const s = document.createElement('span');
    s.textContent = detail;
    elDone.append(b, s);
    elDone.hidden = false;
    sWin();
  }

  /** دکمه‌ی «از اول»؛ هر بازی تابع شروع دوباره‌اش را همین‌جا می‌سپارد */
  function onAgain(fn) {
    const btn = $('#again');
    if (btn) btn.addEventListener('click', () => { hideDone(); fn(); });
  }

  /** آماده‌سازی بوم با نسبت پیکسل نمایشگر (سقف ۲، مثل app.js) */
  function fit(cv) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = cv.clientWidth, h = cv.clientHeight;
    if (!w || !h) return null;
    cv.width = w * dpr;
    cv.height = h * dpr;
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineJoin = ctx.lineCap = 'round';
    return ctx;
  }

  /** مختصات نشانگر نسبت به گوشه‌ی عنصر */
  const at = (el, e) => {
    const r = el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

  /** گرفتن نشانگر؛ اگر نشانگر دیگر فعال نباشد مرورگر خطا می‌دهد
      و آن خطا نباید بازی را متوقف کند */
  const capture = (el, e) => { try { el.setPointerCapture(e.pointerId); } catch (_) {} };

  /** فراخوانی fn پس از تغییر اندازه؛ بدون این مکث، اندازه‌ی بوم
      پیش از نشستن قلم و چیدمان خوانده می‌شود */
  function onResize(fn) {
    let t = 0;
    window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(fn, 150); });
    setTimeout(fn, 300);
  }

  const GAMES = {};

  /* =========================================================
     ۱ | گلوله را به سبد برسان
     کشیدن با انگشت روی هدف بزرگ: ساده‌ترین پله، درست مثل
     مچاله‌کردن کاغذ و انداختنش در سبد.
     ========================================================= */
  GAMES['1'] = function () {
    const stage = $('#stage'), basket = $('#basket');
    if (!stage || !basket) return;

    const TOTAL = 5;
    let balls = [], left = TOTAL, tries = 0;

    const show = () => score('مانده: ' + fa(left) + ' گلوله  •  پرتاب: ' + fa(tries));

    /* سبد با هر گل کوچک‌تر می‌شود؛ همان «سبد را دورتر بگذارید» تمرین خانه */
    const shrink = () => {
      basket.style.setProperty('--s', (1 - (TOTAL - left) * 0.08).toFixed(2));
    };

    function home(ball, i) {
      const w = stage.clientWidth, h = stage.clientHeight;
      const bw = ball.offsetWidth || 54;
      const x = 10 + (w - bw - 20) * (i / (TOTAL - 1));
      const y = h - (ball.offsetHeight || 54) - 12 - (i % 2) * 26;
      ball.style.left = Math.round(clamp(x, 6, w - bw - 6)) + 'px';
      ball.style.top  = Math.round(Math.max(y, 60)) + 'px';
      ball.dataset.hx = ball.style.left;
      ball.dataset.hy = ball.style.top;
    }

    function land(ball) {
      if (ball.classList.contains('is-done')) return;
      ball.classList.add('is-done');
      left--;
      sPop();
      shrink();
      show();
      if (left === 0) {
        say('تمام شد.');
        finish('آفرین! هر پنج گلوله در سبد نشست.',
          'با ' + fa(tries) + ' پرتاب. هرچه این عدد به ۵ نزدیک‌تر باشد، دستت مطمئن‌تر بوده.');
      }
    }

    function makeBall(i) {
      const ball = document.createElement('button');
      ball.type = 'button';
      ball.className = 'gball';
      ball.textContent = '🗞';
      ball.setAttribute('aria-label', 'گلوله‌ی کاغذ شماره ' + fa(i + 1));

      let dx = 0, dy = 0, moving = false;

      ball.addEventListener('pointerdown', (e) => {
        if (ball.classList.contains('is-done')) return;
        moving = true;
        const r = ball.getBoundingClientRect();
        dx = e.clientX - r.left;
        dy = e.clientY - r.top;
        capture(ball, e);
        ball.classList.add('is-drag');
      });

      ball.addEventListener('pointermove', (e) => {
        if (!moving) return;
        const r = stage.getBoundingClientRect();
        ball.style.left = clamp(e.clientX - r.left - dx, 0, stage.clientWidth - ball.offsetWidth) + 'px';
        ball.style.top  = clamp(e.clientY - r.top - dy, 0, stage.clientHeight - ball.offsetHeight) + 'px';
      });

      const drop = () => {
        if (!moving) return;
        moving = false;
        ball.classList.remove('is-drag');
        tries++;
        const b = basket.getBoundingClientRect(), t = ball.getBoundingClientRect();
        const cx = t.left + t.width / 2, cy = t.top + t.height / 2;
        if (cx > b.left && cx < b.right && cy > b.top && cy < b.bottom) {
          land(ball);
        } else {
          ball.style.left = ball.dataset.hx;
          ball.style.top  = ball.dataset.hy;
          sNope();
          show();
        }
      };
      ['pointerup', 'pointercancel'].forEach((ev) => ball.addEventListener(ev, drop));

      /* راه صفحه‌کلید: بازی با کشیدن ساخته شده، اما بدون این مسیر
         برای کسی که ماوس ندارد اصلاً قابل انجام نبود */
      ball.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        tries++;
        land(ball);
      });

      return ball;
    }

    function reset() {
      stage.querySelectorAll('.gball').forEach((b) => b.remove());
      balls = [];
      left = TOTAL;
      tries = 0;
      basket.style.setProperty('--s', '1');
      for (let i = 0; i < TOTAL; i++) {
        const ball = makeBall(i);
        stage.appendChild(ball);
        balls.push(ball);
        home(ball, i);
      }
      say('گلوله‌ها را یکی‌یکی بکش و داخل سبد رها کن.');
      show();
    }

    onResize(() => balls.forEach((b, i) => { if (!b.classList.contains('is-done')) home(b, i); }));
    onAgain(reset);
    reset();
  };

  /* =========================================================
     ۲ | گیره را روی رنگش بگذار
     رها کردن دقیق روی هدف کوچک، به‌اضافه‌ی قاعده‌ی رنگ.
     ========================================================= */
  GAMES['2'] = function () {
    const slotsBox = $('#slots'), tray = $('#clips');
    if (!slotsBox || !tray) return;

    const COLORS = [
      { id: 'r', name: 'قرمز',   c: '#ef5350' },
      { id: 'b', name: 'آبی',    c: '#42a5f5' },
      { id: 'y', name: 'زرد',    c: '#f9a825' },
      { id: 'g', name: 'سبز',    c: '#66bb6a' },
      { id: 'p', name: 'بنفش',   c: '#ab47bc' }
    ];

    let placed = 0, wrong = 0, slots = [];

    const show = () =>
      score('جا افتاده: ' + fa(placed) + ' از ' + fa(COLORS.length) + '  •  اشتباه: ' + fa(wrong));

    function seat(clip, slot) {
      slot.classList.add('is-full');
      slot.appendChild(clip);
      clip.classList.add('is-done');
      clip.style.transform = '';
      placed++;
      sPop();
      show();
      if (placed === COLORS.length) {
        say('تمام شد.');
        finish('همه‌ی گیره‌ها سر جایشان نشستند.',
          wrong === 0
            ? 'بدون هیچ اشتباهی — دست و چشم خوب با هم کار کردند.'
            : 'با ' + fa(wrong) + ' بار جای اشتباه. دفعه‌ی بعد آرام‌تر رها کن.');
      }
    }

    function makeClip(col) {
      const clip = document.createElement('button');
      clip.type = 'button';
      clip.className = 'gclip';
      clip.style.setProperty('--c', col.c);
      clip.dataset.id = col.id;
      clip.setAttribute('aria-label', 'گیره‌ی ' + col.name);

      let sx = 0, sy = 0, moving = false;

      clip.addEventListener('pointerdown', (e) => {
        if (clip.classList.contains('is-done')) return;
        moving = true;
        sx = e.clientX; sy = e.clientY;
        capture(clip, e);
        clip.classList.add('is-drag');
      });

      clip.addEventListener('pointermove', (e) => {
        if (!moving) return;
        clip.style.transform = 'translate(' + (e.clientX - sx) + 'px,' + (e.clientY - sy) + 'px)';
      });

      const drop = (e) => {
        if (!moving) return;
        moving = false;
        clip.classList.remove('is-drag');
        /* هدف از روی مختصات خودِ انگشت پیدا می‌شود، نه از مستطیل گیره:
           مستطیل گیره به جابه‌جایی transform وابسته است و در لحظه‌ی رها
           کردن ممکن است هنوز مقدار تازه ننشسته باشد. مختصات نشانگر
           چنین وابستگی‌ای ندارد. elementFromPoint هم به کار نمی‌آید،
           چون خودِ گیره زیر انگشت است. */
        const cx = e.clientX, cy = e.clientY;
        const hit = slots.find((s) => {
          const b = s.getBoundingClientRect();
          return cx > b.left && cx < b.right && cy > b.top && cy < b.bottom;
        });
        if (hit && !hit.classList.contains('is-full') && hit.dataset.id === clip.dataset.id) {
          seat(clip, hit);
          return;
        }
        clip.style.transform = '';
        if (hit) {
          wrong++;
          sNope();
          clip.classList.add('is-shake');
          setTimeout(() => clip.classList.remove('is-shake'), 420);
          show();
        }
      };
      ['pointerup', 'pointercancel'].forEach((ev) => clip.addEventListener(ev, drop));

      clip.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        const target = slots.find((s) => s.dataset.id === clip.dataset.id);
        if (target && !target.classList.contains('is-full')) seat(clip, target);
      });

      return clip;
    }

    function reset() {
      slotsBox.textContent = '';
      tray.textContent = '';
      placed = 0; wrong = 0; slots = [];

      shuffle(COLORS).forEach((col) => {
        const slot = document.createElement('div');
        slot.className = 'gslot';
        slot.style.setProperty('--c', col.c);
        slot.dataset.id = col.id;
        slotsBox.appendChild(slot);
        slots.push(slot);
      });

      shuffle(COLORS).forEach((col) => tray.appendChild(makeClip(col)));

      say('هر گیره را بکش و روی نوار هم‌رنگ خودش رها کن.');
      show();
    }

    onAgain(reset);
    reset();
  };

  /* =========================================================
     ۳ | مهره‌ها را به ترتیب نخ کن
     یک حرکت پیوسته و مرتب: انگشت از مهره‌ی ۱ تا آخر بلند نمی‌شود.
     ========================================================= */
  GAMES['3'] = function () {
    const cv = $('#board');
    if (!cv) return;
    let ctx = null;

    const ROUNDS = [
      { n: 6,  kind: 'arc'  },
      { n: 8,  kind: 'wave' },
      { n: 10, kind: 'loop' }
    ];
    const R = 21;                 // شعاع مهره
    let round = 0, beads = [], next = 0, trail = [], drawing = false, t0 = 0, spent = 0;

    /* مهره‌ها روی یک منحنی چیده می‌شوند؛ در راست‌چین از سمت راست شروع */
    function build() {
      const w = cv.clientWidth, h = cv.clientHeight;
      const { n, kind } = ROUNDS[round];
      const m = R + 16;
      beads = [];
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        if (kind === 'loop') {
          const cx = w / 2, cy = h / 2;
          const rad = Math.min(w, h) / 2 - m;
          const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
          beads.push({ x: cx + Math.cos(a) * rad, y: cy + Math.sin(a) * rad });
        } else if (kind === 'wave') {
          beads.push({ x: w - m - (w - 2 * m) * t, y: h / 2 + Math.sin(t * Math.PI * 2) * (h / 2 - m) * 0.8 });
        } else {
          beads.push({ x: w - m - (w - 2 * m) * t, y: h / 2 + Math.sin(t * Math.PI) * (h / 2 - m) * -0.7 });
        }
      }
    }

    function draw() {
      if (!ctx) return;
      const w = cv.clientWidth, h = cv.clientHeight;
      ctx.clearRect(0, 0, w, h);

      // راهنمای نخ
      ctx.save();
      ctx.setLineDash([4, 9]);
      ctx.strokeStyle = LINE;
      ctx.lineWidth = 2;
      ctx.beginPath();
      beads.forEach((b, i) => (i ? ctx.lineTo(b.x, b.y) : ctx.moveTo(b.x, b.y)));
      ctx.stroke();
      ctx.restore();

      // نخِ کشیده‌شده
      if (trail.length > 1) {
        ctx.strokeStyle = A;
        ctx.lineWidth = 7;
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        trail.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // مهره‌ها
      beads.forEach((b, i) => {
        const done = i < next;
        const isNext = i === next;
        ctx.beginPath();
        ctx.arc(b.x, b.y, isNext ? R + 3 : R, 0, Math.PI * 2);
        if (done) {
          const g = ctx.createLinearGradient(b.x - R, b.y - R, b.x + R, b.y + R);
          g.addColorStop(0, A); g.addColorStop(1, B);
          ctx.fillStyle = g;
        } else {
          ctx.fillStyle = '#fff';
        }
        ctx.fill();
        ctx.lineWidth = isNext ? 4 : 2;
        ctx.strokeStyle = isNext ? A : LINE;
        ctx.stroke();

        ctx.fillStyle = done ? '#fff' : (isNext ? A : SOFT);
        ctx.font = '800 15px Vazirmatn, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(fa(i + 1), b.x, b.y + 1);
      });
    }

    const show = () =>
      score('دور ' + fa(round + 1) + ' از ' + fa(ROUNDS.length) +
            '  •  مهره: ' + fa(next) + ' از ' + fa(beads.length));

    function fail(msg) {
      drawing = false;
      trail = [];
      next = 0;
      sNope();
      say(msg);
      draw();
      show();
    }

    function nextRound() {
      round++;
      if (round >= ROUNDS.length) {
        say('تمام شد.');
        finish('هر سه رشته نخ شد.',
          'در ' + fa(Math.round(spent / 1000)) + ' ثانیه. اگر انگشت یک بار هم بلند نشد، کارِ سختش را انجام داده‌ای.');
        round = ROUNDS.length - 1;
        return;
      }
      build();
      next = 0; trail = [];
      say('رشته‌ی بعد. باز هم از مهره‌ی ۱ شروع کن.');
      draw();
      show();
    }

    cv.addEventListener('pointerdown', (e) => {
      const p = at(cv, e);
      if (dist(p.x, p.y, beads[0].x, beads[0].y) > R + 10) {
        say('از مهره‌ی ۱ شروع کن.');
        sNope();
        return;
      }
      drawing = true;
      next = 1;
      trail = [p];
      if (!t0) t0 = performance.now();
      capture(cv, e);
      sStep(1);
      say('انگشتت را بلند نکن.');
      draw();
      show();
    });

    cv.addEventListener('pointermove', (e) => {
      if (!drawing) return;
      const p = at(cv, e);
      trail.push(p);
      const target = beads[next];
      if (target && dist(p.x, p.y, target.x, target.y) <= R + 6) {
        next++;
        sStep(next);
        show();
        if (next >= beads.length) {
          drawing = false;
          spent = performance.now() - t0;
          sWin();
          say('این رشته کامل شد.');
          draw();
          setTimeout(nextRound, 850);
          return;
        }
      }
      draw();
    });

    ['pointerup', 'pointercancel'].forEach((ev) =>
      cv.addEventListener(ev, () => {
        if (!drawing) return;
        fail('انگشت زود بلند شد؛ از مهره‌ی ۱ دوباره شروع کن.');
      })
    );

    function reset() {
      round = 0; next = 0; trail = []; drawing = false; t0 = 0; spent = 0;
      ctx = fit(cv) || ctx;
      build();
      say('انگشتت را روی مهره‌ی ۱ بگذار و بدون بلندکردن تا آخر ببر.');
      draw();
      show();
    }

    onResize(() => { ctx = fit(cv) || ctx; build(); next = 0; trail = []; drawing = false; draw(); show(); });
    onAgain(reset);
    reset();
  };

  /* =========================================================
     ۴ | روی خط ببر
     نگه‌داشتن مسیر: امتیاز از فاصله‌ی نشانگر تا خط ساخته می‌شود.
     ========================================================= */
  GAMES['4'] = function () {
    const cv = $('#board');
    if (!cv) return;
    let ctx = null;

    const KINDS = ['line', 'wave', 'circle'];
    const NAMES = { line: 'خط راست', wave: 'خط موجی', circle: 'دایره' };
    const TOL = 15;              // تا این فاصله «روی خط» شمرده می‌شود
    const BAND = 34;             // پهنای نوار کاغذ

    let round = 0, path = [], prog = 0, cutting = false;
    let samples = 0, good = 0, marks = [], results = [];

    function build() {
      const w = cv.clientWidth, h = cv.clientHeight;
      const m = BAND / 2 + 14;
      const kind = KINDS[round];
      const pts = [];
      const N = 220;
      for (let i = 0; i <= N; i++) {
        const t = i / N;
        if (kind === 'circle') {
          const rad = Math.min(w, h) / 2 - m;
          const a = -Math.PI / 2 + t * Math.PI * 2;
          pts.push({ x: w / 2 + Math.cos(a) * rad, y: h / 2 + Math.sin(a) * rad });
        } else if (kind === 'wave') {
          pts.push({ x: w - m - (w - 2 * m) * t, y: h / 2 + Math.sin(t * Math.PI * 2) * (h / 2 - m) * 0.75 });
        } else {
          pts.push({ x: w - m - (w - 2 * m) * t, y: h / 2 });
        }
      }
      path = pts;
    }

    function draw(cursor) {
      if (!ctx) return;
      const w = cv.clientWidth, h = cv.clientHeight;
      ctx.clearRect(0, 0, w, h);

      /* نوار کاغذ؛ ابتدا یک لبه‌ی کم‌رنگ و بعد سفیدِ روی آن،
         وگرنه نوار سفید روی زمینه‌ی روشن بوم اصلاً دیده نمی‌شود */
      ctx.beginPath();
      path.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.strokeStyle = 'rgba(29, 27, 46, .12)';
      ctx.lineWidth = BAND + 4;
      ctx.stroke();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = BAND;
      ctx.stroke();

      // خط بریدن
      ctx.save();
      ctx.setLineDash([7, 8]);
      ctx.strokeStyle = LINE;
      ctx.lineWidth = 2;
      ctx.beginPath();
      path.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.stroke();
      ctx.restore();

      // بخش بریده‌شده
      if (prog > 1) {
        const g = ctx.createLinearGradient(path[0].x, path[0].y, path[prog].x, path[prog].y);
        g.addColorStop(0, A); g.addColorStop(1, B);
        ctx.strokeStyle = g;
        ctx.lineWidth = 6;
        ctx.beginPath();
        for (let i = 0; i <= prog; i++) (i ? ctx.lineTo(path[i].x, path[i].y) : ctx.moveTo(path[i].x, path[i].y));
        ctx.stroke();
      }

      // جاهایی که از خط بیرون زده
      ctx.fillStyle = '#e5484d';
      marks.forEach((m) => {
        ctx.beginPath();
        ctx.arc(m.x, m.y, 3.5, 0, Math.PI * 2);
        ctx.fill();
      });

      // نقطه‌ی شروع
      ctx.beginPath();
      ctx.arc(path[0].x, path[0].y, 11, 0, Math.PI * 2);
      ctx.fillStyle = prog > 2 ? '#fff' : A;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = A;
      ctx.stroke();

      if (cursor) {
        ctx.font = '22px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('✂️', cursor.x, cursor.y);
      }
    }

    const acc = () => (samples ? Math.round((good / samples) * 100) : 100);
    const show = () =>
      score('دور ' + fa(round + 1) + ' از ' + fa(KINDS.length) +
            ' (' + NAMES[KINDS[round]] + ')  •  دقت: ٪' + fa(acc()));

    function startRound() {
      build();
      prog = 0; samples = 0; good = 0; marks = []; cutting = false;
      say('از نقطه‌ی رنگی شروع کن و روی خط‌چین جلو برو.');
      draw();
      show();
    }

    function endRound() {
      cutting = false;
      results.push(acc());
      sWin();
      round++;
      if (round >= KINDS.length) {
        const avg = Math.round(results.reduce((s, v) => s + v, 0) / results.length);
        say('تمام شد.');
        finish('هر سه خط بریده شد.',
          'میانگین دقت: ٪' + fa(avg) + '. زیر ٪۸۰ یعنی همین خط ارزش تمرین دوباره را دارد.');
        round = KINDS.length - 1;
        draw();
        return;
      }
      say('این خط تمام شد؛ خط بعد.');
      setTimeout(startRound, 800);
    }

    cv.addEventListener('pointerdown', (e) => {
      const p = at(cv, e);
      if (dist(p.x, p.y, path[0].x, path[0].y) > 26) {
        say('از نقطه‌ی رنگی شروع کن.');
        sNope();
        return;
      }
      cutting = true;
      capture(cv, e);
      say('روی خط بمان؛ انگشت را بلند نکن.');
      draw(p);
    });

    cv.addEventListener('pointermove', (e) => {
      if (!cutting) return;
      const p = at(cv, e);

      /* نزدیک‌ترین نقطه، فقط در پنجره‌ای حول پیشرفت فعلی.
         جست‌وجوی سراسری برای دایره غلط بود: نقطه‌ی پایان روی نقطه‌ی
         شروع می‌افتد و تساوی همیشه به نفع اندیس ۰ تمام می‌شد،
         پس پیشرفت هیچ‌وقت به انتهای مسیر نمی‌رسید. */
      const lo = Math.max(0, prog - 12);
      const hi = Math.min(path.length - 1, prog + 60);
      let best = prog, bestD = Infinity;
      for (let i = lo; i <= hi; i++) {
        const d = dist(p.x, p.y, path[i].x, path[i].y);
        if (d < bestD) { bestD = d; best = i; }
      }

      samples++;
      if (bestD <= TOL) good++;
      else if (marks.length < 400) marks.push(p);

      if (best > prog && bestD <= TOL * 2) prog = best;

      show();
      draw(p);

      if (prog >= path.length - 4) endRound();
    });

    ['pointerup', 'pointercancel'].forEach((ev) =>
      cv.addEventListener(ev, () => {
        if (!cutting) return;
        cutting = false;
        say('انگشت بلند شد؛ این خط از اول.');
        sNope();
        startRound();
      })
    );

    function reset() {
      ctx = fit(cv) || ctx;
      round = 0; results = [];
      startRound();
    }

    onResize(() => { ctx = fit(cv) || ctx; startRound(); });
    onAgain(reset);
    reset();
  };

  /* =========================================================
     ۵ | الگو را کپی کن
     سخت‌ترین پله: دیدن، به‌خاطر سپردن و بازساختن یک الگو روی نقطه‌ها.
     امتیازدهی دقیق است چون مقایسه روی مجموعه‌ی خط‌هاست، نه شکل آزاد.
     ========================================================= */
  GAMES['5'] = function () {
    const cvP = $('#pattern'), cvB = $('#board'), clearBtn = $('#clear');
    if (!cvP || !cvB) return;
    let ctxP = null, ctxB = null;

    /* شماره‌ی نقطه‌ها سطر به سطر: ۰ ۱ ۲ / ۳ ۴ ۵ / ۶ ۷ ۸ */
    const PATTERNS = [
      { name: 'مثلث', edges: [[0, 2], [2, 7], [7, 0]] },
      { name: 'لوزی', edges: [[1, 3], [3, 7], [7, 5], [5, 1]] },
      { name: 'ضربدر و خط', edges: [[0, 8], [2, 6], [3, 5]] }
    ];

    let round = 0, mine = [], from = null, hover = null, wrong = 0, locked = false;

    const key = (a, b) => (a < b ? a + '-' + b : b + '-' + a);

    function dots(cv) {
      const w = cv.clientWidth, h = cv.clientHeight;
      const m = Math.min(w, h) * 0.2;
      const sx = (w - 2 * m) / 2, sy = (h - 2 * m) / 2;
      const out = [];
      for (let r = 0; r < 3; r++)
        for (let c = 0; c < 3; c++) out.push({ x: m + c * sx, y: m + r * sy });
      return out;
    }

    function paint(cv, ctx, edges, live, interactive) {
      if (!ctx) return;
      const w = cv.clientWidth, h = cv.clientHeight;
      const pts = dots(cv);
      ctx.clearRect(0, 0, w, h);

      ctx.lineWidth = 6;
      edges.forEach((e) => {
        const g = ctx.createLinearGradient(pts[e[0]].x, pts[e[0]].y, pts[e[1]].x, pts[e[1]].y);
        g.addColorStop(0, A); g.addColorStop(1, B);
        ctx.strokeStyle = e.bad ? '#e5484d' : g;
        ctx.beginPath();
        ctx.moveTo(pts[e[0]].x, pts[e[0]].y);
        ctx.lineTo(pts[e[1]].x, pts[e[1]].y);
        ctx.stroke();
      });

      if (interactive && live && from !== null) {
        ctx.save();
        ctx.setLineDash([5, 6]);
        ctx.strokeStyle = SOFT;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(pts[from].x, pts[from].y);
        ctx.lineTo(live.x, live.y);
        ctx.stroke();
        ctx.restore();
      }

      pts.forEach((p, i) => {
        const active = interactive && (i === from || i === hover);
        ctx.beginPath();
        ctx.arc(p.x, p.y, active ? 9 : 7, 0, Math.PI * 2);
        ctx.fillStyle = active ? A : '#fff';
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = active ? A : LINE;
        ctx.stroke();
      });
    }

    const render = (livePoint) => {
      paint(cvP, ctxP, PATTERNS[round].edges.map((e) => e.slice()), null, false);
      paint(cvB, ctxB, mine, livePoint || null, true);
    };

    const show = () =>
      score('الگوی ' + fa(round + 1) + ' از ' + fa(PATTERNS.length) +
            ' (' + PATTERNS[round].name + ')  •  خط: ' + fa(mine.length) +
            ' از ' + fa(PATTERNS[round].edges.length));

    function check() {
      const want = new Set(PATTERNS[round].edges.map((e) => key(e[0], e[1])));
      const bad = mine.filter((e) => !want.has(key(e[0], e[1])));
      if (bad.length === 0) {
        locked = true;
        sWin();
        say('درست است.');
        round++;
        if (round >= PATTERNS.length) {
          round = PATTERNS.length - 1;
          finish('هر سه الگو را ساختی.',
            wrong === 0
              ? 'بدون یک خط اشتباه — چشم و دست و برنامه‌ریزی، هر سه با هم کار کردند.'
              : 'با ' + fa(wrong) + ' بار اصلاح. این الگوها را روی کاغذ هم بکش.');
          render();
          return;
        }
        setTimeout(() => {
          mine = []; from = null; locked = false;
          say('الگوی بعد. دوباره از روی نمونه بساز.');
          render(); show();
        }, 900);
        return;
      }
      wrong++;
      locked = true;
      sNope();
      say('این خط‌ها با نمونه یکی نیست؛ دوباره نگاه کن.');
      bad.forEach((e) => { e.bad = true; });
      render();
      setTimeout(() => {
        mine = []; from = null; locked = false;
        render(); show();
      }, 900);
    }

    const near = (cv, p) => {
      const pts = dots(cv);
      let best = -1, bestD = 26;
      pts.forEach((q, i) => {
        const d = dist(p.x, p.y, q.x, q.y);
        if (d < bestD) { bestD = d; best = i; }
      });
      return best;
    };

    cvB.addEventListener('pointerdown', (e) => {
      if (locked) return;
      const p = at(cvB, e);
      const i = near(cvB, p);
      if (i < 0) return;
      from = i;
      capture(cvB, e);
      render(p);
    });

    cvB.addEventListener('pointermove', (e) => {
      if (from === null || locked) return;
      const p = at(cvB, e);
      hover = near(cvB, p);
      render(p);
    });

    ['pointerup', 'pointercancel'].forEach((ev) =>
      cvB.addEventListener(ev, (e) => {
        if (from === null || locked) return;
        const p = at(cvB, e);
        const to = near(cvB, p);
        const start = from;
        from = null; hover = null;

        if (to >= 0 && to !== start && !mine.some((x) => key(x[0], x[1]) === key(start, to))) {
          mine.push([start, to]);
          sPop();
        }
        render(); show();
        if (mine.length === PATTERNS[round].edges.length) setTimeout(check, 250);
      })
    );

    if (clearBtn) clearBtn.addEventListener('click', () => {
      if (locked) return;
      mine = []; from = null;
      render(); show();
    });

    function reset() {
      ctxP = fit(cvP) || ctxP;
      ctxB = fit(cvB) || ctxB;
      round = 0; mine = []; from = null; wrong = 0; locked = false;
      say('نمونه سمت راست است. همان خط‌ها را روی نقطه‌های سمت چپ بکش.');
      render(); show();
    }

    onResize(() => { ctxP = fit(cvP) || ctxP; ctxB = fit(cvB) || ctxB; render(); });
    onAgain(reset);
    reset();
  };

  /* ---------------- راه‌اندازی ---------------- */

  const which = document.body.dataset.game;
  if (which && GAMES[which]) GAMES[which]();
})();
