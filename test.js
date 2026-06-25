// Test: merge feed results into state, with normalization & idempotency
const { normalize } = require('./normalize');

// Group match fixtures from HTML logic
const FIXTURES = [];
const GROUPS = ['A','B','C','D','E','F','G','H','I','J','K','L'];
const TEAMS = [
  ['Czechia','A'],['Mexico','A'],['South Africa','A'],['South Korea','A'],
  ['Bosnia-Herzegovina','B'],['Canada','B'],['Qatar','B'],['Switzerland','B'],
  ['Brazil','C'],['Haiti','C'],['Morocco','C'],['Scotland','C'],
  ['Australia','D'],['Paraguay','D'],['Türkiye','D'],['United States','D'],
  ['Curaçao','E'],['Ecuador','E'],['Germany','E'],['Ivory Coast','E'],
  ['Japan','F'],['Netherlands','F'],['Sweden','F'],['Tunisia','F'],
  ['Belgium','G'],['Egypt','G'],['Iran','G'],['New Zealand','G'],
  ['Cape Verde','H'],['Saudi Arabia','H'],['Spain','H'],['Uruguay','H'],
  ['France','I'],['Iraq','I'],['Norway','I'],['Senegal','I'],
  ['Algeria','J'],['Argentina','J'],['Austria','J'],['Jordan','J'],
  ['Colombia','K'],['DR Congo','K'],['Portugal','K'],['Uzbekistan','K'],
  ['Croatia','L'],['England','L'],['Ghana','L'],['Panama','L']
];

GROUPS.forEach(g => {
  const ts = TEAMS.filter(t => t[1]===g).map(t => t[0]);
  for(let i=0;i<ts.length;i++) for(let j=i+1;j<ts.length;j++)
    FIXTURES.push({id:`${g}-${i}-${j}`, group:g, t1:ts[i], t2:ts[j]});
});

const byGroup = g => FIXTURES.filter(f => f.group === g);

// Merge: apply finished feed matches to state.scores
function mergeGroupResults(state, feedMatches) {
  for (const match of feedMatches) {
    const team1 = normalize(match.team1);
    const team2 = normalize(match.team2);
    const fixture = FIXTURES.find(f =>
      f.group === match.group &&
      ((normalize(f.t1) === team1 && normalize(f.t2) === team2) ||
       (normalize(f.t1) === team2 && normalize(f.t2) === team1))
    );
    if (!fixture) {
      console.warn(`  [WARN] No fixture found for ${match.team1} vs ${match.team2}`);
      continue;
    }
    const isReverse = normalize(fixture.t1) === team2;
    const h = isReverse ? match.goals2 : match.goals1;
    const a = isReverse ? match.goals1 : match.goals2;
    if (state.scores[fixture.id]?.h === h && state.scores[fixture.id]?.a === a) {
      console.log(`  [IDEMPOTENT] ${fixture.t1} vs ${fixture.t2}: no change`);
    } else {
      state.scores[fixture.id] = { h, a };
      console.log(`  [MERGED] ${fixture.t1} ${h}-${a} ${fixture.t2}`);
    }
  }
  return state;
}

// ===== TEST =====
console.log('=== Test: Feed Merge with Name Normalization ===\n');

const feed = [
  { group: 'A', team1: 'Mexico', team2: 'South Africa', goals1: 2, goals2: 0, finished: true },
  { group: 'A', team1: 'Korea Republic', team2: 'Czechia', goals1: 0, goals2: 1, finished: true }, // name remap!
  { group: 'E', team1: 'Côte d\'Ivoire', team2: 'Ecuador', goals1: 2, goals2: 1, finished: true } // remap!
];

let state = { v: 2, scores: {}, winners: {}, ratings: {}, slotOv: {}, updatedAt: 0 };

console.log('Feed (3 matches, 2 remapped):');
feed.forEach(m => console.log(`  ${m.team1} vs ${m.team2}: ${m.goals1}-${m.goals2}`));

console.log('\n1st merge:');
state = mergeGroupResults(state, feed);

console.log('\n2nd merge (idempotent):');
state = mergeGroupResults(state, feed);

console.log('\nFinal state.scores:');
Object.entries(state.scores).forEach(([id, s]) => {
  console.log(`  ${id}: ${s.h}-${s.a}`);
});

// Verify expected fixture scores by ID
const pass =
  state.scores['A-1-2']?.h === 2 && state.scores['A-1-2']?.a === 0 &&
  state.scores['A-0-3']?.h === 1 && state.scores['A-0-3']?.a === 0 &&
  state.scores['E-1-3']?.h === 1 && state.scores['E-1-3']?.a === 2;
console.log(`\n✓ Test ${pass ? 'PASSED' : 'FAILED'}`);
