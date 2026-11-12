import fs from 'node:fs';
const files = fs.readdirSync('src/nodes').filter(f => f.endsWith('.js'));
const sysKeys = new Set(['battery', 'cabin', 'eea', 'biw', 'chassis', 'occupant', 'thermal', 'hv', 'drive', 'front', 'rear']);
const report = new Map();
const add = (k, f) => { if (!report.has(k)) report.set(k, new Set()); report.get(k).add(f); };
for (const f of files) {
  const src = fs.readFileSync('src/nodes/' + f, 'utf8');
  for (const m of src.matchAll(/\bS\.([A-Za-z_$][\w$]*)(?:\.([A-Za-z_$][\w$]*))?(?:\.([A-Za-z_$][\w$]*))?/g)) {
    add('S.' + [m[1], m[2], m[3]].filter(Boolean).join('.'), f);
  }
  // 任意位置出现的 `X = S.sys`（含多变量声明）
  for (const m of src.matchAll(/([A-Za-z_$][\w$]*)\s*=\s*S\.([A-Za-z_$][\w$]*)/g)) {
    const a = m[1], root = m[2];
    if (!sysKeys.has(root)) continue;
    add('ALIAS:' + a + '=S.' + root, f);
    const re = new RegExp('\\b' + a + '\\.([A-Za-z_$][\\w$]*)(?:\\.([A-Za-z_$][\\w$]*))?', 'g');
    for (const mm of src.matchAll(re)) add('  → ' + a + '.' + [mm[1], mm[2]].filter(Boolean).join('.'), f);
  }
}
for (const k of [...report.keys()].sort()) console.log(k.padEnd(34), [...report.get(k)].join(','));
