#!/usr/bin/env node
process.env.STRESS_DOCKER_PROFILE = 'production-like';
await import('./run-dockerized-smoke.mjs');
