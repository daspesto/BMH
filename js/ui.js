'use strict';

const $ = sel => document.querySelector(sel);

const STORAGE_KEY = 'bmh-remake-v2';
const VIEWS = ['#view-home', '#view-table', '#view-fixtures', '#view-squad', '#view-transfers',
               '#view-stadium', '#view-sponsors', '#view-training', '#view-match'];

const UI = (() => {
  const state = {
    game: null, view: '#view-home',
    squadSort: { key: 'skill', dir: -1 },
    tableLeague: 0, fixturesLeague: 0, fixturesDay: 0,
    match: null, matchTimer: null, matchSpeed: 1,
    subOut: null, subIn: null, halftimeDone: false,
    tsLeague: 0, sponsorOffer: null
  };

  const fmt = fmtMoney;
  const g = () => state.game;
  const me = () => g().teams.find(t => t.short === g().userTeam);

  function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(g())); }
  function load() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
      const d = JSON.parse(raw);
      return d && d.version === 2 ? d : null;
    } catch (e) { return null; }
  }

  function row(cells, cls) {
    const tr = document.createElement('tr');
    if (cls) tr.className = cls;
    cells.forEach(c => {
      const td = document.createElement('td');
      if (c && c.nodeType) td.appendChild(c); else td.textContent = c;
      tr.appendChild(td);
    });
    return tr;
  }
  function btn(label, fn) {
    const b = document.createElement('button');
    b.textContent = label;
    b.addEventListener('click', fn);
    return b;
  }

  /* ---------- Büro ---------- */

  function nextOpponentText() {
    const game = g();
    const meT = me();
    if (game.day >= 34) return 'Saison beendet!';
    const day = game.fixtures[meT.leagueIdx][game.day];
    const m = day.find(x => x.home === game.teams.indexOf(meT) || x.away === game.teams.indexOf(meT));
    if (!m) return '–';
    const home = game.teams[m.home], away = game.teams[m.away];
    return home === meT ? 'zu Hause gegen ' + away.name : 'auswärts bei ' + home.name;
  }

  function home() {
    const meT = me();
    $('#next-opponent').textContent = nextOpponentText();
    $('#home-money').textContent = fmt(meT.money);
    $('#home-stadium').textContent = meT.stadium.capacity.toLocaleString('de-DE') + ' Plätze' + (meT.stadium.roof ? ' (Dach)' : '');
    $('#home-sponsor').textContent = meT.sponsor ? meT.sponsor.name + ' (' + fmt(meT.sponsor.weekly) + '/Spieltag)' : 'kein';
    const news = $('#home-news');
    news.innerHTML = '';
    g().news.slice(0, 10).forEach(n => {
      const li = document.createElement('li');
      li.textContent = n;
      news.appendChild(li);
    });
  }

  /* ---------- Tabelle ---------- */

  function table() {
    const lg = state.tableLeague;
    document.querySelectorAll('.lgbtn').forEach(b =>
      b.classList.toggle('active', +b.dataset.lg === lg && b.closest('#view-table')));
    const rows = computeStandings(g(), lg);
    const tb = $('#table-body');
    tb.innerHTML = '';
    const n = rows.length;
    rows.forEach((r, i) => {
      let cls = r.team.short === g().userTeam ? 'me' : '';
      if (lg < 2 && i < 2) cls += ' up';
      if (lg > 0 && i >= n - 2) cls += ' down';
      tb.appendChild(row([
        (i + 1) + '.', r.name, r.played, r.gf + ':' + r.ga,
        (r.gd > 0 ? '+' : '') + r.gd, r.points
      ], cls.trim()));
    });
  }

  /* ---------- Spielplan ---------- */

  function fixturesView() {
    const lg = state.fixturesLeague;
    document.querySelectorAll('.lgbtn').forEach(b =>
      b.classList.toggle('active', +b.dataset.lg === lg && b.closest('#view-fixtures')));
    const sel = $('#fixtures-day');
    sel.innerHTML = '';
    for (let i = 0; i < 34; i++) {
      const o = document.createElement('option');
      o.value = i; o.textContent = (i + 1) + '. Spieltag';
      if (i === Math.min(g().day, 33)) o.selected = true;
      sel.appendChild(o);
    }
    renderFixturesDay(+sel.value || 0);
  }

  function renderFixturesDay(d) {
    const tb = $('#fixtures-body');
    tb.innerHTML = '';
    const day = g().fixtures[state.fixturesLeague][d];
    if (!day) return;
    day.forEach(m => {
      const h = g().teams[m.home], a = g().teams[m.away];
      tb.appendChild(row([
        (d + 1) + '.', h.name, m.played ? m.hg + ':' + m.ag : ' – ', a.name
      ], h.short === g().userTeam || a.short === g().userTeam ? 'me' : ''));
    });
  }

  /* ---------- Kader ---------- */

  function squadView() {
    const meT = me();
    $('#squad-money').textContent = 'Kontostand: ' + fmt(meT.money);
    const tb = $('#squad-body');
    tb.innerHTML = '';
    const lineup = new Set([meT.lineup.gk, ...(meT.lineup.field || [])]);
    const players = meT.squad.slice();
    const key = state.squadSort.key, dir = state.squadSort.dir;
    players.sort((a, b) => {
      if (key === 'name') return dir * a.name.toLowerCase().localeCompare(b.name.toLowerCase(), 'de');
      if (key === 'pos') return dir * a.pos.localeCompare(b.pos) || b.skill - a.skill;
      return dir * ((a[key] || 0) - (b[key] || 0));
    });
    document.querySelectorAll('#view-squad .sortable').forEach(th => {
      th.classList.toggle('sorted-asc', th.dataset.key === key && dir === 1);
      th.classList.toggle('sorted-desc', th.dataset.key === key && dir === -1);
    });
    players.forEach(p => {
      const lineupBtn = btn(lineup.has(p.id) ? 'BANK' : 'AUFSTELLEN', () => toggleLineup(p.id));
      const sellBtn = btn('VERKAUF', () => doSell(p.id));
      const acts = document.createElement('span');
      acts.appendChild(lineupBtn);
      acts.appendChild(document.createTextNode(' '));
      acts.appendChild(sellBtn);
      if (p.fitness < 85) {
        acts.appendChild(document.createTextNode(' '));
        acts.appendChild(btn('REHA', () => doRehab(p.id)));
      }
      tb.appendChild(row([
        p.name, p.pos, p.age, p.skill, Math.round(p.fitness),
        p.form.toFixed(1), p.games, p.goals, fmt(p.value), acts
      ], lineup.has(p.id) ? 'lineup' : ''));
    });
  }

  function toggleLineup(id) {
    const meT = me();
    const p = meT.squad.find(x => x.id === id);
    if (!p) return;
    const ids = new Set(meT.lineup.field || []);
    if (meT.lineup.gk === id) {
      if (ids.size >= 10) { alert('Aufstellung voll!'); return; }
      meT.lineup.gk = null;
      ids.add(id);
    } else if (ids.has(id)) {
      if (p.pos === 'TW' && !meT.lineup.gk) meT.lineup.gk = id; else ids.delete(id);
    } else {
      if (p.pos === 'TW' && !meT.lineup.gk) meT.lineup.gk = id;
      else if (ids.size >= 10) { alert('Aufstellung voll!'); return; }
      else ids.add(id);
    }
    meT.lineup.field = Array.from(ids);
    save();
    squadView();
  }

  function doSell(id) {
    const res = sellPlayer(g(), id);
    alert(res.msg);
    if (res.ok) { g().news.unshift(res.msg); save(); }
    squadView();
  }

  function doRehab(id) {
    const res = rehabPlayer(g(), id);
    alert(res.msg);
    save();
    squadView();
  }

  /* ---------- Transfers ---------- */

  function transfersView() {
    const meT = me();
    $('#transfer-money').textContent = 'Kontostand: ' + fmt(meT.money);
    const tb = $('#transfer-body');
    tb.innerHTML = '';
    (g().market || []).forEach(p => {
      tb.appendChild(row([p.name, p.pos, p.age, p.skill, fmt(p.value),
        btn('KAUFEN (' + fmt(Math.round(p.value * 1.35)) + ')', () => buyTransfer(p.id))]));
    });
  }

  function buyTransfer(id) {
    const res = transferOffer(g(), id, me().short);
    alert(res.msg);
    if (res.ok) { g().news.unshift(res.msg); save(); }
    transfersView();
  }

  /* ---------- Stadion ---------- */

  function stadiumView() {
    const meT = me();
    $('#stadium-info').innerHTML =
      'Kapazität: ' + meT.stadium.capacity.toLocaleString('de-DE') + ' Plätze<br>' +
      'Dach: ' + (meT.stadium.roof ? 'VORHANDEN' : 'keines') + '<br>' +
      'Einnahmen pro Heimspiel: ca. ' + fmt(stadiumIncome(meT)) + '<br>' +
      'Wartungskosten pro Spieltag: ' + fmt(Math.round(meT.stadium.capacity * 1.2)) + '<br>' +
      'Kontostand: ' + fmt(meT.money);
    $('#roof-btn').disabled = meT.stadium.roof;
  }

  /* ---------- Sponsoren ---------- */

  function sponsorsView() {
    const s = me().sponsor;
    $('#sponsor-current').innerHTML = s
      ? 'Aktuell: <strong>' + s.name + '</strong> zahlt ' + fmt(s.weekly) + ' pro Spieltag (' + s.years + ' Jahr/e).'
      : 'Kein Sponsorenvertrag!';
    $('#sponsor-offer').textContent = state.sponsorOffer
      ? 'Angebot: ' + state.sponsorOffer.name + ' – ' + fmt(state.sponsorOffer.weekly) + '/Spieltag (' + state.sponsorOffer.years + ' Jahre)'
      : 'Noch kein neues Angebot eingeholt.';
  }

  /* ---------- Training ---------- */

  function trainingView() {
    const meT = me();
    $('#camp-info').textContent = 'Trainingslager: ' + (meT.campUsed ? 'diese Saison bereits absolviert.' : 'möglich (400.000 € – Fitness +25, Form +1 für alle).');
    $('#camp-btn').disabled = meT.campUsed || meT.money < 400_000;
    const tb = $('#rehab-body');
    tb.innerHTML = '';
    meT.squad.filter(p => p.fitness < 90).forEach(p => {
      tb.appendChild(row([p.name, p.pos, Math.round(p.fitness) + '%',
        btn('REHA (100.000 €)', () => { const r = rehabPlayer(g(), p.id); alert(r.msg); save(); trainingView(); })]));
    });
    if (!tb.children.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 4; td.textContent = 'Alle Spieler topfit!';
      tr.appendChild(td); tb.appendChild(tr);
    }
  }

  /* ---------- Live-Match ---------- */

  const SLOTS = [
    ['IV', 30, 78], ['IV', 70, 78], ['LV', 12, 72], ['RV', 88, 72],
    ['DM', 50, 62], ['ZM', 35, 52], ['ZM', 65, 52],
    ['LM', 12, 44], ['RM', 88, 44], ['OM', 50, 32], ['ST', 38, 18], ['ST', 62, 18]
  ];

  function pitchChar(isUser, i) { return isUser ? String(1 + (i % 9)) : 'A'; }

  function renderAsciiPitch() {
    const ctx = state.match;
    if (!ctx) return;
    const W = 64, H = 21;
    const grid = [];
    for (let y = 0; y < H; y++) grid.push(new Array(W).fill(' '));
    for (let y = 0; y < H; y++) { grid[y][0] = '|'; grid[y][W - 1] = '|'; }
    for (let x = 1; x < W - 1; x++) { grid[0][x] = '='; grid[H - 1][x] = '='; grid[10][x] = '-'; }
    const putSide = (side, isUser) => {
      const byId = id => side.team.squad.find(p => p.id === id);
      const gk = byId(side.gkId);
      let counter = 0;
      const place = (p, sx, sy) => {
        const gx = Math.max(2, Math.min(W - 3, Math.round(1 + (sx / 100) * (W - 2))));
        let gy = isUser ? Math.round(H - 1 - (sy / 100) * (H - 2)) : Math.round(1 + ((100 - sy) / 100) * (H - 2));
        gy = Math.max(1, Math.min(H - 2, gy));
        grid[gy][gx] = pitchChar(isUser, counter++);
        const label = p.name.split(' ')[1] || p.name;
        const tag = (isUser ? '>' : '<') + label.slice(0, 10);
        for (let i = 0; i < tag.length && gx + i < W - 1; i++) grid[gy][gx + i] = tag[i];
      };
      if (gk) place(gk, 50, 95);
      const slots = SLOTS.slice(); const taken = [];
      side.fieldIds.map(byId).filter(Boolean).forEach(p => {
        let idx = slots.findIndex((s, i) => !taken.includes(i) && s[0] === p.pos);
        if (idx < 0) idx = slots.findIndex((s, i) => !taken.includes(i));
        if (idx < 0) return;
        taken.push(idx);
        place(p, slots[idx][1], slots[idx][2]);
      });
    };
    putSide(ctx.user, true);
    putSide(ctx.opp, false);
    const head =
      ' ' + ctx.home.team.name.toUpperCase().padEnd(24) + ctx.hg + ':' + ctx.ag +
      '   ' + ctx.away.team.name.toUpperCase().padEnd(24) + '\n' +
      ' Minute ' + String(ctx.minute).padStart(2) + ' von ' + ctx.stoppage + '  Taktik: ' + ctx.user.tactics.toUpperCase() +
      '  Wechsel übrig: ' + ctx.user.subsLeft + '\n' +
      '=' .repeat(W) + '\n';
    $('#ascii-pitch').textContent = head + grid.map(r => r.join('')).join('\n');
  }

  function renderMatchTitle() {
    const ctx = state.match;
    $('#match-title').textContent = ctx ? ctx.home.team.name + '  –  ' + ctx.away.team.name : '';
  }

  function pushEvent(e) {
    const li = document.createElement('li');
    li.textContent = e.min + '. ' + e.text;
    li.className = e.type;
    $('#match-events').insertBefore(li, $('#match-events').firstChild);
  }

  function showMatchView() {
    VIEWS.forEach(v => $(v).classList.add('hidden'));
    $('#view-match').classList.remove('hidden');
    document.querySelectorAll('nav button[data-view]').forEach(b => b.classList.remove('active'));
    renderMatchTitle();
    renderAsciiPitch();
    document.querySelectorAll('#match-controls button[data-t]').forEach(b =>
      b.classList.toggle('active', state.match && b.dataset.t === state.match.user.tactics));
  }

  function matchTick() {
    const ctx = state.match;
    if (!ctx || ctx.over) return;
    if (ctx.needsSub) {
      state.subOut = ctx.needsSub;
      $('#sub-panel').classList.remove('hidden');
      renderSubPanel();
      renderAsciiPitch();
      return;
    }
    if (ctx.minute === 45 && !state.halftimeDone) {
      state.halftimeDone = true;
      pushEvent({ min: 45, type: 'break', text: '— HALBZEIT —' });
      renderAsciiPitch();
      return;
    }
    let steps = state.matchSpeed === 'skip' ? 999 : state.matchSpeed;
    for (let i = 0; i < steps; i++) {
      if (ctx.over || ctx.needsSub) break;
      matchMinute(ctx).forEach(pushEvent);
    }
    if (ctx.over) finishLiveMatch();
    else renderAsciiPitch();
  }

  function finishLiveMatch() {
    const ctx = state.match;
    if (!ctx) return;
    if (state.matchTimer) { clearInterval(state.matchTimer); state.matchTimer = null; }
    const game = g();
    const userScore = ctx.meHome ? ctx.hg + ':' + ctx.ag : ctx.ag + ':' + ctx.hg;
    const userWin = ctx.meHome ? ctx.hg > ctx.ag : ctx.ag > ctx.hg;
    const draw = userScore.split(':')[0] === userScore.split(':')[1];
    finishUserMatch(game, ctx);
    state.match = null;
    game.news.unshift(game.day + '. Spieltag: ' + userScore + ' gegen ' + ctx.opp.team.name +
      (userWin ? ' – SIEG!' : draw ? ' – Remis.' : ' – Niederlage.'));
    if (!game.market || game.market.length < 6) game.market = game.market.concat(generateTransferList(game)).slice(0, 17);
    save();
    renderSummaryTicker();
    state.view = '#view-home';
    renderAll();
  }

  function renderSummaryTicker() {
    const game = g();
    const meT = me();
    const day = game.fixtures[meT.leagueIdx][game.day - 1];
    const ticker = $('#ticker');
    ticker.innerHTML = '';
    if (!day) return;
    day.forEach(m => {
      const h = game.teams[m.home], a = game.teams[m.away];
      const li = document.createElement('li');
      li.textContent = h.name + ' – ' + a.name + ' ' + m.hg + ':' + m.ag;
      if (h.short === meT.short || a.short === meT.short) li.className = 'me';
      ticker.appendChild(li);
    });
  }

  function renderSubPanel() {
    const ctx = state.match;
    if (!ctx) return;
    const side = ctx.user;
    $('#sub-selection').textContent =
      'Noch ' + side.subsLeft + ' Auswechslung(en).' + (ctx.needsSub ? '  ACHTUNG: Spieler verletzt/angeschlagen!' : '');
    const byId = id => side.team.squad.find(p => p.id === id);
    const outList = $('#sub-out-list');
    outList.innerHTML = '';
    side.fieldIds.forEach(id => {
      const p = byId(id);
      const r = document.createElement('div');
      r.className = 'sub-row' + (state.subOut === id ? ' sel' : '');
      r.textContent = p.name + ' (' + p.pos + ', Fit ' + Math.round(p.fitness) + ')';
      r.onclick = () => { state.subOut = id; renderSubPanel(); };
      outList.appendChild(r);
    });
    const inList = $('#sub-in-list');
    inList.innerHTML = '';
    side.benchIds.map(byId).filter(Boolean).forEach(p => {
      const r = document.createElement('div');
      r.className = 'sub-row' + (state.subIn === p.id ? ' sel' : '');
      r.textContent = p.name + ' (' + p.pos + ', Sk ' + p.skill + ')';
      r.onclick = () => { state.subIn = p.id; renderSubPanel(); };
      inList.appendChild(r);
    });
    $('#sub-do').disabled = !(state.subOut && state.subIn && side.subsLeft > 0);
  }

  function performSub() {
    const ctx = state.match;
    if (!ctx || !state.subOut || !state.subIn) return;
    const side = ctx.user;
    if (side.subsLeft <= 0) { alert('Keine Auswechslungen mehr übrig!'); return; }
    substitutePlayer(ctx, side, state.subOut, state.subIn);
    const inP = side.team.squad.find(p => p.id === state.subIn);
    const outP = side.team.squad.find(p => p.id === state.subOut);
    pushEvent({ min: ctx.minute, type: 'sub', text: 'Auswechslung: ' + (inP ? inP.name : '?') + ' für ' + (outP ? outP.name : '?') });
    if (ctx.needsSub === state.subOut) ctx.needsSub = null;
    state.subOut = null; state.subIn = null;
    $('#sub-panel').classList.add('hidden');
    renderAsciiPitch();
  }

  /* ---------- Spieltag / Navigation ---------- */

  function playDay() {
    if (state.match && !state.match.over) { showMatchView(); return; }
    const game = g();
    if (game.day >= 34) {
      const final = computeStandings(game, me().leagueIdx);
      const pos = final.findIndex(r => r.team.short === game.userTeam) + 1;
      if (confirm('Saison ' + game.season + ' beendet – Platz ' + pos + ' in der ' + DATA.LEAGUES[me().leagueIdx].name + '!\n\nNeue Saison starten?')) {
        newSeason(game);
        save();
        $('#ticker').innerHTML = '';
        $('#match-events').innerHTML = '';
        state.view = '#view-home';
        renderAll();
      }
      return;
    }
    const meT = me();
    if ((meT.lineup.field || []).length < 10 || !meT.lineup.gk) {
      if (!confirm('Aufstellung unvollständig (1 TW + 10 Feldspieler nötig).\nTrotzdem spielen?')) return;
    }
    const ctx = startUserMatch(game);
    if (!ctx) { endOfDay(game); save(); state.view = '#view-home'; renderAll(); return; }
    state.match = ctx;
    state.subOut = null; state.subIn = null;
    state.halftimeDone = false;
    state.matchSpeed = 1;
    $('#match-events').innerHTML = '';
    $('#sub-panel').classList.add('hidden');
    if (state.matchTimer) clearInterval(state.matchTimer);
    state.matchTimer = setInterval(matchTick, 420);
    showMatchView();
  }

  function renderAll() {
    const meT = me();
    if (!meT) return;
    $('#team-name').textContent = meT.name;
    $('#league-label').textContent = DATA.LEAGUES[meT.leagueIdx].name;
    $('#day-label').textContent = g().day + '. SPIELTAG / SAISON ' + g().season;
    $('#money-label').textContent = fmt(meT.money);
    if (state.view === '#view-match' && state.match) { showMatchView(); return; }
    VIEWS.forEach(v => $(v).classList.add('hidden'));
    $(state.view).classList.remove('hidden');
    document.querySelectorAll('nav button[data-view]').forEach(b =>
      b.classList.toggle('active', '#' + b.dataset.view === state.view));
    ({
      '#view-home': home, '#view-table': table, '#view-fixtures': fixturesView,
      '#view-squad': squadView, '#view-transfers': transfersView,
      '#view-stadium': stadiumView, '#view-sponsors': sponsorsView,
      '#view-training': trainingView
    })[state.view]();
  }

  function show(view) { state.view = view; renderAll(); }

  return { state, show, playDay, save, renderFixturesDay, startGame, performSub, finishLiveMatch };
})();

