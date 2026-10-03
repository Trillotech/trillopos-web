const key = "trillopos:just-sold";

/** Remembers, for this tab only, the sale just charged, so its receipt can greet the cashier with the change to give. */
export function markJustSold(id: string) {
  try {
    sessionStorage.setItem(key, id);
  } catch {
    // storage refused (a private window): the receipt simply shows no greeting
  }
}

/** True once, for the sale just charged: the mark is used up. */
export function takeJustSold(id: string) {
  try {
    if (sessionStorage.getItem(key) === id) {
      sessionStorage.removeItem(key);
      return true;
    }
  } catch {
    // storage refused: no greeting
  }
  return false;
}
