/* Трекер ИПР. Все данные пользователя живут только в localStorage этого браузера
   и в файле, который он выгружает сам. Наружу ничего не уходит. */
(function () {
  'use strict';
  var D = window.APPDATA;
  var KEY = 'ipr-v1';

  var DEF = { v: 1, setup: null, log: [], money: [], stages: {}, shields: {}, ach: {}, news: [], draw: null, theme: null };

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function load() {
    try { var r = localStorage.getItem(KEY); if (r) { var p = JSON.parse(r); var s = clone(DEF); for (var k in p) s[k] = p[k]; return s; } } catch (e) {}
    return clone(DEF);
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
  var S = load();

  /* ---------- даты ---------- */
  function iso(d) { var z = new Date(d.getTime() - d.getTimezoneOffset() * 6e4); return z.toISOString().slice(0, 10); }
  function today() { return iso(new Date()); }
  function mk(ds) { return ds.slice(0, 7); }
  function weekStart(ds) {
    var d = new Date(ds + 'T00:00:00'); var w = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - w); return iso(d);
  }
  function addDays(ds, n) { var d = new Date(ds + 'T00:00:00'); d.setDate(d.getDate() + n); return iso(d); }
  function dayDiff(a, b) { return Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 864e5); }
  function fmtD(ds) {
    var M = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
    var p = ds.split('-'); return (+p[2]) + ' ' + M[+p[1] - 1];
  }
  function num(n) { return (Math.round(n) + '').replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }

  /* ---------- вычисления ---------- */
  function cfg() { return S.setup || { monthlyTarget: 0, priceFloor: 0, normBody: 3, normTouch: 7, normNew: 2, start: today() }; }
  function onDate(t, ds) { var n = 0; for (var i = 0; i < S.log.length; i++) if (S.log[i].type === t && S.log[i].date === ds) n++; return n; }
  function inRange(t, from, to) { var n = 0; for (var i = 0; i < S.log.length; i++) { var e = S.log[i]; if (e.type === t && e.date >= from && (!to || e.date <= to)) n++; } return n; }
  function total(t) { return inRange(t, '0000-00-00', null); }
  function xpTotal() {
    var x = 0, i;
    for (i = 0; i < S.log.length; i++) { var t = D.EVENTS[S.log[i].type]; if (t) x += t.xp; }
    for (i = 0; i < S.money.length; i++) x += Math.round(S.money[i].amount / 10);
    return x;
  }
  function levelIdx(x) { var i = 0; for (var k = 0; k < D.LEVELS.length; k++) if (x >= D.LEVELS[k].xp) i = k; return i; }
  function monthMoney(key) {
    var r = { total: 0, rec: 0, one: 0 };
    for (var i = 0; i < S.money.length; i++) { var m = S.money[i]; if (mk(m.date) === key) { r.total += m.amount; if (m.kind === 'recurring') r.rec += m.amount; else r.one += m.amount; } }
    return r;
  }
  function bodyWeeks() {
    var c = cfg(), n = 0, w = weekStart(c.start), tw = weekStart(today());
    while (w <= tw) { if (inRange('body', w, addDays(w, 6)) >= c.normBody) n++; w = addDays(w, 7); }
    return n;
  }
  function shieldDays(id) {
    var since = (S.shields[id] && S.shields[id].since) || cfg().start;
    return Math.max(0, dayDiff(since, today()));
  }
  function stageDone(st) { var a = S.stages[st.id] || []; var n = 0; for (var i = 0; i < st.items.length; i++) if (a[i]) n++; return n; }
  function catCount(c) { var n = 0; for (var i = 0; i < S.news.length; i++) if (S.news[i].cat === c) n++; return n; }

  /* ---------- ачивки ---------- */
  function achEarned() {
    var got = {}, c = cfg(), mm = monthMoney(mk(today()));
    function set(id, on) { if (on) got[id] = 1; }
    set('first_touch', total('touch') >= 1);
    set('touch_30', total('touch') >= 30);
    set('touch_100', total('touch') >= 100);
    set('touch_500', total('touch') >= 500);
    set('first_brief', total('brief') >= 1);
    set('first_money', S.money.length >= 1);
    set('first_project', total('project') >= 1);
    set('first_retainer', total('retainer') >= 1);
    set('upsell_1', total('upsell') >= 1);
    set('priceup_1', total('priceup') >= 1);
    set('month_target', c.monthlyTarget > 0 && mm.total >= c.monthlyTarget);
    set('floor_half', c.monthlyTarget > 0 && mm.rec >= c.monthlyTarget / 2);
    set('floor_full', c.monthlyTarget > 0 && mm.rec >= c.monthlyTarget);
    set('body_4', bodyWeeks() >= 4);
    set('body_12', bodyWeeks() >= 12);
    set('body_44', bodyWeeks() >= 44);
    set('text_13', total('text') >= 13);
    set('text_50', total('text') >= 50);
    set('new_10', S.news.length >= 10);
    set('new_50', S.news.length >= 50);
    set('new_100', S.news.length >= 100);
    var all = true; for (var i = 0; i < D.NEW_CATS.length; i++) if (!catCount(D.NEW_CATS[i].id)) all = false;
    set('new_cats', all);
    set('shield_90', shieldDays('ponty') >= 90);
    set('flagman_365', shieldDays('flagman') >= 365);
    var b3 = null; for (var j = 0; j < D.STAGES.length; j++) if (D.STAGES[j].id === 'b3') b3 = D.STAGES[j];
    set('stage_b3', b3 && stageDone(b3) === b3.items.length);
    set('level_5', levelIdx(xpTotal()) >= 4);
    return got;
  }
  function syncAch() {
    var got = achEarned(), fresh = [];
    for (var id in got) if (!S.ach[id]) { S.ach[id] = today(); fresh.push(id); }
    if (fresh.length) {
      save();
      var nm = []; for (var i = 0; i < D.ACHIEVEMENTS.length; i++) if (fresh.indexOf(D.ACHIEVEMENTS[i].id) >= 0) nm.push(D.ACHIEVEMENTS[i].name);
      toast('🏆 ' + nm.join(', '));
    }
  }

  /* ---------- утилиты UI ---------- */
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); };
  var tmr;
  function toast(t) {
    var el = $('#toast'); el.textContent = t; el.classList.add('on');
    clearTimeout(tmr); tmr = setTimeout(function () { el.classList.remove('on'); }, 2300);
  }
  function bar(v, m) { var p = m > 0 ? Math.min(100, v / m * 100) : 0; return '<div class="bar"><i class="' + (p >= 100 ? 'full' : '') + '" style="width:' + p + '%"></i></div>'; }

  /* ---------- экраны ---------- */
  var VIEW = 'today';

  function renderHead() {
    var x = xpTotal(), i = levelIdx(x), L = D.LEVELS[i], nx = D.LEVELS[i + 1];
    var p = nx ? (x - L.xp) / (nx.xp - L.xp) * 100 : 100;
    var C = 2 * Math.PI * 19;
    $('#head').innerHTML =
      '<div class="hd">' +
      '<div class="ring"><svg width="44" height="44"><circle cx="22" cy="22" r="19" fill="none" stroke="var(--bg3)" stroke-width="4"/>' +
      '<circle cx="22" cy="22" r="19" fill="none" stroke="var(--acc)" stroke-width="4" stroke-linecap="round" stroke-dasharray="' + C + '" stroke-dashoffset="' + (C - C * p / 100) + '"/></svg>' +
      '<span>' + (i + 1) + '</span></div>' +
      '<div class="lvl"><b>' + esc(L.name) + '</b><small>' + esc(L.note) + '</small></div>' +
      '<div class="mono" style="text-align:right"><b style="font-size:15px">' + num(x) + '</b><br><small style="color:var(--fg3);font-size:11px">XP</small></div>' +
      '</div><div class="xpbar"><i style="width:' + p + '%"></i></div>';
  }

  function renderToday() {
    var c = cfg(), td = today(), ws = weekStart(td), we = addDays(ws, 6);
    var mo = null; for (var i = 0; i < D.MONTHS.length; i++) if (D.MONTHS[i].k === mk(td)) mo = D.MONTHS[i];
    var h = '';

    if (mo) h += '<div class="card q"><div class="ql">Ключевое действие · ' + esc(mo.title) + '</div><div class="qt">' + esc(mo.action) + '</div></div>';

    var daily = ['touch', 'body', 'numbers', 'newness', 'speak', 'lang'];
    h += '<div class="sect">Сегодня · ' + fmtD(td) + '</div><div class="card"><div class="taps">';
    for (i = 0; i < daily.length; i++) {
      var t = daily[i], e = D.EVENTS[t], n = onDate(t, td);
      h += '<button class="tap ' + (n ? 'on' : '') + '" data-add="' + t + '"><span class="ic">' + e.icon + '</span>' +
        '<span class="nm">' + esc(e.label) + '</span><b>' + (n ? '+' + n : '') + '</b></button>';
    }
    h += '</div><div class="hr"></div><div class="row">';
    var wk = ['text', 'report', 'game'];
    for (i = 0; i < wk.length; i++) { var w = D.EVENTS[wk[i]]; h += '<button class="btn sm" data-add="' + wk[i] + '">' + w.icon + ' ' + esc(w.label) + '</button>'; }
    h += '</div></div>';

    h += '<div class="sect">Норма недели</div><div class="card">';
    var norms = [
      ['Касания к компаниям', inRange('touch', ws, we), c.normTouch],
      ['Тело', inRange('body', ws, we), c.normBody],
      ['Новое', inRange('newness', ws, we), c.normNew],
      ['Публичный текст', inRange('text', ws, we), 1],
      ['Цифры за день', inRange('numbers', ws, we), 6],
      ['Отчёт своему человеку', inRange('report', ws, we), 1]
    ];
    for (i = 0; i < norms.length; i++) {
      h += '<div class="norm"><span class="nmn">' + norms[i][0] + '</span>' + bar(norms[i][1], norms[i][2]) +
        '<span class="vv">' + norms[i][1] + ' / ' + norms[i][2] + '</span></div>';
    }
    h += '<p class="muted" style="margin:10px 0 0">Норма недельная, не дневная. Провалила день — не считается. Провалила неделю — считается.</p></div>';

    h += '<div class="sect">Большие события</div><div class="card"><div class="row">';
    var big = ['brief', 'project', 'retainer', 'upsell', 'priceup'];
    for (i = 0; i < big.length; i++) { var b = D.EVENTS[big[i]]; h += '<button class="btn sm" data-add="' + big[i] + '">' + b.icon + ' ' + esc(b.label) + '</button>'; }
    h += '</div></div>';

    var last = S.log.slice(-9).reverse();
    if (last.length) {
      h += '<div class="sect">Последнее</div><div class="card">';
      for (i = 0; i < last.length; i++) {
        var le = D.EVENTS[last[i].type]; if (!le) continue;
        h += '<div class="li"><span class="ic">' + le.icon + '</span><span class="tx">' + esc(le.label) +
          '<small>' + fmtD(last[i].date) + ' · +' + le.xp + ' XP</small></span>' +
          '<button class="del" data-rm="' + last[i].id + '">×</button></div>';
      }
      h += '</div>';
    }
    $('#v-today').innerHTML = h;
  }

  function renderDvizh() {
    var c = cfg(), ws = weekStart(today()), we = addDays(ws, 6);
    var wn = inRange('newness', ws, we);
    var h = '<div class="card"><h2>Движ</h2><p class="sub">Привычки на грани «интересно, могу поделать» ↔ «незнакомо и странно». В ИПР это предрождение: несколько раз в месяц или даже в неделю. Скука — не каприз, а сигнал, что топливо кончилось.</p>' +
      '<div class="norm"><span class="nmn">Эта неделя</span>' + bar(wn, c.normNew) + '<span class="vv">' + wn + ' / ' + c.normNew + '</span></div></div>';

    var d = S.draw;
    var cat = d ? (function () { for (var i = 0; i < D.NEW_CATS.length; i++) if (D.NEW_CATS[i].id === d.c) return D.NEW_CATS[i]; return null; })() : null;
    h += '<div class="card"><div class="draw">' +
      (d ? '<div class="cat">' + (cat ? cat.icon + ' ' + esc(cat.name) : '') + '</div><div class="txt">' + esc(d.t) + '</div>'
         : '<div class="ph">Нажми «Вытянуть» — и получишь конкретное дело, а не абстрактное «попробуй новое»</div>') +
      '</div><div class="row" style="margin-top:12px">' +
      '<button class="btn pri" style="flex:1" id="draw">🎲 Вытянуть</button>' +
      (d ? '<button class="btn" style="flex:1" id="didit">Сделала +20 XP</button>' : '') +
      '</div><label>Или вытянуть из категории</label><select id="dcat"><option value="">любая</option>' +
      D.NEW_CATS.map(function (x) { return '<option value="' + x.id + '">' + x.icon + ' ' + esc(x.name) + '</option>'; }).join('') +
      '</select></div>';

    h += '<div class="card"><h2>Своё</h2><p class="sub">Сделала что-то новое не из колоды — запиши</p>' +
      '<label>Что это было</label><input id="nfree" placeholder="новая еда, место, человек…">' +
      '<label>Категория</label><select id="nfcat">' + D.NEW_CATS.map(function (x) { return '<option value="' + x.id + '">' + x.icon + ' ' + esc(x.name) + '</option>'; }).join('') + '</select>' +
      '<button class="btn wide pri" id="nfadd" style="margin-top:12px">Записать</button></div>';

    h += '<div class="sect">Разброс по категориям</div><div class="card"><div class="cats">';
    for (var i = 0; i < D.NEW_CATS.length; i++) {
      var x = D.NEW_CATS[i], n = catCount(x.id);
      h += '<div class="cc ' + (n ? 'has' : '') + '"><span class="ic">' + x.icon + '</span><span class="n">' + esc(x.name) + '</span><b>' + n + '</b></div>';
    }
    h += '</div><p class="muted" style="margin:10px 0 0">Всего нового: <b class="mono">' + S.news.length + '</b>. Пустая категория — там и спрятан запас энергии.</p></div>';

    if (S.news.length) {
      h += '<div class="sect">Журнал движа</div><div class="card">';
      var ln = S.news.slice(-14).reverse();
      for (i = 0; i < ln.length; i++) {
        var cc = null; for (var j = 0; j < D.NEW_CATS.length; j++) if (D.NEW_CATS[j].id === ln[i].cat) cc = D.NEW_CATS[j];
        h += '<div class="li"><span class="ic">' + (cc ? cc.icon : '✨') + '</span><span class="tx">' + esc(ln[i].text) + '<small>' + fmtD(ln[i].date) + '</small></span></div>';
      }
      h += '</div>';
    }
    $('#v-dvizh').innerHTML = h;
  }

  function renderMoney() {
    var c = cfg(), key = mk(today()), mm = monthMoney(key);
    var pct = c.monthlyTarget > 0 ? Math.min(100, mm.total / c.monthlyTarget * 100) : 0;
    var h = '<div class="card"><h2>Этот месяц</h2>' +
      '<div class="big">' + num(mm.total) + ' <small>из ' + num(c.monthlyTarget) + ' €</small></div>' +
      '<div class="xpbar" style="margin:10px 0 12px"><i style="width:' + pct + '%"></i></div>' +
      '<div class="split"><div><b>' + num(mm.rec) + ' €</b><small>повторяющийся — приходит сам</small></div>' +
      '<div><b>' + num(mm.one) + ' €</b><small>разовый — продала в этом месяце</small></div></div>' +
      '<p class="muted" style="margin:12px 0 0">Цель не в сумме, а в первой колонке. Повторяющийся доход — это и есть выход из «то пусто, то густо».</p></div>';

    h += '<div class="card"><h2>Записать поступление</h2><p class="sub">Деньги, которые пришли на счёт, а не обещания</p>' +
      '<label>Сумма, €</label><input id="mamt" type="number" inputmode="decimal" placeholder="650">' +
      '<label>Тип</label><select id="mkind"><option value="recurring">Повторяющийся — ведение</option><option value="oneoff">Разовый — проект, предоплата</option></select>' +
      '<label>Подпись (необязательно, видишь только ты)</label><input id="mnote" placeholder="">' +
      '<button class="btn wide pri" id="madd" style="margin-top:12px">Добавить</button></div>';

    var hist = {}, order = [];
    for (var i = 0; i < S.money.length; i++) { var k = mk(S.money[i].date); if (!hist[k]) { hist[k] = { t: 0, r: 0 }; order.push(k); } hist[k].t += S.money[i].amount; if (S.money[i].kind === 'recurring') hist[k].r += S.money[i].amount; }
    order.sort().reverse();
    if (order.length) {
      var mx = 0; for (i = 0; i < order.length; i++) mx = Math.max(mx, hist[order[i]].t);
      h += '<div class="sect">По месяцам</div><div class="card">';
      for (i = 0; i < order.length; i++) {
        var o = hist[order[i]];
        h += '<div class="norm"><span class="nmn mono">' + order[i] + '</span>' + bar(o.t, mx) +
          '<span class="vv">' + num(o.t) + ' €</span></div>';
      }
      h += '<p class="muted" style="margin:10px 0 0">Это единственное доказательство, которое работает против качелей: посмотреть на первый месяц и на последний рядом.</p></div>';
    }

    if (S.money.length) {
      h += '<div class="sect">Журнал</div><div class="card">';
      var lm = S.money.slice(-14).reverse();
      for (i = 0; i < lm.length; i++) {
        h += '<div class="li"><span class="ic">' + (lm[i].kind === 'recurring' ? '🔁' : '🚀') + '</span>' +
          '<span class="tx">' + esc(lm[i].note || (lm[i].kind === 'recurring' ? 'Ведение' : 'Проект')) + '<small>' + fmtD(lm[i].date) + '</small></span>' +
          '<span class="am">' + num(lm[i].amount) + ' €</span>' +
          '<button class="del" data-rmm="' + lm[i].id + '">×</button></div>';
      }
      h += '</div>';
    }
    $('#v-money').innerHTML = h;
  }

  function renderMap() {
    var h = '<div class="card"><h2>Четыре рождения</h2><p class="sub">Стадии из ИПР. Отмечай то, что уже стало правдой — честно, иначе смысла нет. Активная стадия закрывается к 31 году.</p></div>';
    for (var i = 0; i < D.STAGES.length; i++) {
      var st = D.STAGES[i], dn = stageDone(st), tt = st.items.length, p = dn / tt * 100;
      h += '<details class="stg ' + (st.active ? 'act' : '') + (st.locked ? ' lck' : '') + '"' + (st.active ? ' open' : '') + '>' +
        '<summary><span class="sname">' + esc(st.name) + '</span><span class="pct">' + dn + '/' + tt + '</span></summary>' +
        '<div class="sbar"><i style="width:' + p + '%"></i></div><div class="body"><p class="hint">' + esc(st.hint) + '</p>';
      for (var j = 0; j < st.items.length; j++) {
        var on = !!(S.stages[st.id] || [])[j];
        h += '<label class="chk ' + (on ? 'done' : '') + '"><input type="checkbox" data-st="' + st.id + '" data-ix="' + j + '"' + (on ? ' checked' : '') + '><span>' + esc(st.items[j]) + '</span></label>';
      }
      h += '</div></details>';
    }
    h += '<div class="card"><h2>Четыре рычага</h2><p class="sub">Рывок — это не «работать больше». Это четыре решения, повторённые двенадцать месяцев.</p>' +
      '<div class="li"><span class="ic">📈</span><span class="tx">Цена<small>Пол не опускается никогда</small></span></div>' +
      '<div class="li"><span class="ic">🔁</span><span class="tx">Повторяющийся доход<small>Пол, который не зависит от продаж месяца</small></span></div>' +
      '<div class="li"><span class="ic">⚙</span><span class="tx">Конвейер<small>Шаблоны: срок падает, цена нет</small></span></div>' +
      '<div class="li"><span class="ic">🎯</span><span class="tx">Фокус<small>Один оффер, один тип клиента, год без смены</small></span></div></div>';
    $('#v-map').innerHTML = h;
  }

  function renderMore() {
    var c = cfg(), got = S.ach;
    var h = '<div class="sect">Щиты</div><div class="card"><p class="sub">Стрики наоборот: считают дни, когда риск не случился. Если сорвалась — жми, и счётчик начнётся заново. Это не наказание, это данные.</p>';
    for (var i = 0; i < D.SHIELDS.length; i++) {
      var sh = D.SHIELDS[i], dd = shieldDays(sh.id);
      h += '<div class="sh"><span class="days ' + (dd ? '' : 'zero') + '">' + dd + '</span>' +
        '<span class="d"><b>' + esc(sh.name) + ' <span class="muted">' + sh.weight + '</span></b><small>' + esc(sh.desc) + '</small></span>' +
        '<button class="btn sm" data-break="' + sh.id + '">сорвалась</button></div>';
    }
    h += '</div>';

    h += '<div class="sect">Ачивки · ' + Object.keys(got).length + ' из ' + D.ACHIEVEMENTS.length + '</div><div class="card"><div class="ach">';
    for (i = 0; i < D.ACHIEVEMENTS.length; i++) {
      var a = D.ACHIEVEMENTS[i], on = !!got[a.id];
      h += '<div class="ab ' + (on ? 'on' : '') + '"><div class="ic">' + (on ? '🏆' : '🔒') + '</div><b>' + esc(a.name) + '</b><small>' + esc(on ? fmtD(got[a.id]) : a.desc) + '</small></div>';
    }
    h += '</div></div>';

    h += '<div class="sect">Настройки</div><div class="card">' +
      '<label>Цель по доходу в месяц, €</label><input id="s1" type="number" inputmode="decimal" value="' + c.monthlyTarget + '">' +
      '<label>Пол цены за проект, €</label><input id="s2" type="number" inputmode="decimal" value="' + c.priceFloor + '">' +
      '<label>Норма тела в неделю</label><input id="s3" type="number" inputmode="numeric" value="' + c.normBody + '">' +
      '<label>Норма касаний в неделю</label><input id="s4" type="number" inputmode="numeric" value="' + c.normTouch + '">' +
      '<label>Норма нового в неделю</label><input id="s5" type="number" inputmode="numeric" value="' + c.normNew + '">' +
      '<button class="btn wide pri" id="ssave" style="margin-top:12px">Сохранить</button></div>';

    h += '<div class="sect">Данные</div><div class="card"><p class="sub">Всё хранится только в этом браузере. Чтобы перенести на телефон или сохранить — выгрузи файл.</p>' +
      '<div class="row"><button class="btn" style="flex:1" id="exp">⬇ Выгрузить</button>' +
      '<button class="btn" style="flex:1" id="impb">⬆ Загрузить</button></div>' +
      '<input type="file" id="imp" accept="application/json" style="display:none">' +
      '<div class="hr"></div><div class="row"><button class="btn sm" id="thm">Тема</button>' +
      '<button class="btn sm" id="wipe" style="color:var(--bad)">Стереть всё</button></div></div>';

    h += '<div class="card"><h2>Если всё развалилось</h2><p class="sub">Протокол, по убыванию важности</p>' +
      '<div class="li"><span class="ic">1</span><span class="tx">Вернуть тело. Один раз, сегодня, хоть двадцать минут</span></div>' +
      '<div class="li"><span class="ic">2</span><span class="tx">Позвонить своему человеку и сказать, что развалилось</span></div>' +
      '<div class="li"><span class="ic">3</span><span class="tx">Сделать одно касание. Любое, самое мелкое</span></div>' +
      '<div class="li"><span class="ic">4</span><span class="tx">Не пересматривать флагман. Желание сменить направление в момент провала — это качели, а не озарение</span></div>' +
      '<div class="li"><span class="ic">5</span><span class="tx">Начать неделю с текущего дня, а не с понедельника</span></div></div>';
    $('#v-more').innerHTML = h;
  }

  function render() {
    syncAch(); renderHead();
    if (VIEW === 'today') renderToday();
    if (VIEW === 'dvizh') renderDvizh();
    if (VIEW === 'money') renderMoney();
    if (VIEW === 'map') renderMap();
    if (VIEW === 'more') renderMore();
    var bs = document.querySelectorAll('.nv button');
    for (var i = 0; i < bs.length; i++) bs[i].classList.toggle('on', bs[i].getAttribute('data-v') === VIEW);
    var vs = document.querySelectorAll('.view');
    for (i = 0; i < vs.length; i++) vs[i].classList.toggle('on', vs[i].id === 'v-' + VIEW);
  }

  /* ---------- действия ---------- */
  function addLog(t) {
    var e = D.EVENTS[t]; if (!e) return;
    S.log.push({ id: 'l' + Date.now() + Math.random().toString(36).slice(2, 6), type: t, date: today() });
    save(); toast(e.icon + ' ' + e.label + ' +' + e.xp + ' XP'); render();
  }
  function drawCard() {
    var f = $('#dcat') ? $('#dcat').value : '';
    var pool = D.DECK.filter(function (x) { return !f || x.c === f; });
    var done = {}; for (var i = 0; i < S.news.length; i++) done[S.news[i].text] = 1;
    var fresh = pool.filter(function (x) { return !done[x.t]; });
    var src = fresh.length ? fresh : pool;
    S.draw = src[Math.floor(Math.random() * src.length)];
    save(); render();
  }
  function logNew(cat, text) {
    S.news.push({ id: 'n' + Date.now(), date: today(), cat: cat, text: text });
    S.log.push({ id: 'l' + Date.now() + 'n', type: 'newness', date: today() });
    S.draw = null; save(); toast('✨ Записано +20 XP'); render();
  }

  document.addEventListener('click', function (ev) {
    var t = ev.target.closest ? ev.target.closest('[data-add],[data-rm],[data-rmm],[data-break],[data-v],button') : null;
    if (!t) return;
    var a;
    if ((a = t.getAttribute('data-add'))) return addLog(a);
    if ((a = t.getAttribute('data-v'))) { VIEW = a; window.scrollTo(0, 0); return render(); }
    if ((a = t.getAttribute('data-rm'))) { S.log = S.log.filter(function (x) { return x.id !== a; }); save(); return render(); }
    if ((a = t.getAttribute('data-rmm'))) { S.money = S.money.filter(function (x) { return x.id !== a; }); save(); return render(); }
    if ((a = t.getAttribute('data-break'))) { S.shields[a] = { since: today() }; save(); toast('Счётчик пошёл заново. Это данные, не приговор'); return render(); }

    switch (t.id) {
      case 'draw': return drawCard();
      case 'didit': if (S.draw) return logNew(S.draw.c, S.draw.t); return;
      case 'nfadd': {
        var v = $('#nfree').value.trim(); if (!v) return toast('Напиши, что это было');
        return logNew($('#nfcat').value, v);
      }
      case 'madd': {
        var am = parseFloat($('#mamt').value); if (!am || am <= 0) return toast('Введи сумму');
        S.money.push({ id: 'm' + Date.now(), date: today(), amount: am, kind: $('#mkind').value, note: $('#mnote').value.trim() });
        save(); toast('💶 ' + num(am) + ' € записано'); return render();
      }
      case 'ssave': {
        var c = cfg();
        S.setup = {
          monthlyTarget: +$('#s1').value || 0, priceFloor: +$('#s2').value || 0,
          normBody: +$('#s3').value || 3, normTouch: +$('#s4').value || 7, normNew: +$('#s5').value || 2,
          start: c.start || today()
        };
        save(); toast('Сохранено'); return render();
      }
      case 'exp': {
        var blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
        var u = URL.createObjectURL(blob), a2 = document.createElement('a');
        a2.href = u; a2.download = 'ipr-' + today() + '.json'; a2.click();
        setTimeout(function () { URL.revokeObjectURL(u); }, 1000);
        return toast('Файл выгружен');
      }
      case 'impb': return $('#imp').click();
      case 'thm': {
        var cur = document.documentElement.getAttribute('data-theme');
        var nxt = cur === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', nxt); S.theme = nxt; save(); return;
      }
      case 'wipe': {
        if (!confirm('Стереть все данные без возможности вернуть? Сначала лучше выгрузить файл.')) return;
        S = clone(DEF); save(); toast('Стёрто'); return render();
      }
      case 'setupgo': {
        S.setup = {
          monthlyTarget: +$('#w1').value || 0, priceFloor: +$('#w2').value || 0,
          normBody: +$('#w3').value || 3, normTouch: +$('#w4').value || 7, normNew: +$('#w5').value || 2,
          start: today()
        };
        for (var i = 0; i < D.SHIELDS.length; i++) S.shields[D.SHIELDS[i].id] = { since: today() };
        save(); $('#setup').remove(); return render();
      }
    }
  });

  document.addEventListener('change', function (ev) {
    var el = ev.target;
    if (el.getAttribute && el.getAttribute('data-st')) {
      var id = el.getAttribute('data-st'), ix = +el.getAttribute('data-ix');
      if (!S.stages[id]) S.stages[id] = [];
      S.stages[id][ix] = el.checked; save(); render();
      return;
    }
    if (el.id === 'imp' && el.files && el.files[0]) {
      var fr = new FileReader();
      fr.onload = function () {
        try {
          var p = JSON.parse(fr.result);
          if (!p || typeof p !== 'object' || !('log' in p)) throw 0;
          if (!confirm('Заменить текущие данные загруженными?')) return;
          S = clone(DEF); for (var k in p) S[k] = p[k]; save(); toast('Загружено'); render();
        } catch (e) { toast('Файл не похож на выгрузку трекера'); }
      };
      fr.readAsText(el.files[0]);
    }
  });

  /* ---------- старт ---------- */
  if (S.theme) document.documentElement.setAttribute('data-theme', S.theme);

  if (!S.setup) {
    var w = document.createElement('div');
    w.id = 'setup';
    w.style.cssText = 'position:fixed;inset:0;z-index:100;background:var(--bg);overflow:auto;padding:26px 0';
    w.innerHTML = '<div class="wrap"><h1 style="font-size:22px;margin:0 0 6px;letter-spacing:-.02em">Пара цифр для старта</h1>' +
      '<p class="muted" style="margin:0 0 4px">Ничего из этого не уходит из твоего браузера и не попадает в репозиторий. Потом всё можно поменять в «Ещё».</p>' +
      '<div class="card"><label>Цель по доходу в месяц, €</label><input id="w1" type="number" inputmode="decimal" placeholder="2050">' +
      '<label>Пол цены за проект, € — ниже не называешь никогда</label><input id="w2" type="number" inputmode="decimal" placeholder="650">' +
      '<label>Тело: раз в неделю</label><input id="w3" type="number" inputmode="numeric" value="3">' +
      '<label>Касания к компаниям: за неделю</label><input id="w4" type="number" inputmode="numeric" value="7">' +
      '<label>Нового: за неделю</label><input id="w5" type="number" inputmode="numeric" value="2">' +
      '<button class="btn wide pri" id="setupgo" style="margin-top:14px">Начать</button></div></div>';
    document.body.appendChild(w);
  }
  render();
})();
