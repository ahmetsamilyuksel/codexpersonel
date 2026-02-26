import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success, error } from '@/lib/api-response'
import { createAuditLog } from '@/lib/audit'

interface RouteParams {
  params: Promise<{ id: string }>
}

// ==================== GET /api/employees/[id]/documents ====================
// List all documents for an employee with files and document type info

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    // Verify employee exists
    const employee = await prisma.employee.findUnique({
      where: { id, deletedAt: null },
      select: { id: true },
    })

    if (!employee) {
      return error('Employee not found', 404)
    }

    const documents = await prisma.employeeDocument.findMany({
      where: {
        employeeId: id,
        deletedAt: null,
      },
      include: {
        documentType: {
          select: {
            id: true,
            code: true,
            nameTr: true,
            nameRu: true,
            nameEn: true,
            category: true,
            hasExpiry: true,
            defaultAlertDays: true,
          },
        },
        files: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            fileName: true,
            originalName: true,
            mimeType: true,
            size: true,
            storagePath: true,
            versionNo: true,
            uploadedById: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return success(documents)
  } catch (err: any) {
    console.error('GET /api/employees/[id]/documents error:', err)
    return error(err.message || 'Failed to fetch documents', 500)
  }
}

// ==================== POST /api/employees/[id]/documents ====================
// Create a new document record for an employee

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const body = await request.json()

    // Verify employee exists
    const employee = await prisma.employee.findUnique({
      where: { id, deletedAt: null },
      select: { id: true },
    })

    if (!employee) {
      return error('Employee not found', 404)
    }

    // Validate required fields
    if (!body.documentTypeId) {
      return error('documentTypeId is required', 400)
    }

    // Verify the document type exists
    const documentType = await prisma.documentType.findUnique({
      where: { id: body.documentTypeId },
      select: { id: true, code: true, hasExpiry: true },
    })

    if (!documentType) {
      return error('Document type not found', 400)
    }

    // Extract files data if provided (for nested create)
    const { files, ...documentData } = body

    const document = await prisma.employeeDocument.create({
      data: {
        employeeId: id,
        documentTypeId: documentData.documentTypeId,
        documentNo: documentData.documentNo || null,
        documentName: documentData.documentName || null,
        issuedBy: documentData.issuedBy || null,
        issueDate: documentData.issueDate ? new Date(documentData.issueDate) : null,
        expiryDate: documentData.expiryDate ? new Date(documentData.expiryDate) : null,
        description: documentData.description || null,
        isVerified: documentData.isVerified || false,
        alertDaysOverride: documentData.alertDaysOverride || null,
        versionNo: documentData.versionNo || 1,
        createdById: documentData.createdById || null,
        // Optionally create attached files
        ...(files && files.length > 0
          ? {
              files: {
                create: files.map((file: any) => ({
                  fileName: file.fileName,
                  originalName: file.originalName,
                  mimeType: file.mimeType,
                  size: file.size,
                  storagePath: file.storagePath,
                  storageHash: file.storageHash || null,
                  versionNo: file.versionNo || 1,
                  uploadedById: file.uploadedById || null,
                })),
              },
            }
          : {}),
      },
      include: {
        documentType: {
          select: {
            id: true,
            code: true,
            nameTr: true,
            nameRu: true,
            nameEn: true,
            category: true,
            hasExpiry: true,
          },
        },
        files: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    // Audit log
    await createAuditLog({
      action: 'CREATE',
      entity: 'EmployeeDocument',
      entityId: document.id,
      newValues: {
        employeeId: id,
        documentTypeId: body.documentTypeId,
        documentNo: body.documentNo,
        documentName: body.documentName,
      },
    })

    return success(document, 201)
  } catch (err: any) {
    console.error('POST /api/employees/[id]/documents error:', err)
    return error(err.message || 'Failed to create document', 500)
  }
}
