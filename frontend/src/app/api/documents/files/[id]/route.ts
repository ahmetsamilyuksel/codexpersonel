import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success, error } from '@/lib/api-response'
import { getCurrentUser } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'
import path from 'path'
import fs from 'fs/promises'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/documents/files/[id] - Download a file
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser(request)
    if (!user) return error('UNAUTHORIZED', 401)

    const { id } = await params

    const file = await prisma.documentFile.findUnique({
      where: { id, deletedAt: null },
      include: {
        document: {
          include: {
            employee: { select: { employeeNo: true } },
            documentType: { select: { code: true } },
          },
        },
      },
    })

    if (!file) return error('NOT_FOUND', 404)

    // For local storage, read file from disk
    const filePath = path.join(process.cwd(), file.storagePath)
    try {
      const buffer = await fs.readFile(filePath)
      return new Response(buffer, {
        headers: {
          'Content-Type': file.mimeType,
          'Content-Disposition': `inline; filename="${encodeURIComponent(file.originalName)}"`,
          'Content-Length': String(buffer.length),
        },
      })
    } catch {
      // If file not on disk, return the storage path info
      return success({
        id: file.id,
        fileName: file.fileName,
        originalName: file.originalName,
        mimeType: file.mimeType,
        size: file.size,
        storagePath: file.storagePath,
        versionNo: file.versionNo,
        createdAt: file.createdAt,
      })
    }
  } catch (err: any) {
    console.error('GET /api/documents/files/[id] error:', err)
    return error('FETCH_FAILED', 500)
  }
}

// DELETE /api/documents/files/[id] - Soft delete a file
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser(request)
    if (!user) return error('UNAUTHORIZED', 401)

    const { id } = await params

    const file = await prisma.documentFile.findUnique({
      where: { id, deletedAt: null },
    })

    if (!file) return error('NOT_FOUND', 404)

    await prisma.documentFile.update({
      where: { id },
      data: { deletedAt: new Date() },
    })

    await createAuditLog({
      userId: user.id,
      action: 'DELETE',
      entity: 'DocumentFile',
      entityId: id,
      oldValues: { fileName: file.originalName, documentId: file.documentId },
    })

    return success({ message: 'File deleted' })
  } catch (err: any) {
    console.error('DELETE /api/documents/files/[id] error:', err)
    return error('DELETE_FAILED', 500)
  }
}
