import { http } from "./http";
import { getOrCreateDeviceId } from "./storage";

const BFF_BASE = "https://dc-app-backend-for-frontend.sixty60.co.za";
const DSL_BASE =
  "https://api.shopritegroup.co.za/dsl/brands/checkers/countries/ZA";
const AUTH_BASE = "https://auth.sixty60.co.za";
const CATALOG_BASE = "https://catalog.sixty60.co.za";
const ORDERS_BASE = "https://orders-api.sixty60.co.za";

const X_API_KEY = "5y2GIJ8RoP8dm5FxUtsBZ66OfvAZ8Njh3Pjaj9WF";
const X_API_KEY_AUTH = "HbFTqw6RLe4T3gbgGLb7X2qM08viEJlN3Amyq40z";
const PROFILE_TOKEN = "G5tmYwwRnpfPmtJ3HT7VYV7C4x86NGDz";

const APP_VERSION = "iPadOS 2.0.99 (1769786479)";
const APP_BUILD = "1769786479";

const DEFAULT_LATITUDE = -33.9249;
const DEFAULT_LONGITUDE = 18.4241;

type BffTokenResponse = {
  access_token: string;
};

type VerifyUserResponse = {
  response?: {
    uid?: string;
  };
};

type OtpRequestResponse = {
  response?: {
    reference?: string;
  };
};

type OtpVerifyResponse = {
  response?: {
    accessToken?: string;
    refreshToken?: string;
  };
};

type CustomerProfileResponse = {
  userProfile?: {
    id?: string;
    identifier?: string;
    email?: string;
  };
};

type StoreContextsResponse = {
  items?: Array<{
    storeId?: string;
  }>;
};

type CartsResponse = {
  carts?: Array<{
    item?: {
      id?: string;
      serviceOptionId?: string;
      deliveryAddress?: {
        identifier?: string;
      };
      lineItems?: Array<{
        id?: string;
        productId?: string;
        status?: string;
        price?: number;
        priceFactor?: number;
        previousPrice?: number;
        instruction?: string;
        quantity?: number;
        specialInstruction?: string;
        specialInstructions?: string;
        storeId?: string;
        replacementPreferenceId?: string;
        optionSelections?: unknown[];
        selectedWeightRange?: unknown;
        missionName?: string;
        missionType?: string;
        addToBasketType?: string;
        addToBasketJourney?: string;
        serviceOptionId?: string;
        isStockAvailable?: boolean;
        ranged?: boolean;
        requiresOver18?: boolean;
        isSponsoredProduct?: boolean;
        hasAlcohol?: boolean;
        product?: {
          id?: string;
        } | null;
      }>;
      [key: string]: unknown;
    };
  }>;
};

export type LoginContext = {
  phoneE164: string;
  customerId: string;
  userId: string;
  email: string;
  accessToken: string;
  refreshToken?: string;
  storeIds: string[];
};

const normalizePhone = (value: string): string => {
  const digits = value.replace(/\D+/g, "");
  if (digits.startsWith("27") && digits.length === 11) {
    return `+${digits}`;
  }
  if (digits.startsWith("0") && digits.length === 10) {
    return `+27${digits.slice(1)}`;
  }
  if (digits.length === 9) {
    return `+27${digits}`;
  }

  throw new Error(
    "Invalid phone number. Use South African format like 0821234567 or +27821234567.",
  );
};

const baseHeaders = async (
  token: string,
  phoneE164: string,
  storeIds: string[],
  userId?: string,
  customerId?: string,
  email?: string,
): Promise<Record<string, string>> => {
  const deviceId = await getOrCreateDeviceId();
  const storeIdsJson = JSON.stringify(storeIds);
  const storeIdsCsv = storeIds.join(",");

  const headers: Record<string, string> = {
    Accept: "application/json, text/plain, */*",
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    mobileNumber: phoneE164,
    "device-id": deviceId,
    channel: "super-app",
    "app-version": APP_VERSION,
    "channel-os": APP_VERSION,
    appversion: APP_BUILD,
    "istio-appVersion": APP_BUILD,
    storeids: storeIdsJson,
    "istio-storeIds": storeIdsJson,
    "aws-cf-cd-storeid": storeIdsCsv,
  };

  if (userId) {
    headers.UserId = userId;
  }

  if (customerId) {
    headers["customer-id"] = customerId;
  }

  if (email) {
    headers.email = email;
  }

  return headers;
};

