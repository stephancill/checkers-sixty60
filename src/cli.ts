#!/usr/bin/env node

import { input, password, select } from "@inquirer/prompts";
import {
  type LoginContext,
  addToBasket,
  completeOtpFlow,
  fetchOrders,
  getBffToken,
  getCustomerProfile,
  getStoreIds,
  searchProducts,
  startOtpFlow,
  verifyUser,
} from "./api";
import { AUTH_FILE } from "./config";
import { type AuthState, readJsonFile, writeJsonFile } from "./storage";

type ParsedCli = {
  command?: string;
  phone?: string;
  otp?: string;
  reference?: string;
  query?: string;
  productId?: string;
  cartId?: string;
  page?: number;
  size?: number;
  qty?: number;
  json: boolean;
  compact: boolean;
  help: boolean;
};

const usage = `
Usage:
  checkers-sixty60                                Interactive menu
  checkers-sixty60 login                          Interactive login (phone + OTP)
  checkers-sixty60 request-otp --phone <phone>
  checkers-sixty60 verify-otp --phone <phone> --otp <code> [--reference <ref>]
  checkers-sixty60 login --phone <phone> --otp <code> [--reference <ref>]
  checkers-sixty60 orders [--json] [--compact]
  checkers-sixty60 search --query <text> [--page <n>] [--size <n>] [--compact]
  checkers-sixty60 add-to-basket --product-id <id> [--qty <n>] [--cart-id <id>]

Examples:
  checkers-sixty60 request-otp --phone 0821234567
  checkers-sixty60 verify-otp --phone 0821234567 --otp 1234
  checkers-sixty60 orders --json
  checkers-sixty60 orders --compact
  checkers-sixty60 search --query milk --compact
  checkers-sixty60 add-to-basket --product-id 5d3af63cf434cf8420737e3e --qty 1
`;

