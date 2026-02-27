import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success, error } from '@/lib/api-response'
import { createAuditLog } from '@/lib/audit'
import { getCurrentUser } from '@/lib/auth'

// ==================== GET /api/alert-rules ====================
// List all alert rules

export async function GET(request: NextRequest) {
  try {
    const rules = await prisma.alertRule.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { alerts: true },
        },
      },
    })

    return success(rules)
  } catch (err) {
    console.error('GET /api/alert-rules error:', err)
    return error('FETCH_FAILED', 500)
  }
}

// ==================== POST /api/alert-rules ====================
// Create alert rule

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    if (!user) return error('UNAUTHORIZED', 401)

    const body = await request.json()
    const { code, nameTr, nameRu, nameEn, entity, dateField, warningDays, criticalDays } = body

    if (!code || !nameTr || !nameRu || !nameEn || !entity || !dateField) {
      return error('FIELDS_REQUIRED', 400)
    }

    if (warningDays === undefined || criticalDays === undefined) {
      return error('FIELDS_REQUIRED', 400)
    }

    const existing = await prisma.alertRule.findUnique({
      where: { code },
    })
    if (existing) {
      return error('ALREADY_EXISTS', 409)
    }

    const rule = await prisma.alertRule.create({
      data: {
        code,
        nameTr,
        nameRu,
        nameEn,
        entity,
        dateField,
        warningDays,
        criticalDays,
        isActive: body.isActive ?? true,
        notifyEmail: body.notifyEmail ?? false,
        notifyTelegram: body.notifyTelegram ?? false,
      },
    })

    await createAuditLog({
      userId: user.id,
      action: 'CREATE',
      entity: 'AlertRule',
      entityId: rule.id,
      newValues: body,
    })

    return success(rule, 201)
  } catch (err) {
    console.error('POST /api/alert-rules error:', err)
    return error('CREATE_FAILED', 500)
  }
}
