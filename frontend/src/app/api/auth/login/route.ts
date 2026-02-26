import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  comparePassword,
  generateAccessToken,
  generateRefreshToken,
  hashPassword,
} from '@/lib/auth'
import { success, error } from '@/lib/api-response'
import { createAuditLog } from '@/lib/audit'

interface UserRoleWithPermissions {
  worksiteId: string | null
  role: {
    id: string
    code: string
    nameTr: string
    nameRu: string
    nameEn: string
    rolePermissions: {
      permission: {
        code: string
      }
    }[]
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body

    // ── Validate input ──────────────────────────────────────────────
    if (!email || !password) {
      return error('Email and password are required', 400)
    }

    // ── Find user ───────────────────────────────────────────────────
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!user) {
      return error('Invalid email or password', 401)
    }

    // ── Check soft-delete ───────────────────────────────────────────
    if (user.deletedAt) {
      return error('This account has been deleted', 401)
    }

    // ── Check user status ───────────────────────────────────────────
    if (user.status !== 'ACTIVE') {
      return error('Account is inactive. Please contact an administrator.', 403)
    }

    // ── Verify password ─────────────────────────────────────────────
    const isPasswordValid = await comparePassword(password, user.password)
    if (!isPasswordValid) {
      return error('Invalid email or password', 401)
    }

    // ── Build role / permission payload ─────────────────────────────
    const userRoles = user.userRoles as unknown as UserRoleWithPermissions[]

    const roles = userRoles.map((ur: UserRoleWithPermissions) => ({
      id: ur.role.id,
      code: ur.role.code,
      nameTr: ur.role.nameTr,
      nameRu: ur.role.nameRu,
      nameEn: ur.role.nameEn,
      worksiteId: ur.worksiteId,
    }))

    const permissionSet = new Set<string>()
    for (const ur of userRoles) {
      for (const rp of ur.role.rolePermissions) {
        permissionSet.add(rp.permission.code)
      }
    }
    const permissions = Array.from(permissionSet)

    // ── Generate tokens ─────────────────────────────────────────────
    const tokenPayload = {
      userId: user.id,
      email: user.email,
    }

    const accessToken = generateAccessToken(tokenPayload)
    const refreshToken = generateRefreshToken(tokenPayload)

    // ── Store hashed refresh token in DB ────────────────────────────
    const hashedRefreshToken = await hashPassword(refreshToken)

    await prisma.user.update({
      where: { id: user.id },
      data: {
        refreshToken: hashedRefreshToken,
        lastLoginAt: new Date(),
      },
    })

    // ── Audit log ───────────────────────────────────────────────────
    const ipAddress =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      'unknown'
    const userAgent = request.headers.get('user-agent') ?? 'unknown'

    await createAuditLog({
      userId: user.id,
      action: 'LOGIN',
      entity: 'User',
      entityId: user.id,
      newValues: { email: user.email, ip: ipAddress },
      ipAddress,
      userAgent,
    })

    // ── Build response with httpOnly cookie ─────────────────────────
    const response = success(
      {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          status: user.status,
          locale: user.locale,
          theme: user.theme,
          roles,
          permissions,
        },
      },
      200,
    )

    // Set refresh token as httpOnly cookie (7 days)
    response.cookies.set('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
    })

    return response
  } catch (err) {
    console.error('Login error:', err)
    return error('Internal server error', 500)
  }
}
