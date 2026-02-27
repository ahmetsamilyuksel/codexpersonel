import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success, error } from '@/lib/api-response'
import { createAuditLog } from '@/lib/audit'
import { getCurrentUser } from '@/lib/auth'

// ==================== GET /api/numbering-rules ====================
// List all numbering rules

export async function GET(request: NextRequest) {
  try {
    const rules = await prisma.numberingRule.findMany({
      orderBy: { entity: 'asc' },
    })

    return success(rules)
  } catch (err) {
    console.error('GET /api/numbering-rules error:', err)
    return error('FETCH_FAILED', 500)
  }
}

// ==================== PUT /api/numbering-rules ====================
// Update a numbering rule (prefix, padLength)

export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    if (!user) return error('UNAUTHORIZED', 401)

    const body = await request.json()
    const { entity, prefix, padLength } = body

    if (!entity) {
      return error('FIELDS_REQUIRED', 400)
    }

    const existing = await prisma.numberingRule.findUnique({
      where: { entity },
    })

    if (!existing) {
      return error('NOT_FOUND', 404)
    }

    const rule = await prisma.numberingRule.update({
      where: { entity },
      data: {
        prefix: prefix !== undefined ? prefix : existing.prefix,
        padLength: padLength !== undefined ? padLength : existing.padLength,
      },
    })

    await createAuditLog({
      userId: user.id,
      action: 'UPDATE',
      entity: 'NumberingRule',
      entityId: rule.id,
      oldValues: existing,
      newValues: body,
    })

    return success(rule)
  } catch (err) {
    console.error('PUT /api/numbering-rules error:', err)
    return error('UPDATE_FAILED', 500)
  }
}
