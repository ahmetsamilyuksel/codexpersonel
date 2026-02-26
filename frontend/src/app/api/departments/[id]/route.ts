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

    const item = await prisma.department.findUnique({
      where: { id },
      include: {
        parent: { select: { id: true, code: true, nameTr: true, nameRu: true, nameEn: true } },
        children: {
          select: { id: true, code: true, nameTr: true, nameRu: true, nameEn: true, isActive: true, sortOrder: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    })

    if (!item) {
      return error('Department not found', 404)
    }

    return success(item)
  } catch (err) {
    console.error('GET /api/departments/[id] error:', err)
    return error('Failed to fetch department', 500)
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const existing = await prisma.department.findUnique({
      where: { id },
    })

    if (!existing) {
      return error('Department not found', 404)
    }

    if (body.code && body.code !== existing.code) {
      const duplicate = await prisma.department.findUnique({
        where: { code: body.code },
      })
      if (duplicate) {
        return error('A department with this code already exists', 409)
      }
    }

    // Prevent circular parent references
    if (body.parentId) {
      if (body.parentId === id) {
        return error('A department cannot be its own parent', 400)
      }
      const parent = await prisma.department.findUnique({
        where: { id: body.parentId },
      })
      if (!parent) {
        return error('Parent department not found', 404)
      }
      // Check if the proposed parent is a descendant of this department
      let currentParent = parent
      while (currentParent.parentId) {
        if (currentParent.parentId === id) {
          return error('Cannot set a descendant as parent (circular reference)', 400)
        }
        const nextParent = await prisma.department.findUnique({
          where: { id: currentParent.parentId },
        })
        if (!nextParent) break
        currentParent = nextParent
      }
    }

    const item = await prisma.department.update({
      where: { id },
      data: {
        code: body.code ?? existing.code,
        nameTr: body.nameTr ?? existing.nameTr,
        nameRu: body.nameRu ?? existing.nameRu,
        nameEn: body.nameEn ?? existing.nameEn,
        parentId: body.parentId !== undefined ? body.parentId : existing.parentId,
        isActive: body.isActive ?? existing.isActive,
        sortOrder: body.sortOrder ?? existing.sortOrder,
      },
      include: {
        parent: { select: { id: true, code: true, nameTr: true, nameRu: true, nameEn: true } },
      },
    })

    await createAuditLog({
      action: 'UPDATE',
      entity: 'Department',
      entityId: item.id,
      oldValues: existing,
      newValues: body,
    })

    return success(item)
  } catch (err) {
    console.error('PUT /api/departments/[id] error:', err)
    return error('Failed to update department', 500)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const existing = await prisma.department.findUnique({
      where: { id },
      include: {
        children: { select: { id: true } },
      },
    })

    if (!existing) {
      return error('Department not found', 404)
    }

    if (existing.children.length > 0) {
      return error('Cannot delete department with child departments. Remove or reassign children first.', 400)
    }

    const employeeCount = await prisma.employee.count({
      where: { departmentId: id },
    })

    if (employeeCount > 0) {
      const item = await prisma.department.update({
        where: { id },
        data: { isActive: false },
      })

      await createAuditLog({
        action: 'DEACTIVATE',
        entity: 'Department',
        entityId: id,
        oldValues: existing,
        newValues: { isActive: false },
      })

      return success(item)
    }

    await prisma.department.delete({ where: { id } })

    await createAuditLog({
      action: 'DELETE',
      entity: 'Department',
      entityId: id,
      oldValues: existing,
    })

    return success({ message: 'Department deleted successfully' })
  } catch (err) {
    console.error('DELETE /api/departments/[id] error:', err)
    return error('Failed to delete department', 500)
  }
}
