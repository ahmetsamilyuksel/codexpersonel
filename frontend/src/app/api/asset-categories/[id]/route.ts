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

    const item = await prisma.assetCategory.findUnique({
      where: { id },
    })

    if (!item) {
      return error('Asset category not found', 404)
    }

    return success(item)
  } catch (err) {
    console.error('GET /api/asset-categories/[id] error:', err)
    return error('Failed to fetch asset category', 500)
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const existing = await prisma.assetCategory.findUnique({
      where: { id },
    })

    if (!existing) {
      return error('Asset category not found', 404)
    }

    if (body.code && body.code !== existing.code) {
      const duplicate = await prisma.assetCategory.findUnique({
        where: { code: body.code },
      })
      if (duplicate) {
        return error('An asset category with this code already exists', 409)
      }
    }

    const item = await prisma.assetCategory.update({
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
      entity: 'AssetCategory',
      entityId: item.id,
      oldValues: existing,
      newValues: body,
    })

    return success(item)
  } catch (err) {
    console.error('PUT /api/asset-categories/[id] error:', err)
    return error('Failed to update asset category', 500)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const existing = await prisma.assetCategory.findUnique({
      where: { id },
    })

    if (!existing) {
      return error('Asset category not found', 404)
    }

    const assetCount = await prisma.asset.count({
      where: { categoryId: id },
    })

    if (assetCount > 0) {
      const item = await prisma.assetCategory.update({
        where: { id },
        data: { isActive: false },
      })

      await createAuditLog({
        action: 'DEACTIVATE',
        entity: 'AssetCategory',
        entityId: id,
        oldValues: existing,
        newValues: { isActive: false },
      })

      return success(item)
    }

    await prisma.assetCategory.delete({ where: { id } })

    await createAuditLog({
      action: 'DELETE',
      entity: 'AssetCategory',
      entityId: id,
      oldValues: existing,
    })

    return success({ message: 'Asset category deleted successfully' })
  } catch (err) {
    console.error('DELETE /api/asset-categories/[id] error:', err)
    return error('Failed to delete asset category', 500)
  }
}
