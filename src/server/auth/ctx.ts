import { portableCtx, portableCtxOrNull } from "../portable/session";

export const getCtx = () => portableCtx();
export const getCtxOrNull = () => portableCtxOrNull(); // API routes: 401, never redirect
