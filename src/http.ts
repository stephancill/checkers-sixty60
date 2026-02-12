type HttpOptions = {
  method?: "GET" | "POST" | "PUT";
  headers?: Record<string, string>;
  query?: Record<string, string | boolean | number | undefined>;
  body?: unknown;
};

const withQuery = (url: string, query?: HttpOptions["query"]): string => {
  if (!query) {
    return url;
  }

  const u = new URL(url);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      u.searchParams.set(key, String(value));
    }
  }
  return u.toString();
};

export const http = async <T>(
  url: string,
  options: HttpOptions = {},
): Promise<T> => {
  const fullUrl = withQuery(url, options.query);
  const method = options.method ?? "GET";
  const requestInit: RequestInit = {
    method,
    headers: options.headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  };

  const response = await fetch(fullUrl, requestInit);
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${text}`);
  }

  if (!text) {
    return {} as T;
  }

  return JSON.parse(text) as T;
};
