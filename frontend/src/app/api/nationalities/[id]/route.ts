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

    const item = await prisma.nationality.findUnique({
      where: { id },
    })

    if (!item) {
      return error('Nationality not found', 404)
    }

    return success(item)
  } catch (err) {
    console.error('GET /api/nationalities/[id] error:', err)
    return error('Failed to fetch nationality', 500)
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const existing = await prisma.nationality.findUnique({
      where: { id },
    })

    if (!existing) {
      return error('Nationality not found', 404)
    }

    if (body.code && body.code !== existing.code) {
      const duplicate = await prisma.nationality.findUnique({
        where: { code: body.code },
      })
      if (duplicate) {
        return error('A nationality with this code already exists', 409)
      }
    }

    const item = await prisma.nationality.update({
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
      entity: 'Nationality',
      entityId: item.id,
      oldValues: existing,
      newValues: body,
    })

    return success(item)
  } catch (err) {
    console.error('PUT /api/nationalities/[id] error:', err)
    return error('Failed to update nationality', 500)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const existing = await prisma.nationality.findUnique({
      where: { id },
    })

    if (!existing) {
      return error('Nationality not found', 404)
    }

    const employeeCount = await prisma.employee.count({
      where: { nationalityId: id },
    })

    if (employeeCount > 0) {
      // Soft deactivate instead of delete when referenced
      const item = await prisma.nationality.update({
        where: { id },
        data: { isActive: false },
      })

      await createAuditLog({
        action: 'DEACTIVATE',
        entity: 'Nationality',
        entityId: id,
        oldValues: existing,
        newValues: { isActive: false },
      })

      return success(item)
    }

    await prisma.nationality.delete({ where: { id } })

    await createAuditLog({
      action: 'DELETE',
      entity: 'Nationality',
      entityId: id,
      oldValues: existing,
    })

    return success({ message: 'Nationality deleted successfully' })
  } catch (err) {
    console.error('DELETE /api/nationalities/[id] error:', err)
    return error('Failed to delete nationality', 500)
  }
}
