import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success, error, paginated } from '@/lib/api-response'
import { createAuditLog } from '@/lib/audit'
import { getCurrentUser, hashPassword } from '@/lib/auth'

// ==================== GET /api/users ====================
// List users with roles

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    if (!user) return error('Unauthorized', 401)

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = { deletedAt: null }
    if (status) where.status = status

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [data, total] = await Promise.all([
      prisma.user.findMany({
        where: where as any,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          status: true,
          locale: true,
          theme: true,
          lastLoginAt: true,
          createdAt: true,
          userRoles: {
            select: {
              id: true,
              worksiteId: true,
              role: {
                select: {
                  id: true,
                  code: true,
                  nameTr: true,
                  nameRu: true,
                  nameEn: true,
                },
              },
            },
          },
        },
      }),
      prisma.user.count({ where: where as any }),
    ])

    return paginated(data, total, page, limit)
  } catch (err) {
    console.error('GET /api/users error:', err)
    return error('Failed to fetch users', 500)
  }
}

// ==================== POST /api/users ====================
// Create user (delegates to register logic)

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request)
    if (!currentUser) return error('Unauthorized', 401)

    const isAdmin =
      currentUser.roles.some((r) => r.code === 'ADMIN' || r.code === 'SUPER_ADMIN') ||
      currentUser.permissions.includes('users.create')

    if (!isAdmin) {
      return error('Insufficient permissions', 403)
    }

    const body = await request.json()
    const { email, password, firstName, lastName, roleIds } = body

    if (!email || !password || !firstName || !lastName) {
      return error('Email, password, firstName, and lastName are required', 400)
    }

    if (password.length < 8) {
      return error('Password must be at least 8 characters long', 400)
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return error('Invalid email format', 400)
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    })

    if (existingUser) {
      return error('A user with this email already exists', 409)
    }

    // Validate role IDs if provided
    const roleIdsArray: string[] = Array.isArray(roleIds) ? roleIds : []

    if (roleIdsArray.length > 0) {
      const existingRoles = await prisma.role.findMany({
        where: { id: { in: roleIdsArray } },
        select: { id: true },
      })

      const existingRoleIds = new Set(existingRoles.map((r: any) => r.id))
      const invalidRoleIds = roleIdsArray.filter((id: string) => !existingRoleIds.has(id))

      if (invalidRoleIds.length > 0) {
        return error(`Invalid role IDs: ${invalidRoleIds.join(', ')}`, 400)
      }
    }

    const hashedPassword = await hashPassword(password)

    const newUser = await prisma.$transaction(async (tx: any) => {
      const user = await tx.user.create({
        data: {
          email: email.toLowerCase().trim(),
          password: hashedPassword,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          status: body.status || 'ACTIVE',
          locale: body.locale || 'tr',
        },
      })

      if (roleIdsArray.length > 0) {
        await tx.userRole.createMany({
          data: roleIdsArray.map((roleId: string) => ({
            userId: user.id,
            roleId,
          })),
        })
      }

      return tx.user.findUnique({
        where: { id: user.id },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          status: true,
          locale: true,
          createdAt: true,
          userRoles: {
            select: {
              role: {
                select: {
                  id: true,
                  code: true,
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
      userId: currentUser.id,
      action: 'CREATE',
      entity: 'User',
      entityId: newUser?.id,
      newValues: {
        email: newUser?.email,
        firstName: newUser?.firstName,
        lastName: newUser?.lastName,
        roleIds: roleIdsArray,
      },
    })

    return success(newUser, 201)
  } catch (err) {
    console.error('POST /api/users error:', err)
    return error('Failed to create user', 500)
  }
}