/* ---------- Boot ---------- */

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('nav button[data-view]').forEach(b =>
    b.addEventListener('click', () => UI.show('#' + b.dataset.view)));
  $('#play-day').addEventListener('click', UI.playDay);
  $('#fixtures-day').addEventListener('change', e => UI.renderFixturesDay(+e.target.value));
  $('#reset-game').addEventListener('click', () => {
    if (confirm('Neu starten? Der Spielstand wird gelöscht.')) {
      localStorage.removeItem(STORAGE_KEY);
      location.reload();
    }
  });

  document.querySelectorAll('#view-table .lgbtn').forEach(b =>
    b.addEventListener('click', () => { UI.state.tableLeague = +b.dataset.lg; UI.show('#view-table'); }));
  document.querySelectorAll('#view-fixtures .lgbtn').forEach(b =>
    b.addEventListener('click', () => { UI.state.fixturesLeague = +b.dataset.lg; UI.show('#view-fixtures'); }));

  document.querySelectorAll('#view-squad .sortable').forEach(th =>
    th.addEventListener('click', () => {
      const st = UI.state.squadSort;
      if (st.key === th.dataset.key) st.dir *= -1;
      else { st.key = th.dataset.key; st.dir = 1; }
      UI.show('#view-squad');
    }));

  document.querySelectorAll('button[data-expand]').forEach(b =>
    b.addEventListener('click', () => {
      const r = expandStadium(UI.state.game, +b.dataset.expand);
      alert(r.msg);
      if (r.ok) { UI.state.game.news.unshift(r.msg); UI.save(); }
      UI.show('#view-stadium');
    }));
  $('#roof-btn').addEventListener('click', () => {
    const r = buildRoof(UI.state.game);
    alert(r.msg);
    if (r.ok) { UI.state.game.news.unshift(r.msg); UI.save(); }
    UI.show('#view-stadium');
  });
  $('#sponsor-negotiate').addEventListener('click', () => {
    const off = sponsorOffer(UI.state.game);
    UI.state.sponsorOffer = off;
    $('#sponsor-offer').innerHTML = 'Angebot: <strong>' + off.name + '</strong> – ' + fmtMoney(off.weekly) +
      '/Spieltag (' + off.years + ' Jahre) <button id="sponsor-accept">ANNEHMEN</button>';
    $('#sponsor-accept').addEventListener('click', () => {
      const r = acceptSponsor(UI.state.game);
      alert(r.msg);
      UI.state.game.news.unshift(r.msg);
      UI.state.sponsorOffer = null;
      UI.save();
      UI.show('#view-sponsors');
    });
  });
  $('#camp-btn').addEventListener('click', () => {
    const r = trainingCamp(UI.state.game);
    alert(r.msg);
    if (r.ok) UI.state.game.news.unshift(r.msg);
    UI.save();
    UI.show('#view-training');
  });

  document.querySelectorAll('#match-controls button[data-t]').forEach(b =>
    b.addEventListener('click', () => {
      const ctx = UI.state.match;
      if (!ctx || ctx.over) return;
      ctx.user.tactics = b.dataset.t;
      ctx.user.team.tactics = b.dataset.t;
      document.querySelectorAll('#match-controls button[data-t]').forEach(x => x.classList.toggle('active', x === b));
    }));
  $('#sub-open').addEventListener('click', () => {
    if (!UI.state.match || UI.state.match.over) return;
    $('#sub-panel').classList.toggle('hidden');
  });
  $('#sub-do').addEventListener('click', UI.performSub);
  $('#sub-close').addEventListener('click', () => $('#sub-panel').classList.add('hidden'));
  $('#match-speed').addEventListener('click', () => {
    if (UI.state.matchSpeed === 1) { UI.state.matchSpeed = 3; $('#match-speed').textContent = 'NOCH SCHNELLER'; }
    else if (UI.state.matchSpeed === 3) { UI.state.matchSpeed = 1; $('#match-speed').textContent = 'SCHNELLER'; }
  });
  $('#match-finish').addEventListener('click', () => {
    const ctx = UI.state.match;
    if (!ctx || ctx.over) return;
    let guard = 0;
    while (!ctx.over && guard++ < 200 && !ctx.needsSub) matchMinute(ctx).forEach(pushEvtDom);
    if (ctx.over) UI.finishLiveMatch();
    function pushEvtDom(e) {
      const li = document.createElement('li');
      li.textContent = e.min + '. ' + e.text;
      li.className = e.type;
      $('#match-events').insertBefore(li, $('#match-events').firstChild);
    }
  });

  // Spielstand laden oder Vereinsauswahl zeigen
  const saved = (() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try { const d = JSON.parse(raw); return d && d.version === 2 ? d : null; }
    catch (e) { return null; }
  })();
  if (saved) {
    UI.state.game = saved;
    UI.state.view = '#view-home';
    UI.show('#view-home');
    return;
  }
  showTeamSelect();
});

