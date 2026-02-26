import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success, error } from '@/lib/api-response'

// ==================== GET /api/permissions ====================
// List all permissions grouped by module

export async function GET(request: NextRequest) {
  try {
    const permissions = await prisma.permission.findMany({
      orderBy: [{ module: 'asc' }, { action: 'asc' }],
    })

    // Group by module
    const grouped: Record<string, typeof permissions> = {}
    for (const perm of permissions) {
      if (!grouped[perm.module]) {
        grouped[perm.module] = []
      }
      grouped[perm.module].push(perm)
    }

    return success({
      permissions,
      grouped,
    })
  } catch (err) {
    console.error('GET /api/permissions error:', err)
    return error('Failed to fetch permissions', 500)
  }
}
