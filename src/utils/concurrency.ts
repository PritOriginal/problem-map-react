/**
 * `Promise.allSettled` over `items` with at most `limit` calls of `fn` in flight at once.
 * Results keep the order of `items`.
 */
export async function mapWithLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<PromiseSettledResult<R>[]> {
    const results: PromiseSettledResult<R>[] = new Array(items.length);
    let next = 0;
    const worker = async () => {
        while (next < items.length) {
            const index = next++;
            try {
                results[index] = { status: "fulfilled", value: await fn(items[index]) };
            } catch (reason) {
                results[index] = { status: "rejected", reason };
            }
        }
    };
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
    return results;
}
