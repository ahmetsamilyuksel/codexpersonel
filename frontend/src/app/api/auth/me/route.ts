import { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { success, error } from '@/lib/api-response'

export async function GET(request: NextRequest) {
  try {
    // ── Authenticate via access token ───────────────────────────────
    const user = await getCurrentUser(request)

    if (!user) {
      return error('Authentication required', 401)
    }

    // ── Return full user profile ────────────────────────────────────
    return success({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.status,
      locale: user.locale,
      roles: user.roles,
      permissions: user.permissions,
    })
  } catch (err) {
    console.error('Get current user error:', err)
    return error('Internal server error', 500)
  }
}
