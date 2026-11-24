'use strict';

function rng(state) {
  let s = state >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function randName(rnd, used) {
  const { FIRST, LAST } = DATA;
  for (let i = 0; i < 50; i++) {
    const n = FIRST[Math.floor(rnd() * FIRST.length)] + ' ' +
              LAST[Math.floor(rnd() * LAST.length)];
    if (!used.has(n)) { used.add(n); return n; }
  }
  return 'Spieler ' + Math.floor(rnd() * 9999);
}

function round(x) { return Math.round(x * 100) / 100; }
function fmtMoney(m) { return (m < 0 ? '-' : '') + Math.abs(Math.round(m)).toLocaleString('de-DE') + ' €'; }

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
    pos,
    age: age || 17 + Math.floor(rnd() * 17),
    skill: Math.max(1, Math.min(99, Math.round(baseSkill + (rnd() - 0.5) * 12))),
    form: Math.round(4 + rnd() * 4),
    fitness: Math.round(85 + rnd() * 15),
    goals: 0, assists: 0, games: 0
  };
  p.value = playerValue(p);
  return p;
}

function newTeam(def, rnd, used) {
  const squad = [];
  DATA.POSITIONS.forEach(pos => {
    squad.push(newPlayer(rnd, used, def.strength + (pos === 'TW' ? 0 : 1), pos));
    squad.push(newPlayer(rnd, used, def.strength - 3, pos));
  });
  squad.push(newPlayer(rnd, used, def.strength - 5, 'ST'));
  return {
    id: def.short, name: def.name, short: def.short,
    strength: def.strength,
    money: def.budget,
    squad,
    tactics: 'normal',
    lineup: [],
    points: 0, played: 0, goalsFor: 0, goalsAgainst: 0,
    lastResults: []
  };
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
  const second = rounds.map(rd => rd.map(([a, b]) => [b, a]));
  return rounds.concat(second);
}

function newGame(seed, userTeamShort) {
  const rnd = rng(seed || Date.now());
  const used = new Set();
  const teams = DATA.TEAMS.map(t => newTeam(t, rnd, used));
  const fixtures = roundRobin(teams.length).map(day =>
    day.map(([a, b]) => ({ home: a, away: b, played: false, hg: null, ag: null }))
  );
  for (const t of teams) {
    const gk = t.squad.filter(p => p.pos === 'TW')[0];
    t.lineup = { gk: gk.id, field: t.squad.filter(p => p.pos !== 'TW').slice(0, 10).map(p => p.id) };
  }
  return {
    seed: (seed || Date.now()) >>> 0,
    userTeam: userTeamShort || DATA.TEAMS[16].short,
    day: 0,
    season: 1,
    teams,
    fixtures,
    transfers: [],
    news: ['Willkommen beim Bundesliga Manager!'],
    lastMatch: null,
    standings: null
  };
}

function avg(arr) { return arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : 0; }

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

function skillOf(team) {
  const s = teamStrength(team, false);
  return (s.attack + s.midfield + s.defense) / 3;
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
  const pool = field.map(p => ({ p, w: p.pos === 'ST' ? 10 : p.pos === 'OM' ? 6 : p.pos === 'RM' || p.pos === 'LM' ? 3 : 1 }));
  let total = pool.reduce((s, x) => s + x.w, 0);
  let r = rnd() * total;
  for (const x of pool) { r -= x.w; if (r <= 0) return x.p; }
  return pool[pool.length - 1].p;
}

function applyMatch(state, match, scoreFn, rnd, log) {
  const teams = state.teams;
  const home = teams[match.home], away = teams[match.away];
  const [hg, ag] = scoreFn;
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
        p.fitness = Math.max(40, p.fitness - (11 + Math.floor(rnd() * 8)) + (Math.floor(rnd() * 4) / 2));
        p.form = Math.max(1, Math.min(10, p.form + (rnd() < 0.35 ? 1 : rnd() < 0.3 ? -1 : 0)));
      } else {
        p.fitness = Math.min(100, p.fitness + 8);
      }
    });
    for (let i = 0; i < gf; i++) {
      const s = scorer(team, rnd);
      if (s) { s.goals++; log && log.push({ team: team.short, scorer: s.name, minute: 1 + Math.floor(rnd() * 90) }); }
    }
  }
}

