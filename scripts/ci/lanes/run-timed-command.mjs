import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

function parseArguments(argv) {
  const separatorIndex = argv.indexOf('--');
  if (separatorIndex < 0 || separatorIndex === argv.length - 1) {
    throw new Error(
      'usage: run-timed-command.mjs --scope=<name> --stage=<name> -- <command> [...args]',
    );
  }

  const options = Object.fromEntries(
    argv.slice(0, separatorIndex).map((value) => {
      const [key, ...rest] = value.replace(/^--/u, '').split('=');
      return [key, rest.join('=')];
    }),
  );

  if (!options.scope || !options.stage) {
    throw new Error('both --scope and --stage are required');
  }

  return {
    scope: options.scope,
    stage: options.stage,
    command: argv[separatorIndex + 1],
    commandArgs: argv.slice(separatorIndex + 2),
  };
}

function appendTimingSummary({ scope, stage, durationSeconds, result }) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) {
    return;
  }

  const marker = `<!-- ci-stage-timing:${scope} -->`;
  const currentSummary = existsSync(summaryPath) ? readFileSync(summaryPath, 'utf8') : '';
  if (!currentSummary.includes(marker)) {
    appendFileSync(
      summaryPath,
      `${marker}\n### ${scope} CI stage timing\n| stage | seconds | result |\n| --- | ---: | --- |\n`,
    );
  }

  appendFileSync(summaryPath, `| ${stage} | ${durationSeconds.toFixed(2)} | ${result} |\n`);
}

function main() {
  const input = parseArguments(process.argv.slice(2));
  const startedAt = performance.now();
  const commandResult = spawnSync(input.command, input.commandArgs, {
    env: process.env,
    stdio: 'inherit',
  });
  const durationSeconds = (performance.now() - startedAt) / 1000;
  const result = commandResult.status === 0 ? 'success' : 'failure';

  appendTimingSummary({ ...input, durationSeconds, result });
  process.exitCode = commandResult.status ?? 1;
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
