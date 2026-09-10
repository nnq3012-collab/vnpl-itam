import { DeviceStatus } from "@prisma/client";

const STATUS_ALIASES: Record<string, DeviceStatus> = {
  "in stock": DeviceStatus.IN_STOCK,
  "instock": DeviceStatus.IN_STOCK,
  "deployed": DeviceStatus.DEPLOYED,
  "in repair": DeviceStatus.IN_REPAIR,
  "inrepair": DeviceStatus.IN_REPAIR,
  "lost": DeviceStatus.LOST,
  "stolen": DeviceStatus.STOLEN,
  "broken": DeviceStatus.BROKEN,
  "retired": DeviceStatus.RETIRED,
};

export function normalizeStatus(raw: string | undefined | null): DeviceStatus {
  if (!raw) return DeviceStatus.IN_STOCK;
  const key = raw.trim().toLowerCase();
  return STATUS_ALIASES[key] ?? DeviceStatus.IN_STOCK;
}

export function isKnownStatus(raw: string | undefined | null): boolean {
  if (!raw) return true; // blank is fine, defaults to In Stock
  return raw.trim().toLowerCase() in STATUS_ALIASES;
}
