import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  verifyRefreshToken,
  generateAccessToken,
  comparePassword,
} from '@/lib/auth'
import { success, error } from '@/lib/api-response'

export async function POST(request: NextRequest) {
  try {
    // ── Extract refresh token from cookie or body ───────────────────
    let refreshToken: string | null = null

    // 1. Try httpOnly cookie first
    refreshToken = request.cookies.get('refreshToken')?.value ?? null

    // 2. Fall back to request body
    if (!refreshToken) {
      try {
        const body = await request.json()
        refreshToken = body.refreshToken ?? null
      } catch {
        // Body may be empty or not JSON; that's fine
      }
    }

    if (!refreshToken) {
      return error('REFRESH_TOKEN_REQUIRED', 400)
    }

    // ── Verify the refresh token JWT ────────────────────────────────
    let decoded: { userId?: string; email?: string }
    try {
      decoded = verifyRefreshToken(refreshToken) as { userId?: string; email?: string }
    } catch {
      return error('INVALID_REFRESH_TOKEN', 401)
    }

    if (!decoded.userId) {
      return error('INVALID_REFRESH_TOKEN', 401)
    }

    // ── Look up the user ────────────────────────────────────────────
    const user = await prisma.user.findUnique({
      where: {
        id: decoded.userId,
        status: 'ACTIVE',
        deletedAt: null,
      },
      select: {
        id: true,
        email: true,
        refreshToken: true,
      },
    })

    if (!user) {
      return error('USER_NOT_FOUND', 401)
    }

    // ── Compare token against stored hash ───────────────────────────
    if (!user.refreshToken) {
      return error('NO_ACTIVE_SESSION', 401)
    }

    const isTokenValid = await comparePassword(refreshToken, user.refreshToken)
    if (!isTokenValid) {
      return error('TOKEN_REVOKED', 401)
    }

    // ── Generate a new access token ─────────────────────────────────
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
    })

    return success({ accessToken }, 200)
  } catch (err) {
    console.error('Refresh token error:', err)
    return error('INTERNAL_ERROR', 500)
  }
}
