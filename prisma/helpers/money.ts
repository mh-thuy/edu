import { Decimal } from "@prisma/client/runtime/library";

export function money(value: number | string | Decimal): Decimal {
  return new Decimal(value);
}
