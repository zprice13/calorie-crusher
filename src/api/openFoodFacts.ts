import type { Food, NutritionPer100 } from '../types'

const PRODUCT_FIELDS = [
  'code',
  'product_name',
  'brands',
  'nutriments',
  'serving_quantity',
  'serving_size',
  'image_small_url',
].join(',')

interface OffNutriments {
  'energy-kcal_100g'?: number
  energy_100g?: number
  proteins_100g?: number
  carbohydrates_100g?: number
  fat_100g?: number
  fiber_100g?: number
  sugars_100g?: number
  sodium_100g?: number
}

interface OffProduct {
  code: string
  product_name?: string
  brands?: string
  nutriments?: OffNutriments
  serving_quantity?: number | string
  serving_size?: string
  image_small_url?: string
}

function toNutrition(n: OffNutriments | undefined): NutritionPer100 | null {
  if (!n) return null
  let kcal = n['energy-kcal_100g']
  if (kcal == null && n.energy_100g != null) kcal = n.energy_100g / 4.184
  if (kcal == null) return null
  return {
    kcal: Math.round(kcal),
    protein: n.proteins_100g ?? 0,
    carbs: n.carbohydrates_100g ?? 0,
    fat: n.fat_100g ?? 0,
    fiber: n.fiber_100g,
    sugar: n.sugars_100g,
    sodium: n.sodium_100g,
  }
}

function toFood(p: OffProduct): Food | null {
  const per100 = toNutrition(p.nutriments)
  if (!per100 || !p.product_name) return null
  const servingGrams =
    typeof p.serving_quantity === 'string'
      ? parseFloat(p.serving_quantity)
      : p.serving_quantity
  return {
    id: p.code,
    name: p.product_name,
    brand: p.brands?.split(',')[0]?.trim(),
    per100,
    servingGrams: servingGrams && servingGrams > 0 ? servingGrams : undefined,
    servingLabel: p.serving_size,
    source: 'openfoodfacts',
    imageUrl: p.image_small_url,
    lastUsed: Date.now(),
  }
}

export class ProductNotFoundError extends Error {
  constructor(barcode: string) {
    super(`No product found for barcode ${barcode}`)
    this.name = 'ProductNotFoundError'
  }
}

/** Look up a product by UPC/EAN barcode. Throws ProductNotFoundError if unknown. */
export async function lookupBarcode(barcode: string): Promise<Food> {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(
    barcode,
  )}.json?fields=${PRODUCT_FIELDS}`
  const res = await fetch(url)
  if (res.status === 404) throw new ProductNotFoundError(barcode)
  if (!res.ok) throw new Error(`Open Food Facts request failed (${res.status})`)
  const data = await res.json()
  if (data.status !== 1 || !data.product) throw new ProductNotFoundError(barcode)
  const food = toFood(data.product)
  if (!food) throw new ProductNotFoundError(barcode)
  return food
}

/** Free-text product search (for foods without a barcode handy). */
export async function searchProducts(query: string, signal?: AbortSignal): Promise<Food[]> {
  // Free-text search is only available on the legacy CGI endpoint. The US
  // subdomain limits results to products sold in the US (the world index is
  // dominated by European entries), and sorting by scan count floats the
  // products people actually buy to the top.
  const url =
    'https://us.openfoodfacts.org/cgi/search.pl?' +
    new URLSearchParams({
      search_terms: query,
      search_simple: '1',
      action: 'process',
      json: '1',
      page_size: '20',
      sort_by: 'unique_scans_n',
      lc: 'en',
      fields: PRODUCT_FIELDS,
    })
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`Search failed (${res.status})`)
  const data = await res.json()
  const products: OffProduct[] = data.products ?? []
  return products.map(toFood).filter((f): f is Food => f !== null)
}
