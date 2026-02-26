import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { NextRequest } from 'next/server'
import { prisma } from './prisma'

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || 'access-secret-change-me'
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'refresh-secret-change-me'

const ACCESS_TOKEN_EXPIRY = '15m'
const REFRESH_TOKEN_EXPIRY = '7d'

const BCRYPT_SALT_ROUNDS = 12

// ==================== Token Generation ====================

export function generateAccessToken(payload: Record<string, unknown>): string {
  return jwt.sign(payload, ACCESS_TOKEN_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  })
}

export function generateRefreshToken(payload: Record<string, unknown>): string {
  return jwt.sign(payload, REFRESH_TOKEN_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRY,
  })
}

// ==================== Token Verification ====================

export function verifyAccessToken(token: string): jwt.JwtPayload {
  return jwt.verify(token, ACCESS_TOKEN_SECRET) as jwt.JwtPayload
}

export function verifyRefreshToken(token: string): jwt.JwtPayload {
  return jwt.verify(token, REFRESH_TOKEN_SECRET) as jwt.JwtPayload
}

// ==================== Password Utilities ====================

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_SALT_ROUNDS)
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

// ==================== Current User Extraction ====================

export interface AuthUser {
  id: string
  email: string
  firstName: string
  lastName: string
  status: string
  locale: string
  roles: {
    id: string
    code: string
    nameTr: string
    nameRu: string
    nameEn: string
    worksiteId: string | null
  }[]
  permissions: string[]
}

export async function getCurrentUser(request: NextRequest): Promise<AuthUser | null> {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null
    }

    const token = authHeader.substring(7)
    const decoded = verifyAccessToken(token)

    if (!decoded || !decoded.userId) {
      return null
    }

    const user = await prisma.user.findUnique({
      where: {
        id: decoded.userId as string,
        status: 'ACTIVE',
        deletedAt: null,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        status: true,
        locale: true,
        userRoles: {
          select: {
            worksiteId: true,
            role: {
              select: {
                id: true,
                code: true,
                nameTr: true,
                nameRu: true,
                nameEn: true,
                rolePermissions: {
                  select: {
                    permission: {
                      select: {
                        code: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!user) {
      return null
    }

    const roles = user.userRoles.map((ur) => ({
      id: ur.role.id,
      code: ur.role.code,
      nameTr: ur.role.nameTr,
      nameRu: ur.role.nameRu,
      nameEn: ur.role.nameEn,
      worksiteId: ur.worksiteId,
    }))

    const permissionSet = new Set<string>()
    for (const ur of user.userRoles) {
      for (const rp of ur.role.rolePermissions) {
        permissionSet.add(rp.permission.code)
      }
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.status,
      locale: user.locale,
      roles,
      permissions: Array.from(permissionSet),
    }
  } catch {
    return null
  }
}
