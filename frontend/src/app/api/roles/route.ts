import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success, error } from '@/lib/api-response'
import { createAuditLog } from '@/lib/audit'
import { getCurrentUser } from '@/lib/auth'

// ==================== GET /api/roles ====================
// List roles with permission counts

export async function GET(request: NextRequest) {
  try {
    const roles = await prisma.role.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        _count: {
          select: {
            rolePermissions: true,
            userRoles: true,
          },
        },
      },
    })

    return success(roles)
  } catch (err) {
    console.error('GET /api/roles error:', err)
    return error('FETCH_FAILED', 500)
  }
}

// ==================== POST /api/roles ====================
// Create role

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    if (!user) return error('UNAUTHORIZED', 401)

    const body = await request.json()
    const { code, nameTr, nameRu, nameEn, permissionIds } = body

    if (!code || !nameTr || !nameRu || !nameEn) {
      return error('FIELDS_REQUIRED', 400)
    }

    const existing = await prisma.role.findUnique({
      where: { code },
    })
    if (existing) {
      return error('ALREADY_EXISTS', 409)
    }

    const role = await prisma.$transaction(async (tx: any) => {
      const created = await tx.role.create({
        data: {
          code,
          nameTr,
          nameRu,
          nameEn,
          description: body.description || null,
          isSystem: false,
          siteScoped: body.siteScoped ?? false,
        },
      })

      // Assign permissions if provided
      const permIds: string[] = Array.isArray(permissionIds) ? permissionIds : []
      if (permIds.length > 0) {
        await tx.rolePermission.createMany({
          data: permIds.map((permissionId: string) => ({
            roleId: created.id,
            permissionId,
          })),
        })
      }

      return tx.role.findUnique({
        where: { id: created.id },
        include: {
          _count: {
            select: {
              rolePermissions: true,
              userRoles: true,
            },
          },
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
        },
      })
    })

    await createAuditLog({
      userId: user.id,
      action: 'CREATE',
      entity: 'Role',
      entityId: role?.id,
      newValues: body,
    })

    return success(role, 201)
  } catch (err) {
    console.error('POST /api/roles error:', err)
    return error('CREATE_FAILED', 500)
  }
}
