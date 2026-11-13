import assert from "node:assert/strict";
import {
  mergeableGroups,
  splittableBatches,
} from "../src/modules/finance/payments/components/payment-batch-bulk";

const g = (id: string, accounts: string[]) => ({
  id,
  items: accounts.map((bankAccountId) => ({ bankAccountId })),
});
assert.deepEqual(
  mergeableGroups([g("a", ["X", "X"]), g("b", ["X"]), g("c", ["X", "Y"]), g("d", [])]).map((x) => x.id),
  ["a"],
);
assert.deepEqual(mergeableGroups([]), []);

const b = (id: string, n: number) => ({ id, allocations: Array(n).fill(0) });
assert.deepEqual(
  splittableBatches([b("p", 1), b("q", 2), b("r", 3), b("s", 0)]).map((x) => x.id),
  ["q", "r"],
);
assert.deepEqual(splittableBatches([]), []);

console.log("payment-batch-bulk: OK");
