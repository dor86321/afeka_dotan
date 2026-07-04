-- AlterTable
ALTER TABLE "Incident" ADD COLUMN "closedAt" DATETIME;
ALTER TABLE "Incident" ADD COLUMN "closureReason" TEXT;
ALTER TABLE "Incident" ADD COLUMN "volunteerNote" TEXT;
