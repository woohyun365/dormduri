# season-participants/lifestyle

Persistence mapper for season participant lifestyle/profile columns.

The canonical owner is `season-participants` because these columns are stored on
season participant profile records. Profiles and matches may import this mapper
for read-model projection, but orchestration/query ownership stays in their own
domain services.
