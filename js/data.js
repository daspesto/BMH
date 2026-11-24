'use strict';

const DATA = (() => {

  const TEAMS = [
    { name: 'FC Bayern München',      short: 'FCB', strength: 88, budget: 40_000_000 },
    { name: 'Borussia Dortmund',      short: 'BVB', strength: 84, budget: 32_000_000 },
    { name: 'RB Leipzig',             short: 'RBL', strength: 82, budget: 28_000_000 },
    { name: 'Bayer 04 Leverkusen',    short: 'B04', strength: 82, budget: 26_000_000 },
    { name: 'Eintracht Frankfurt',    short: 'SGE', strength: 79, budget: 20_000_000 },
    { name: 'VfB Stuttgart',          short: 'VfB', strength: 78, budget: 18_000_000 },
    { name: 'Borussia M’gladbach',    short: 'BMG', strength: 77, budget: 17_000_000 },
    { name: 'VfL Wolfsburg',          short: 'WOB', strength: 77, budget: 19_000_000 },
    { name: 'SV Werder Bremen',       short: 'SVW', strength: 76, budget: 15_000_000 },
    { name: 'TSG Hoffenheim',         short: 'TSG', strength: 75, budget: 13_000_000 },
    { name: 'SC Freiburg',            short: 'SCF', strength: 75, budget: 12_000_000 },
    { name: '1. FSV Mainz 05',        short: 'M05', strength: 74, budget: 11_000_000 },
    { name: '1. FC Union Berlin',     short: 'FCU', strength: 74, budget: 12_000_000 },
    { name: 'FC Augsburg',            short: 'FCA', strength: 72, budget: 10_000_000 },
    { name: 'Fortuna Düsseldorf',   short: 'F95', strength: 69, budget: 8_000_000 },
    { name: '1. FC Köln',             short: 'FC',  strength: 70, budget: 10_000_000 },
    { name: 'Hannover 96',            short: 'H96', strength: 69, budget: 8_000_000 },
    { name: 'FC St. Pauli',           short: 'STP', strength: 67, budget: 7_000_000 }
  ];

  const FIRST = ['Max','Jonas','Leon','Finn','Lukas','Nico','Tim','Jan','Elias','Paul',
                 'Noah','Luis','Ben','Felix','Tom','Emil','Moritz','David','Marco','Sven',
                 'Kerem','Serge','André','Kevin','Nils','Jannik','Fabian','Tobias','Florian','Marcel'];

  const LAST = ['Müller','Schmidt','Schneider','Fischer','Weber','Meyer','Wagner','Becker',
                'Hoffmann','Schäfer','Koch','Bauer','Richter','Klein','Wolf','Schröder',
                'Neumann','Zimmermann','Braun','Krüger','Hartmann','Lange','Werner','Krause',
                'Lehmann','Köhler','Herrmann','König','Walter','Maier'];

  const POSITIONS = ['TW','IV','IV','LV','RV','DM','ZM','ZM','LM','RM','OM','ST','ST'];

  return { TEAMS, FIRST, LAST, POSITIONS };
})();

if (typeof module !== 'undefined') module.exports = { DATA };
