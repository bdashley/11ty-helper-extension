const { spawn } = require('child_process');

// This script starts the main audit watcher as a completely detached
// background process, allowing the parent Gemini CLI process to exit
// without terminating the watcher.

const child = spawn('npm', ['start'], {
  detached: true,
  stdio: 'ignore'
});

child.unref();
