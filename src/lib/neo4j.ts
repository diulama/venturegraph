import neo4j, { Driver, Integer } from "neo4j-driver";

let driver: Driver | undefined;

export function getDriver(): Driver {
  if (!driver) {
    driver = neo4j.driver(
      process.env.NEO4J_URI!,
      neo4j.auth.basic(
        process.env.NEO4J_USERNAME!,
        process.env.NEO4J_PASSWORD!,
      ),
      { maxConnectionPoolSize: 10 },
    );
  }
  return driver;
}

function convert(value: unknown): unknown {
  if (value instanceof Integer) return value.toNumber();
  if (Array.isArray(value)) return value.map(convert);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        convert(v),
      ]),
    );
  }
  return value;
}

/** Run a read query and return plain JS row objects. */
export async function cypher<T = Record<string, unknown>>(
  query: string,
  params: Record<string, unknown> = {},
): Promise<T[]> {
  const { records } = await getDriver().executeQuery(query, params, {
    database: "neo4j",
  });
  return records.map((r) => convert(r.toObject()) as T);
}
