import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success, error } from '@/lib/api-response'
import { getCurrentUser } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'
import crypto from 'crypto'
import path from 'path'
import { uploadFile, buildStoragePath, isGcsConfigured } from '@/lib/gcs'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/documents/[id]/files - list files for a document
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    const files = await prisma.documentFile.findMany({
      where: { documentId: id, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    })

    return success(files)
  } catch (err: any) {
    return error('FETCH_FAILED', 500)
  }
}

// POST /api/documents/[id]/files - upload a file to a document
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser(request)
    if (!user) return error('UNAUTHORIZED', 401)

    const { id: documentId } = await params

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) return error('FILE_REQUIRED', 400)

    // Validate file type
    const ALLOWED_MIME_TYPES = [
      'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/tiff',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ]
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return error('FILE_TYPE_NOT_ALLOWED', 400)
    }

    const MAX_FILE_SIZE = 20 * 1024 * 1024
    if (file.size > MAX_FILE_SIZE) {
      return error('FILE_TOO_LARGE', 400)
    }

    // Verify document exists
    const document = await prisma.employeeDocument.findUnique({
      where: { id: documentId },
      include: {
        employee: { select: { employeeNo: true } },
        documentType: { select: { code: true } },
      },
    })
    if (!document) return error('NOT_FOUND', 404)

    const buffer = Buffer.from(await file.arrayBuffer())
    const fileHash = crypto.createHash('md5').update(buffer).digest('hex')
    const ext = path.extname(file.name) || '.bin'
    const uniqueName = `${fileHash}${ext}`

    const latestFile = await prisma.documentFile.findFirst({
      where: { documentId },
      orderBy: { versionNo: 'desc' },
    })
    const versionNo = (latestFile?.versionNo || 0) + 1

    let storagePath: string
    let storageHash: string
    let size: number

    if (isGcsConfigured()) {
      const gcsPath = buildStoragePath(document.employee.employeeNo, document.documentType.code, uniqueName)
      const result = await uploadFile(buffer, gcsPath, file.type)
      storagePath = result.storagePath
      storageHash = result.storageHash
      size = result.size
    } else {
      const fs = await import('fs/promises')
      const localDir = path.join(process.cwd(), 'uploads', document.employee.employeeNo, document.documentType.code)
      await fs.mkdir(localDir, { recursive: true })
      const localPath = path.join(localDir, uniqueName)
      await fs.writeFile(localPath, buffer)
      storagePath = `uploads/${document.employee.employeeNo}/${document.documentType.code}/${uniqueName}`
      storageHash = fileHash
      size = buffer.length
    }

    const documentFile = await prisma.documentFile.create({
      data: {
        documentId,
        fileName: uniqueName,
        originalName: file.name,
        mimeType: file.type,
        size,
        storagePath,
        storageHash,
        versionNo,
        uploadedById: user.id,
      },
    })

    await createAuditLog({
      userId: user.id,
      action: 'UPLOAD',
      entity: 'DocumentFile',
      entityId: documentFile.id,
      newValues: { documentId, fileName: file.name, size, versionNo },
    })

    return success(documentFile, 201)
  } catch (err: any) {
    console.error('File upload error:', err)
    return error('UPLOAD_FAILED', 500)
  }
}
