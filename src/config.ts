import { homedir } from "node:os";

export const API = {
  bffBase: "https://dc-app-backend-for-frontend.sixty60.co.za",
  ordersBase: "https://orders-api.sixty60.co.za",
  tokenPath: "/api/v1/token/dsl",
  loginByMobilePath: "/api/v1/users/loginbymobile",
  verifyOtpPath: "/api/v1/otp/loginbymobile/verify",
  ordersGroupsPath: "/api/v1/orders/groups",
} as const;

export const DEFAULT_HEADERS = {
  Accept: "application/json",
  "Content-Type": "application/json",
  "x-api-key": "HbFTqw6RLe4T3gbgGLb7X2qM08viEJlN3Amyq40z",
  channel: "super-app",
} as const;

const HOME = process.env.HOME ?? homedir();

export const AUTH_FILE = `${HOME}/.checkers-sixty60/auth.json`;
export const DEVICE_FILE = `${HOME}/.checkers-sixty60/device.json`;
export const SETTINGS_FILE = `${HOME}/.checkers-sixty60/settings.json`;
