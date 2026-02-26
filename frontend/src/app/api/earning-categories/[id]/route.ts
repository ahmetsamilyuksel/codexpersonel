import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success, error } from '@/lib/api-response'
import { createAuditLog } from '@/lib/audit'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const item = await prisma.earningCategory.findUnique({
      where: { id },
    })

    if (!item) {
      return error('Earning category not found', 404)
    }

    return success(item)
  } catch (err) {
    console.error('GET /api/earning-categories/[id] error:', err)
    return error('Failed to fetch earning category', 500)
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const existing = await prisma.earningCategory.findUnique({
      where: { id },
    })

    if (!existing) {
      return error('Earning category not found', 404)
    }

    if (body.code && body.code !== existing.code) {
      const duplicate = await prisma.earningCategory.findUnique({
        where: { code: body.code },
      })
      if (duplicate) {
        return error('An earning category with this code already exists', 409)
      }
    }

    const item = await prisma.earningCategory.update({
      where: { id },
      data: {
        code: body.code ?? existing.code,
        nameTr: body.nameTr ?? existing.nameTr,
        nameRu: body.nameRu ?? existing.nameRu,
        nameEn: body.nameEn ?? existing.nameEn,
        isActive: body.isActive ?? existing.isActive,
        sortOrder: body.sortOrder ?? existing.sortOrder,
      },
    })

    await createAuditLog({
      action: 'UPDATE',
      entity: 'EarningCategory',
      entityId: item.id,
      oldValues: existing,
      newValues: body,
    })

    return success(item)
  } catch (err) {
    console.error('PUT /api/earning-categories/[id] error:', err)
    return error('Failed to update earning category', 500)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const existing = await prisma.earningCategory.findUnique({
      where: { id },
    })

    if (!existing) {
      return error('Earning category not found', 404)
    }

    // EarningCategory is referenced by Earning.categoryId but the FK is not
    // enforced at Prisma level, so we check for usages manually.
    const earningCount = await prisma.earning.count({
      where: { categoryId: id },
    })

    if (earningCount > 0) {
      const item = await prisma.earningCategory.update({
        where: { id },
        data: { isActive: false },
      })

      await createAuditLog({
        action: 'DEACTIVATE',
        entity: 'EarningCategory',
        entityId: id,
        oldValues: existing,
        newValues: { isActive: false },
      })

      return success(item)
    }

    await prisma.earningCategory.delete({ where: { id } })

    await createAuditLog({
      action: 'DELETE',
      entity: 'EarningCategory',
      entityId: id,
      oldValues: existing,
    })

    return success({ message: 'Earning category deleted successfully' })
  } catch (err) {
    console.error('DELETE /api/earning-categories/[id] error:', err)
    return error('Failed to delete earning category', 500)
  }
}
