// deno-lint-ignore-file no-explicit-any
import type { Container } from "@denoboot/di/mod.ts";
import type { Tenant } from "./tenant_manager.ts";


export interface MiddlewareFactory<T extends AnyMiddleware = AnyMiddleware> extends EnhancedMiddleware<T> {
  __factory: true;
}

export type MaybeMiddlewareFactory<T extends AnyMiddleware = AnyMiddleware> = T | MiddlewareFactory<T>;

export function defineMiddlewareFactory<T extends AnyMiddleware = AnyMiddleware>(fn: <TContainer extends Container<any> = Container<any>>(kwargs: EnhancedHandleFnKwargs<TContainer>) => T): MiddlewareFactory<T> {
  (fn as MiddlewareFactory<T>).__factory = true;
  return fn as MiddlewareFactory<T>;
}


export function isMiddlewareFactory<T extends AnyMiddleware = AnyMiddleware>(
  value: MaybeMiddlewareFactory<T>
): value is MiddlewareFactory<T> {
  return typeof value === "function" && "__factory" in value && value.__factory === true;
}


export interface AnyMiddleware {
  [key: string]: any;
}
export interface AnyMiddleware {
  (...args: any[]): any;
}

export interface EnhancedMiddleware<TMiddleware extends AnyMiddleware = AnyMiddleware, TContainer extends Container<any> = Container<any>> {
  (kwargs: EnhancedHandleFnKwargs<TContainer>): TMiddleware;
}

export interface EnhancedHandleFnKwargs<TContainer extends Container<any> = Container<any>> {
  container: TContainer;
  tenant: Tenant | null;
  [key: string]: any;
}

