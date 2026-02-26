import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { error } from '@/lib/api-response'
import { getCurrentUser } from '@/lib/auth'
import { getSignedUrl, isGcsConfigured } from '@/lib/gcs'
import path from 'path'

interface RouteParams {
  params: Promise<{ fileId: string }>
}

// GET /api/documents/files/[fileId] - download/serve a file
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser(request)
    if (!user) return error('Unauthorized', 401)

    const { fileId } = await params

    const file = await prisma.documentFile.findUnique({
      where: { id: fileId, deletedAt: null },
    })

    if (!file) return error('File not found', 404)

    if (isGcsConfigured()) {
      const signedUrl = await getSignedUrl(file.storagePath, 60)
      return NextResponse.redirect(signedUrl)
    } else {
      // Local file serving
      const fs = await import('fs/promises')
      const filePath = path.join(process.cwd(), file.storagePath)
      try {
        const buffer = await fs.readFile(filePath)
        return new NextResponse(buffer, {
          headers: {
            'Content-Type': file.mimeType,
            'Content-Disposition': `inline; filename="${encodeURIComponent(file.originalName)}"`,
            'Content-Length': String(file.size),
          },
        })
      } catch {
        return error('File not found on disk', 404)
      }
    }
  } catch (err: any) {
    return error(err.message || 'Failed to serve file', 500)
  }
}

// DELETE /api/documents/files/[fileId] - soft delete a file
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser(request)
    if (!user) return error('Unauthorized', 401)

    const { fileId } = await params

    const file = await prisma.documentFile.findUnique({
      where: { id: fileId, deletedAt: null },
    })

    if (!file) return error('File not found', 404)

    await prisma.documentFile.update({
      where: { id: fileId },
      data: { deletedAt: new Date() },
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return error(err.message || 'Failed to delete file', 500)
  }
}