const buildStoreContexts = (storeIds: string[]) => {
  return storeIds.map((storeId) => ({
    storeId,
    serviceOptionIds: ["sixty-min-delivery"],
    brandPriority: 1,
    hasCapacity: ["sixty-min-delivery"],
  }));
};

export const getBffToken = async (): Promise<string> => {
  const data = await http<BffTokenResponse>(`${BFF_BASE}/api/v1/token/dsl`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  if (!data.access_token) {
    throw new Error("No access_token from BFF /token/dsl");
  }

  return data.access_token;
};

export const verifyUser = async (
  phoneE164: string,
  bffToken: string,
): Promise<string> => {
  const data = await http<VerifyUserResponse>(`${DSL_BASE}/users/verify`, {
    method: "GET",
    headers: {
      ...(await baseHeaders(bffToken, phoneE164, [])),
      "x-api-key": X_API_KEY,
    },
  });

  const customerId = data.response?.uid;
  if (!customerId) {
    throw new Error(
      `No uid returned from /users/verify: ${JSON.stringify(data)}`,
    );
  }

  return customerId;
};

export const requestOtp = async (
  phoneRaw: string,
  bffToken: string,
  customerId: string,
): Promise<{ phoneE164: string; reference: string }> => {
  const phoneE164 = normalizePhone(phoneRaw);

  const data = await http<OtpRequestResponse>(
    `${DSL_BASE}/users/loginbymobile`,
    {
      method: "GET",
      query: {
        mobileNumber: phoneE164,
      },
      headers: {
        ...(await baseHeaders(bffToken, phoneE164, [], undefined, customerId)),
        "x-api-key": X_API_KEY_AUTH,
      },
    },
  );

  const reference = data.response?.reference;
  if (!reference) {
    throw new Error(`No OTP reference returned: ${JSON.stringify(data)}`);
  }

  return { phoneE164, reference };
};

export const verifyOtp = async (
  phoneE164: string,
  reference: string,
  otp: string,
  bffToken: string,
  customerId: string,
): Promise<{ accessToken: string; refreshToken?: string }> => {
  const data = await http<OtpVerifyResponse>(
    `${DSL_BASE}/otp/loginbymobile/verify`,
    {
      method: "POST",
      headers: {
        ...(await baseHeaders(bffToken, phoneE164, [], undefined, customerId)),
        "x-api-key": X_API_KEY_AUTH,
      },
      body: {
        target: {
          type: "SMS",
          identifier: phoneE164,
          reference,
        },
        otp,
      },
    },
  );

  const accessToken = data.response?.accessToken;
  if (!accessToken) {
    throw new Error(`No accessToken from OTP verify: ${JSON.stringify(data)}`);
  }

  return {
    accessToken,
    refreshToken: data.response?.refreshToken,
  };
};

export const getCustomerProfile = async (
  customerId: string,
  accessToken: string,
  phoneE164: string,
): Promise<{ userId: string; email: string }> => {
  const data = await http<CustomerProfileResponse>(
    `${AUTH_BASE}/customers/${customerId}/customer-profile/v2/${accessToken}`,
    {
      method: "GET",
      headers: {
        ...(await baseHeaders(accessToken, phoneE164, [])),
        Authorization: `Bearer ${PROFILE_TOKEN}`,
      },
    },
  );

  const userId = data.userProfile?.id ?? data.userProfile?.identifier;
  const email = data.userProfile?.email;

  if (!userId || !email) {
    throw new Error(
      `Could not resolve user profile context: ${JSON.stringify(data)}`,
    );
  }

  return { userId, email };
};

export const getStoreIds = async (
  accessToken: string,
  phoneE164: string,
  userId: string,
  customerId: string,
  email: string,
): Promise<string[]> => {
  const data = await http<StoreContextsResponse>(
    `${CATALOG_BASE}/api/v3/store-contexts`,
    {
      method: "POST",
      headers: await baseHeaders(
        accessToken,
        phoneE164,
        [],
        userId,
        customerId,
        email,
      ),
      body: {
        latitude: DEFAULT_LATITUDE,
        longitude: DEFAULT_LONGITUDE,
      },
    },
  );

  const storeIds = (data.items ?? [])
    .map((item) => item.storeId)
    .filter((value): value is string => Boolean(value));

  if (storeIds.length === 0) {
    throw new Error(`No store contexts returned: ${JSON.stringify(data)}`);
  }

  return storeIds;
};

export const loginFlow = async (
  phoneRaw: string,
  otp: string,
  otpReference: string,
): Promise<LoginContext> => {
  const phoneE164 = normalizePhone(phoneRaw);
  const bffToken = await getBffToken();
  const customerId = await verifyUser(phoneE164, bffToken);
  const otpResult = await verifyOtp(
    phoneE164,
    otpReference,
    otp,
    bffToken,
    customerId,
  );
  const profile = await getCustomerProfile(
    customerId,
    otpResult.accessToken,
    phoneE164,
  );
  const storeIds = await getStoreIds(
    otpResult.accessToken,
    phoneE164,
    profile.userId,
    customerId,
    profile.email,
  );

  return {
    phoneE164,
    customerId,
    userId: profile.userId,
    email: profile.email,
    accessToken: otpResult.accessToken,
    refreshToken: otpResult.refreshToken,
    storeIds,
  };
};

export const startOtpFlow = async (
  phoneRaw: string,
): Promise<{
  phoneE164: string;
  customerId: string;
  bffToken: string;
  reference: string;
}> => {
  const phoneE164 = normalizePhone(phoneRaw);
  const bffToken = await getBffToken();
  const customerId = await verifyUser(phoneE164, bffToken);
  const otpRequest = await requestOtp(phoneE164, bffToken, customerId);

  return {
    phoneE164,
    customerId,
    bffToken,
    reference: otpRequest.reference,
  };
};

export const completeOtpFlow = async (
  phoneE164: string,
  customerId: string,
  bffToken: string,
  otpReference: string,
  otp: string,
): Promise<LoginContext> => {
  const otpResult = await verifyOtp(
    phoneE164,
    otpReference,
    otp,
    bffToken,
    customerId,
  );
  const profile = await getCustomerProfile(
    customerId,
    otpResult.accessToken,
    phoneE164,
  );
  const storeIds = await getStoreIds(
    otpResult.accessToken,
    phoneE164,
    profile.userId,
    customerId,
    profile.email,
  );

  return {
    phoneE164,
    customerId,
    userId: profile.userId,
    email: profile.email,
    accessToken: otpResult.accessToken,
    refreshToken: otpResult.refreshToken,
    storeIds,
  };
};

export const fetchOrders = async (context: LoginContext): Promise<unknown> => {
  return http(`${ORDERS_BASE}/api/v2/orders/history`, {
    method: "GET",
    headers: await baseHeaders(
      context.accessToken,
      context.phoneE164,
      context.storeIds,
      context.userId,
      context.customerId,
      context.email,
    ),
  });
};

export const searchProducts = async (
  context: LoginContext,
  query: string,
  page = 0,
  pageSize = 20,
): Promise<unknown> => {
  const url = `${CATALOG_BASE}/api/v3/products/product-list-page`;
  const headers = await baseHeaders(
    context.accessToken,
    context.phoneE164,
    context.storeIds,
    context.userId,
    context.customerId,
    context.email,
  );

  const storeIdsCsv = context.storeIds.join(",");
  headers.storeids = storeIdsCsv;
  headers["istio-storeIds"] = storeIdsCsv;

  return http(url, {
    method: "POST",
    query: {
      isCarousel: true,
      includePromotions: true,
      promotionChannel: "sixty60",
      isXtraSavingsMember: true,
      particularMemberBonusBuyIds: "",
      t: Date.now(),
    },
    headers,
    body: {
      filter: {
        productListSource: {
          search: query,
        },
        paginationOptions: {
          page,
          pageSize,
        },
        filterOptions: {
          dealsOnly: false,
          brandOptions: [],
          departmentOptions: [],
          facetOptions: [],
          serviceOptions: [],
          filterIds: [],
        },
        showNotRangedProducts: false,
      },
      userContext: {
        storeContexts: buildStoreContexts(context.storeIds),
        userId: context.userId,
      },
    },
  });
};

export const addToBasket = async (
  context: LoginContext,
  productId: string,
  quantity = 1,
  cartId?: string,
): Promise<unknown> => {
  const storeContextResponse = await http<StoreContextsResponse>(
    `${CATALOG_BASE}/api/v3/store-contexts`,
    {
      method: "POST",
      headers: await baseHeaders(
        context.accessToken,
        context.phoneE164,
        [],
        context.userId,
        context.customerId,
        context.email,
      ),
      body: {
        latitude: DEFAULT_LATITUDE,
        longitude: DEFAULT_LONGITUDE,
      },
    },
  );

  const storeContexts = (storeContextResponse.items ?? []).filter(
    (item): item is { storeId: string; [key: string]: unknown } =>
      Boolean(item.storeId),
  );
  const updateStoreIds = storeContexts.map((item) => item.storeId);

  const cartsResponse = await http<CartsResponse>(
    `${ORDERS_BASE}/api/v2/carts/user?useProductMinInfoAnnotation=true`,
    {
      method: "POST",
      headers: {
        ...(await baseHeaders(
          context.accessToken,
          context.phoneE164,
          updateStoreIds,
          context.userId,
          context.customerId,
          context.email,
        )),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: {
        storeContexts,
        includeV2ReplacementOptions: true,
      },
    },
  );

  const carts = (cartsResponse.carts ?? []).filter((cart) =>
    Boolean(cart.item?.id),
  );
  const selected = cartId
    ? carts.find((cart) => cart.item?.id === cartId)
    : (carts.find(
        (cart) => cart.item?.serviceOptionId === "sixty-min-delivery",
      ) ?? carts[0]);

  if (!selected?.item?.id || !selected.item.serviceOptionId) {
    throw new Error("Could not locate a cart to update");
  }

  const productLookupHeaders = await baseHeaders(
    context.accessToken,
    context.phoneE164,
    updateStoreIds,
    context.userId,
    context.customerId,
    context.email,
  );
  const storeIdsCsv = updateStoreIds.join(",");
  productLookupHeaders.storeids = storeIdsCsv;
  productLookupHeaders["istio-storeIds"] = storeIdsCsv;

  const productLookup = await http<{
    products?: Array<{
      id?: string;
      storeId?: string;
      priceWithoutDecimal?: number;
      oldPrice?: number;
      priceFactor?: number;
      serviceOptionId?: string;
      isStockAvailable?: boolean;
      requiresOver18?: boolean;
      isSponsored?: boolean;
      hasAlcohol?: boolean;
    }>;
  }>(`${CATALOG_BASE}/api/v3/products/product-list-page`, {
    method: "POST",
    query: {
      isCarousel: true,
      includePromotions: true,
      promotionChannel: "sixty60",
      isXtraSavingsMember: true,
      particularMemberBonusBuyIds: "",
      t: Date.now(),
    },
    headers: productLookupHeaders,
    body: {
      filter: {
        productListSource: {
          productIds: [productId],
        },
        paginationOptions: {
          page: 0,
          pageSize: 20,
        },
        filterOptions: {
          dealsOnly: false,
          brandOptions: [],
          departmentOptions: [],
          facetOptions: [],
          serviceOptions: [],
          filterIds: [],
        },
        showNotRangedProducts: false,
      },
      userContext: {
        storeContexts,
        userId: context.userId,
      },
    },
  });

  const productData = productLookup.products?.find(
    (product) => product.id === productId,
  );
  if (!productData) {
    throw new Error(`Product ${productId} not found in current store context`);
  }

  const currentLineItems = [...(selected.item.lineItems ?? [])];
  const existingIndex = currentLineItems.findIndex(
    (line) => line.productId === productId || line.product?.id === productId,
  );

  const nextLineItems = [...currentLineItems];
  const defaultStoreId = productData.storeId ?? updateStoreIds[0] ?? "";
  if (existingIndex >= 0) {
    const existing = nextLineItems[existingIndex];
    nextLineItems[existingIndex] = {
      ...existing,
      quantity: (existing.quantity ?? 0) + quantity,
    };
  } else {
    nextLineItems.push({
      id: "",
      productId,
      price: productData.priceWithoutDecimal ?? 0,
      priceFactor: productData.priceFactor ?? 100,
      previousPrice:
        productData.oldPrice ?? productData.priceWithoutDecimal ?? 0,
      quantity,
      specialInstructions: "",
      storeId: defaultStoreId,
      replacementPreferenceId: "",
      optionSelections: [],
      selectedWeightRange: null,
      missionName: "",
      missionType: "",
      addToBasketType: "quick_add",
      addToBasketJourney: "main_search_results",
      serviceOptionId:
        productData.serviceOptionId ?? selected.item.serviceOptionId,
      isStockAvailable: productData.isStockAvailable ?? true,
      ranged: false,
      requiresOver18: productData.requiresOver18 ?? false,
      isSponsoredProduct: productData.isSponsored ?? false,
      hasAlcohol: productData.hasAlcohol ?? false,
    });
  }

  const normalizedTargetLineItems = nextLineItems.map((line) => {
    const normalized = {
      ...line,
      productId: line.productId ?? line.product?.id,
      product: undefined,
    } as Record<string, unknown>;
    return normalized;
  });

  const cartsForUpdate: Array<{
    id: string;
    serviceOptionId: string;
    lineItems: Array<Record<string, unknown>>;
  }> = [];

  for (const cart of carts) {
    const item = cart.item;
    if (!item?.id || !item.serviceOptionId) {
      continue;
    }

    if (item.id === selected.item?.id) {
      cartsForUpdate.push({
        id: item.id,
        serviceOptionId: item.serviceOptionId,
        lineItems: normalizedTargetLineItems,
      });
      continue;
    }

    cartsForUpdate.push({
      id: item.id,
      serviceOptionId: item.serviceOptionId,
      lineItems: (item.lineItems ?? []) as Array<Record<string, unknown>>,
    });
  }

  const deliveryAddressId =
    selected.item.deliveryAddress?.identifier ??
    carts
      .map((cart) => cart.item?.deliveryAddress?.identifier)
      .find((identifier): identifier is string => Boolean(identifier)) ??
    "";

  const updateHeaders = await baseHeaders(
    context.accessToken,
    context.phoneE164,
    updateStoreIds,
    context.userId,
    context.customerId,
    context.email,
  );
  updateHeaders.storeids = storeIdsCsv;
  updateHeaders["istio-storeIds"] = storeIdsCsv;
  updateHeaders["aws-cf-cd-storeid"] = storeIdsCsv;
  updateHeaders["Content-Type"] = "application/x-www-form-urlencoded";

  const updated = await http(
    `${ORDERS_BASE}/api/v3/carts/update?useProductMinInfoAnnotation=true`,
    {
      method: "POST",
      headers: updateHeaders,
      body: {
        carts: cartsForUpdate,
        deliveryAddressId,
        storeContexts,
        targetCart: selected.item.id,
      },
    },
  );

  for (const cart of cartsForUpdate) {
    const promotionHeaders = await baseHeaders(
      context.accessToken,
      context.phoneE164,
      updateStoreIds,
      context.userId,
      context.customerId,
      context.email,
    );
    promotionHeaders.storeids = JSON.stringify(updateStoreIds);
    promotionHeaders["istio-storeIds"] = JSON.stringify(updateStoreIds);
    promotionHeaders["aws-cf-cd-storeid"] = storeIdsCsv;
    promotionHeaders["Content-Type"] = "application/x-www-form-urlencoded";

    await http(
      `${ORDERS_BASE}/api/v1/carts/${cart.id}/update-promotions?include_v2_replacement_preferences=true&useProductMinInfoAnnotation=true`,
      {
        method: "POST",
        headers: promotionHeaders,
        body: {
          storeContexts,
        },
      },
    );
  }

  return updated;
};