function boot() {
  UI.state.view = '#view-home';
  UI.show('#view-home');
}

function startGame(short) {
  const t = DATA.LEAGUES.flatMap(l => l.teams).find(x => x.short === short);
  if (!t) return;
  UI.state.game = newGame(null, t.short);
  UI.state.game.market = generateTransferList(UI.state.game);
  UI.save();
  $('#team-select').classList.add('hidden');
  boot();
}

function showTeamSelect() {
  const tabs = $('#ts-tabs');
  tabs.innerHTML = '';
  DATA.LEAGUES.forEach((lg, i) => {
    const b = document.createElement('button');
    b.textContent = lg.name;
    b.classList.toggle('active', UI.state.tsLeague === i);
    b.addEventListener('click', () => { UI.state.tsLeague = i; showTeamSelect(); });
    tabs.appendChild(b);
  });
  const list = $('#team-select-list');
  list.innerHTML = '';
  DATA.LEAGUES[UI.state.tsLeague].teams.forEach(t => {
    const b = document.createElement('button');
    b.className = 'team-btn';
    b.innerHTML = '<strong>' + t.name + '</strong><br><small>Stärke ' + t.strength +
      ' · ' + fmtMoney(t.budget) + ' Budget · ' + t.cap.toLocaleString('de-DE') + ' Plätze</small>';
    b.addEventListener('click', () => startGame(t.short));
    list.appendChild(b);
  });
  $('#team-select').classList.remove('hidden');
}
