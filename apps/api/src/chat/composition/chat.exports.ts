import { CHAT_BLOCK_SIDE_EFFECT_PORT } from '../application/ports/chat-block-side-effect.port.js';
import { CHAT_LIFECYCLE_SWEEP_PORT } from '../application/ports/chat-lifecycle-sweep.port.js';
import { CHAT_MATCH_THREAD_LIFECYCLE_PORT } from '../application/ports/chat-match-thread-lifecycle.port.js';
import { ChatLifecycleModule } from '../lifecycle/chat-lifecycle.module.js';
import {
  REALTIME_DISPATCHER_CONFIG_PORT,
  REALTIME_DISPATCH_METRICS_PORT,
  REALTIME_METRICS_READER_PORT,
  REALTIME_USER_ROOM_PUBLISHER_PORT,
} from '../../realtime/realtime.tokens.js';

export const CHAT_EXPORTS = [
  CHAT_BLOCK_SIDE_EFFECT_PORT,
  CHAT_MATCH_THREAD_LIFECYCLE_PORT,
  CHAT_LIFECYCLE_SWEEP_PORT,
  ChatLifecycleModule,
  REALTIME_DISPATCHER_CONFIG_PORT,
  REALTIME_DISPATCH_METRICS_PORT,
  REALTIME_METRICS_READER_PORT,
  REALTIME_USER_ROOM_PUBLISHER_PORT,
];
