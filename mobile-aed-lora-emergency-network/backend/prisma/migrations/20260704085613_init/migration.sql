-- CreateTable
CREATE TABLE "VolunteerAlert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "incidentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "cellularPush" BOOLEAN NOT NULL DEFAULT false,
    "cellularSms" BOOLEAN NOT NULL DEFAULT false,
    "meshtasticDelivered" BOOLEAN NOT NULL DEFAULT false,
    "meshtasticGateway" TEXT,
    "meshtasticBeeping" BOOLEAN NOT NULL DEFAULT false,
    "distanceMeters" INTEGER,
    "etaMinutes" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VolunteerAlert_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VolunteerAlert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
