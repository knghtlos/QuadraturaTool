import { Prisma } from "@prisma/client";

export function toDecimal(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Prisma.Decimal) return value;
  if (typeof value === "number") return Number.isFinite(value) ? new Prisma.Decimal(value) : null;
  const normalized = String(value)
    .trim()
    .replace(/[€\s]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? new Prisma.Decimal(parsed) : null;
}

export function toNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const normalized = String(value).trim().replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function toInteger(value: unknown) {
  const parsed = toNumber(value);
  return parsed === null ? null : Math.trunc(parsed);
}

export function toStringOrNull(value: unknown) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

export function toBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (value === null || value === undefined || value === "") return false;
  const normalized = String(value).trim().toLowerCase();
  return ["true", "1", "yes", "y", "si", "sì", "x", "ok", "ready"].includes(normalized);
}

export function toDate(value: unknown) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "number") {
    const epoch = Date.UTC(1899, 11, 30);
    const date = new Date(epoch + value * 24 * 60 * 60 * 1000);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function parseJsonObject(value: unknown) {
  if (!value) return null;
  if (typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function decimalToNumber(value: Prisma.Decimal | number | string | null | undefined) {
  if (value === null || value === undefined) return 0;
  if (value instanceof Prisma.Decimal) return value.toNumber();
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
