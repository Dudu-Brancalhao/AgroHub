-- Shared harvests, crop as junction.
--
-- This migration EMPTIES `crops` and `harvests`. It does not touch `producers`, `properties` or
-- any authentication table: those are structurally unchanged, and "rebuild from empty" was an
-- answer about not writing a data migration, not a licence to destroy working records.
--
-- The two deletions below are required, not defensive:
--   * `crops` gains a NOT NULL `property_id` with no default, which cannot be added to existing
--     rows.
--   * `harvests.year` becomes UNIQUE, and the old model produced one harvest per property per
--     year - so duplicates certainly exist.
-- Without them this migration fails halfway and leaves the schema in an unknown state.

DELETE FROM "crops";
DELETE FROM "harvests";

-- DropForeignKey
ALTER TABLE "crops" DROP CONSTRAINT "crops_harvest_id_fkey";

-- DropForeignKey
ALTER TABLE "harvests" DROP CONSTRAINT "harvests_property_id_fkey";

-- DropIndex
DROP INDEX "crops_harvest_id_name_normalized_key";

-- DropIndex
DROP INDEX "harvests_property_id_idx";

-- AlterTable
ALTER TABLE "crops" ADD COLUMN     "property_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "harvests" DROP COLUMN "property_id";

-- CreateIndex
CREATE INDEX "crops_property_id_idx" ON "crops"("property_id");

-- CreateIndex
CREATE INDEX "crops_harvest_id_idx" ON "crops"("harvest_id");

-- CreateIndex
CREATE UNIQUE INDEX "crops_property_id_harvest_id_name_normalized_key" ON "crops"("property_id", "harvest_id", "name_normalized");

-- CreateIndex
CREATE UNIQUE INDEX "harvests_year_key" ON "harvests"("year");

-- AddForeignKey
ALTER TABLE "crops" ADD CONSTRAINT "crops_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crops" ADD CONSTRAINT "crops_harvest_id_fkey" FOREIGN KEY ("harvest_id") REFERENCES "harvests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
