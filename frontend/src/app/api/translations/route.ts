import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success, error } from '@/lib/api-response'
import { createAuditLog } from '@/lib/audit'
import { getCurrentUser } from '@/lib/auth'

// ==================== GET /api/translations ====================
// List translations, filter by ?namespace=

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const namespace = searchParams.get('namespace') || ''

    const where: Record<string, unknown> = {}
    if (namespace) where.namespace = namespace

    const translations = await prisma.translation.findMany({
      where: where as any,
      orderBy: [{ namespace: 'asc' }, { key: 'asc' }],
    })

    return success(translations)
  } catch (err) {
    console.error('GET /api/translations error:', err)
    return error('Failed to fetch translations', 500)
  }
}

// ==================== POST /api/translations ====================
// Create translation

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    if (!user) return error('Unauthorized', 401)

    const body = await request.json()
    const { key, namespace, tr, ru, en } = body

    if (!key || !tr || !ru || !en) {
      return error('Fields key, tr, ru, en are required', 400)
    }

    const existing = await prisma.translation.findUnique({
      where: { key_namespace: { key, namespace: namespace || 'common' } },
    })

    if (existing) {
      return error('A translation with this key and namespace already exists', 409)
    }

    const translation = await prisma.translation.create({
      data: {
        key,
        namespace: namespace || 'common',
        tr,
        ru,
        en,
      },
    })

    await createAuditLog({
      userId: user.id,
      action: 'CREATE',
      entity: 'Translation',
      entityId: translation.id,
      newValues: body,
    })

    return success(translation, 201)
  } catch (err) {
    console.error('POST /api/translations error:', err)
    return error('Failed to create translation', 500)
  }
}

// ==================== PUT /api/translations ====================
// Bulk update translations

export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    if (!user) return error('Unauthorized', 401)

    const body = await request.json()

    if (!Array.isArray(body)) {
      return error('Request body must be an array of translation objects', 400)
    }

    const results = await prisma.$transaction(async (tx: any) => {
      const updated = []

      for (const item of body) {
        if (!item.id) continue

        const existing = await tx.translation.findUnique({
          where: { id: item.id },
        })

        if (!existing) continue

        const translation = await tx.translation.update({
          where: { id: item.id },
          data: {
            tr: item.tr !== undefined ? item.tr : existing.tr,
            ru: item.ru !== undefined ? item.ru : existing.ru,
            en: item.en !== undefined ? item.en : existing.en,
          },
        })

        updated.push(translation)
      }

      return updated
    })

    await createAuditLog({
      userId: user.id,
      action: 'BULK_UPDATE',
      entity: 'Translation',
      newValues: body,
    })

    return success(results)
  } catch (err) {
    console.error('PUT /api/translations error:', err)
    return error('Failed to update translations', 500)
  }
}
