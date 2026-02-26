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

    const item = await prisma.shift.findUnique({
      where: { id },
    })

    if (!item) {
      return error('Shift not found', 404)
    }

    return success(item)
  } catch (err) {
    console.error('GET /api/shifts/[id] error:', err)
    return error('Failed to fetch shift', 500)
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const existing = await prisma.shift.findUnique({
      where: { id },
    })

    if (!existing) {
      return error('Shift not found', 404)
    }

    if (body.code && body.code !== existing.code) {
      const duplicate = await prisma.shift.findUnique({
        where: { code: body.code },
      })
      if (duplicate) {
        return error('A shift with this code already exists', 409)
      }
    }

    const item = await prisma.shift.update({
      where: { id },
      data: {
        code: body.code ?? existing.code,
        nameTr: body.nameTr ?? existing.nameTr,
        nameRu: body.nameRu ?? existing.nameRu,
        nameEn: body.nameEn ?? existing.nameEn,
        startTime: body.startTime ?? existing.startTime,
        endTime: body.endTime ?? existing.endTime,
        breakMinutes: body.breakMinutes ?? existing.breakMinutes,
        isNightShift: body.isNightShift ?? existing.isNightShift,
        isActive: body.isActive ?? existing.isActive,
      },
    })

    await createAuditLog({
      action: 'UPDATE',
      entity: 'Shift',
      entityId: item.id,
      oldValues: existing,
      newValues: body,
    })

    return success(item)
  } catch (err) {
    console.error('PUT /api/shifts/[id] error:', err)
    return error('Failed to update shift', 500)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const existing = await prisma.shift.findUnique({
      where: { id },
    })

    if (!existing) {
      return error('Shift not found', 404)
    }

    const employmentCount = await prisma.employeeEmployment.count({
      where: { shiftId: id },
    })

    if (employmentCount > 0) {
      const item = await prisma.shift.update({
        where: { id },
        data: { isActive: false },
      })

      await createAuditLog({
        action: 'DEACTIVATE',
        entity: 'Shift',
        entityId: id,
        oldValues: existing,
        newValues: { isActive: false },
      })

      return success(item)
    }

    await prisma.shift.delete({ where: { id } })

    await createAuditLog({
      action: 'DELETE',
      entity: 'Shift',
      entityId: id,
      oldValues: existing,
    })

    return success({ message: 'Shift deleted successfully' })
  } catch (err) {
    console.error('DELETE /api/shifts/[id] error:', err)
    return error('Failed to delete shift', 500)
  }
}
