import { blocksClient } from "@/lib/blocks/client";
import { FIELDS, type SchemaName, type SystemFields } from "@/features/domain/types";

// Thin, typed layer over blocksClient.data for the nine schemas. Everything
// goes through the SDK's collection helpers or data.graphql(); the Data
// Gateway speaks Mongo-style JSON for `filter` and `sort`.

export class DataGatewayError extends Error {
  constructor(message: string, readonly detail?: unknown) {
    super(message);
    this.name = "DataGatewayError";
  }
}

type Filter = Record<string, unknown>;
type Sort = Record<string, 1 | -1>;

type ListPage<T> = { items: T[]; totalCount: number; hasNextPage: boolean };

const SYSTEM_SELECTION = ["CreatedDate", "LastUpdatedDate", "CreatedBy", "LastUpdatedBy"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function graphqlErrors(response: unknown): string | undefined {
  if (!isRecord(response)) return undefined;
  const errors = response.errors;
  if (Array.isArray(errors) && errors.length) {
    return errors
      .map((error) => (isRecord(error) && typeof error.message === "string" ? error.message : JSON.stringify(error)))
      .join("; ");
  }
  return undefined;
}

function collectionFor<T>(name: SchemaName, fields?: readonly string[]) {
  return blocksClient.data.collection<T>(name, { fields: [...(fields ?? FIELDS[name]), ...SYSTEM_SELECTION] });
}

function unwrapList<T>(response: unknown, name: SchemaName): ListPage<T> {
  const failure = graphqlErrors(response);
  if (failure) throw new DataGatewayError(`${name}: ${failure}`, response);
  const record = response as { data?: Record<string, unknown> };
  const gateway = record.data?.[`get${name}s`];
  if (!isRecord(gateway)) throw new DataGatewayError(`${name}: unexpected list response shape`, response);
  const items = Array.isArray(gateway.items) ? (gateway.items as T[]) : [];
  return {
    items,
    totalCount: typeof gateway.totalCount === "number" ? gateway.totalCount : items.length,
    hasNextPage: Boolean(gateway.hasNextPage)
  };
}

function unwrapMutation(response: unknown, name: SchemaName, operation: string): { itemId?: string; totalImpactedData?: number } {
  const failure = graphqlErrors(response);
  if (failure) throw new DataGatewayError(`${operation}${name}: ${failure}`, response);
  const record = response as { data?: Record<string, unknown> };
  const payload = record.data?.[`${operation}${name}`];
  if (!isRecord(payload)) throw new DataGatewayError(`${operation}${name}: unexpected mutation response`, response);
  if (payload.acknowledged === false) {
    throw new DataGatewayError(`${operation}${name}: ${String(payload.message ?? "not acknowledged")}`, response);
  }
  return {
    itemId: typeof payload.itemId === "string" ? payload.itemId : undefined,
    totalImpactedData: typeof payload.totalImpactedData === "number" ? payload.totalImpactedData : undefined
  };
}

/**
 * `fields` narrows the GraphQL selection below the schema's full field list.
 * Used for audience-specific projections (e.g. the sender client never asks
 * for receiver contact details), so restricted data is not merely hidden in
 * the UI -- it never leaves the gateway for that caller.
 */
export async function listPage<T extends SystemFields>(
  name: SchemaName,
  options: { filter?: Filter; sort?: Sort; pageNo?: number; pageSize?: number; fields?: readonly string[] } = {}
): Promise<ListPage<T>> {
  const response = await collectionFor<T>(name, options.fields).list({
    filter: options.filter,
    sort: options.sort ?? { CreatedDate: -1 },
    pageNo: options.pageNo ?? 1,
    pageSize: options.pageSize ?? 100
  });
  return unwrapList<T>(response, name);
}

/** Pages through the whole result set (bounded) -- fine for desk-sized volumes. */
export async function listAll<T extends SystemFields>(
  name: SchemaName,
  options: { filter?: Filter; sort?: Sort; maxItems?: number; fields?: readonly string[] } = {}
): Promise<T[]> {
  const pageSize = 200;
  const maxItems = options.maxItems ?? 5000;
  const items: T[] = [];
  for (let pageNo = 1; items.length < maxItems; pageNo += 1) {
    const page = await listPage<T>(name, { filter: options.filter, sort: options.sort, pageNo, pageSize, fields: options.fields });
    items.push(...page.items);
    if (!page.hasNextPage || page.items.length < pageSize) break;
  }
  return items.slice(0, maxItems);
}

export async function getOne<T extends SystemFields>(name: SchemaName, itemId: string): Promise<T | undefined> {
  const response = await collectionFor<T>(name).get(itemId);
  return unwrapList<T>(response, name).items[0];
}

export async function createOne<T extends SystemFields>(name: SchemaName, payload: Omit<T, keyof SystemFields>): Promise<string> {
  const response = await collectionFor<T>(name).create(payload as Partial<T>);
  const { itemId } = unwrapMutation(response, name, "insert");
  if (!itemId) throw new DataGatewayError(`insert${name}: no itemId returned`, response);
  return itemId;
}

export async function updateOne<T extends SystemFields>(
  name: SchemaName,
  itemId: string,
  payload: Partial<Omit<T, keyof SystemFields>>
): Promise<void> {
  const response = await collectionFor<T>(name).update(itemId, payload as Partial<T>);
  unwrapMutation(response, name, "update");
}

export async function deleteOne(name: SchemaName, itemId: string, hard = true): Promise<void> {
  const response = await collectionFor(name).delete(itemId, { hardDelete: hard });
  unwrapMutation(response, name, "delete");
}

/**
 * Bulk insert. Tries the gateway's `insertMany<Schema>` mutation first; if the
 * runtime does not expose it for this schema, falls back to bounded-concurrency
 * single inserts so seeding still completes.
 */
export async function createMany<T extends SystemFields>(
  name: SchemaName,
  rows: Omit<T, keyof SystemFields>[],
  onProgress?: (done: number, total: number) => void
): Promise<number> {
  if (!rows.length) return 0;
  const batchSize = 100;
  let done = 0;
  let bulkSupported: boolean | undefined;

  for (let start = 0; start < rows.length; start += batchSize) {
    const batch = rows.slice(start, start + batchSize);
    if (bulkSupported !== false) {
      try {
        const response = await blocksClient.data.graphql({
          operationName: `insertMany${name}`,
          query: `mutation insertMany${name}($input: [${name}InsertInput!]!) {
  insertMany${name}(input: $input) {
    acknowledged
    itemId
    message
    totalImpactedData
  }
}`,
          variables: { input: batch }
        });
        const failure = graphqlErrors(response);
        if (failure) throw new DataGatewayError(failure, response);
        bulkSupported = true;
        done += batch.length;
        onProgress?.(done, rows.length);
        continue;
      } catch {
        bulkSupported = false;
      }
    }
    await runWithConcurrency(batch, 8, async (row) => {
      await createOne<T>(name, row);
      done += 1;
      onProgress?.(done, rows.length);
    });
  }
  return done;
}

export async function deleteMany(name: SchemaName, itemIds: string[], onProgress?: (done: number, total: number) => void): Promise<number> {
  let done = 0;
  await runWithConcurrency(itemIds, 10, async (itemId) => {
    await deleteOne(name, itemId, true);
    done += 1;
    onProgress?.(done, itemIds.length);
  });
  return done;
}

export async function runWithConcurrency<T>(items: T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> {
  let index = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = items[index]!;
      index += 1;
      await worker(current);
    }
  });
  await Promise.all(runners);
}

export function parseJson<T>(value: string | undefined | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function nowIso(): string {
  return new Date().toISOString();
}
