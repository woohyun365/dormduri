// Bounded normalization of an observed SubagentStop transcript, not a host grant.
export function readClaudeStoppedTranscript(bytes, { sessionId, agentId, prompt, expectedModel }) {
  if (!Buffer.isBuffer(bytes) || bytes.length > 4 * 1024 * 1024)
    throw new TypeError('transcript byte limit');
  const raw = bytes.toString('utf8');
  if (!Buffer.from(raw).equals(bytes) || !raw.endsWith('\n'))
    throw new TypeError('incomplete transcript');
  const rows = raw
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  const messages = rows.filter((r) => ['assistant', 'user'].includes(r.type));
  if (!messages.length || messages.some((r) => r.sessionId !== sessionId || r.agentId !== agentId))
    throw new TypeError('foreign transcript');
  const first = messages[0];
  if (first.type !== 'user' || first.message?.content !== prompt)
    throw new TypeError('transcript prompt mismatch');
  const assistants = messages.filter((r) => r.type === 'assistant');
  if (!assistants.length || assistants.some((r) => r.message?.model !== expectedModel))
    throw new TypeError('transcript model mismatch');
  const calls = new Map();
  let deliveredText = null;
  for (const row of messages) {
    const content = Array.isArray(row.message?.content) ? row.message.content : [];
    for (const c of content) {
      if (row.type === 'assistant' && c.type === 'tool_use' && c.name === 'SubagentHandback') {
        if (
          typeof c.id !== 'string' ||
          !c.id ||
          calls.has(c.id) ||
          typeof c.input?.message !== 'string'
        )
          throw new TypeError('malformed/duplicate handback');
        calls.set(c.id, { text: c.input.message, delivered: false });
      } else if (row.type === 'user' && c.type === 'tool_result' && calls.has(c.tool_use_id)) {
        const call = calls.get(c.tool_use_id);
        if (call.delivered || c.is_error === true)
          throw new TypeError('failed/duplicate handback result');
        call.delivered = true;
        deliveredText = call.text;
      }
    }
  }
  if ([...calls.values()].some((call) => !call.delivered))
    throw new TypeError('undelivered handback');
  const text =
    deliveredText ??
    assistants
      .flatMap((r) => r.message?.content ?? [])
      .filter((c) => c.type === 'text')
      .at(-1)?.text;
  if (typeof text !== 'string' || !text.trim()) throw new TypeError('missing final child response');
  return {
    status: 'completed',
    agentId,
    resolvedModel: expectedModel,
    modelsUsed: [...new Set(assistants.map((r) => r.message.model))],
    prompt,
    content: [{ type: 'text', text }],
  };
}

export function isClaudeCompletedNotification(row, { sessionId, agentId, toolUseId }) {
  // Claude can deliver a notification between turns as a user message, or absorb it
  // mid-turn as this typed attachment. Queue enqueue alone is not delivery evidence.
  const attached =
    row?.type === 'attachment' &&
    row.isSidechain === false &&
    row.attachment?.type === 'queued_command' &&
    row.attachment.commandMode === 'task-notification';
  const text = attached ? row.attachment.prompt : row?.message?.content;
  // `sessionId` is the transcript's session. After `--resume` the same transcript also records the
  // new process as `session_id`, so only its shape is checked; the caller already requires the
  // registered session's transcript file.
  if (
    (row?.type !== 'user' && !attached) ||
    row.sessionId !== sessionId ||
    (row.session_id !== undefined &&
      row.session_id !== sessionId &&
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u.test(row.session_id)) ||
    typeof text !== 'string' ||
    !text.endsWith('</task-notification>')
  )
    return false;
  const header =
    /^<task-notification>\n<task-id>([^<>\n]+)<\/task-id>\n<tool-use-id>([^<>\n]+)<\/tool-use-id>\n(?:<output-file>[^<>\n]*<\/output-file>\n)?<status>([^<>\n]+)<\/status>\n/u.exec(
      text,
    );
  if (!header || header[1] !== agentId || header[2] !== toolUseId || header[3] !== 'completed')
    return false;
  return ['task-id', 'tool-use-id', 'status'].every(
    (tag) => text.split(`<${tag}>`).length === 2 && text.split(`</${tag}>`).length === 2,
  );
}

// Effort on the assistant rows of a finished child transcript. A transcript still being written
// (absent, partial last row, no assistant row yet) is pending; rows from another child, prompt or
// model are foreign. `missing` reports an assistant row without the field, which no flush adds.
export function readClaudeTranscriptEfforts(bytes, { sessionId, agentId, prompt, expectedModel }) {
  if (bytes === null) return { status: 'pending' };
  if (!Buffer.isBuffer(bytes) || bytes.length > 4 * 1024 * 1024) return { status: 'foreign' };
  const raw = bytes.toString('utf8');
  if (!Buffer.from(raw).equals(bytes)) return { status: 'foreign' };
  if (!raw.endsWith('\n')) return { status: 'pending' };
  let rows;
  try {
    rows = raw
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
  } catch {
    return { status: 'foreign' };
  }
  const messages = rows.filter((r) => ['assistant', 'user'].includes(r?.type));
  if (messages.some((r) => r.sessionId !== sessionId || r.agentId !== agentId))
    return { status: 'foreign' };
  if (messages.length && (messages[0].type !== 'user' || messages[0].message?.content !== prompt))
    return { status: 'foreign' };
  const assistants = messages.filter((r) => r.type === 'assistant');
  if (!assistants.length) return { status: 'pending' };
  if (assistants.some((r) => r.message?.model !== expectedModel)) return { status: 'foreign' };
  const efforts = assistants.map((r) => r.effort);
  return {
    status: 'observed',
    efforts: [...new Set(efforts.filter((e) => typeof e === 'string'))].sort(),
    missing: efforts.some((e) => typeof e !== 'string'),
  };
}
