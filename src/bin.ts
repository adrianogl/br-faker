#!/usr/bin/env node
import { run } from './cli.js';

const { stdout, exitCode } = run(process.argv.slice(2));
(exitCode === 0 ? process.stdout : process.stderr).write(`${stdout}\n`);
process.exit(exitCode);
