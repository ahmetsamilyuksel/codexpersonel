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

    const item = await prisma.profession.findUnique({
      where: { id },
    })

    if (!item) {
      return error('NOT_FOUND', 404)
    }

    return success(item)
  } catch (err) {
    console.error('GET /api/professions/[id] error:', err)
    return error('FETCH_FAILED', 500)
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const existing = await prisma.profession.findUnique({
      where: { id },
    })

    if (!existing) {
      return error('NOT_FOUND', 404)
    }

    if (body.code && body.code !== existing.code) {
      const duplicate = await prisma.profession.findUnique({
        where: { code: body.code },
      })
      if (duplicate) {
        return error('DUPLICATE_CODE', 409)
      }
    }

    const item = await prisma.profession.update({
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
      entity: 'Profession',
      entityId: item.id,
      oldValues: existing,
      newValues: body,
    })

    return success(item)
  } catch (err) {
    console.error('PUT /api/professions/[id] error:', err)
    return error('UPDATE_FAILED', 500)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const existing = await prisma.profession.findUnique({
      where: { id },
    })

    if (!existing) {
      return error('NOT_FOUND', 404)
    }

    const employeeCount = await prisma.employee.count({
      where: { professionId: id },
    })

    if (employeeCount > 0) {
      const item = await prisma.profession.update({
        where: { id },
        data: { isActive: false },
      })

      await createAuditLog({
        action: 'DEACTIVATE',
        entity: 'Profession',
        entityId: id,
        oldValues: existing,
        newValues: { isActive: false },
      })

      return success(item)
    }

    await prisma.profession.delete({ where: { id } })

    await createAuditLog({
      action: 'DELETE',
      entity: 'Profession',
      entityId: id,
      oldValues: existing,
    })

    return success({ message: 'Profession deleted successfully' })
  } catch (err) {
    console.error('DELETE /api/professions/[id] error:', err)
    return error('DELETE_FAILED', 500)
  }
}
