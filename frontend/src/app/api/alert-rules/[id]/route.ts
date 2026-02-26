import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success, error } from '@/lib/api-response'
import { createAuditLog } from '@/lib/audit'
import { getCurrentUser } from '@/lib/auth'

interface RouteParams {
  params: Promise<{ id: string }>
}

// ==================== GET /api/alert-rules/[id] ====================

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    const rule = await prisma.alertRule.findUnique({
      where: { id },
      include: {
        _count: {
          select: { alerts: true },
        },
      },
    })

    if (!rule) {
      return error('Alert rule not found', 404)
    }

    return success(rule)
  } catch (err) {
    console.error('GET /api/alert-rules/[id] error:', err)
    return error('Failed to fetch alert rule', 500)
  }
}

// ==================== PUT /api/alert-rules/[id] ====================

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser(request)
    if (!user) return error('Unauthorized', 401)

    const { id } = await params
    const body = await request.json()

    const existing = await prisma.alertRule.findUnique({
      where: { id },
    })

    if (!existing) {
      return error('Alert rule not found', 404)
    }

    if (body.code && body.code !== existing.code) {
      const duplicate = await prisma.alertRule.findUnique({
        where: { code: body.code },
      })
      if (duplicate) {
        return error('An alert rule with this code already exists', 409)
      }
    }

    const rule = await prisma.alertRule.update({
      where: { id },
      data: {
        code: body.code ?? existing.code,
        nameTr: body.nameTr ?? existing.nameTr,
        nameRu: body.nameRu ?? existing.nameRu,
        nameEn: body.nameEn ?? existing.nameEn,
        entity: body.entity ?? existing.entity,
        dateField: body.dateField ?? existing.dateField,
        warningDays: body.warningDays ?? existing.warningDays,
        criticalDays: body.criticalDays ?? existing.criticalDays,
        isActive: body.isActive !== undefined ? body.isActive : existing.isActive,
        notifyEmail: body.notifyEmail !== undefined ? body.notifyEmail : existing.notifyEmail,
        notifyTelegram: body.notifyTelegram !== undefined ? body.notifyTelegram : existing.notifyTelegram,
      },
    })

    await createAuditLog({
      userId: user.id,
      action: 'UPDATE',
      entity: 'AlertRule',
      entityId: id,
      oldValues: existing,
      newValues: body,
    })

    return success(rule)
  } catch (err) {
    console.error('PUT /api/alert-rules/[id] error:', err)
    return error('Failed to update alert rule', 500)
  }
}

// ==================== DELETE /api/alert-rules/[id] ====================

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser(request)
    if (!user) return error('Unauthorized', 401)

    const { id } = await params

    const existing = await prisma.alertRule.findUnique({
      where: { id },
    })

    if (!existing) {
      return error('Alert rule not found', 404)
    }

    await prisma.alertRule.delete({ where: { id } })

    await createAuditLog({
      userId: user.id,
      action: 'DELETE',
      entity: 'AlertRule',
      entityId: id,
      oldValues: existing,
    })

    return success({ message: 'Alert rule deleted successfully' })
  } catch (err) {
    console.error('DELETE /api/alert-rules/[id] error:', err)
    return error('Failed to delete alert rule', 500)
  }
}
