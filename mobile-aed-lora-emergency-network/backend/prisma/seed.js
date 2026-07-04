"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
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
function randomInRange(min, max) {
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
    const hash = await bcryptjs_1.default.hash("1234", 10);
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
        const type = i % 6 === 0 ? "LORA_CARRIER_ONLY" : i % 2 === 0 ? "MOBILE_AED_WITH_LORA" : "MOBILE_AED_NO_LORA";
        const lat = randomInRange(31.95, 32.15);
        const lng = randomInRange(34.74, 35.0);
        const battery = Math.floor(randomInRange(12, 99));
        const hasLora = type === "MOBILE_AED_WITH_LORA";
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
            const aed = await prisma.aEDDevice.create({
                data: {
                    ownerId: user.id,
                    hasLora,
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
                    loraId: `IL433-${(1000 + i).toString()}`,
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
