export function mergeableGroups<
  G extends { items: { bankAccountId: string | null }[] },
>(groups: G[]): G[] {
  return groups.filter(
    (group) =>
      group.items.length >= 2 &&
      group.items.every(
        (item) => item.bankAccountId === group.items[0]!.bankAccountId,
      ),
  );
}

export function splittableBatches<B extends { allocations: unknown[] }>(
  batches: B[],
): B[] {
  return batches.filter((batch) => batch.allocations.length >= 2);
}
