import {
  GENERATORS,
  GROUP_LABELS,
  type GroupId,
  findGenerator,
  generate,
} from './generators.js';

const USAGE = `alfred-br-faker — Brazilian fake data generator

Usage:
  br-faker <generator> [options]
  br-faker --list

Options:
  -n, --count <n>   How many values to produce (default: 1)
  -r, --raw         Unmasked output, when the generator has one
  -j, --json        JSON output
  -l, --list        List the available generators
  -h, --help        Show this help

Examples:
  br-faker cpf
  br-faker cnpj-alpha -n 5
  br-faker mobile --raw
  br-faker address --json
`;

export interface Options {
  key?: string;
  count: number;
  raw: boolean;
  json: boolean;
  list: boolean;
  help: boolean;
}

export function parseArgs(argv: string[]): Options {
  const options: Options = { count: 1, raw: false, json: false, list: false, help: false };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === undefined) continue;

    switch (arg) {
      case '-h':
      case '--help':
        options.help = true;
        break;
      case '-l':
      case '--list':
        options.list = true;
        break;
      case '-r':
      case '--raw':
        options.raw = true;
        break;
      case '-j':
      case '--json':
        options.json = true;
        break;
      case '-n':
      case '--count': {
        const value = Number(argv[++i]);
        if (!Number.isInteger(value) || value < 1) {
          throw new Error(`--count must be an integer >= 1 (got: ${argv[i] ?? 'nothing'})`);
        }
        options.count = value;
        break;
      }
      default:
        if (arg.startsWith('-')) throw new Error(`unknown option: ${arg}`);
        if (options.key === undefined) options.key = arg;
        else throw new Error(`unexpected argument: ${arg}`);
    }
  }

  return options;
}

function renderList(): string {
  const lines: string[] = ['Available generators:', ''];

  for (const group of Object.keys(GROUP_LABELS) as GroupId[]) {
    const items = GENERATORS.filter((generator) => generator.group === group);
    if (items.length === 0) continue;

    lines.push(`  ${GROUP_LABELS[group]}`);
    for (const item of items) {
      const aliases = item.aliases?.length ? `  (${item.aliases.join(', ')})` : '';
      lines.push(`    ${item.id.padEnd(16)} ${item.label}${aliases}`);
    }
    lines.push('');
  }

  return lines.join('\n').trimEnd();
}

export function run(argv: string[]): { stdout: string; exitCode: number } {
  let options: Options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    return { stdout: `br-faker: ${(error as Error).message}`, exitCode: 2 };
  }

  if (options.help || (options.key === undefined && !options.list)) {
    return { stdout: USAGE.trimEnd(), exitCode: options.help ? 0 : 2 };
  }
  if (options.list) {
    return { stdout: renderList(), exitCode: 0 };
  }

  const generator = findGenerator(options.key!);
  if (!generator) {
    return {
      stdout: `br-faker: unknown generator "${options.key}". Run --list to see the options.`,
      exitCode: 1,
    };
  }

  const values = generate(generator, options.count, options.raw);
  const stdout = options.json
    ? JSON.stringify({ generator: generator.id, values }, null, 2)
    : values.join('\n');

  return { stdout, exitCode: 0 };
}
