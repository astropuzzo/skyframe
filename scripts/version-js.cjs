// Scrive la versione dell'app in src/js/version.js: la usa la versione Android per controllare gli aggiornamenti.
const fs = require('fs'), path = require('path');
const v = require('../package.json').version;
fs.writeFileSync(path.join(__dirname, '..', 'src', 'js', 'version.js'), `window.SKYFRAME_VERSION = '${v}';\n`);
console.log('version.js', v);
