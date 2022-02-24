import { program } from 'commander';
import { CommandOptions } from './types.mjs';
import { error } from './feedback.mjs';

export function getCommand(): CommandOptions {
  program.option('-s, --src <src>', 'Source folder', 'src');
  program.parse(process.argv);
  const options = program.opts();
  const src = `${options.src}`;
  const debug: boolean = options.debug === true;
  if (!src) {
    error('Missing --src parameter');
  }
  return { src, debug };
}
