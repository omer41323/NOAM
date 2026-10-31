const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');
(async () => {
  const root = path.resolve(__dirname, '..');
  process.chdir(root);
  if (fs.existsSync('.env.local')) process.loadEnvFile('.env.local');
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url || '') || !key?.startsWith('sb_publishable_')) throw new Error('Set SUPABASE_URL and a publishable key. Secret keys must never enter the frontend.');
  fs.mkdirSync('dist', { recursive: true });
  fs.cpSync('public', 'dist', { recursive: true });
  fs.writeFileSync('dist/cloud-config.js', 'window.CLOUD_CONFIG=' + JSON.stringify({ url, key }) + ';\n');
  await esbuild.build({ entryPoints: ['scripts/vendor.js'], bundle: true, minify: true, outfile: 'dist/vendor/cloud.js', platform: 'browser', target: 'es2022', legalComments: 'linked' });
  console.log('Built public app with Supabase Auth and private storage.');
})().catch(error => { console.error(error.message); process.exit(1); });

