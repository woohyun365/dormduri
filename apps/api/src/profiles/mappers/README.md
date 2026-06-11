# Profiles mappers

`mappers/` is reserved for profile-owned response presenter helpers that are not consumed by other domains directly.

Cross-domain profile response helpers that must be imported by matches/chat live under `profiles/contracts/` so architecture guards can keep `details/`, `targets/`, and `mappers/` private to `profiles`.
