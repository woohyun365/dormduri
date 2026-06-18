SELECT
  COUNT(*) FILTER (WHERE rolled_back_at IS NOT NULL)::int AS failed_count,
  COUNT(*) FILTER (WHERE finished_at IS NULL AND rolled_back_at IS NULL)::int AS incomplete_count
FROM "_prisma_migrations"
