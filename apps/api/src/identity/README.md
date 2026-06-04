# identity

Pure shared-kernel helpers for account/display/academic identity invariants.

This directory owns identity vocabulary that multiple product domains need, but
it must stay free of Nest providers, Prisma clients, HTTP adapters, or runtime
module wiring. Domain services may import these helpers directly when they need
the same account identity invariant.
