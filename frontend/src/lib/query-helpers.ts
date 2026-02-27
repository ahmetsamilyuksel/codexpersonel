/**
 * Common query helpers for building Prisma queries from URL search params.
 * Used across all API route handlers for consistent pagination, sorting, searching, and filtering.
 */

export interface ParsedQueryParams {
  page: number
  limit: number
  skip: number
  sort: string
  order: 'asc' | 'desc'
  search: string
  filters: Record<string, string>
}

/**
 * Extracts standardized query parameters from URLSearchParams.
 *
 * Supported params:
 *   - page (default: 1)
 *   - limit (default: 20, max: 100)
 *   - sort (default: 'createdAt')
 *   - order (default: 'desc')
 *   - search (default: '')
 *   - Any other param is treated as a filter (e.g. status=ACTIVE, departmentId=xxx)
 */
export function parseQueryParams(searchParams: URLSearchParams): ParsedQueryParams {
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))
  const skip = (page - 1) * limit
  const sort = searchParams.get('sort') || 'createdAt'
  const orderParam = searchParams.get('order')?.toLowerCase()
  const order: 'asc' | 'desc' = orderParam === 'asc' ? 'asc' : 'desc'
  const search = searchParams.get('search')?.trim() || ''

  const reservedKeys = new Set(['page', 'limit', 'sort', 'order', 'search'])
  const filters: Record<string, string> = {}

  searchParams.forEach((value, key) => {
    if (!reservedKeys.has(key) && value) {
      filters[key] = value
    }
  })

  return { page, limit, skip, sort, order, search, filters }
}

/**
 * Builds a Prisma `where` clause from search text and filters.
 *
 * @param search - The search string to match against multiple fields
 * @param searchFields - Array of field names to search in (uses `contains` with case-insensitive mode)
 * @param filters - Key-value pairs for exact match filters
 * @returns A Prisma-compatible where object
 *
 * Example:
 *   buildWhereClause('john', ['firstName', 'lastName', 'email'], { status: 'ACTIVE' })
 *   =>
 *   {
 *     AND: [
 *       { OR: [
 *           { firstName: { contains: 'john', mode: 'insensitive' } },
 *           { lastName: { contains: 'john', mode: 'insensitive' } },
 *           { email: { contains: 'john', mode: 'insensitive' } },
 *         ]
 *       },
 *       { status: 'ACTIVE' },
 *     ]
 *   }
 */
export function buildWhereClause(
  search: string,
  searchFields: string[],
  filters: Record<string, string>
): Record<string, any> {
  const conditions: Record<string, any>[] = []

  // Search across multiple fields with OR
  if (search && searchFields.length > 0) {
    const searchConditions = searchFields.map((field) => {
      // Support nested fields using dot notation (e.g., 'employee.firstName')
      const parts = field.split('.')
      if (parts.length > 1) {
        let nested: Record<string, any> = {
          contains: search,
          mode: 'insensitive',
        }
        // Build from innermost to outermost
        for (let i = parts.length - 1; i >= 1; i--) {
          nested = { [parts[i]]: nested }
        }
        return { [parts[0]]: nested }
      }

      return {
        [field]: {
          contains: search,
          mode: 'insensitive' as const,
        },
      }
    })

    conditions.push({ OR: searchConditions })
  }

  // Add exact-match filters
  for (const [key, value] of Object.entries(filters)) {
    // Support nested filters using dot notation (e.g., 'employment.worksiteId')
    const parts = key.split('.')
    if (parts.length > 1) {
      let nested: Record<string, any> = value as unknown as Record<string, any>
      for (let i = parts.length - 1; i >= 1; i--) {
        nested = { [parts[i]]: nested }
      }
      conditions.push({ [parts[0]]: nested })
    } else {
      conditions.push({ [key]: value })
    }
  }

  if (conditions.length === 0) {
    return {}
  }

  if (conditions.length === 1) {
    return conditions[0]
  }

  return { AND: conditions }
}

/**
 * Builds a Prisma `orderBy` clause from sort field and order direction.
 *
 * Supports nested fields using dot notation (e.g., 'department.nameEn').
 *
 * @param sort - The field name to sort by
 * @param order - Sort direction ('asc' | 'desc')
 * @returns A Prisma-compatible orderBy object
 *
 * Example:
 *   buildOrderBy('department.nameEn', 'asc')
 *   => { department: { nameEn: 'asc' } }
 */
export function buildOrderBy(
  sort: string,
  order: 'asc' | 'desc'
): Record<string, any> {
  const parts = sort.split('.')

  if (parts.length === 1) {
    return { [sort]: order }
  }

  // Build nested orderBy from innermost to outermost
  let result: Record<string, any> = { [parts[parts.length - 1]]: order }
  for (let i = parts.length - 2; i >= 0; i--) {
    result = { [parts[i]]: result }
  }

  return result
}
