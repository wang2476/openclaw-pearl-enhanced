#!/usr/bin/env node
/**
 * Pearl CLI Entry Point
 * Main CLI for running Pearl server and managing memories
 */

import { Command } from 'commander';
import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { serveCommand } from './cli/serve.js';
import { memoryCommand } from './cli/memory.js';
import { statsCommand } from './cli/stats.js';
import { authCommand } from './cli/auth.js';
import { watchCommand } from './cli/watch.js';

export const program = new Command();

program
  .name('pearl')
  .description('Pearl - Memory-enhanced model proxy')
  .version('0.1.0');

// Register commands
program.addCommand(serveCommand);
program.addCommand(memoryCommand);
program.addCommand(statsCommand);
program.addCommand(authCommand);
program.addCommand(watchCommand);

// Parse only when this file is the executable entrypoint.
// This works for direct execution and symlinked binaries (e.g. npm link).
const isMainModule = (() => {
  const argvPath = process.argv[1];
  if (!argvPath) return false;

  const currentPath = __filename;
  try {
    return realpathSync(argvPath) === realpathSync(currentPath);
  } catch {
    return resolve(argvPath) === resolve(currentPath);
  }
})();

if (isMainModule) {
  program.parse();
}
