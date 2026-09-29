"use client";
import { createContext, useContext } from "react";
import { canSell, managesStock, type CurrentSession } from "@/lib/permissions";
export const SessionContext = createContext<CurrentSession | undefined>(undefined);
export function useMembershipRole() {
  const session = useContext(SessionContext);
  return { session, role: session?.role, ready: Boolean(session), owner: session?.role === "OWNER",
    managesStock: managesStock(session?.role), canSell: canSell(session?.role),
    register: session?.kind === "REGISTER", locationId: session?.locationId };
}
