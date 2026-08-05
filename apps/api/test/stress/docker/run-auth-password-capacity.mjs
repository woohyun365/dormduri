#!/usr/bin/env node
process.env.STRESS_DOCKER_PROFILE = 'production-like';
process.env.STRESS_DOCKER_AUTH_PASSWORD_CAPACITY = 'true';
process.env.STRESS_DOCKER_SKIP_WRITE_MIX = 'true';
process.env.STRESS_DOCKER_SKIP_REALTIME_SMOKE = 'true';
await import('./run-dockerized-smoke.mjs');
