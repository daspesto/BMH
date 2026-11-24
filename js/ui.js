'use strict';

const STORAGE_KEY = 'hattrick-manager-save-v1';

const $ = sel => document.querySelector(sel);

const UI = (() => {
  const state = { game: null, squadSort: { key: 'skill', dir: -1 }, match: null, matchTimer: null, matchSpeed: 1, subOut: null, subIn: null, halftimeDone: false };

  function fmt(m) { return fmtMoney(m); }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.game));
  }
  function load() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }

  function myTeam() { return state.game.teams.find(t => t.short === state.game.userTeam); }

  function row(cells, cls) {
    const tr = document.createElement('tr');
    if (cls) tr.className = cls;
    cells.forEach(c => {
      const td = document.createElement('td');
      td.textContent = c;
      tr.appendChild(td);
    });
    return tr;
  }

  function home() {
    const g = state.game;
    const me = myTeam();
    const rows = computeStandings(g);
    const news = $('#home-news');
    news.innerHTML = '';
    g.news.slice(-8).reverse().forEach(n => {
      const li = document.createElement('li');
      li.textContent = n;
      news.appendChild(li);
    });
    $('#next-opponent').textContent = nextOpponentText();
    const kaderTD = $('#home-kader');
    kaderTD.innerHTML = '';
    me.squad.slice(0, 3).forEach(p => kaderTD.appendChild(row([p.name, p.pos, p.skill])));
  }

  function nextOpponentText() {
    const g = state.game;
    if (g.day >= g.fixtures.length) return 'Saison beendet!';
    const me = myTeam();
    const day = g.fixtures[g.day];
    const m = day.find(x => x.home === g.teams.indexOf(me) || x.away === g.teams.indexOf(me));
    if (!m) return '—';
    const home = g.teams[m.home];
    const away = g.teams[m.away];
    return home === me ? 'zu Hause gegen ' + away.name : 'auswärts bei ' + home.name;
  }

  function table() {
    const g = state.game;
    const rows = computeStandings(g);
    const tb = $('#table-body');
    tb.innerHTML = '';
    rows.forEach((r, i) => {
      const cls = r.team.short === g.userTeam ? 'me' : (i < 4 ? 'cl' : i >= rows.length - 3 ? 'ab' : '');
      tb.appendChild(row([
        (i + 1) + '.', r.name, r.played, r.gf + ':' + r.ga,
        (r.gd > 0 ? '+' : '') + r.gd, r.points
      ], cls));
    });
  }

  function fixturesView() {
    const g = state.game;
    const sel = $('#fixtures-day');
    sel.innerHTML = '';
    g.fixtures.forEach((_, i) => {
      const o = document.createElement('option');
      o.value = i; o.textContent = i + 1 + '. Spieltag';
      if (i === g.day) o.selected = true;
      sel.appendChild(o);
    });
    renderFixturesDay($('#fixtures-day').value | 0);
  }
  function renderFixturesDay(d) {
    const g = state.game;
    const tb = $('#fixtures-body');
    tb.innerHTML = '';
    g.fixtures[d].forEach(m => {
      const home = g.teams[m.home], away = g.teams[m.away];
      tb.appendChild(row([
        (d + 1) + '.',
        home.name, m.played ? m.hg + ':' + m.ag : '–', away.name
      ], home.short === g.userTeam || away.short === g.userTeam ? 'me' : ''));
    });
  }

  function squadView() {
    const me = myTeam();
    const tb = $('#squad-body');
    tb.innerHTML = '';
    const lineup = new Set([me.lineup.gk, ...(me.lineup.field || [])]);
    const players = me.squad.slice();
    const key = state.squadSort.key;
    const dir = state.squadSort.dir;
    players.sort((a, b) => {
      let x = a[key], y = b[key];
      if (key === 'name') { x = x.toLowerCase(); y = y.toLowerCase(); return dir * x.localeCompare(y, 'de'); }
      return dir * (x - y);
    });
    document.querySelectorAll('#view-squad .sortable').forEach(th => {
      th.classList.toggle('sorted-asc', th.dataset.key === key && dir === 1);
      th.classList.toggle('sorted-desc', th.dataset.key === key && dir === -1);
    });
    players.forEach(p => {
      const btn = document.createElement('button');
      btn.textContent = lineup.has(p.id) ? 'Bank' : 'Aufstellen';
      btn.onclick = () => toggleLineup(p.id);
      const tr = row([
        p.name, p.pos, p.age, p.skill, Math.round(p.fitness),
        p.form.toFixed(1), p.games, p.goals, fmt(p.value)
      ], lineup.has(p.id) ? 'lineup' : '');
      const td = document.createElement('td');
      td.appendChild(btn);
      tr.appendChild(td);
      tb.appendChild(tr);
    });
    $('#squad-money').textContent = 'Kontostand: ' + fmt(me.money);
  }

  function toggleLineup(id) {
    const me = myTeam();
    const p = me.squad.find(x => x.id === id);
    if (!p) return;
    const ids = new Set(me.lineup.field || []);
    if (me.lineup.gk === id) {
      if (ids.size >= 10) { alert('Aufstellung voll!'); return; }
      me.lineup.gk = null;
      ids.add(id);
    } else if (ids.has(id)) {
      if (p.pos === 'TW' && !me.lineup.gk) me.lineup.gk = id; else ids.delete(id);
    } else {
      if (p.pos === 'TW' && !me.lineup.gk) me.lineup.gk = id;
      else if (ids.size >= 10) { alert('Aufstellung voll!'); return; }
      else ids.add(id);
    }
    me.lineup.field = Array.from(ids);
    save();
    squadView();
  }

  function transfersView() {
    const g = state.game;
    const me = myTeam();
    $('#transfer-money').textContent = 'Kontostand: ' + fmt(me.money);
    const tb = $('#transfer-body');
    tb.innerHTML = '';
    (g.market || []).forEach((p, i) => {
      const fee = Math.round(p.value * 1.35);
      const btn = document.createElement('button');
      btn.textContent = 'Kaufen (' + fmt(fee) + ')';
      btn.onclick = () => buyTransfer(i);
      const tr = row([p.name, p.pos, p.age, p.skill, fmt(p.value)]);
      const td = document.createElement('td');
      td.appendChild(btn);
      tr.appendChild(td);
      tb.appendChild(tr);
    });
  }

  function buyTransfer(i) {
    const g = state.game;
    const p = (g.market || [])[i];
    if (!p) return;
    const me = myTeam();
    const res = transferOffer(state.game, p.id, me.short);
    if (!res.ok) { alert(res.msg); return; }

    state.game.news.push(res.msg);
    save();
    transfersView();
  }

  function playDay() {
    const g = state.game;
    if (state.match && !state.match.over) { showMatchView(); return; }
    if (g.day >= g.fixtures.length) {
      const finalPos = computeStandings(g).findIndex(r => r.team.short === g.userTeam) + 1;
      if (confirm('Saison ' + g.season + ' ist beendet – Platz ' + finalPos + '!\n\nNeue Saison starten?')) {
        newSeason(g);
        save();
        $('#ticker').innerHTML = '';
        renderAll();
      }
      return;
    }
    if ((myTeam().lineup.field || []).length < 10 || !myTeam().lineup.gk) {
      if (!confirm('Aufstellung unvollständig (benötigt: 1 TW + 10 Feldspieler).\nTrotzdem spielen?')) return;
    }
    startLiveMatch(g);
  }

  function startLiveMatch(g) {
    const ctx = startUserMatch(g);
    if (!ctx) {
      endOfDay(g);
      save();
      renderAll();
      return;
    }
    state.match = ctx;
    state.subOut = null; state.subIn = null;
    state.halftimeDone = false;
    state.matchSpeed = 1;
    if (state.matchTimer) clearInterval(state.matchTimer);
    state.matchTimer = setInterval(matchTick, 420);
    renderMatch();
    showMatchView();
  }

  function showMatchView() {
    ['#view-home','#view-table','#view-fixtures','#view-squad','#view-transfers','#view-tactics','#view-match'].forEach(v => {
      $(v).classList.add('hidden');
    });
    $('#view-match').classList.remove('hidden');
    document.querySelectorAll('nav button[data-view]').forEach(b => b.classList.remove('active'));
    renderMatch();
  }

  function matchTick() {
    const ctx = state.match;
    if (!ctx || ctx.over) return;
    if (ctx.needsSub) {
      openSubPanel(ctx.needsSub);
      renderMatch();
      return;
    }
    if (ctx.minute === 45 && !state.halftimeDone) {
      state.halftimeDone = true;
      pushEvent({ min: 45, side: 'home', type: 'break', text: '— HALBZEIT —', id: null });
      renderMatch();
      return;
    }
    let steps = state.matchSpeed;
    if (steps === 'skip') steps = 999;
    for (let i = 0; i < steps; i++) {
      if (ctx.over || ctx.needsSub) break;
      const ev = matchMinute(ctx);
      ev.forEach(e => pushEvent(e));
    }
    if (ctx.over) finishLiveMatch();
    else renderMatch();
  }

  function pushEvent(e) {
    const li = document.createElement('li');
    li.textContent = e.min + '. ' + e.text;
    li.className = e.type;
    const list = $('#match-events');
    list.insertBefore(li, list.firstChild);
  }

  function finishLiveMatch() {
    const ctx = state.match;
    if (!ctx) return;
    if (state.matchTimer) { clearInterval(state.matchTimer); state.matchTimer = null; }
    const g = state.game;
    const userScore = ctx.meHome ? ctx.hg + ':' + ctx.ag : ctx.ag + ':' + ctx.hg;
    const userWin = (ctx.meHome ? ctx.hg > ctx.ag : ctx.ag > ctx.hg);
    const others = finishUserMatch(g, ctx);
    state.match = null;
    g.news.push((g.day) + '. Spieltag: ' + userScore + ' gegen ' + ctx.opp.team.name +
      (userWin ? ' – Sieg!' : (userScore.split(':')[0] === userScore.split(':')[1]) ? ' – Remis.' : ' – Niederlage.'));
    if (!g.market || g.market.length < 6) g.market = (g.market || []).concat(generateTransferList(g)).slice(0, 14);
    save();
    renderSummaryTicker(others);
    state.view = '#view-home';
    renderAll();
  }

  function renderSummaryTicker(others) {
    const g = state.game;
    const day = g.fixtures[g.day - 1];
    const me = myTeam();
    const ticker = $('#ticker');
    ticker.innerHTML = '';
    day.forEach(m => {
      const h = g.teams[m.home], a = g.teams[m.away];
      const scoring = others.filter(r => r.team === h.short || r.team === a.short);
      const mine = h.short === me.short || a.short === me.short;
      const li = document.createElement('li');
      li.textContent = h.name + ' – ' + a.name + ' ' + m.hg + ':' + m.ag +
        (scoring.length ? '  (' + scoring.map(s => s.scorer + ' ' + s.minute + '.').join(', ') + ')' : '');
      if (mine) li.className = 'me';
      ticker.appendChild(li);
    });
  }

  const SLOTS = [
    ['IV', 30, 78], ['IV', 70, 78], ['LV', 12, 72], ['RV', 88, 72],
    ['DM', 50, 62], ['ZM', 35, 52], ['ZM', 65, 52],
    ['LM', 12, 44], ['RM', 88, 44], ['OM', 50, 32], ['ST', 38, 18], ['ST', 62, 18]
  ];

  function chip(side, p, x, y, isOpp) {
    const el = document.createElement('div');
    el.className = 'chip' + (isOpp ? ' opp' : '') +
      (side && side.yellows.has(p.id) ? ' warn' : '') +
      ((side && side.fieldIds.includes(p.id)) ? '' : ' out');
    el.style.left = x + '%';
    el.style.top = y + '%';
    el.textContent = p.pos + ' ' + p.name.split(' ')[1] + ' (' + p.skill + ')';
    if (!side.fieldIds.includes(p.id)) el.style.opacity = '0.35';
    $('#pitch').appendChild(el);
  }

  function renderPitchSide(side, isOpp) {
    const ctx = state.match;
    const byId = id => side.team.squad.find(p => p.id === id);
    const gk = byId(side.gkId);
    const slots = SLOTS.slice();
    const taken = [];
    if (gk) {
      const y = isOpp ? 5 : 95;
      chip(side, gk, 50, y, isOpp);
    }
    const field = side.fieldIds.map(byId).filter(Boolean);
    field.forEach(p => {
      let idx = slots.findIndex((s, i) => !taken.includes(i) && s[0] === p.pos);
      if (idx < 0) idx = slots.findIndex((s, i) => !taken.includes(i));
      if (idx < 0) return;
      taken.push(idx);
      let x = slots[idx][1], y = slots[idx][2];
      if (isOpp) { x = 100 - x; y = 100 - y; }
      chip(side, p, x, y, isOpp);
    });
  }

  function renderMatch() {
    const ctx = state.match;
    if (!ctx) return;
    $('#match-home').textContent = ctx.home.team.name;
    $('#match-away').textContent = ctx.away.team.name;
    $('#match-score-num').textContent = ctx.hg + ':' + ctx.ag;
    $('#match-minute').textContent = ctx.minute + '. Minute' +
      (ctx.minute >= ctx.stoppage ? ' – ABPFIFF!' : ctx.minute >= 45 ? ' – 2. Halbzeit' : '');
    const pitch = $('#pitch');
    pitch.innerHTML = '';
    renderPitchSide(ctx.user, false);
    renderPitchSide(ctx.opp, true);
    document.querySelectorAll('#match-controls button[data-t]').forEach(b => {
      b.classList.toggle('active', b.dataset.t === ctx.user.tactics);
    });
  }

  function openSubPanel(focusId) {
    const ctx = state.match;
    if (!ctx) return;
    const side = ctx.user;
    $('#sub-panel').classList.remove('hidden');
    if (focusId) state.subOut = focusId;
    renderSubPanel();
  }

  function renderSubPanel() {
    const ctx = state.match;
    const side = ctx.user;
    $('#sub-selection').textContent =
      'Noch ' + side.subsLeft + ' Auswechslung(en) übrig.' +
      (ctx.needsSub ? ' ACHTUNG: Ein Spieler ist verletzt/angeschlagen!' : '');
    const outList = $('#sub-out-list');
    outList.innerHTML = '';
    const byId = id => side.team.squad.find(p => p.id === id);
    side.fieldIds.forEach(id => {
      const p = byId(id);
      const row = document.createElement('div');
      row.className = 'sub-row' + (state.subOut === id ? ' sel' : '');
      row.textContent = p.name + ' (' + p.pos + ', Fit. ' + Math.round(p.fitness) + ')';
      row.onclick = () => { state.subOut = id; renderSubPanel(); };
      outList.appendChild(row);
    });
    const inList = $('#sub-in-list');
    inList.innerHTML = '';
    side.benchIds.map(byId).filter(Boolean).forEach(p => {
      const row = document.createElement('div');
      row.className = 'sub-row' + (state.subIn === p.id ? ' sel' : '');
      row.textContent = p.name + ' (' + p.pos + ', Skill ' + p.skill + ')';
      row.onclick = () => { state.subIn = p.id; renderSubPanel(); };
      inList.appendChild(row);
    });
    const doBtn = $('#sub-do');
    if (doBtn) doBtn.disabled = !(state.subOut && state.subIn && side.subsLeft > 0);
  }

  function performSub() {
    const ctx = state.match;
    if (!ctx || !state.subOut || !state.subIn) return;
    const side = ctx.user;
    if (side.subsLeft <= 0) { alert('Keine Auswechslungen mehr übrig!'); return; }
    substitutePlayer(ctx, side, state.subOut, state.subIn);
    const outP = side.team.squad.find(p => p.id === state.subOut);
    pushEvent({ min: ctx.minute, side: 'user', type: 'sub',
      text: 'Auswechslung: ' + (side.team.squad.find(p => p.id === state.subIn).name) + ' für ' + (outP ? outP.name : '?') });
    if (ctx.needsSub === state.subOut) ctx.needsSub = null;
    state.subOut = null; state.subIn = null;
    $('#sub-panel').classList.add('hidden');
    save();
    renderMatch();
  }

  function tactics() {
    const me = myTeam();
    document.querySelectorAll('#tactics .option').forEach(b => {
      b.classList.toggle('active', b.dataset.t === me.tactics);
      b.onclick = () => {
        me.tactics = b.dataset.t;
        save();
        tactics();
      };
    });
  }

  function renderAll() {
    const me = myTeam();
    $('#team-name').textContent = me.name;
    $('#day-label').textContent = state.game.day + '. Spieltag (Saison ' + state.game.season + ')';
    $('#money-label').textContent = fmt(me.money);
    ['#view-home','#view-table','#view-fixtures','#view-squad','#view-transfers','#view-tactics','#view-match'].forEach(v => {
      $(v).classList.add('hidden');
    });
    $(state.view).classList.remove('hidden');
    document.querySelectorAll('nav button[data-view]').forEach(b => {
      b.classList.toggle('active', '#' + b.dataset.view === state.view);
    });
    if (state.view === '#view-match') { showMatchView(); return; }
    ({ '#view-home': home, '#view-table': table, '#view-fixtures': fixturesView,
       '#view-squad': squadView, '#view-transfers': transfersView, '#view-tactics': tactics })[state.view]();
  }

  function show(view) {
    state.view = view;
    renderAll();
  }

  return { show, playDay, save, renderFixturesDay, state, load, startGame, performSub, finishLiveMatch };
})();

