import { isPortable } from "../config";
import { portableCtx, portableCtxOrNull } from "../portable/session";

// Hosted code is imported lazily so the portable edition never loads it.
export const getCtx = async () =>
  isPortable ? portableCtx() : (await import("./hosted")).hostedCtx();

export const getCtxOrNull = async () =>
  isPortable
    ? portableCtxOrNull()
    : (await import("./hosted")).hostedCtxOrNull(); // API routes: 401, never redirect
