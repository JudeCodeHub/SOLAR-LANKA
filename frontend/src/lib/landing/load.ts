import "server-only";

import { serverApi } from "@/lib/api/server";

/** One landing section's data, or a marker that it could not be loaded. */
export type Section<T> = { ok: true; items: T[]; total: number } | { ok: false };

const FEATURED_COUNT = 3;

async function load<T>(
  request: (api: Awaited<ReturnType<typeof serverApi>>) => Promise<{
    data?: { items: T[]; total: number };
  }>,
): Promise<Section<T>> {
  try {
    const { data } = await request(await serverApi());
    return data ? { ok: true, items: data.items, total: data.total } : { ok: false };
  } catch {
    // The backend being down must not take the whole page with it.
    return { ok: false };
  }
}

/** The public data shown on the landing page. Each section fails independently. */
export async function loadLanding() {
  const query = { params: { query: { limit: FEATURED_COUNT } } };
  const [panels, inverters, companies] = await Promise.all([
    load((api) => api.GET("/catalogue/panels", query)),
    load((api) => api.GET("/catalogue/inverters", query)),
    load((api) => api.GET("/public/companies", query)),
  ]);
  return { panels, inverters, companies };
}
