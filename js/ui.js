'use strict';

const STORAGE_KEY = 'hattrick-manager-save-v1';

const $ = sel => document.querySelector(sel);

const UI = (() => {
  const state = { game: null };

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
    me.squad.slice().sort((a, b) => b.skill - a.skill).forEach(p => {
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
    const results = endOfDay(g);
    const day = g.fixtures[g.day - 1];
    const me = myTeam();
    const myMatch = day.find(m => g.teams[m.home].short === me.short || g.teams[m.away].short === me.short);
    const ticker = $('#ticker');
    ticker.innerHTML = '';
    day.forEach(m => {
      const h = g.teams[m.home], a = g.teams[m.away];
      const scoring = results.filter(r => r.team === h.short || r.team === a.short);
      const li = document.createElement('li');
      const mine = h.short === me.short || a.short === me.short;
      li.textContent = h.name + ' – ' + a.name + ' ' + m.hg + ':' + m.ag +
        (scoring.length ? '  (' + scoring.map(s => s.scorer + ' ' + s.minute + '.').join(', ') + ')' : '');
      if (mine) li.className = 'me';
      ticker.appendChild(li);
    });
    const res = myMatch ? (g.teams[myMatch.home].short === me.short ? myMatch.hg + ':' + myMatch.ag : myMatch.ag + ':' + myMatch.hg) : '–';
    g.news.push(g.day + '. Spieltag: ' + res + ' – ' + nextOpponentText());
    if (!g.market || g.market.length < 6) g.market = (g.market || []).concat(generateTransferList(g)).slice(0, 14);
    save();
    renderAll();
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
    ['#view-home','#view-table','#view-fixtures','#view-squad','#view-transfers','#view-tactics'].forEach(v => {
      $(v).classList.add('hidden');
    });
    $('#' + state.view).classList.remove('hidden');
    document.querySelectorAll('nav button[data-view]').forEach(b => {
      b.classList.toggle('active', '#' + b.dataset.view === state.view);
    });
    ({ '#view-home': home, '#view-table': table, '#view-fixtures': fixturesView,
       '#view-squad': squadView, '#view-transfers': transfersView, '#view-tactics': tactics })[state.view]();
  }

  function show(view) {
    state.view = view;
    renderAll();
  }

  return { show, playDay, save, renderFixturesDay, state, load };
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
  if (!UI.state.game) {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) UI.state.game = JSON.parse(saved);
  }
  if (!UI.state.game) {
    const names = DATA.TEAMS.map(t => t.name).join('\n');
    const teamName = prompt('Willkommen beim Bundesliga Manager!\n\nWähle deinen Verein (genauer Name):\n\n' + names + '\n\nVerein:', 'Hannover 96');
    const t = DATA.TEAMS.find(x => x.name === teamName);
    UI.state.game = newGame(null, t ? t.short : DATA.TEAMS[16].short);
    UI.state.game.market = generateTransferList(UI.state.game);
    UI.save();
  }
  if (!UI.state.game.market || !UI.state.game.market.length) {
    UI.state.game.market = generateTransferList(UI.state.game);
  }
  UI.state.view = '#view-home';
  UI.show('#view-home');
  const btn = $('#play-day');
  if (btn) btn.addEventListener('click', UI.playDay);
});
