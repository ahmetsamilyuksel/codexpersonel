import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success, error } from '@/lib/api-response'
import { createAuditLog } from '@/lib/audit'
import { getCurrentUser } from '@/lib/auth'

interface RouteParams {
  params: Promise<{ id: string }>
}

// ==================== PUT /api/alerts/[id] ====================
// Mark as read, dismiss, or resolve

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser(request)
    if (!user) return error('UNAUTHORIZED', 401)

    const { id } = await params
    const body = await request.json()

    const existing = await prisma.alert.findUnique({
      where: { id },
    })

    if (!existing) {
      return error('NOT_FOUND', 404)
    }

    const updateData: Record<string, unknown> = {}

    if (body.isRead !== undefined) {
      updateData.isRead = body.isRead
    }

    if (body.isDismissed !== undefined) {
      updateData.isDismissed = body.isDismissed
    }

    if (body.resolve === true) {
      updateData.resolvedAt = new Date()
    }

    const alert = await prisma.alert.update({
      where: { id },
      data: updateData,
      include: {
        alertRule: {
          select: {
            id: true,
            code: true,
            nameTr: true,
            nameRu: true,
            nameEn: true,
          },
        },
        employee: {
          select: {
            id: true,
            employeeNo: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    })

    await createAuditLog({
      userId: user.id,
      action: 'UPDATE',
      entity: 'Alert',
      entityId: id,
      oldValues: {
        isRead: existing.isRead,
        isDismissed: existing.isDismissed,
        resolvedAt: existing.resolvedAt,
      },
      newValues: updateData,
    })

    return success(alert)
  } catch (err) {
    console.error('PUT /api/alerts/[id] error:', err)
    return error('UPDATE_FAILED', 500)
  }
}
