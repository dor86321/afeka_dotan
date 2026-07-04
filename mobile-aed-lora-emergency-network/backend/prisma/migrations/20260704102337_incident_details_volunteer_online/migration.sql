-- AlterTable
ALTER TABLE "Incident" ADD COLUMN "description" TEXT;
ALTER TABLE "Incident" ADD COLUMN "incidentCategory" TEXT;
ALTER TABLE "Incident" ADD COLUMN "patientAgeGroup" TEXT;
ALTER TABLE "Incident" ADD COLUMN "urgencyLevel" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "locationSource" TEXT;
ALTER TABLE "User" ADD COLUMN "volunteerLat" REAL;
ALTER TABLE "User" ADD COLUMN "volunteerLng" REAL;
ALTER TABLE "User" ADD COLUMN "volunteerOnlineAt" DATETIME;
