import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? "dev-access-secret";
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? "dev-refresh-secret";

export type AdminClaims = {
  adminId: string;
  username: string;
};

export type VolunteerClaims = {
  userId: string;
  firstName: string;
  phone: string;
  role: "volunteer";
};

export function signAccessToken(claims: AdminClaims) {
  return jwt.sign(claims, ACCESS_SECRET, { expiresIn: "15m" });
}

export function signRefreshToken(claims: AdminClaims) {
  return jwt.sign(claims, REFRESH_SECRET, { expiresIn: "7d" });
}

export function signVolunteerToken(claims: Omit<VolunteerClaims, "role">) {
  return jwt.sign({ ...claims, role: "volunteer" as const }, ACCESS_SECRET, { expiresIn: "24h" });
}

export function verifyRefreshToken(token: string): AdminClaims {
  return jwt.verify(token, REFRESH_SECRET) as AdminClaims;
}

export type AuthedRequest = Request & { admin?: AdminClaims; volunteer?: VolunteerClaims };

export function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: "Unauthorized" });

  try {
    const claims = jwt.verify(token, ACCESS_SECRET) as AdminClaims & { role?: string };
    if (!claims.adminId || claims.role === "volunteer") {
      return res.status(401).json({ message: "Admin access required" });
    }
    req.admin = { adminId: claims.adminId, username: claims.username };
    next();
  } catch {
    res.status(401).json({ message: "Invalid token" });
  }
}

export function requireVolunteer(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: "Unauthorized" });

  try {
    const claims = jwt.verify(token, ACCESS_SECRET) as VolunteerClaims;
    if (claims.role !== "volunteer") {
      return res.status(401).json({ message: "Volunteer access required" });
    }
    req.volunteer = claims;
    next();
  } catch {
    res.status(401).json({ message: "Invalid token" });
  }
}
