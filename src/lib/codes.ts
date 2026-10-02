import { useTranslations } from "next-intl";

type CodeGroup =
  | "method"
  | "saleStatus"
  | "saleProgress"
  | "salePayment"
  | "role"
  | "memberStatus"
  | "unit"
  | "priceType"
  | "channel"
  | "receivableStatus"
  | "payableStatus"
  | "receivableSource"
  | "payableSource"
  | "docType"
  | "docStatus"
  | "movementType"
  | "movementReason"
  | "locationType"
  | "registerStatus"
  | "customerType"
  | "costing";

/** Words for the backend's codes (KBZ_PAY → "KBZPay") in the reader's language; an unknown code shows as it is. */
export function useCodes() {
  const t = useTranslations("codes");
  return (group: CodeGroup, code: string | null | undefined) => {
    if (!code) {
      return "";
    }
    const key = `${group}.${code}`;
    return t.has(key) ? t(key) : code;
  };
}
