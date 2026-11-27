'use strict';

const DATA = (() => {

  const LEAGUES = [
    {
      name: '1. Bundesliga', short: 'BL',
      teams: [
        { name: 'FC Bayern München',      short: 'FCB', strength: 88, budget: 40_000_000, cap: 75000 },
        { name: 'Borussia Dortmund',      short: 'BVB', strength: 84, budget: 32_000_000, cap: 81000 },
        { name: 'RB Leipzig',             short: 'RBL', strength: 82, budget: 28_000_000, cap: 47000 },
        { name: 'Bayer 04 Leverkusen',    short: 'B04', strength: 82, budget: 26_000_000, cap: 30000 },
        { name: 'Eintracht Frankfurt',    short: 'SGE', strength: 79, budget: 20_000_000, cap: 58000 },
        { name: 'VfB Stuttgart',         short: 'VfB', strength: 78, budget: 18_000_000, cap: 60000 },
        { name: 'Borussia M’gladbach',    short: 'BMG', strength: 77, budget: 17_000_000, cap: 54000 },
        { name: 'VfL Wolfsburg',          short: 'WOB', strength: 77, budget: 19_000_000, cap: 30000 },
        { name: 'SV Werder Bremen',       short: 'SVW', strength: 76, budget: 15_000_000, cap: 42000 },
        { name: 'TSG Hoffenheim',         short: 'TSG', strength: 75, budget: 13_000_000, cap: 30000 },
        { name: 'SC Freiburg',            short: 'SCF', strength: 75, budget: 12_000_000, cap: 35000 },
        { name: '1. FSV Mainz 05',        short: 'M05', strength: 74, budget: 11_000_000, cap: 33000 },
        { name: '1. FC Union Berlin',     short: 'FCU', strength: 74, budget: 12_000_000, cap: 22000 },
        { name: 'FC Augsburg',           short: 'FCA', strength: 72, budget: 10_000_000, cap: 31000 },
        { name: 'Arminia Bielefeld',     short: 'DSC', strength: 69, budget: 9_000_000,  cap: 27000 },
        { name: '1. FC Köln',             short: 'FC',  strength: 70, budget: 10_000_000, cap: 50000 },
        { name: 'Hannover 96',            short: 'H96', strength: 70, budget: 8_000_000,  cap: 49000 },
        { name: 'FC St. Pauli',           short: 'STP', strength: 67, budget: 7_000_000,  cap: 30000 }
      ]
    },
    {
      name: '2. Bundesliga', short: 'BL2',
      teams: [
        { name: 'Hamburger SV',           short: 'HSV', strength: 65, budget: 8_000_000, cap: 57000 },
        { name: 'Hertha BSC',             short: 'BSC', strength: 64, budget: 7_000_000, cap: 74000 },
        { name: 'FC Schalke 04',          short: 'S04', strength: 64, budget: 7_000_000, cap: 62000 },
        { name: '1. FC Nürnberg',         short: 'FCN', strength: 62, budget: 6_000_000, cap: 50000 },
        { name: 'Fortuna Düsseldorf',     short: 'F95', strength: 61, budget: 5_500_000, cap: 54000 },
        { name: 'Karlsruher SC',          short: 'KSC', strength: 60, budget: 5_000_000, cap: 34000 },
        { name: 'Holstein Kiel',          short: 'KIE', strength: 60, budget: 5_000_000, cap: 15000 },
        { name: 'SV Darmstadt 98',        short: 'SVD', strength: 59, budget: 4_500_000, cap: 21000 },
        { name: 'VfL Bochum',             short: 'BOC', strength: 59, budget: 4_500_000, cap: 27000 },
        { name: '1. FC Kaiserslautern',   short: 'FCK', strength: 58, budget: 4_000_000, cap: 49000 },
        { name: 'SC Paderborn 07',        short: 'SCP', strength: 57, budget: 4_000_000, cap: 15000 },
        { name: 'Hansa Rostock',          short: 'HRO', strength: 56, budget: 3_500_000, cap: 29000 },
        { name: 'SV Elversberg',          short: 'ELV', strength: 55, budget: 3_000_000, cap: 10000 },
        { name: '1. FC Magdeburg',        short: 'FCM', strength: 55, budget: 3_000_000, cap: 30000 },
        { name: 'Dynamo Dresden',         short: 'SGD', strength: 54, budget: 3_000_000, cap: 32000 },
        { name: 'SpVgg Greuther Fürth',   short: 'SGF', strength: 54, budget: 3_000_000, cap: 16000 },
        { name: 'SSV Jahn Regensburg',    short: 'JAH', strength: 53, budget: 2_500_000, cap: 15000 },
        { name: 'VfL Osnabrück',          short: 'OSN', strength: 52, budget: 2_500_000, cap: 15000 }
      ]
    },
    {
      name: '3. Liga', short: 'L3',
      teams: [
        { name: 'MSV Duisburg',           short: 'MSV', strength: 50, budget: 2_000_000, cap: 31000 },
        { name: 'Rot-Weiss Essen',         short: 'RWE', strength: 49, budget: 2_000_000, cap: 20000 },
        { name: 'TSV 1860 München',       short: '1860', strength: 49, budget: 2_000_000, cap: 15000 },
        { name: 'FC Ingolstadt 04',       short: 'FCI', strength: 48, budget: 1_800_000, cap: 15000 },
        { name: 'SV Wehen Wiesbaden',     short: 'SVW2', strength: 47, budget: 1_500_000, cap: 17000 },
        { name: 'Erzgebirge Aue',         short: 'AUE', strength: 47, budget: 1_500_000, cap: 16000 },
        { name: 'Preußen Münster',        short: 'PRM', strength: 46, budget: 1_200_000, cap: 15000 },
        { name: 'Viktoria Köln',          short: 'VKO', strength: 46, budget: 1_200_000, cap: 8000 },
        { name: '1. FC Saarbrücken',      short: 'FCS', strength: 45, budget: 1_000_000, cap: 16000 },
        { name: 'FSV Zwickau',            short: 'FSZ', strength: 45, budget: 1_000_000, cap: 10000 },
        { name: 'SpVgg Unterhaching',     short: 'UTH', strength: 44, budget: 900_000,   cap: 15000 },
        { name: 'SV Sandhausen',          short: 'SAN', strength: 44, budget: 900_000,   cap: 15000 },
        { name: 'VfB Stuttgart II',       short: 'VfB2', strength: 43, budget: 800_000,   cap: 11000 },
        { name: 'Bor. Dortmund II',       short: 'BVB2', strength: 43, budget: 800_000,   cap: 10000 },
        { name: 'SSV Ulm 1846',            short: 'ULM', strength: 42, budget: 700_000,   cap: 19000 },
        { name: 'Waldhof Mannheim',       short: 'WMH', strength: 42, budget: 700_000,   cap: 25000 },
        { name: 'SV Meppen',              short: 'MEP', strength: 41, budget: 600_000,   cap: 13000 },
        { name: 'FC Viktoria Berlin',     short: 'VFB', strength: 41, budget: 600_000,   cap: 12000 }
      ]
    }
  ];

  const FIRST = ['Max','Jonas','Leon','Finn','Lukas','Nico','Tim','Jan','Elias','Paul',
                 'Noah','Luis','Ben','Felix','Tom','Emil','Moritz','David','Marco','Sven',
                 'Kerem','Serge','André','Kevin','Nils','Jannik','Fabian','Tobias','Florian','Marcel',
                 'Ali','Yusuf','Ibrahim','Ronaldo','Enzo','Mateo','Luca','Diego','Bruno','Victor'];

  const LAST = ['Müller','Schmidt','Schneider','Fischer','Weber','Meyer','Wagner','Becker',
                'Hoffmann','Schäfer','Koch','Bauer','Richter','Klein','Wolf','Schröder',
                'Neumann','Zimmermann','Braun','Krüger','Hartmann','Lange','Werner','Krause',
                'Lehmann','Köhler','Herrmann','König','Walter','Maier',
                'Yilmaz','Kaya','Demir','Özkan','Novak','Petrov','Silva','Costa','Ferreira','Rossi'];

  const POSITIONS = ['TW','IV','IV','LV','RV','DM','ZM','ZM','LM','RM','OM','ST','ST'];

  const SPONSORS = ['Adidas','Nike','Puma','Opel','Volkswagen','Deutsche Bank','Lufthansa',
                   'Telekom','Becks','Bitburger','Stern TV','Ritter Sport','Dr. Oetker',
                   'Muller Milch','Karcher','Bosch','SAP','Rewe'];

  return { LEAGUES, FIRST, LAST, POSITIONS, SPONSORS };
})();

if (typeof module !== 'undefined') module.exports = { DATA };
