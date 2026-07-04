-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "phone" TEXT NOT NULL,
    "registrationType" TEXT NOT NULL,
    "medicalTraining" TEXT,
    "consent" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AEDDevice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "hasLora" BOOLEAN NOT NULL,
    "loraDeviceId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OK',
    "batteryLevel" INTEGER NOT NULL,
    "lastLat" REAL NOT NULL,
    "lastLng" REAL NOT NULL,
    "lastSeenAt" DATETIME NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "AEDDevice_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LoRaDevice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "loraId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "batteryLevel" INTEGER NOT NULL,
    "lastLat" REAL NOT NULL,
    "lastLng" REAL NOT NULL,
    "lastSeenAt" DATETIME NOT NULL,
    "signalStatus" TEXT NOT NULL DEFAULT 'MEDIUM',
    CONSTRAINT "LoRaDevice_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SimulatorConfig" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "searchRadiusMeters" INTEGER NOT NULL DEFAULT 3000,
    "noCellularMode" BOOLEAN NOT NULL DEFAULT false,
    "noGatewayMode" BOOLEAN NOT NULL DEFAULT false,
    "callForVolunteers" TEXT NOT NULL,
    "loraBuyInfo" TEXT NOT NULL,
    "maintenanceInfo" TEXT NOT NULL,
    "registrationHelp" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Incident" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lat" REAL NOT NULL,
    "lng" REAL NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MaintenanceAlert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deviceId" TEXT NOT NULL,
    "battery" INTEGER NOT NULL,
    "isHandled" BOOLEAN NOT NULL DEFAULT false,
    "contactedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "AEDDevice_ownerId_key" ON "AEDDevice"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "AEDDevice_loraDeviceId_key" ON "AEDDevice"("loraDeviceId");

-- CreateIndex
CREATE UNIQUE INDEX "LoRaDevice_loraId_key" ON "LoRaDevice"("loraId");

-- CreateIndex
CREATE UNIQUE INDEX "LoRaDevice_ownerId_key" ON "LoRaDevice"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_username_key" ON "AdminUser"("username");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_token_key" ON "RefreshToken"("token");
