import { mkdir, readFile, writeFile } from "node:fs/promises";
import { DEVICE_FILE } from "./config";

export type AuthState = {
  phoneE164: string;
  bffToken?: string;
  userAccessToken?: string;
  refreshToken?: string;
  otpReference?: string;
  customerId?: string;
  userId?: string;
  email?: string;
  storeIds?: string[];
  savedAt: string;
};

type DeviceState = {
  deviceId: string;
  savedAt: string;
};

export const readJsonFile = async <T>(path: string): Promise<T | null> => {
  try {
    const text = await readFile(path, "utf8");
    return JSON.parse(text) as T;
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "ENOENT") {
      return null;
    }

    throw error;
  }
};

export const writeJsonFile = async (
  path: string,
  value: unknown,
): Promise<void> => {
  const lastSlash = path.lastIndexOf("/");
  const dir = lastSlash > 0 ? path.slice(0, lastSlash) : ".";
  await mkdir(dir, { recursive: true });
  await writeFile(path, JSON.stringify(value, null, 2), "utf8");
};

export const getOrCreateDeviceId = async (): Promise<string> => {
  const existing = await readJsonFile<DeviceState>(DEVICE_FILE);
  if (existing?.deviceId) {
    return existing.deviceId;
  }

  const deviceId = crypto.randomUUID();
  await writeJsonFile(DEVICE_FILE, {
    deviceId,
    savedAt: new Date().toISOString(),
  });
  return deviceId;
};