function computeStandings(state) {
  const rows = state.teams.map(t => ({
    team: t, name: t.name, short: t.short, played: t.played,
    gf: t.goalsFor, ga: t.goalsAgainst, gd: t.goalsFor - t.goalsAgainst,
    points: t.points
  }));
  rows.sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf || b.name.localeCompare(a.name));
  state.standings = rows;
  return rows;
}

function attendanceIncome(team, isHome) {
  if (!isHome) return 0;
  const base = 400_000 + team.strength * 12_000;
  return Math.round(base + (Math.random() - 0.4) * 150_000);
}

function weeklyFinance(state) {
  state.teams.forEach(t => {
    const wages = t.squad.reduce((s, p) => s + playerValue(p) * 0.0022, 0);
    t.money -= Math.round(wages);
    t.money += 250_000;
  });
}

function endOfDay(state) {
  const rnd = rng((state.seed + state.day * 7919) >>> 0);
  const day = state.fixtures[state.day];
  const results = [];
  day.forEach(m => {
    const home = state.teams[m.home], away = state.teams[m.away];
    const hs = teamStrength(home), as = teamStrength(away);
    const log = [];
    const score = simulateGoals(hs, as, rnd);
    applyMatch(state, m, score, rnd, log);
    log.forEach(l => results.push(l));
    home.money += attendanceIncome(home, true);
  });
  weeklyFinance(state);
  state.day++;
  const user = state.teams.find(t => t.short === state.userTeam);
  if (user) {
    user.squad.forEach(p => {
      if (p.fitness < 95) p.fitness = Math.min(100, p.fitness + 5);
      if (rnd() < 0.08 && p.age < 30 && p.skill < 95) { p.skill++; p.value = playerValue(p); }
      if (rnd() < 0.02 && p.age > 31 && p.skill > 40) { p.skill--; p.value = playerValue(p); }
    });
  }
  computeStandings(state);
  return results;
}

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
  } else {
    state.market = state.market.filter(x => x.id !== p.id);
  }
  if (seller && (seller.lineup.field || []).includes(p.id)) seller.lineup.field = seller.lineup.field.filter(id => id !== p.id);
  if (seller && seller.lineup.gk === p.id) {
    const gk = seller.squad.find(x => x.pos === 'TW');
    seller.lineup.gk = gk ? gk.id : null;
  }
  buyer.squad.push(p);
  if (buyer.short === state.userTeam && buyer.squad.length <= 18) {
    if (p.pos === 'TW' && !buyer.lineup.gk) buyer.lineup.gk = p.id;
    else if (p.pos !== 'TW' && (buyer.lineup.field || []).length < 10) buyer.lineup.field.push(p.id);
  }
  return { ok: true, msg: p.name + ' für ' + fmtMoney(fee) + ' verpflichtet.', fee };
}

function newSeason(state) {
  const rnd = rng((state.seed + state.season * 104729) >>> 0);
  state.season++;
  const used = new Set(state.teams.flatMap(t => t.squad.map(p => p.name)));
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
  });
  const order = state.teams.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const map = order.slice();
  state.fixtures = roundRobin(state.teams.length).map(day =>
    day.map(([a, b]) => ({ home: map[a], away: map[b], played: false, hg: null, ag: null }))
  );
  state.day = 0;
  state.market = generateTransferList(state);
  state.news.unshift('=== Saison ' + state.season + ' beginnt! ===');
}

function generateTransferList(state) {
  const rnd = rng((state.seed ^ 0x5eed) + state.day * 131);
  const list = [];
  const used = new Set(state.teams.flatMap(t => t.squad.map(p => p.name)));
  for (let i = 0; i < 5; i++) {
    list.push(newPlayer(rnd, used, 55 + rnd() * 12, DATA.POSITIONS[Math.floor(rnd() * DATA.POSITIONS.length)]));
  }
  for (let i = 0; i < 6; i++) {
    list.push(newPlayer(rnd, used, 64 + rnd() * 10, DATA.POSITIONS[Math.floor(rnd() * DATA.POSITIONS.length)]));
  }
  for (let i = 0; i < 3; i++) {
    list.push(newPlayer(rnd, used, 72 + rnd() * 10, DATA.POSITIONS[Math.floor(rnd() * DATA.POSITIONS.length)]));
  }
  return list;
}

if (typeof module !== 'undefined') module.exports = {
  rng, newGame, newSeason, endOfDay, computeStandings, teamStrength, transferOffer,
  generateTransferList, playerValue, fmtMoney, roundRobin
};
