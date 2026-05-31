import { Prisma } from "@prisma/client";

function isDecimal(value: unknown): value is Prisma.Decimal {
  return value instanceof Prisma.Decimal;
}

/** JSON-safe clone: Decimal → string, Date → ISO, Map → object. */
export function serializeForMobile<T>(value: T): unknown {
  return serializeValue(value);
}

function serializeValue(value: unknown): unknown {
  if (value == null) return value;
  if (isDecimal(value)) return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Map) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of value.entries()) {
      out[String(k)] = serializeValue(v);
    }
    return out;
  }
  if (Array.isArray(value)) {
    return value.map((item) => serializeValue(item));
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = serializeValue(v);
    }
    return out;
  }
  return value;
}