document.addEventListener('DOMContentLoaded', () => {
  UI.state.view = '#view-home';
  document.querySelectorAll('nav button[data-view]').forEach(b => {
    b.addEventListener('click', () => UI.show('#' + b.dataset.view));
  });
  $('#fixtures-day') && $('#fixtures-day').addEventListener('change', e => UI.renderFixturesDay(e.target.value | 0));
  $('#reset-game') && $('#reset-game').addEventListener('click', () => {
    if (confirm('Neu starten? Der Spielstand wird gelöscht.')) {
      localStorage.removeItem(STORAGE_KEY);
      location.reload();
    }
  });
  const btn = $('#play-day');
  if (btn) btn.addEventListener('click', UI.playDay);
  document.querySelectorAll('#view-squad .sortable').forEach(th => {
    th.addEventListener('click', () => {
      const st = UI.state.squadSort;
      if (st.key === th.dataset.key) st.dir *= -1;
      else { st.key = th.dataset.key; st.dir = 1; }
      UI.show('#view-squad');
    });
  });
  document.querySelectorAll('#match-controls button[data-t]').forEach(b => {
    b.addEventListener('click', () => {
      const ctx = UI.state.match;
      if (!ctx || ctx.over) return;
      ctx.user.tactics = b.dataset.t;
      ctx.user.team.tactics = b.dataset.t;
      document.querySelectorAll('#match-controls button[data-t]').forEach(x => x.classList.toggle('active', x === b));
    });
  });
  $('#sub-open') && $('#sub-open').addEventListener('click', () => {
    const ctx = UI.state.match;
    if (!ctx || ctx.over) return;
    $('#sub-panel').classList.toggle('hidden');
    UI.show('#view-match');
  });
  $('#sub-do') && $('#sub-do').addEventListener('click', UI.performSub);
  $('#sub-close') && $('#sub-close').addEventListener('click', () => $('#sub-panel').classList.add('hidden'));
  $('#match-speed') && $('#match-speed').addEventListener('click', () => {
    if (UI.state.matchSpeed === 1) { UI.state.matchSpeed = 3; $('#match-speed').textContent = '↭ Noch schneller'; }
    else { UI.state.matchSpeed = 1; $('#match-speed').textContent = '↯ Normaltempo'; }
  });
  $('#match-finish') && $('#match-finish').addEventListener('click', () => {
    const ctx = UI.state.match;
    if (!ctx || ctx.over) return;
    let guard = 0;
    while (!ctx.over && guard++ < 200 && !ctx.needsSub) {
      matchMinute(ctx).forEach(e => {
        const li = document.createElement('li');
        li.textContent = e.min + '. ' + e.text;
        li.className = e.type;
        $('#match-events').insertBefore(li, $('#match-events').firstChild);
      });
      if (ctx.minute === 45) guard = guard;
    }
    if (ctx.over) UI.finishLiveMatch();
    else UI.show('#view-match');
  });

  const savedRaw = localStorage.getItem(STORAGE_KEY);
  let savedOk = false;
  if (savedRaw) {
    try { UI.state.game = JSON.parse(savedRaw); savedOk = true; }
    catch (e) { localStorage.removeItem(STORAGE_KEY); }
  }
  if (savedOk && UI.state.game) {
    boot();
    return;
  }
  showTeamSelect();
});

function boot() {
  if (!UI.state.game.market || !UI.state.game.market.length) {
    UI.state.game.market = generateTransferList(UI.state.game);
  }
  UI.state.view = '#view-home';
  UI.show('#view-home');
}

function startGame(short) {
  const t = DATA.TEAMS.find(x => x.short === short) || DATA.TEAMS[16];
  UI.state.game = newGame(null, t.short);
  UI.state.game.market = generateTransferList(UI.state.game);
  UI.save();
  $('#team-select').classList.add('hidden');
  boot();
}

function showTeamSelect() {
  const list = $('#team-select-list');
  list.innerHTML = '';
  DATA.TEAMS.forEach((t, i) => {
    const b = document.createElement('button');
    b.className = 'team-btn';
    b.innerHTML = '<strong>' + t.name + '</strong><br>' +
      'Stärke ' + t.strength + ' · ' + fmtMoney(t.budget) + ' Transferbudget';
    b.addEventListener('click', () => startGame(t.short));
    if (i === 5 || i === 11) list.appendChild(document.createElement('br'));
    list.appendChild(b);
  });
  $('#team-select').classList.remove('hidden');
}
