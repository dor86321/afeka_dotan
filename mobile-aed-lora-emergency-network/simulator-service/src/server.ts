import "dotenv/config";
import express from "express";
import cors from "cors";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

const app = express();
const PORT = Number(process.env.PORT ?? 4200);
const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:3000";
const DB_FILE = path.resolve(process.cwd(), "data", "nosql-events.json");

type EventRecord = {
  id: string;
  type: string;
  payload: unknown;
  timestamp: string;
  incidentId?: string;
  deviceId?: string;
};

function ensureStore() {
  const dir = path.dirname(DB_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify({ telemetry: [], incidents: [] }, null, 2));
}

function readStore(): { telemetry: EventRecord[]; incidents: EventRecord[] } {
  ensureStore();
  return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
}

function writeStore(data: { telemetry: EventRecord[]; incidents: EventRecord[] }) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(express.json());

app.get("/health", (_, res) => res.json({ ok: true }));

app.get("/telemetry", (_, res) => {
  const store = readStore();
  res.json(store.telemetry.slice(-300).reverse());
});

app.post("/telemetry", (req, res) => {
  const schema = z.object({ deviceId: z.string(), type: z.string(), payload: z.unknown() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Bad telemetry payload" });
  const store = readStore();
  store.telemetry.push({
    id: crypto.randomUUID(),
    deviceId: parsed.data.deviceId,
    type: parsed.data.type,
    payload: parsed.data.payload,
    timestamp: new Date().toISOString(),
  });
  writeStore(store);
  res.status(201).json({ ok: true });
});

app.post("/incident-events", (req, res) => {
  const schema = z.object({ incidentId: z.string(), type: z.string(), payload: z.unknown() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Bad incident payload" });
  const store = readStore();
  store.incidents.push({
    id: crypto.randomUUID(),
    incidentId: parsed.data.incidentId,
    type: parsed.data.type,
    payload: parsed.data.payload,
    timestamp: new Date().toISOString(),
  });
  writeStore(store);
  res.status(201).json({ ok: true });
});

app.get("/incident-events/:incidentId", (req, res) => {
  const store = readStore();
  res.json(store.incidents.filter((e) => e.incidentId === req.params.incidentId));
});

app.post("/reset", (_, res) => {
  writeStore({ telemetry: [], incidents: [] });
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Simulator service listening on ${PORT}`);
});
