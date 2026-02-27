import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success, error } from '@/lib/api-response'
import { createAuditLog } from '@/lib/audit'
import { getCurrentUser } from '@/lib/auth'

interface RouteParams {
  params: Promise<{ id: string }>
}

// ==================== GET /api/roles/[id] ====================
// Get role with permissions

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    const role = await prisma.role.findUnique({
      where: { id },
      include: {
        rolePermissions: {
          include: {
            permission: {
              select: {
                id: true,
                code: true,
                module: true,
                action: true,
                nameTr: true,
                nameRu: true,
                nameEn: true,
              },
            },
          },
        },
        _count: {
          select: {
            userRoles: true,
          },
        },
      },
    })

    if (!role) {
      return error('NOT_FOUND', 404)
    }

    return success(role)
  } catch (err) {
    console.error('GET /api/roles/[id] error:', err)
    return error('FETCH_FAILED', 500)
  }
}

// ==================== PUT /api/roles/[id] ====================
// Update role, supports updating permissions array

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser(request)
    if (!user) return error('UNAUTHORIZED', 401)

    const { id } = await params
    const body = await request.json()

    const existing = await prisma.role.findUnique({
      where: { id },
      include: {
        rolePermissions: {
          select: { permissionId: true },
        },
      },
    })

    if (!existing) {
      return error('NOT_FOUND', 404)
    }

    if (body.code && body.code !== existing.code) {
      const duplicate = await prisma.role.findUnique({
        where: { code: body.code },
      })
      if (duplicate) {
        return error('DUPLICATE_CODE', 409)
      }
    }

    const role = await prisma.$transaction(async (tx: any) => {
      // Update role fields
      await tx.role.update({
        where: { id },
        data: {
          code: body.code ?? existing.code,
          nameTr: body.nameTr ?? existing.nameTr,
          nameRu: body.nameRu ?? existing.nameRu,
          nameEn: body.nameEn ?? existing.nameEn,
          description: body.description !== undefined ? body.description : existing.description,
          siteScoped: body.siteScoped !== undefined ? body.siteScoped : existing.siteScoped,
        },
      })

      // Update permissions if provided
      if (Array.isArray(body.permissionIds)) {
        // Remove all existing permissions
        await tx.rolePermission.deleteMany({
          where: { roleId: id },
        })

        // Add new permissions
        if (body.permissionIds.length > 0) {
          await tx.rolePermission.createMany({
            data: body.permissionIds.map((permissionId: string) => ({
              roleId: id,
              permissionId,
            })),
          })
        }
      }

      return tx.role.findUnique({
        where: { id },
        include: {
          rolePermissions: {
            include: {
              permission: {
                select: {
                  id: true,
                  code: true,
                  module: true,
                  action: true,
                  nameTr: true,
                  nameRu: true,
                  nameEn: true,
                },
              },
            },
          },
          _count: {
            select: {
              userRoles: true,
            },
          },
        },
      })
    })

    await createAuditLog({
      userId: user.id,
      action: 'UPDATE',
      entity: 'Role',
      entityId: id,
      oldValues: {
        code: existing.code,
        nameTr: existing.nameTr,
        permissionIds: existing.rolePermissions.map((rp: any) => rp.permissionId),
      },
      newValues: body,
    })

    return success(role)
  } catch (err) {
    console.error('PUT /api/roles/[id] error:', err)
    return error('UPDATE_FAILED', 500)
  }
}

// ==================== DELETE /api/roles/[id] ====================
// Cannot delete system roles

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser(request)
    if (!user) return error('UNAUTHORIZED', 401)

    const { id } = await params

    const existing = await prisma.role.findUnique({
      where: { id },
      include: {
        _count: {
          select: { userRoles: true },
        },
      },
    })

    if (!existing) {
      return error('NOT_FOUND', 404)
    }

    if (existing.isSystem) {
      return error('SYSTEM_ROLE_PROTECTED', 400)
    }

    if (existing._count.userRoles > 0) {
      return error('ROLE_IN_USE', 400)
    }

    // Delete role permissions and the role
    await prisma.$transaction([
      prisma.rolePermission.deleteMany({ where: { roleId: id } }),
      prisma.role.delete({ where: { id } }),
    ])

    await createAuditLog({
      userId: user.id,
      action: 'DELETE',
      entity: 'Role',
      entityId: id,
      oldValues: existing,
    })

    return success({ message: 'Role deleted successfully' })
  } catch (err) {
    console.error('DELETE /api/roles/[id] error:', err)
    return error('DELETE_FAILED', 500)
  }
}
