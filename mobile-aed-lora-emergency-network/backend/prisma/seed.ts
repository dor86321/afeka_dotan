import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient, RegistrationType } from "@prisma/client";

const prisma = new PrismaClient();

const firstNames = [
  "נועם",
  "אור",
  "מיכל",
  "תום",
  "נועה",
  "איתי",
  "שירה",
  "ליאור",
  "רוני",
  "דניאל",
  "מאיה",
  "אופיר",
];

const lastNames = ["כהן", "לוי", "פרץ", "אברהם", "מלכה", "חדד", "אלון", "כץ", "דביר", "ישראלי"];

function randomInRange(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

async function main() {
  await prisma.refreshToken.deleteMany();
  await prisma.maintenanceAlert.deleteMany();
  await prisma.incident.deleteMany();
  await prisma.loRaDevice.deleteMany();
  await prisma.aEDDevice.deleteMany();
  await prisma.user.deleteMany();
  await prisma.adminUser.deleteMany();
  await prisma.simulatorConfig.deleteMany();

  const hash = await bcrypt.hash("1234", 10);
  await prisma.adminUser.create({ data: { username: "micha", passwordHash: hash } });

  await prisma.simulatorConfig.create({
    data: {
      id: "default",
      searchRadiusMeters: 3500,
      noCellularMode: false,
      noGatewayMode: false,
      callForVolunteers: "הצטרפו לרשת המתנדבים והצילו חיים בזמן אמת.",
      loraBuyInfo: "יש לוודא רכישת ציוד LoRa בתדר 433MHz בלבד.",
      maintenanceInfo: "בדקו סוללה אחת לשבוע ושמרו על AED טעון וזמין.",
      registrationHelp: "מלאו טופס קצר והצטרפו לרשת החירום הקהילתית.",
    },
  });

  for (let i = 0; i < 50; i += 1) {
    const firstName = firstNames[i % firstNames.length];
    const lastName = lastNames[i % lastNames.length];
    const type: RegistrationType =
      i % 6 === 0 ? "LORA_CARRIER_ONLY" : i % 2 === 0 ? "MOBILE_AED_WITH_LORA" : "MOBILE_AED_NO_LORA";
    const lat = randomInRange(31.95, 32.15);
    const lng = randomInRange(34.74, 35.0);
    const battery = Math.floor(randomInRange(12, 99));
    const hasLora = type === "MOBILE_AED_WITH_LORA";
    const loraId = `IL433-${(1000 + i).toString()}`;
    const user = await prisma.user.create({
      data: {
        firstName,
        lastName,
        phone: `05${Math.floor(randomInRange(0, 10))}${Math.floor(randomInRange(1000000, 9999999))}`,
        registrationType: type,
        medicalTraining: i % 3 === 0 ? "מע״ר" : "ללא",
        consent: true,
      },
    });

    if (type !== "LORA_CARRIER_ONLY") {
      const loraIdForAed = hasLora ? loraId : undefined;
      const aed = await prisma.aEDDevice.create({
        data: {
          ownerId: user.id,
          hasLora,
          loraDeviceId: loraIdForAed,
          status: battery < 20 ? "MAINTENANCE" : "OK",
          batteryLevel: battery,
          lastLat: lat,
          lastLng: lng,
          lastSeenAt: new Date(Date.now() - randomInRange(1, 120) * 60000),
          isAvailable: i % 9 !== 0,
        },
      });

      if (battery < 20) {
        await prisma.maintenanceAlert.create({
          data: {
            deviceId: aed.id,
            battery,
          },
        });
      }
    }

    if (type !== "MOBILE_AED_NO_LORA") {
      await prisma.loRaDevice.create({
        data: {
          ownerId: user.id,
          loraId,
          role: type === "LORA_CARRIER_ONLY" ? "CARRIER_ONLY" : "AED_ATTACHED",
          batteryLevel: battery,
          lastLat: lat,
          lastLng: lng,
          lastSeenAt: new Date(Date.now() - randomInRange(1, 120) * 60000),
          signalStatus: i % 5 === 0 ? "WEAK" : "MEDIUM",
        },
      });
    }
  }

  // Meshtastic gateway stations (433 MHz) for mesh-to-internet bridge simulation
  const gatewaySpots = [
    { name: "Gateway", lastName: "צפון TA", lat: 32.11, lng: 34.82, loraId: "GW-433-NORTH" },
    { name: "Gateway", lastName: "מרכז TA", lat: 32.07, lng: 34.78, loraId: "GW-433-CENTER" },
    { name: "Gateway", lastName: "דרום TA", lat: 32.03, lng: 34.75, loraId: "GW-433-SOUTH" },
  ];

  for (const gw of gatewaySpots) {
    const user = await prisma.user.create({
      data: {
        firstName: gw.name,
        lastName: gw.lastName,
        phone: "0500000000",
        registrationType: "LORA_CARRIER_ONLY",
        medicalTraining: "Gateway operator",
        consent: true,
      },
    });
    await prisma.loRaDevice.create({
      data: {
        ownerId: user.id,
        loraId: gw.loraId,
        role: "GATEWAY",
        batteryLevel: 100,
        lastLat: gw.lat,
        lastLng: gw.lng,
        lastSeenAt: new Date(),
        signalStatus: "STRONG",
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
