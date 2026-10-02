// npm test: tutte le prove, una dopo l'altra; si ferma alla prima che non passa (in CI blocca la release).
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const steps = [
  ['prove di base', ['--test', 'scripts/test-core.cjs']],
  ['modello: casi tipici', ['scripts/check-model.cjs'], true],
  ['modello: casi della verifica', ['scripts/check-cases.cjs'], true],
  ['meteo nelle ore utili', ['scripts/check-weather-timing.cjs'], true],
];
for (const [name, args, quiet] of steps) {
  const t0 = Date.now(), r = spawnSync(process.execPath, args, { cwd: path.join(__dirname, '..'), encoding: 'utf8', stdio: quiet ? 'pipe' : 'inherit', env: { ...process.env, TZ: 'Europe/Rome' } });
  if (r.status !== 0) {
    if (quiet) process.stdout.write((r.stdout || '').split('\n').slice(-40).join('\n') + (r.stderr || ''));
    console.error(`✗ ${name}`); process.exit(1);
  }
  console.log(`✓ ${name} (${Date.now() - t0} ms)`);
}
