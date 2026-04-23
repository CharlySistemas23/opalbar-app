// Wrapper to capture all API output
const fs = require('fs');
const path = require('path');

const logFile = 'C:/Users/Panda/api-run.log';
const stream = fs.createWriteStream(logFile, { flags: 'w' });

function log(msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}\n`;
  stream.write(line);
  process.stdout.write(line);
}

log('Starting API wrapper...');

process.on('uncaughtException', (e) => {
  log('UNCAUGHT EXCEPTION: ' + e.message);
  log(e.stack || '');
  stream.end(() => process.exit(1));
});

process.on('unhandledRejection', (reason) => {
  log('UNHANDLED REJECTION: ' + reason);
  stream.end(() => process.exit(1));
});

process.on('exit', (code) => {
  log('Process exiting with code: ' + code);
});

// Monkey-patch console to log to file too
const origLog = console.log;
const origError = console.error;
const origWarn = console.warn;
console.log = (...args) => { log('[LOG] ' + args.join(' ')); origLog(...args); };
console.error = (...args) => { log('[ERR] ' + args.join(' ')); origError(...args); };
console.warn = (...args) => { log('[WRN] ' + args.join(' ')); origWarn(...args); };

// Intercept process.stdout and process.stderr writes
const origStdoutWrite = process.stdout.write.bind(process.stdout);
const origStderrWrite = process.stderr.write.bind(process.stderr);
process.stdout.write = function(data, encoding, callback) {
  stream.write('[STDOUT] ' + data);
  return origStdoutWrite(data, encoding, callback);
};
process.stderr.write = function(data, encoding, callback) {
  stream.write('[STDERR] ' + data);
  return origStderrWrite(data, encoding, callback);
};

log('Loading main module...');

try {
  require('./apps/api/dist/main.js');
  log('Main module loaded');
} catch (e) {
  log('Failed to load main: ' + e.message);
  log(e.stack || '');
  process.exit(1);
}
