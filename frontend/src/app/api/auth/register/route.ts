import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, hashPassword } from '@/lib/auth'
import { success, error } from '@/lib/api-response'
import { createAuditLog } from '@/lib/audit'

interface CreatedUserRole {
  role: {
    id: string
    code: string
    nameTr: string
    nameRu: string
    nameEn: string
  }
}

interface CreatedUser {
  id: string
  email: string
  firstName: string
  lastName: string
  status: string
  locale: string
  createdAt: Date
  userRoles: CreatedUserRole[]
}

export async function POST(request: NextRequest) {
  try {
    // ── Auth check (admin only) ─────────────────────────────────────
    const currentUser = await getCurrentUser(request)
    if (!currentUser) {
      return error('Authentication required', 401)
    }

    const isAdmin =
      currentUser.roles.some((r) => r.code === 'ADMIN' || r.code === 'SUPER_ADMIN') ||
      currentUser.permissions.includes('users.create')

    if (!isAdmin) {
      return error('Insufficient permissions. Only admins can create users.', 403)
    }

    // ── Parse & validate body ───────────────────────────────────────
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

    // ── Check if email already exists ───────────────────────────────
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    })

    if (existingUser) {
      return error('A user with this email already exists', 409)
    }

    // ── Validate role IDs if provided ───────────────────────────────
    const roleIdsArray: string[] = Array.isArray(roleIds) ? roleIds : []

    if (roleIdsArray.length > 0) {
      const existingRoles = await prisma.role.findMany({
        where: { id: { in: roleIdsArray } },
        select: { id: true },
      })

      const existingRoleIds = new Set(existingRoles.map((r: { id: string }) => r.id))
      const invalidRoleIds = roleIdsArray.filter((id: string) => !existingRoleIds.has(id))

      if (invalidRoleIds.length > 0) {
        return error(`Invalid role IDs: ${invalidRoleIds.join(', ')}`, 400)
      }
    }

    // ── Hash password ───────────────────────────────────────────────
    const hashedPassword = await hashPassword(password)

    // ── Create user + assign roles in a transaction ─────────────────
    const newUser = await prisma.$transaction(async (tx: typeof prisma) => {
      const user = await tx.user.create({
        data: {
          email: email.toLowerCase().trim(),
          password: hashedPassword,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          status: 'ACTIVE',
        },
      })

      // Assign roles
      if (roleIdsArray.length > 0) {
        await tx.userRole.createMany({
          data: roleIdsArray.map((roleId: string) => ({
            userId: user.id,
            roleId,
          })),
        })
      }

      // Re-fetch with roles
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
    }) as CreatedUser | null

    // ── Audit log ───────────────────────────────────────────────────
    const ipAddress =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      'unknown'
    const userAgent = request.headers.get('user-agent') ?? 'unknown'

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
      ipAddress,
      userAgent,
    })

    // ── Return created user ─────────────────────────────────────────
    const roles = newUser?.userRoles.map((ur: CreatedUserRole) => ({
      id: ur.role.id,
      code: ur.role.code,
      nameTr: ur.role.nameTr,
      nameRu: ur.role.nameRu,
      nameEn: ur.role.nameEn,
    }))

    return success(
      {
        id: newUser?.id,
        email: newUser?.email,
        firstName: newUser?.firstName,
        lastName: newUser?.lastName,
        status: newUser?.status,
        locale: newUser?.locale,
        createdAt: newUser?.createdAt,
        roles,
      },
      201,
    )
  } catch (err) {
    console.error('Register error:', err)
    return error('Internal server error', 500)
  }
}