const parseCliArgs = (): ParsedCli => {
  const args = process.argv.slice(2);
  const first = args[0];
  const command = first && !first.startsWith("-") ? first : undefined;

  const getFlag = (name: string): string | undefined => {
    const index = args.indexOf(name);
    if (index === -1 || index + 1 >= args.length) {
      return undefined;
    }
    return args[index + 1];
  };

  const getNumberFlag = (name: string): number | undefined => {
    const value = getFlag(name);
    if (!value) {
      return undefined;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  return {
    command,
    phone: getFlag("--phone"),
    otp: getFlag("--otp"),
    reference: getFlag("--reference"),
    query: getFlag("--query"),
    productId: getFlag("--product-id"),
    cartId: getFlag("--cart-id"),
    page: getNumberFlag("--page"),
    size: getNumberFlag("--size"),
    qty: getNumberFlag("--qty"),
    json: args.includes("--json"),
    compact: args.includes("--compact"),
    help: args.includes("--help") || args.includes("-h"),
  };
};

type CompactOrder = {
  id: string;
  reference: string;
  status: string;
  totalPayable: number;
  createdOn: number;
};

const toCompactOrders = (payload: unknown): CompactOrder[] => {
  if (typeof payload !== "object" || payload === null) {
    return [];
  }

  const root = payload as { inactiveOrderGroupSummaries?: unknown };
  if (!Array.isArray(root.inactiveOrderGroupSummaries)) {
    return [];
  }

  return root.inactiveOrderGroupSummaries
    .map((item) => {
      if (typeof item !== "object" || item === null) {
        return null;
      }

      const order = item as {
        id?: unknown;
        reference?: unknown;
        reducedStatus?: unknown;
        customerStatus?: unknown;
        totals?: { totalPayable?: unknown };
        createdOn?: unknown;
      };

      return {
        id: String(order.id ?? ""),
        reference: String(order.reference ?? ""),
        status: String(
          order.reducedStatus ?? order.customerStatus ?? "unknown",
        ),
        totalPayable: Number(order.totals?.totalPayable ?? 0),
        createdOn: Number(order.createdOn ?? 0),
      };
    })
    .filter((order): order is CompactOrder => Boolean(order?.id));
};

const toCompactSearchResults = (payload: unknown) => {
  if (typeof payload !== "object" || payload === null) {
    return [];
  }

  const root = payload as {
    products?: Array<{
      id?: string;
      name?: string;
      brandName?: string;
      currentPrice?: number;
      price?: { now?: number };
    }>;
  };

  return (root.products ?? []).map((product) => ({
    id: product.id,
    name: product.name,
    brand: product.brandName,
    price: product.currentPrice ?? product.price?.now,
  }));
};

const toLoginContext = (auth: AuthState): LoginContext => {
  if (
    !auth.customerId ||
    !auth.userId ||
    !auth.email ||
    !auth.userAccessToken ||
    !auth.storeIds
  ) {
    throw new Error("Auth context is incomplete. Run login first.");
  }

  return {
    phoneE164: auth.phoneE164,
    customerId: auth.customerId,
    userId: auth.userId,
    email: auth.email,
    accessToken: auth.userAccessToken,
    refreshToken: auth.refreshToken,
    storeIds: auth.storeIds,
  };
};

const toAuthState = (
  context: LoginContext,
  bffToken: string,
  otpReference: string,
): AuthState => {
  return {
    phoneE164: context.phoneE164,
    bffToken,
    userAccessToken: context.accessToken,
    refreshToken: context.refreshToken,
    otpReference,
    customerId: context.customerId,
    userId: context.userId,
    email: context.email,
    storeIds: context.storeIds,
    savedAt: new Date().toISOString(),
  };
};

const savePendingAuth = async (
  phoneE164: string,
  bffToken: string,
  customerId: string,
  reference: string,
): Promise<AuthState> => {
  const existing = await readJsonFile<AuthState>(AUTH_FILE);
  const next: AuthState = {
    ...(existing ?? { phoneE164, savedAt: new Date().toISOString() }),
    phoneE164,
    bffToken,
    customerId,
    otpReference: reference,
    savedAt: new Date().toISOString(),
  };
  await writeJsonFile(AUTH_FILE, next);
  return next;
};

const ensurePhone = (phone?: string): string => {
  if (!phone) {
    throw new Error("Missing required --phone option");
  }
  return phone;
};

const ensureOtp = (otp?: string): string => {
  if (!otp) {
    throw new Error("Missing required --otp option");
  }
  return otp;
};

const ensureQuery = (query?: string): string => {
  if (!query) {
    throw new Error("Missing required --query option");
  }
  return query;
};

const ensureProductId = (productId?: string): string => {
  if (!productId) {
    throw new Error("Missing required --product-id option");
  }
  return productId;
};

const ensureQuantity = (qty?: number): number => {
  const value = qty ?? 1;
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error("--qty must be a positive integer");
  }
  return value;
};

const startOtpForPhone = async (phone: string): Promise<void> => {
  const started = await startOtpFlow(phone);
  await savePendingAuth(
    started.phoneE164,
    started.bffToken,
    started.customerId,
    started.reference,
  );
  console.log(`OTP sent to ${started.phoneE164}`);
  console.log(`Reference: ${started.reference}`);
};

const completeOtpForPhone = async (
  phone: string,
  otpCode: string,
  reference?: string,
): Promise<AuthState> => {
  const existing = await readJsonFile<AuthState>(AUTH_FILE);

  const phoneFromState = existing?.phoneE164;
  const bffToken = existing?.bffToken;
  const customerId = existing?.customerId;
  const otpReference = reference ?? existing?.otpReference;

  if (!phoneFromState || !bffToken || !customerId || !otpReference) {
    throw new Error(
      "Missing pending auth context. Run request-otp first (or pass --reference).",
    );
  }

  const login = await completeOtpFlow(
    phone,
    customerId,
    bffToken,
    otpReference,
    otpCode,
  );

  const state = toAuthState(login, bffToken, otpReference);
  await writeJsonFile(AUTH_FILE, state);
  return state;
};

const runInteractiveLogin = async (): Promise<AuthState> => {
  const phone = await input({ message: "Phone number (e.g. 0821234567):" });
  const otpStart = await startOtpFlow(phone);

  console.log(`OTP sent to ${otpStart.phoneE164}`);
  const otp = await password({ message: "Enter OTP:" });

  const login = await completeOtpFlow(
    otpStart.phoneE164,
    otpStart.customerId,
    otpStart.bffToken,
    otpStart.reference,
    otp,
  );

  const state = toAuthState(login, otpStart.bffToken, otpStart.reference);
  await writeJsonFile(AUTH_FILE, state);
  return state;
};

const hydrateAuth = async (auth: AuthState): Promise<AuthState> => {
  const next = { ...auth };

  if (!next.bffToken) {
    next.bffToken = await getBffToken();
  }

  if (!next.customerId) {
    next.customerId = await verifyUser(next.phoneE164, next.bffToken);
  }

  if (!next.userAccessToken) {
    throw new Error("Missing user access token. Run login first.");
  }

  if (!next.userId || !next.email) {
    const profile = await getCustomerProfile(
      next.customerId,
      next.userAccessToken,
      next.phoneE164,
    );
    next.userId = profile.userId;
    next.email = profile.email;
  }

  if (!next.storeIds || next.storeIds.length === 0) {
    next.storeIds = await getStoreIds(
      next.userAccessToken,
      next.phoneE164,
      next.userId,
      next.customerId,
      next.email,
    );
  }

  next.savedAt = new Date().toISOString();
  await writeJsonFile(AUTH_FILE, next);
  return next;
};

const runOrders = async (
  jsonOnly: boolean,
  compact: boolean,
): Promise<void> => {
  let auth = await readJsonFile<AuthState>(AUTH_FILE);
  if (!auth) {
    throw new Error("No local auth found. Run login first.");
  }

  auth = await hydrateAuth(auth);

  const orders = await fetchOrders(toLoginContext(auth));

  if (compact) {
    const compactOrders = toCompactOrders(orders);
    console.log(JSON.stringify(compactOrders, null, 2));
    return;
  }

  if (!jsonOnly) {
    console.log("Fetched orders successfully.");
  }
  console.log(JSON.stringify(orders, null, 2));
};

const runSearch = async (
  query: string,
  page: number,
  size: number,
  compact: boolean,
): Promise<void> => {
  let auth = await readJsonFile<AuthState>(AUTH_FILE);
  if (!auth) {
    throw new Error("No local auth found. Run login first.");
  }

  auth = await hydrateAuth(auth);

  const results = await searchProducts(toLoginContext(auth), query, page, size);
  if (compact) {
    console.log(JSON.stringify(toCompactSearchResults(results), null, 2));
    return;
  }

  console.log(JSON.stringify(results, null, 2));
};

const runAddToBasket = async (
  productId: string,
  qty: number,
  cartId?: string,
): Promise<void> => {
  let auth = await readJsonFile<AuthState>(AUTH_FILE);
  if (!auth) {
    throw new Error("No local auth found. Run login first.");
  }

  auth = await hydrateAuth(auth);
  const result = await addToBasket(
    toLoginContext(auth),
    productId,
    qty,
    cartId,
  );
  console.log(JSON.stringify(result, null, 2));
};

const runInteractiveMenu = async (): Promise<void> => {
  const action = await select({
    message: "Select action",
    choices: [
      { value: "login", name: "Interactive login (phone + OTP)" },
      { value: "orders", name: "Fetch my orders" },
    ],
  });

  if (action === "login") {
    const state = await runInteractiveLogin();
    console.log(`Saved auth state to ${AUTH_FILE} for ${state.phoneE164}`);
    return;
  }

  await runOrders(false, false);
};

const main = async (): Promise<void> => {
  const cli = parseCliArgs();

  if (cli.help) {
    console.log(usage.trim());
    return;
  }

  if (!cli.command) {
    await runInteractiveMenu();
    return;
  }

  if (cli.command === "login") {
    if (!cli.phone && !cli.otp) {
      const state = await runInteractiveLogin();
      console.log(`Saved auth state to ${AUTH_FILE} for ${state.phoneE164}`);
      return;
    }

    if (cli.phone && !cli.otp) {
      await startOtpForPhone(ensurePhone(cli.phone));
      return;
    }

    const state = await completeOtpForPhone(
      ensurePhone(cli.phone),
      ensureOtp(cli.otp),
      cli.reference,
    );
    console.log(`Saved auth state to ${AUTH_FILE} for ${state.phoneE164}`);
    return;
  }

  if (cli.command === "request-otp") {
    await startOtpForPhone(ensurePhone(cli.phone));
    return;
  }

  if (cli.command === "verify-otp") {
    const state = await completeOtpForPhone(
      ensurePhone(cli.phone),
      ensureOtp(cli.otp),
      cli.reference,
    );
    console.log(`Saved auth state to ${AUTH_FILE} for ${state.phoneE164}`);
    return;
  }

  if (cli.command === "orders") {
    await runOrders(cli.json, cli.compact);
    return;
  }

  if (cli.command === "search") {
    await runSearch(
      ensureQuery(cli.query),
      cli.page ?? 0,
      cli.size ?? 20,
      cli.compact,
    );
    return;
  }

  if (cli.command === "add-to-basket") {
    await runAddToBasket(
      ensureProductId(cli.productId),
      ensureQuantity(cli.qty),
      cli.cartId,
    );
    return;
  }

  throw new Error(`Unknown command: ${cli.command}\n\n${usage.trim()}`);
};

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
