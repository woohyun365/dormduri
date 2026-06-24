const passwordResetSensitiveWriteSources = [
  'local' + 'Storage',
  'session' + 'Storage',
  'document' + '.cookie',
  'history' + '.pushState',
  'history' + '.replaceState',
] as const;

function escapeRegExp(source: string) {
  return source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const PASSWORD_RESET_STORAGE_WRITE_PATTERNS = passwordResetSensitiveWriteSources.map(
  (source) => new RegExp(`\\b${escapeRegExp(source)}\\b`),
);
