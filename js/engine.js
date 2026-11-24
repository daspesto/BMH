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

function applyMatch(state, match, scoreFn, rnd, log, goalScorers) {
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
        p.fitness = Math.max(40, p.fitness - (6 + Math.floor(rnd() * 5)));
        p.form = Math.max(1, Math.min(10, p.form + (rnd() < 0.35 ? 1 : rnd() < 0.3 ? -1 : 0)));
      } else {
        p.fitness = Math.min(100, p.fitness + 8);
      }
    });
    for (let i = 0; i < gf; i++) {
      let s;
      if (goalScorers) {
        const list = (home === team ? goalScorers.home : goalScorers.away) || [];
        const id = list[i];
        s = id != null ? team.squad.find(x => x.id === id) : null;
        if (!s) s = scorer(team, rnd);
      } else {
        s = scorer(team, rnd);
      }
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

function endOfDay(state, skipShort) {
  const rnd = rng((state.seed + state.day * 7919) >>> 0);
  const day = state.fixtures[state.day];
  const results = [];
  day.forEach(m => {
    const home = state.teams[m.home], away = state.teams[m.away];
    if (skipShort && (home.short === skipShort || away.short === skipShort)) return;
    const hs = teamStrength(home), as = teamStrength(away);
    const log = [];
    const score = simulateGoals(hs, as, rnd);
    applyMatch(state, m, score, rnd, log);
    log.forEach(l => results.push(l));
    home.money += attendanceIncome(home, true);
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
      p.fitness = Math.min(100, p.fitness + (isUser ? 10 : 8));
      if (isUser) {
        if (rnd() < 0.08 && p.age < 30 && p.skill < 95) { p.skill++; p.value = playerValue(p); }
        if (rnd() < 0.02 && p.age > 31 && p.skill > 40) { p.skill--; p.value = playerValue(p); }
      }
    });
  });
  computeStandings(state);
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

function startUserMatch(state) {
  const day = state.fixtures[state.day];
  if (!day) return null;
  const meIdx = state.teams.findIndex(t => t.short === state.userTeam);
  const m = day.find(mm => mm.home === meIdx || mm.away === meIdx);
  if (!m) return null;
  const ctx = {
    state, m, meHome: m.home === meIdx,
    minute: 0, hg: 0, ag: 0, over: false,
    stoppage: 90 + Math.floor(rng((state.seed + state.day * 31) >>> 0)() * 5),
    events: [], needsSub: null,
    rnd: rng((state.seed ^ 0xBEEF) + state.day * 977 >>> 0),
    goalScorers: { home: [], away: [] },
    goals: { home: [], away: [] }
  };
  ctx.home = makeSideFor(state, state.teams[m.home]);
  ctx.away = makeSideFor(state, state.teams[m.away]);
  ctx.user = ctx.meHome ? ctx.home : ctx.away;
  ctx.opp = ctx.meHome ? ctx.away : ctx.home;
  return ctx;
}

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
  return teamStrength({
    squad: side.team.squad,
    lineup: { gk: side.gkId, field: side.fieldIds },
    tactics: side.tactics
  });
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

function matchGoal(ctx, side, isHome, ev) {
  const s = pickScorer(side, ctx.rnd);
  if (isHome) { ctx.hg++; } else { ctx.ag++; }
  const key = isHome ? 'home' : 'away';
  ctx.goalScorers[key].push(s ? s.id : null);
  ctx.goals[key].push({ id: s ? s.id : null, min: ctx.minute });
  ev.push({ min: ctx.minute, side: key, type: 'goal', id: s && s.id,
    text: 'TOR! ' + (s ? s.name : '?') + ' (' + side.team.short + ')' });
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

function substitutePlayer(ctx, side, outId, inId) {
  side.fieldIds = side.fieldIds.filter(id => id !== outId);
  side.fieldIds.push(inId);
  side.benchIds = side.benchIds.filter(id => id !== inId);
  side.subsLeft--;
}

function matchMinute(ctx) {
  if (ctx.over) return [];
  ctx.minute++;
  const ev = [];
  const rnd = ctx.rnd;
  const hs = liveStrength(ctx.home), as = liveStrength(ctx.away);
  const pGoal = (att, def, home) =>
    Math.max(0.004, Math.min(0.11, 0.015 * (att / Math.max(1, def)) * (home ? 1.12 : 1)));
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
        if (side.isUser) {
          ctx.needsSub = pid;
        } else {
          aiSub(ctx, side, pid, ev);
        }
      }
    }
    for (const pid of side.fieldIds) {
      const p = sidePlayer(side, pid);
      if (p) p.fitness = Math.max(10, p.fitness - 0.15);
    }
    const gk = sidePlayer(side, side.gkId);
    if (gk && ctx.minute % 15 === 0) gk.fitness = Math.max(10, gk.fitness - 0.5);
  }
  if (ctx.minute >= ctx.stoppage) ctx.over = true;
  ctx.events.push(...ev);
  return ev;
}

function finishUserMatch(state, ctx) {
  const m = ctx.m;
  ctx.home.team.lineup = { gk: ctx.home.gkId, field: ctx.home.fieldIds.slice() };
  ctx.away.team.lineup = { gk: ctx.away.gkId, field: ctx.away.fieldIds.slice() };
  applyMatch(state, m, [ctx.hg, ctx.ag], ctx.rnd, null, ctx.goalScorers);
  if (ctx.meHome) ctx.home.team.money += attendanceIncome(ctx.home.team, true);
  const others = endOfDay(state, state.userTeam);
  return others;
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
  rng, newGame, newSeason, endOfDay, postDay, computeStandings, teamStrength, transferOffer,
  startUserMatch, matchMinute, finishUserMatch, substitutePlayer, liveStrength,
  generateTransferList, playerValue, fmtMoney, roundRobin
};
