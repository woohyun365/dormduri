// Synthetic business providers; the HTTP ticket controller, guard, resolver and gateway are real.
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
const require = createRequire('/workspace/apps/api/package.json');
require('reflect-metadata');
const { Module } = require('@nestjs/common');
const { NestFactory, HttpAdapterHost, Reflector } = require('@nestjs/core');
const api = (path) => import(pathToFileURL(`/workspace/apps/api/dist/${path}.js`).href);
const [
  config,
  { ChatController },
  { ChatService },
  { ChatRealtimeTicketService },
  { ChatRealtimeRateLimiterService },
  { ChatRealtimeMetricsService },
  { ChatRealtimeGateway },
  { ChatRealtimeAuthService },
  { ChatRealtimePublisher },
  { ChatRealtimeIoAdapter },
  { ChatThreadContextResolver },
  { AuthenticatedUserGuard },
  { AuthActorContextResolver },
  { ApiExceptionFilter },
] = await Promise.all([
  api('chat/realtime/chat-realtime.config'),
  api('chat/chat.controller'),
  api('chat/application/chat.service'),
  api('chat/realtime/chat-realtime-ticket.service'),
  api('chat/realtime/chat-realtime-rate-limiter.service'),
  api('chat/realtime/chat-realtime.metrics'),
  api('chat/realtime/chat-realtime.gateway'),
  api('chat/realtime/chat-realtime-auth.service'),
  api('chat/realtime/chat-realtime-publisher'),
  api('chat/realtime/chat-realtime-io.adapter'),
  api('chat/context/chat-thread-context.resolver'),
  api('auth/access/authenticated-user.guard'),
  api('auth/application/auth-actor-context.resolver'),
  api('platform/http/api-exception.filter'),
]);
const settings = config.createChatRealtimeSettings(process.env);
const tickets = new Map();
const actor = (id) => ({
  id,
  actorId: id,
  actorType: 'USER',
  sessionId: id,
  campus: 'CHUNCHEON',
  gender: 'M',
  capabilities: [],
});
class FixtureModule {}
Module({
  controllers: [ChatController],
  providers: [
    { provide: config.default.KEY, useValue: settings },
    ChatRealtimeRateLimiterService,
    ChatRealtimeMetricsService,
    ChatRealtimeGateway,
    { provide: ChatService, useValue: {} },
    { provide: ChatThreadContextResolver, useValue: {} },
    {
      provide: ChatRealtimeTicketService,
      useValue: {
        issueTicketFromAccessToken(token) {
          if (!token?.startsWith('fixture-')) return null;
          const ticket = randomUUID();
          tickets.set(ticket, actor(token));
          return { ticket };
        },
      },
    },
    {
      provide: ChatRealtimeAuthService,
      useValue: {
        consumeTicket(ticket) {
          const user = tickets.get(ticket) ?? null;
          tickets.delete(ticket);
          return Promise.resolve(user);
        },
      },
    },
    { provide: ChatRealtimePublisher, useValue: { bindServer() {} } },
    {
      provide: AuthActorContextResolver,
      useValue: {
        resolveCurrentUserContext(token) {
          return token?.startsWith('fixture-') ? actor(token) : null;
        },
      },
    },
    AuthenticatedUserGuard,
    Reflector,
  ],
})(FixtureModule);
const app = await NestFactory.create(FixtureModule, { logger: false, abortOnError: false });
try {
  app.useWebSocketAdapter(new ChatRealtimeIoAdapter(app, settings));
  app.useGlobalGuards(app.get(AuthenticatedUserGuard));
  app.useGlobalFilters(
    new ApiExceptionFilter({ write() {} }, { recordException() {} }, app.get(HttpAdapterHost)),
  );
  const server = app.getHttpAdapter().getInstance();
  const limiter = app.get(ChatRealtimeRateLimiterService);
  // Diagnostic routes exist only in this account-free fixture, never in the production application.
  server.get('/health/ready', (_req, res) => res.json({ ready: true }));
  server.get('/auth/fixture/probe', (req, res) =>
    res.json({
      totalConnections: app.get(ChatRealtimeMetricsService).snapshot().totalConnections,
      peer: req.socket.remoteAddress,
      ip: limiter.resolveRequestIp({ peerAddress: req.socket.remoteAddress, headers: req.headers }),
      host: req.headers.host,
      proto: req.headers['x-forwarded-proto'],
      xff: req.headers['x-forwarded-for'],
      realIp: req.headers['x-real-ip'],
      forwarded: req.headers.forwarded,
    }),
  );
  server.get('/internal/metrics', (req, res) => {
    if (req.headers.authorization !== 'Bearer fixture-metrics') return res.sendStatus(401);
    res.type('text/plain').send('fixture_up 1\n');
  });
  await app.listen(4000, '0.0.0.0');
  process.stdout.write('fixture-api-ready\n');
  for (const signal of ['SIGINT', 'SIGTERM'])
    process.once(signal, () => {
      void app.close().then(() => process.exit(0));
    });
} catch (error) {
  await app.close();
  throw error;
}
