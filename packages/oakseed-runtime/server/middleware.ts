// ============================================================================
// server/middleware.ts - Server middleware
// ============================================================================
export type Middleware = (
  req: Request,
  next: () => Promise<Response>,
) => Promise<Response>;

export class MiddlewareStack {
  private stack: Middleware[] = [];

  use(middleware: Middleware): void {
    this.stack.push(middleware);
  }

  async handle(req: Request, finalHandler: () => Promise<Response>): Promise<Response> {
    let index = 0;

    const next = async (): Promise<Response> => {
      if (index >= this.stack.length) {
        return finalHandler();
      }

      const middleware = this.stack[index++];
      return middleware(req, next);
    };

    return next();
  }
}

// CORS middleware
export function corsMiddleware(): Middleware {
  return async (_req, next) => {
    const response = await next();
    
    const headers = new Headers(response.headers);
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set("Access-Control-Allow-Methods", "*");
    headers.set("Access-Control-Allow-Headers", "Content-Type");

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };
}

// Logging middleware
export function loggingMiddleware(): Middleware {
  return async (req, next) => {
    const start = Date.now();
    const response = await next();
    const duration = Date.now() - start;

    console.log(`${req.method} ${new URL(req.url).pathname} - ${response.status} (${duration}ms)`);

    return response;
  };
}