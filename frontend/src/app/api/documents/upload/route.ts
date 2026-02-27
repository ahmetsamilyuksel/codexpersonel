import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success, error } from '@/lib/api-response'
import { createAuditLog } from '@/lib/audit'
import { getCurrentUser } from '@/lib/auth'
import { uploadFile, buildStoragePath, isGcsConfigured } from '@/lib/gcs'
import crypto from 'crypto'
import path from 'path'

// Allowed file types
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/tiff',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]

const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    if (!user) return error('UNAUTHORIZED', 401)

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const documentId = formData.get('documentId') as string | null
    const employeeId = formData.get('employeeId') as string | null

    if (!file) return error('FILE_REQUIRED', 400)
    if (!documentId) return error('FIELDS_REQUIRED', 400)

    // Validate file type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return error('FILE_TYPE_NOT_ALLOWED', 400)
    }

    // Validate file size
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

    // Get current version number
    const latestFile = await prisma.documentFile.findFirst({
      where: { documentId },
      orderBy: { versionNo: 'desc' },
    })
    const versionNo = (latestFile?.versionNo || 0) + 1

    let storagePath: string
    let storageHash: string
    let size: number

    if (isGcsConfigured()) {
      // Upload to GCS
      const gcsPath = buildStoragePath(
        document.employee.employeeNo,
        document.documentType.code,
        uniqueName
      )
      const result = await uploadFile(buffer, gcsPath, file.type)
      storagePath = result.storagePath
      storageHash = result.storageHash
      size = result.size
    } else {
      // Local storage fallback for development
      const fs = await import('fs/promises')
      const localDir = path.join(process.cwd(), 'uploads', document.employee.employeeNo, document.documentType.code)
      await fs.mkdir(localDir, { recursive: true })
      const localPath = path.join(localDir, uniqueName)
      await fs.writeFile(localPath, buffer)
      storagePath = `uploads/${document.employee.employeeNo}/${document.documentType.code}/${uniqueName}`
      storageHash = fileHash
      size = buffer.length
    }

    // Save file record
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
      newValues: {
        documentId,
        employeeId,
        fileName: file.name,
        mimeType: file.type,
        size,
        versionNo,
      },
    })

    return success(documentFile, 201)
  } catch (err) {
    console.error('File upload error:', err)
    return error('UPLOAD_FAILED', 500)
  }
}
