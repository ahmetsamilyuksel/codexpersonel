import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success, error } from '@/lib/api-response'
import { createAuditLog } from '@/lib/audit'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const item = await prisma.documentType.findUnique({
      where: { id },
      include: {
        requirements: true,
      },
    })

    if (!item) {
      return error('Document type not found', 404)
    }

    return success(item)
  } catch (err) {
    console.error('GET /api/document-types/[id] error:', err)
    return error('Failed to fetch document type', 500)
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const existing = await prisma.documentType.findUnique({
      where: { id },
    })

    if (!existing) {
      return error('Document type not found', 404)
    }

    if (body.code && body.code !== existing.code) {
      const duplicate = await prisma.documentType.findUnique({
        where: { code: body.code },
      })
      if (duplicate) {
        return error('A document type with this code already exists', 409)
      }
    }

    const item = await prisma.documentType.update({
      where: { id },
      data: {
        code: body.code ?? existing.code,
        nameTr: body.nameTr ?? existing.nameTr,
        nameRu: body.nameRu ?? existing.nameRu,
        nameEn: body.nameEn ?? existing.nameEn,
        category: body.category !== undefined ? body.category : existing.category,
        hasExpiry: body.hasExpiry ?? existing.hasExpiry,
        defaultAlertDays: body.defaultAlertDays ?? existing.defaultAlertDays,
        isActive: body.isActive ?? existing.isActive,
        sortOrder: body.sortOrder ?? existing.sortOrder,
      },
      include: {
        requirements: true,
      },
    })

    await createAuditLog({
      action: 'UPDATE',
      entity: 'DocumentType',
      entityId: item.id,
      oldValues: existing,
      newValues: body,
    })

    return success(item)
  } catch (err) {
    console.error('PUT /api/document-types/[id] error:', err)
    return error('Failed to update document type', 500)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const existing = await prisma.documentType.findUnique({
      where: { id },
    })

    if (!existing) {
      return error('Document type not found', 404)
    }

    const documentCount = await prisma.employeeDocument.count({
      where: { documentTypeId: id },
    })

    if (documentCount > 0) {
      const item = await prisma.documentType.update({
        where: { id },
        data: { isActive: false },
      })

      await createAuditLog({
        action: 'DEACTIVATE',
        entity: 'DocumentType',
        entityId: id,
        oldValues: existing,
        newValues: { isActive: false },
      })

      return success(item)
    }

    await prisma.documentType.delete({ where: { id } })

    await createAuditLog({
      action: 'DELETE',
      entity: 'DocumentType',
      entityId: id,
      oldValues: existing,
    })

    return success({ message: 'Document type deleted successfully' })
  } catch (err) {
    console.error('DELETE /api/document-types/[id] error:', err)
    return error('Failed to delete document type', 500)
  }
}
