
export interface CorsOptions {
  origin?:
    | string
    | string[]
    | ((origin: string | undefined, ctx: any) => string | boolean);

  methods?: string[];
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  credentials?: boolean;
  maxAge?: number;
  preflightContinue?: boolean;
  optionsSuccessStatus?: number;
}

const DEFAULT_METHODS = ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"];

export function corsMiddleware(options: CorsOptions = {}) {
  const {
    origin = "*",
    methods = DEFAULT_METHODS,
    allowedHeaders,
    exposedHeaders,
    credentials = false,
    maxAge,
    preflightContinue = false,
    optionsSuccessStatus = 204,
  } = options;

  return async function _corsMiddleware(ctx: any, next: any): Promise<void> {
    const requestOrigin = ctx.request.headers.get("Origin") ?? undefined;

    // ---- Origin resolution ----
    let resolvedOrigin: string | undefined;

    if (typeof origin === "string") {
      resolvedOrigin = origin;
    } else if (Array.isArray(origin)) {
      if (requestOrigin && origin.includes(requestOrigin)) {
        resolvedOrigin = requestOrigin;
      }
    } else if (typeof origin === "function") {
      const result = origin(requestOrigin, ctx);
      if (result === true) resolvedOrigin = requestOrigin;
      if (typeof result === "string") resolvedOrigin = result;
    }

    if (resolvedOrigin) {
      ctx.response.headers.set(
        "Access-Control-Allow-Origin",
        resolvedOrigin,
      );
    }

    // Avoid caching issues with dynamic origins
    ctx.response.headers.append("Vary", "Origin");

    // ---- Credentials ----
    if (credentials) {
      ctx.response.headers.set(
        "Access-Control-Allow-Credentials",
        "true",
      );
    }

    // ---- Exposed headers ----
    if (exposedHeaders?.length) {
      ctx.response.headers.set(
        "Access-Control-Expose-Headers",
        exposedHeaders.join(", "),
      );
    }

    // ---- Preflight ----
    if (ctx.request.method === "OPTIONS") {
      ctx.response.headers.set(
        "Access-Control-Allow-Methods",
        methods.join(", "),
      );

      if (allowedHeaders?.length) {
        ctx.response.headers.set(
          "Access-Control-Allow-Headers",
          allowedHeaders.join(", "),
        );
      } else {
        const reqHeaders = ctx.request.headers.get(
          "Access-Control-Request-Headers",
        );
        if (reqHeaders) {
          ctx.response.headers.set(
            "Access-Control-Allow-Headers",
            reqHeaders,
          );
        }
      }

      if (typeof maxAge === "number") {
        ctx.response.headers.set(
          "Access-Control-Max-Age",
          String(maxAge),
        );
      }

      if (!preflightContinue) {
        ctx.response.status = optionsSuccessStatus;
        return;
      }
    }

    await next();
  };
}
