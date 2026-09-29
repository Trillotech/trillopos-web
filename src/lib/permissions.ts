import type { Schemas } from "@/lib/backend";
export type CurrentSession = Schemas["SessionView"];
export type Role = NonNullable<CurrentSession["role"]>;
export const managesStock = (role?: Role) => role === "OWNER" || role === "STOCK_MANAGER";
export const canSell = (role?: Role) => managesStock(role) || role === "CASHIER";
export function landing(role?: Role) {
  return role === "CASHIER" ? "/sales/new" : role === "PACKER" ? "/products" : "/dashboard";
}
/** UI affordances only. Every permission is independently enforced by the backend. */
export function canOpen(path: string, session: CurrentSession) {
  const { role, kind } = session;
  if (!role) return false;
  if (path === "/account") return kind !== "REGISTER";
  if (["/settings", "/locations", "/staff", "/registers"].includes(path))
    return role === "OWNER" && (path !== "/registers" || kind !== "REGISTER");
  if (path === "/products/new" || /^\/products\/[^/]+\/edit$/.test(path)) return managesStock(role);
  if (["/categories", "/stock", "/suppliers", "/payables"].some(p => path === p || path.startsWith(p + "/"))) return managesStock(role);
  if (["/sales", "/customers", "/receivables", "/expenses"].some(p => path === p || path.startsWith(p + "/"))) return canSell(role);
  return path === "/dashboard" || path === "/products" || /^\/products\/[^/]+$/.test(path);
}
