'use strict';

function rng(state) {
  let s = state >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function avg(arr) { return arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : 0; }
function round(x) { return Math.round(x * 100) / 100; }
function fmtMoney(m) { return (m < 0 ? '-' : '') + Math.abs(Math.round(m)).toLocaleString('de-DE') + ' €'; }

function randName(rnd, used) {
  const { FIRST, LAST } = DATA;
  for (let i = 0; i < 50; i++) {
    const n = FIRST[Math.floor(rnd() * FIRST.length)] + ' ' +
              LAST[Math.floor(rnd() * LAST.length)];
    if (!used.has(n)) { used.add(n); return n; }
  }
  return 'Spieler ' + Math.floor(rnd() * 9999);
}

function playerValue(p) {
  const base = Math.pow(Math.max(1, p.skill) / 50, 2.6) * 2_600_000;
  const peak = 27;
  const ageFactor = p.age <= peak ? 1 + (peak - p.age) * 0.05 : Math.max(0.15, 1 - (p.age - peak) * 0.11);
  const formFactor = 0.8 + p.form / 50;
  return Math.max(100_000, Math.round(base * ageFactor * formFactor / 100_000) * 100_000);
}

function newPlayer(rnd, used, baseSkill, pos, age) {
  const p = {
    id: Math.floor(rnd() * 1e9),
    name: randName(rnd, used),
    pos, age: age || 17 + Math.floor(rnd() * 17),
    skill: Math.max(1, Math.min(99, Math.round(baseSkill + (rnd() - 0.5) * 12))),
    form: Math.round(4 + rnd() * 4),
    fitness: Math.round(85 + rnd() * 15),
    goals: 0, assists: 0, games: 0
  };
  p.value = playerValue(p);
  return p;
}

function newTeam(def, leagueIdx, rnd, used) {
  const squad = [];
  DATA.POSITIONS.forEach(pos => {
    squad.push(newPlayer(rnd, used, def.strength + (pos === 'TW' ? 0 : 1), pos));
    squad.push(newPlayer(rnd, used, def.strength - 3, pos));
  });
  squad.push(newPlayer(rnd, used, def.strength - 5, 'ST'));
  const gks = squad.filter(p => p.pos === 'TW').sort((a, b) => b.skill - a.skill);
  const gk = gks[0];
  const field = squad
    .filter(p => p.pos !== 'TW' && p !== gk)
    .sort((a, b) => b.skill - a.skill)
    .slice(0, 10);
  return {
    id: def.short, name: def.name, short: def.short,
    leagueIdx, strength: def.strength,
    money: def.budget,
    squad,
    tactics: 'normal',
    lineup: { gk: gk.id, field: field.map(p => p.id) },
    points: 0, played: 0, goalsFor: 0, goalsAgainst: 0,
    stadium: { capacity: def.cap, roof: false },
    sponsor: null,
    campUsed: false,
    lastResults: []
  };
}

function newSponsor(team, rnd) {
  const names = DATA.SPONSORS;
  const weekly = Math.round((30000 + team.strength * 3800 * (1 + (rnd() - 0.4) * 0.3)) / 1000) * 1000;
  return { name: names[Math.floor(rnd() * names.length)], weekly, years: 1 + Math.floor(rnd() * 3) };
}

function roundRobin(n) {
  const teams = [];
  for (let i = 1; i < n; i++) teams.push(i);
  const rounds = [];
  const half = n / 2;
  for (let r = 0; r < n - 1; r++) {
    const pairs = [];
    const list = [0].concat(teams);
    for (let i = 0; i < half; i++) {
      const a = list[i], b = list[n - 1 - i];
      pairs.push(r % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(pairs);
    teams.push(teams.shift());
  }
  return rounds.concat(rounds.map(rd => rd.map(([a, b]) => [b, a])));
}

function makeLeagueFixtures(leagueTeamIdxs, rnd) {
  const order = leagueTeamIdxs.slice();
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return roundRobin(order.length).map(day =>
    day.map(([a, b]) => ({ home: order[a], away: order[b], played: false, hg: null, ag: null }))
  );
}

function newGame(seed, userTeamShort) {
  const rnd = rng(seed || Date.now());
  const used = new Set();
  const teams = [];
  DATA.LEAGUES.forEach((lg, li) => lg.teams.forEach(def => {
    const t = newTeam(def, li, rnd, used);
    t.sponsor = newSponsor(t, rnd);
    teams.push(t);
  }));
  const seedR = rng((seed || Date.now()) + 7);
  const fixtures = DATA.LEAGUES.map((lg, li) =>
    makeLeagueFixtures(teams.map((t, i) => t.leagueIdx === li ? i : -1).filter(i => i >= 0), seedR)
  );
  const user = teams.find(t => t.short === userTeamShort) || teams[0];
  return {
    version: 2,
    seed: (seed || Date.now()) >>> 0,
    userTeam: user.short,
    day: 0,
    season: 1,
    teams,
    fixtures,
    market: [],
    news: ['Willkommen beim Bundesliga Manager Hattrick – Remake!'],
    lastMatch: null,
    standings: null
  };
}

/* ---------- Stärke & Simulation ---------- */

function teamStrength(team) {
  const byId = new Map(team.squad.map(p => [p.id, p]));
  const field = (team.lineup.field || []).map(id => byId.get(id)).filter(Boolean);
  const keeper = byId.get(team.lineup.gk);
  const q = p => p.skill * (0.75 + p.form / 20) * (0.5 + p.fitness / 200);
  const attPlayers = field.filter(p => ['ST', 'OM'].includes(p.pos)).map(q);
  const midPlayers = field.filter(p => ['ZM', 'LM', 'RM', 'OM', 'DM'].includes(p.pos)).map(q);
  const defPlayers = field.filter(p => ['IV', 'LV', 'RV', 'DM'].includes(p.pos)).map(q);
  const all = field.map(q).concat(keeper ? [q(keeper)] : []);
  const base = avg(all) || 30;
  const tac = team.tactics === 'offensive' ? { a: 1.15, d: 0.85 } :
              team.tactics === 'defensive' ? { a: 0.85, d: 1.15 } : { a: 1, d: 1 };
  const missing = Math.max(0, 10 - field.length);
  const penalty = 1 - missing * 0.06;
  return {
    attack: (attPlayers.length ? avg(attPlayers) : base * 0.85) * tac.a * penalty,
    midfield: (midPlayers.length ? avg(midPlayers) : base * 0.9) * penalty,
    defense: ((defPlayers.length ? avg(defPlayers) : base * 0.9) * 0.7 +
              (keeper ? q(keeper) : base * 0.8) * 0.3) * tac.d * penalty
  };
}

function simulateGoals(homeStr, awayStr, rnd) {
  const hx = homeStr.attack / ((homeStr.attack + awayStr.defense) / 2);
  const ax = awayStr.attack / ((awayStr.attack + homeStr.defense) / 2);
  const hm = Math.max(0.3, Math.min(4.0, 1.8 * Math.pow(hx, 1.7)));
  const am = Math.max(0.25, Math.min(3.6, 1.5 * Math.pow(ax, 1.7)));
  const goalsFor = mean => {
    let g = 0;
    for (let i = 0; i < 6; i++) if (rnd() < mean / 6) g++;
    return g;
  };
  return [goalsFor(hm), goalsFor(am)];
}

function scorer(team, rnd) {
  const field = (team.lineup.field || []).map(id => team.squad.find(p => p.id === id)).filter(Boolean);
  if (!field.length) return null;
  const pool = field.map(p => ({ p, w: p.pos === 'ST' ? 10 : p.pos === 'OM' ? 6 : (p.pos === 'RM' || p.pos === 'LM') ? 3 : 1 }));
  let total = pool.reduce((s, x) => s + x.w, 0);
  let r = rnd() * total;
  for (const x of pool) { r -= x.w; if (r <= 0) return x.p; }
  return pool[pool.length - 1].p;
}

function applyMatch(state, match, score, rnd, log, goalScorers, skipFitnessShort) {
  const home = state.teams[match.home], away = state.teams[match.away];
  const [hg, ag] = score;
  match.played = true; match.hg = hg; match.ag = ag;
  home.played++; away.played++;
  home.goalsFor += hg; home.goalsAgainst += ag;
  away.goalsFor += ag; away.goalsAgainst += hg;
  let hpts = 0, apts = 0;
  if (hg > ag) hpts = 3; else if (hg < ag) apts = 3; else { hpts = 1; apts = 1; }
  home.points += hpts; away.points += apts;
  home.lastResults.push(hpts); away.lastResults.push(apts);
  for (const [team, gf] of [[home, hg], [away, ag]]) {
    const ids = new Set([team.lineup.gk, ...(team.lineup.field || [])]);
    team.squad.forEach(p => {
      if (ids.has(p.id)) {
        p.games++;
        if (team.short !== skipFitnessShort) {
          p.fitness = Math.max(40, p.fitness - (6 + Math.floor(rnd() * 5)));
        }
        p.form = Math.max(1, Math.min(10, p.form + (rnd() < 0.35 ? 1 : rnd() < 0.3 ? -1 : 0)));
      } else {
        p.fitness = Math.min(100, p.fitness + 4);
      }
    });
    for (let i = 0; i < gf; i++) {
      let s = null;
      if (goalScorers) {
        const list = (home === team ? goalScorers.home : goalScorers.away) || [];
        const id = list[i];
        s = id != null ? team.squad.find(x => x.id === id) : null;
      }
      if (!s) s = scorer(team, rnd);
      if (s) { s.goals++; log && log.push({ team: team.short, scorer: s.name, minute: 1 + Math.floor(rnd() * 90) }); }
    }
  }
}

/* ---------- Stadion & Finanzen ---------- */

const TICKET_PRICE = [25, 18, 12];

function stadiumIncome(team) {
  const price = TICKET_PRICE[team.leagueIdx] || 12;
  const fill = Math.max(0.45, Math.min(0.98, 0.5 + team.strength / 220));
  const roofBonus = team.stadium.roof ? 1.12 : 1;
  return Math.round(team.stadium.capacity * fill * price * roofBonus);
}

function expandStadium(state, seats) {
  const t = state.teams.find(x => x.short === state.userTeam);
  if (!t) return { ok: false, msg: 'Verein nicht gefunden.' };
  if (t.stadium.capacity + seats > 100000) return { ok: false, msg: 'Maximal 100.000 Plätze!' };
  const cost = seats * 400;
  if (t.money < cost) return { ok: false, msg: 'Nicht genug Geld: ' + fmtMoney(cost) + ' nötig.' };
  t.money -= cost;
  t.stadium.capacity += seats;
  return { ok: true, msg: 'Ausbau um ' + seats.toLocaleString('de-DE') + ' Plätze für ' + fmtMoney(cost) + '.' };
}

function buildRoof(state) {
  const t = state.teams.find(x => x.short === state.userTeam);
  if (!t) return { ok: false, msg: 'Verein nicht gefunden.' };
  if (t.stadium.roof) return { ok: false, msg: 'Das Stadion hat bereits ein Dach!' };
  const cost = Math.round(t.stadium.capacity * 150 / 1000) * 1000;
  if (t.money < cost) return { ok: false, msg: 'Nicht genug Geld: ' + fmtMoney(cost) + ' nötig.' };
  t.money -= cost;
  t.stadium.roof = true;
  return { ok: true, msg: 'Dach gebaut! Zuschauereinnahmen +12%.' };
}

function sponsorOffer(state) {
  const t = state.teams.find(x => x.short === state.userTeam);
  if (!t) return null;
  const rnd = rng((state.seed + state.day * 613 + t.strength) >>> 0);
  return newSponsor(t, rnd);
}

function acceptSponsor(state) {
  const t = state.teams.find(x => x.short === state.userTeam);
  if (!t) return { ok: false };
  const offer = sponsorOffer(state);
  t.sponsor = offer;
  return { ok: true, msg: 'Neuer Sponsor: ' + offer.name + ' zahlt ' + fmtMoney(offer.weekly) + ' pro Spieltag (' + offer.years + ' Jahre).' };
}

function weeklyFinance(state) {
  state.teams.forEach(t => {
    const wages = t.squad.reduce((s, p) => s + playerValue(p) * 0.0022, 0);
    const upkeep = t.stadium.capacity * 1.2;
    const sponsor = t.sponsor ? t.sponsor.weekly : 0;
    t.money -= Math.round(wages + upkeep - sponsor);
  });
}

/* ---------- Transfers ---------- */

function transferOffer(state, playerId, buyingTeamShort) {
  const buyer = state.teams.find(t => t.short === buyingTeamShort);
  if (!buyer) return { ok: false, msg: 'Verein nicht gefunden.' };
  const seller = state.teams.find(t => t.squad.some(p => p.id === playerId));
  const free = state.market && state.market.some(p => p.id === playerId);
  if (!seller && !free) return { ok: false, msg: 'Spieler nicht gefunden.' };
  const p = seller ? seller.squad.find(x => x.id === playerId)
                    : state.market.find(x => x.id === playerId);
  const fee = Math.round(p.value * 1.35);
  if (buyer.squad.length >= 32) return { ok: false, msg: 'Kader voll (max. 32 Spieler).' };
  if (buyer.money < fee) return { ok: false, msg: 'Nicht genug Geld für ' + fmtMoney(fee) + '.' };
  buyer.money -= fee;
  if (seller) {
    seller.money += fee;
    seller.squad = seller.squad.filter(x => x.id !== p.id);
    if ((seller.lineup.field || []).includes(p.id)) seller.lineup.field = seller.lineup.field.filter(id => id !== p.id);
    if (seller.lineup.gk === p.id) {
      const gk = seller.squad.find(x => x.pos === 'TW');
      seller.lineup.gk = gk ? gk.id : null;
    }
  } else {
    state.market = state.market.filter(x => x.id !== p.id);
  }
  buyer.squad.push(p);
  if (buyer.short === state.userTeam && buyer.squad.length <= 18) {
    if (p.pos === 'TW' && !buyer.lineup.gk) buyer.lineup.gk = p.id;
    else if (p.pos !== 'TW' && (buyer.lineup.field || []).length < 10) buyer.lineup.field.push(p.id);
  }
  return { ok: true, msg: p.name + ' für ' + fmtMoney(fee) + ' verpflichtet.', fee };
}

function sellPlayer(state, playerId) {
  const me = state.teams.find(t => t.short === state.userTeam);
  if (!me) return { ok: false, msg: 'Verein nicht gefunden.' };
  const p = me.squad.find(x => x.id === playerId);
  if (!p) return { ok: false, msg: 'Spieler nicht gefunden.' };
  if (me.squad.length <= 14) return { ok: false, msg: 'Kader zu klein (min. 14 Spieler).' };
  const rnd = rng((state.seed + playerId) >>> 0);
  const fee = Math.round(p.value * (0.72 + rnd() * 0.3));
  const candidates = state.teams.filter(t =>
    t.short !== me.short && t.money >= fee && t.squad.length < 30 &&
    t.strength >= p.skill - 14 && t.strength <= p.skill + 10);
  if (!candidates.length) {
    return { ok: false, msg: 'Kein Interessent für ' + p.name + ' – Trainer warten lassen.' };
  }
  const buyer = candidates[Math.floor(rnd() * candidates.length)];
  buyer.money -= fee;
  me.money += fee;
  me.squad = me.squad.filter(x => x.id !== p.id);
  if ((me.lineup.field || []).includes(p.id)) me.lineup.field = me.lineup.field.filter(id => id !== p.id);
  if (me.lineup.gk === p.id) {
    const gk = me.squad.find(x => x.pos === 'TW');
    me.lineup.gk = gk ? gk.id : null;
  }
  buyer.squad.push(p);
  return { ok: true, msg: p.name + ' für ' + fmtMoney(fee) + ' an ' + buyer.name + ' verkauft.' };
}

/* ---------- Training ---------- */

function trainingCamp(state) {
  const t = state.teams.find(x => x.short === state.userTeam);
  if (!t) return { ok: false, msg: 'Verein nicht gefunden.' };
  if (t.campUsed) return { ok: false, msg: 'In dieser Saison wurde schon ein Trainingslager absolviert.' };
  const cost = 400_000;
  if (t.money < cost) return { ok: false, msg: 'Trainingslager kostet ' + fmtMoney(cost) + '.' };
  t.money -= cost;
  t.campUsed = true;
  t.squad.forEach(p => {
    p.fitness = Math.min(100, p.fitness + 25);
    p.form = Math.min(10, p.form + 1);
  });
  return { ok: true, msg: 'Trainingslager abgeschlossen: Fitness +25, Form +1 für alle!' };
}

function rehabPlayer(state, playerId) {
  const t = state.teams.find(x => x.short === state.userTeam);
  if (!t) return { ok: false, msg: 'Verein nicht gefunden.' };
  const p = t.squad.find(x => x.id === playerId);
  if (!p) return { ok: false, msg: 'Spieler nicht gefunden.' };
  const cost = 100_000;
  if (t.money < cost) return { ok: false, msg: 'Reha kostet ' + fmtMoney(cost) + '.' };
  t.money -= cost;
  p.fitness = 100;
  return { ok: true, msg: p.name + ' ist wieder topfit (Reha-Klinik, ' + fmtMoney(cost) + ').' };
}

/* ---------- Spieltag ---------- */

/* ---------- KI-Rotation: fitteste Spieler aufstellen ---------- */

function aiRotate(team) {
  const gks = team.squad.filter(p => p.pos === 'TW')
    .sort((a, b) => (b.skill * (b.fitness / 100)) - (a.skill * (a.fitness / 100)));
  const gk = gks[0];
  const field = team.squad
    .filter(p => p.pos !== 'TW' && (!gk || p.id !== gk.id))
    .sort((a, b) => (b.skill * (0.5 + b.fitness / 200)) - (a.skill * (0.5 + a.fitness / 200)))
    .slice(0, 10);
  team.lineup.gk = gk ? gk.id : null;
  team.lineup.field = field.map(p => p.id);
}

function endOfDay(state, skipShort) {
  const rnd = rng((state.seed + state.day * 7919) >>> 0);
  const results = [];
  state.teams.forEach(t => { if (t.short !== state.userTeam) aiRotate(t); });
  state.fixtures.forEach(leagueFixtures => {
    const day = leagueFixtures[state.day];
    if (!day) return;
    day.forEach(m => {
      const home = state.teams[m.home], away = state.teams[m.away];
      if (skipShort && (home.short === skipShort || away.short === skipShort)) return;
      const hs = teamStrength(home), as = teamStrength(away);
      const log = [];
      const score = simulateGoals(hs, as, rnd);
      applyMatch(state, m, score, rnd, log);
      log.forEach(l => results.push(l));
      home.money += stadiumIncome(home);
    });
  });
  postDay(state, rnd);
  return results;
}

function postDay(state, rnd) {
  weeklyFinance(state);
  state.day++;
  state.teams.forEach(t => {
    const isUser = t.short === state.userTeam;
    t.squad.forEach(p => {
      p.fitness = Math.min(100, p.fitness + (isUser ? 12 : 10));
      if (isUser) {
        if (rnd() < 0.08 && p.age < 30 && p.skill < 95) { p.skill++; p.value = playerValue(p); }
        if (rnd() < 0.02 && p.age > 31 && p.skill > 40) { p.skill--; p.value = playerValue(p); }
      }
    });
  });
  computeStandings(state);
}

function computeStandings(state, leagueIdx) {
  const rows = state.teams.map((t, i) => ({ t, i }))
    .filter(x => x.t.leagueIdx === leagueIdx)
    .map(x => ({
      team: x.t, idx: x.i, name: x.t.name, short: x.t.short, played: x.t.played,
      gf: x.t.goalsFor, ga: x.t.goalsAgainst, gd: x.t.goalsFor - x.t.goalsAgainst,
      points: x.t.points
    }));
  rows.sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf || a.name.localeCompare(b.name));
  return rows;
}

/* ---------- Saison-Wechsel (Auf-/Abstieg) ---------- */

function newSeason(state) {
  const rnd = rng((state.seed + state.season * 104729) >>> 0);
  state.season++;
  const used = new Set(state.teams.flatMap(t => t.squad.map(p => p.name)));
  // Abschluss-Tabellen VOR dem Reset für Auf-/Abstieg merken
  const finalTables = [0, 1, 2].map(li => computeStandings(state, li));
  state.teams.forEach(t => {
    const keep = [];
    t.squad.forEach(p => {
      p.age++;
      if (p.age > 34 + Math.floor(rnd() * 3)) {
        t.money += Math.round(p.value * 0.2);
        if (p.id === t.lineup.gk) t.lineup.gk = null;
        t.lineup.field = (t.lineup.field || []).filter(id => id !== p.id);
      } else {
        p.games = 0; p.goals = 0;
        keep.push(p);
      }
    });
    t.squad = keep;
    while (t.squad.length < 20) {
      const pos = DATA.POSITIONS[t.squad.length % DATA.POSITIONS.length];
      t.squad.push(newPlayer(rnd, used, t.strength - 6 + rnd() * 8, pos, 17 + Math.floor(rnd() * 6)));
    }
    const gk = t.squad.find(p => p.pos === 'TW');
    if (!t.lineup.gk && gk) t.lineup.gk = gk.id;
    const valid = (t.lineup.field || []).filter(id => t.squad.some(p => p.id === id));
    if (valid.length < 10) {
      const pool = t.squad.filter(p => p.pos !== 'TW' && !valid.includes(p.id));
      while (valid.length < 10 && pool.length) valid.push(pool.shift().id);
    }
    t.lineup.field = valid.slice(0, 10);
    t.points = 0; t.played = 0; t.goalsFor = 0; t.goalsAgainst = 0; t.lastResults = [];
    t.campUsed = false;
  });
  // Auf-/Abstieg: die unteren 2 einer Liga tauschen mit den oberen 2 der Liga darunter
  const me = state.teams.find(t => t.short === state.userTeam);
  const myNews = [];
  for (let li = 0; li < 2; li++) {
    const upper = finalTables[li];
    const lower = finalTables[li + 1];
    const down = upper.slice(-2);
    const up = lower.slice(0, 2);
    down.forEach(r => { r.team.leagueIdx = li + 1; });
    up.forEach(r => { r.team.leagueIdx = li; });
    if (me && (down.some(r => r.team === me) || up.some(r => r.team === me))) {
      myNews.push(me.leagueIdx === li ? 'ABSTIEG! Ihr Verein spielt nächste Saison in der ' + DATA.LEAGUES[li + 1].name + '.'
                                       : 'AUFSTIEG! Ihr Verein spielt nächste Saison in der ' + DATA.LEAGUES[li].name + '!');
    }
  }
  // neue Spielpläne je Liga
  const seedR = rng((state.seed + state.season * 7717) >>> 0);
  state.fixtures = DATA.LEAGUES.map((lg, li) =>
    makeLeagueFixtures(state.teams.map((t, i) => t.leagueIdx === li ? i : -1).filter(i => i >= 0), seedR)
  );
  state.day = 0;
  state.market = generateTransferList(state);
  state.news.unshift('=== Saison ' + state.season + ' beginnt! ===');
  myNews.forEach(n => state.news.unshift(n));
}

function generateTransferList(state) {
  const rnd = rng((state.seed ^ 0x5eed) + state.day * 131);
  const list = [];
  const used = new Set(state.teams.flatMap(t => t.squad.map(p => p.name)));
  const tier = (lo, hi) => newPlayer(rnd, used, lo + rnd() * (hi - lo), DATA.POSITIONS[Math.floor(rnd() * DATA.POSITIONS.length)]);
  for (let i = 0; i < 5; i++) list.push(tier(45, 57));
  for (let i = 0; i < 6; i++) list.push(tier(54, 64));
  for (let i = 0; i < 3; i++) list.push(tier(62, 74));
  for (let i = 0; i < 3; i++) list.push(tier(70, 82));
  return list;
}

/* ---------- Live-Match des Users ---------- */

function makeSideFor(state, team) {
  const side = {
    team, isUser: team.short === state.userTeam, tactics: team.tactics,
    yellows: new Set(), reds: new Set(), injured: new Set(), subsLeft: 3
  };
  const gkP = team.squad.find(p => p.id === team.lineup.gk) || team.squad.find(p => p.pos === 'TW');
  side.gkId = gkP ? gkP.id : null;
  side.fieldIds = (team.lineup.field || []).filter(id => team.squad.some(p => p.id === id));
  const used = new Set([side.gkId].concat(side.fieldIds));
  side.benchIds = team.squad.filter(p => !used.has(p.id)).map(p => p.id);
  return side;
}

function liveStrength(side) {
  return teamStrength({ squad: side.team.squad, lineup: { gk: side.gkId, field: side.fieldIds }, tactics: side.tactics });
}

function sidePlayer(side, id) { return side.team.squad.find(p => p.id === id); }

function pickScorer(side, rnd) {
  const field = side.fieldIds.map(id => sidePlayer(side, id)).filter(Boolean);
  if (!field.length) return null;
  const pool = field.map(p => ({ p, w: p.pos === 'ST' ? 10 : p.pos === 'OM' ? 6 : (p.pos === 'RM' || p.pos === 'LM') ? 3 : 1 }));
  let total = pool.reduce((s, x) => s + x.w, 0);
  let r = rnd() * total;
  for (const x of pool) { r -= x.w; if (r <= 0) return x.p; }
  return pool[pool.length - 1].p;
}

function startUserMatch(state) {
  const leagueFixtures = state.fixtures[state.teams.findIndex(t => t.short === state.userTeam) >= 0 ? state.teams.find(t => t.short === state.userTeam).leagueIdx : 0];
  const day = leagueFixtures[state.day];
  if (!day) return null;
  const meIdx = state.teams.findIndex(t => t.short === state.userTeam);
  const m = day.find(mm => mm.home === meIdx || mm.away === meIdx);
  if (!m) return null;
  const ctx = {
    state, m, meHome: m.home === meIdx,
    minute: 0, hg: 0, ag: 0, over: false,
    stoppage: 90 + Math.floor(rng((state.seed + state.day * 31) >>> 0)() * 5),
    events: [], needsSub: null,
    rnd: rng(((state.seed ^ 0xBEEF) + state.day * 977) >>> 0),
    goalScorers: { home: [], away: [] },
    goals: { home: [], away: [] }
  };
  if (state.teams[m.home].short !== state.userTeam) aiRotate(state.teams[m.home]);
  if (state.teams[m.away].short !== state.userTeam) aiRotate(state.teams[m.away]);
  ctx.home = makeSideFor(state, state.teams[m.home]);
  ctx.away = makeSideFor(state, state.teams[m.away]);
  ctx.user = ctx.meHome ? ctx.home : ctx.away;
  ctx.opp = ctx.meHome ? ctx.away : ctx.home;
  return ctx;
}

function matchGoal(ctx, side, isHome, ev) {
  const s = pickScorer(side, ctx.rnd);
  if (isHome) ctx.hg++; else ctx.ag++;
  const key = isHome ? 'home' : 'away';
  ctx.goalScorers[key].push(s ? s.id : null);
  ctx.goals[key].push({ id: s ? s.id : null, min: ctx.minute });
  ev.push({ min: ctx.minute, side: key, type: 'goal', id: s && s.id,
    text: 'TOR! ' + (s ? s.name : '?') + ' (' + side.team.short + ')' });
}

function substitutePlayer(ctx, side, outId, inId) {
  side.fieldIds = side.fieldIds.filter(id => id !== outId);
  side.fieldIds.push(inId);
  side.benchIds = side.benchIds.filter(id => id !== inId);
  side.subsLeft--;
}

function aiSub(ctx, side, outId, ev) {
  if (side.subsLeft <= 0 || !side.benchIds.length) return;
  const outP = sidePlayer(side, outId);
  const bench = side.benchIds.map(id => sidePlayer(side, id)).filter(Boolean);
  if (!bench.length) return;
  bench.sort((a, b) => {
    const pa = a.pos === (outP && outP.pos) ? 1 : 0;
    const pb = b.pos === (outP && outP.pos) ? 1 : 0;
    return pb - pa || b.skill - a.skill;
  });
  const inP = bench[0];
  substitutePlayer(ctx, side, outId, inP.id);
  ev.push({ min: ctx.minute, side: side === ctx.home ? 'home' : 'away', type: 'sub',
    id: inP.id, text: 'Auswechslung (' + side.team.short + '): ' + inP.name + ' für ' + (outP ? outP.name : '?') });
}

function matchMinute(ctx) {
  if (ctx.over) return [];
  ctx.minute++;
  const ev = [];
  const rnd = ctx.rnd;
  const hs = liveStrength(ctx.home), as = liveStrength(ctx.away);
  const pGoal = (att, def, home) =>
    Math.max(0.003, Math.min(0.12, 0.0135 * Math.pow(att / Math.max(1, def), 2.2) * (home ? 1.12 : 1)));
  const ph = pGoal(hs.attack, as.defense, true);
  const pa = pGoal(as.attack, hs.defense, false);
  if (rnd() < ph) matchGoal(ctx, ctx.home, true, ev);
  if (!ev.length && rnd() < pa) matchGoal(ctx, ctx.away, false, ev);
  for (const side of [ctx.home, ctx.away]) {
    const key = side === ctx.home ? 'home' : 'away';
    if (rnd() < 0.006) {
      const ids = side.fieldIds.slice();
      if (ids.length) {
        const pid = ids[Math.floor(rnd() * ids.length)];
        const p = sidePlayer(side, pid);
        if (side.yellows.has(pid)) {
          side.yellows.delete(pid);
          side.reds.add(pid);
          side.fieldIds = side.fieldIds.filter(id => id !== pid);
          if (p) p.form = Math.max(1, p.form - 1);
          ev.push({ min: ctx.minute, side: key, type: 'red', id: pid,
            text: 'ROT! ' + (p ? p.name : '?') + ' (' + side.team.short + ') ist vom Platz!' });
        } else {
          side.yellows.add(pid);
          ev.push({ min: ctx.minute, side: key, type: 'yellow', id: pid,
            text: 'Gelb: ' + (p ? p.name : '?') + ' (' + side.team.short + ')' });
        }
      }
    }
    if (rnd() < 0.0035) {
      const ids = side.fieldIds.slice();
      if (ids.length) {
        const pid = ids[Math.floor(rnd() * ids.length)];
        const p = sidePlayer(side, pid);
        if (p) p.fitness = Math.max(15, p.fitness - 25);
        side.injured.add(pid);
        ev.push({ min: ctx.minute, side: key, type: 'injury', id: pid,
          text: 'VERLETZT: ' + (p ? p.name : '?') + ' (' + side.team.short + ')' });
        if (side.isUser) ctx.needsSub = pid;
        else aiSub(ctx, side, pid, ev);
      }
    }
    for (const pid of side.fieldIds) {
      const p = sidePlayer(side, pid);
      if (p) p.fitness = Math.max(40, p.fitness - 0.11);
    }
    const gk = sidePlayer(side, side.gkId);
    if (gk && ctx.minute % 15 === 0) gk.fitness = Math.max(40, gk.fitness - 0.4);
  }
  if (ctx.minute >= ctx.stoppage) ctx.over = true;
  ctx.events.push(...ev);
  return ev;
}

function finishUserMatch(state, ctx) {
  const m = ctx.m;
  ctx.home.team.lineup = { gk: ctx.home.gkId, field: ctx.home.fieldIds.slice() };
  ctx.away.team.lineup = { gk: ctx.away.gkId, field: ctx.away.fieldIds.slice() };
  applyMatch(state, m, [ctx.hg, ctx.ag], ctx.rnd, null, ctx.goalScorers, state.userTeam);
  if (ctx.meHome) ctx.home.team.money += stadiumIncome(ctx.home.team);
  const others = endOfDay(state, state.userTeam);
  return others;
}

if (typeof module !== 'undefined') module.exports = {
  rng, newGame, newSeason, endOfDay, postDay, computeStandings, teamStrength,
  transferOffer, sellPlayer, generateTransferList, playerValue, fmtMoney, roundRobin,
  simulateGoals, aiRotate,
  startUserMatch, matchMinute, finishUserMatch, substitutePlayer, liveStrength,
  stadiumIncome, expandStadium, buildRoof, sponsorOffer, acceptSponsor,
  trainingCamp, rehabPlayer
};
