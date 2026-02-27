import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success, error } from '@/lib/api-response'
import { createAuditLog } from '@/lib/audit'
import { getCurrentUser } from '@/lib/auth'

// ==================== GET /api/settings ====================
// List all settings, optionally filter by ?category=

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    if (!user) return error('UNAUTHORIZED', 401)

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category') || ''

    const where: Record<string, unknown> = {}
    if (category) where.category = category

    const settings = await prisma.setting.findMany({
      where: where as any,
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    })

    return success(settings)
  } catch (err) {
    console.error('GET /api/settings error:', err)
    return error('FETCH_FAILED', 500)
  }
}

// ==================== PUT /api/settings ====================
// Bulk update settings (accepts array of {key, value} pairs)

export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    if (!user) return error('UNAUTHORIZED', 401)

    const body = await request.json()

    if (!Array.isArray(body)) {
      return error('INVALID_REQUEST_BODY', 400)
    }

    const results = await prisma.$transaction(async (tx: any) => {
      const updated = []

      for (const item of body) {
        if (!item.key) continue

        const existing = await tx.setting.findUnique({
          where: { key: item.key },
        })

        if (!existing) continue

        const setting = await tx.setting.update({
          where: { key: item.key },
          data: {
            value: item.value !== undefined ? String(item.value) : existing.value,
            valueTr: item.valueTr !== undefined ? item.valueTr : existing.valueTr,
            valueRu: item.valueRu !== undefined ? item.valueRu : existing.valueRu,
            valueEn: item.valueEn !== undefined ? item.valueEn : existing.valueEn,
          },
        })

        updated.push(setting)
      }

      return updated
    })

    await createAuditLog({
      userId: user.id,
      action: 'BULK_UPDATE',
      entity: 'Setting',
      newValues: body,
    })

    return success(results)
  } catch (err) {
    console.error('PUT /api/settings error:', err)
    return error('UPDATE_FAILED', 500)
  }
}
