// Checks that a buildx builder runs the GC limits of buildkitd.toml. `docker buildx inspect` has no machine format,
// so this reads its "GC Policy rule#N" blocks. A BuildKit version that ignores the config fields shows its defaults
// (about 93GiB, 1440h) and fails the check.
const BINARY_UNITS = { B: 1, KiB: 1024, MiB: 1024 ** 2, GiB: 1024 ** 3, TiB: 1024 ** 4 };
// Upper bound for a buildkitd.toml size: "20GB" may be parsed as decimal or binary, so accept the binary value.
const CONFIG_UNITS = { B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3, TB: 1024 ** 4 };

export function parseInspectGcPolicy(text) {
  const rules = [];
  let current;
  for (const line of text.split(/\r?\n/u)) {
    if (/^\s*GC Policy rule#\d+:/u.test(line)) {
      current = {};
      rules.push(current);
      continue;
    }
    if (!current) continue;
    const field = line.match(/^\s+([A-Za-z ]+):\s*(.+?)\s*$/u);
    if (!field) {
      current = undefined;
      continue;
    }
    const [, name, value] = field;
    if (name === 'Max Used Space') current.maxUsedSpace = parseInspectSize(value);
    if (name === 'Keep Duration') current.keepDurationHours = parseInspectDuration(value);
    if (name === 'All') current.all = value === 'true';
  }
  return rules;
}

export function expectedGcLimits(tomlText) {
  const sizes = [...tomlText.matchAll(/^\s*maxUsedSpace\s*=\s*"(\d+(?:\.\d+)?)([KMGT]?B)"/gmu)].map(
    ([, amount, unit]) => Number(amount) * CONFIG_UNITS[unit],
  );
  const durations = [...tomlText.matchAll(/^\s*keepDuration\s*=\s*"(\d+)h"/gmu)].map(([, hours]) =>
    Number(hours),
  );
  if (sizes.length === 0 || durations.length === 0) {
    throw new Error('buildkitd.toml must set maxUsedSpace and keepDuration in its GC policies.');
  }
  return { maxUsedSpace: Math.max(...sizes), keepDurationHours: Math.max(...durations) };
}

export function assertBuilderGcPolicy(inspectText, expected) {
  const rules = parseInspectGcPolicy(inspectText);
  const problems = [];
  if (rules.length === 0) problems.push('no GC policy is reported');
  for (const [index, rule] of rules.entries()) {
    if (rule.maxUsedSpace === undefined || rule.maxUsedSpace > expected.maxUsedSpace) {
      problems.push(`rule#${index} has no Max Used Space at or below the configured limit`);
    }
  }
  if (!rules.some((rule) => rule.keepDurationHours === expected.keepDurationHours)) {
    problems.push(`no rule keeps unused cache for ${expected.keepDurationHours}h`);
  }
  if (problems.length > 0) {
    throw new Error(`Builder GC policy does not match buildkitd.toml: ${problems.join('; ')}.`);
  }
  return rules;
}

function parseInspectSize(value) {
  const match = value.match(/^(\d+(?:\.\d+)?)(B|KiB|MiB|GiB|TiB)$/u);
  return match ? Number(match[1]) * BINARY_UNITS[match[2]] : undefined;
}

function parseInspectDuration(value) {
  const match = value.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/u);
  if (!match || value === '') return undefined;
  const [, hours = '0', minutes = '0', seconds = '0'] = match;
  return Number(hours) + Number(minutes) / 60 + Number(seconds) / 3600;
}
