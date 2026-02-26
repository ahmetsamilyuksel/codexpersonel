import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success, error } from '@/lib/api-response'
import { createAuditLog } from '@/lib/audit'
import { getCurrentUser } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const worksite = await prisma.worksite.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            employments: true,
            assets: true,
            attendancePeriods: true,
            payrollRuns: true,
          },
        },
      },
    })

    if (!worksite) return error('Worksite not found', 404)
    return success(worksite)
  } catch (err) {
    console.error('Get worksite error:', err)
    return error('Failed to fetch worksite', 500)
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request)
    if (!user) return error('Unauthorized', 401)

    const { id } = await params
    const existing = await prisma.worksite.findUnique({ where: { id } })
    if (!existing) return error('Worksite not found', 404)

    const body = await request.json()

    if (body.code && body.code !== existing.code) {
      const dup = await prisma.worksite.findUnique({ where: { code: body.code } })
      if (dup) return error('Worksite code already exists', 409)
    }

    const worksite = await prisma.worksite.update({
      where: { id },
      data: {
        code: body.code ?? existing.code,
        name: body.name ?? existing.name,
        address: body.address !== undefined ? body.address : existing.address,
        city: body.city !== undefined ? body.city : existing.city,
        region: body.region !== undefined ? body.region : existing.region,
        startDate: body.startDate !== undefined ? (body.startDate ? new Date(body.startDate) : null) : existing.startDate,
        endDate: body.endDate !== undefined ? (body.endDate ? new Date(body.endDate) : null) : existing.endDate,
        projectManager: body.projectManager !== undefined ? body.projectManager : existing.projectManager,
        siteManager: body.siteManager !== undefined ? body.siteManager : existing.siteManager,
        client: body.client !== undefined ? body.client : existing.client,
        status: body.status ?? existing.status,
        notes: body.notes !== undefined ? body.notes : existing.notes,
      },
    })

    await createAuditLog({
      userId: user.id,
      action: 'UPDATE',
      entity: 'Worksite',
      entityId: id,
      oldValues: existing,
      newValues: body,
    })

    return success(worksite)
  } catch (err) {
    console.error('Update worksite error:', err)
    return error('Failed to update worksite', 500)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request)
    if (!user) return error('Unauthorized', 401)

    const { id } = await params
    const existing = await prisma.worksite.findUnique({ where: { id } })
    if (!existing) return error('Worksite not found', 404)

    // Soft delete
    await prisma.worksite.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'COMPLETED' },
    })

    await createAuditLog({
      userId: user.id,
      action: 'DELETE',
      entity: 'Worksite',
      entityId: id,
      oldValues: existing,
    })

    return success({ deleted: true })
  } catch (err) {
    console.error('Delete worksite error:', err)
    return error('Failed to delete worksite', 500)
  }
}
