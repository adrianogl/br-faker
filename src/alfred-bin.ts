#!/usr/bin/env node
import { buildOutput } from './alfred.js';

process.stdout.write(JSON.stringify(buildOutput(process.argv[2] ?? '')));
