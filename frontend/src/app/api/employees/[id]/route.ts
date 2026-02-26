import { NextRequest } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { success, error } from '@/lib/api-response'
import { createAuditLog } from '@/lib/audit'

type TransactionClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

interface RouteParams {
  params: Promise<{ id: string }>
}

// ==================== GET /api/employees/[id] ====================
// Get a single employee with ALL relations

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    const employee = await prisma.employee.findUnique({
      where: { id, deletedAt: null },
      include: {
        nationality: true,
        profession: true,
        department: true,
        createdBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        updatedBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        identity: true,
        workStatus: true,
        employment: {
          include: {
            worksite: {
              select: {
                id: true,
                code: true,
                name: true,
                city: true,
                region: true,
                status: true,
              },
            },
            shift: {
              select: {
                id: true,
                code: true,
                nameTr: true,
                nameRu: true,
                nameEn: true,
                startTime: true,
                endTime: true,
                breakMinutes: true,
                isNightShift: true,
              },
            },
          },
        },
        salaryProfile: true,
        contacts: {
          orderBy: { createdAt: 'asc' },
        },
        documents: {
          where: { deletedAt: null },
          include: {
            files: {
              where: { deletedAt: null },
              orderBy: { createdAt: 'desc' },
            },
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
          },
          orderBy: { createdAt: 'desc' },
        },
        alerts: {
          where: {
            isDismissed: false,
            resolvedAt: null,
          },
          include: {
            alertRule: {
              select: {
                id: true,
                code: true,
                nameTr: true,
                nameRu: true,
                nameEn: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        attendances: {
          orderBy: { date: 'desc' },
          take: 30,
          select: {
            id: true,
            date: true,
            checkIn: true,
            checkOut: true,
            totalHours: true,
            overtimeHours: true,
            nightHours: true,
            attendanceType: true,
            worksiteId: true,
            notes: true,
          },
        },
        leaveBalances: {
          include: {
            leaveType: {
              select: {
                id: true,
                code: true,
                nameTr: true,
                nameRu: true,
                nameEn: true,
                isPaid: true,
              },
            },
          },
          orderBy: [{ year: 'desc' }, { leaveType: { sortOrder: 'asc' } }],
        },
        assetAssignments: {
          where: { returnDate: null },
          include: {
            asset: {
              select: {
                id: true,
                assetNo: true,
                name: true,
                brand: true,
                model: true,
                serialNo: true,
                status: true,
                photoUrl: true,
              },
            },
          },
          orderBy: { assignedDate: 'desc' },
        },
        customFieldValues: {
          include: {
            definition: {
              select: {
                id: true,
                fieldKey: true,
                labelTr: true,
                labelRu: true,
                labelEn: true,
                fieldType: true,
                options: true,
                isRequired: true,
                section: true,
                sortOrder: true,
              },
            },
          },
          orderBy: {
            definition: { sortOrder: 'asc' },
          },
        },
        patentPayments: {
          orderBy: [{ year: 'desc' }, { month: 'desc' }],
        },
      },
    })

    if (!employee) {
      return error('Employee not found', 404)
    }

    return success(employee)
  } catch (err: any) {
    console.error(`GET /api/employees/${(await params).id} error:`, err)
    return error(err.message || 'Failed to fetch employee', 500)
  }
}

// ==================== PUT /api/employees/[id] ====================
// Update employee main fields and optionally upsert related records.
// Tracks changes in audit log with old vs new values.

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const body = await request.json()

    const {
      identity,
      workStatus,
      employment,
      salaryProfile,
      ...employeeData
    } = body

    // Fetch existing employee for change tracking
    const existing = await prisma.employee.findUnique({
      where: { id, deletedAt: null },
      include: {
        identity: true,
        workStatus: true,
        employment: true,
        salaryProfile: true,
      },
    })

    if (!existing) {
      return error('Employee not found', 404)
    }

    // Build the update transaction
    const employee = await prisma.$transaction(async (tx: TransactionClient) => {
      // Update main employee fields
      const updated = await tx.employee.update({
        where: { id },
        data: employeeData,
      })

      // Upsert identity if provided
      if (identity !== undefined) {
        await tx.employeeIdentity.upsert({
          where: { employeeId: id },
          create: { ...identity, employeeId: id },
          update: identity,
        })
      }

      // Upsert work status if provided
      if (workStatus !== undefined) {
        await tx.employeeWorkStatus.upsert({
          where: { employeeId: id },
          create: { ...workStatus, employeeId: id },
          update: workStatus,
        })
      }

      // Upsert employment if provided
      if (employment !== undefined) {
        await tx.employeeEmployment.upsert({
          where: { employeeId: id },
          create: { ...employment, employeeId: id },
          update: employment,
        })
      }

      // Upsert salary profile if provided
      if (salaryProfile !== undefined) {
        await tx.employeeSalaryProfile.upsert({
          where: { employeeId: id },
          create: { ...salaryProfile, employeeId: id },
          update: salaryProfile,
        })
      }

      // Return full employee with relations
      return tx.employee.findUnique({
        where: { id },
        include: {
          nationality: true,
          profession: true,
          department: true,
          identity: true,
          workStatus: true,
          employment: {
            include: { worksite: true, shift: true },
          },
          salaryProfile: true,
        },
      })
    })

    // Build old/new values for audit
    const oldValues: Record<string, any> = {}
    const newValues: Record<string, any> = {}

    // Track changes in main employee fields
    for (const [key, newVal] of Object.entries(employeeData)) {
      const oldVal = (existing as any)[key]
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        oldValues[key] = oldVal
        newValues[key] = newVal
      }
    }

    // Track changes in nested relations
    if (identity !== undefined && existing.identity) {
      for (const [key, newVal] of Object.entries(identity)) {
        const oldVal = (existing.identity as any)[key]
        if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
          oldValues[`identity.${key}`] = oldVal
          newValues[`identity.${key}`] = newVal
        }
      }
    }

    if (workStatus !== undefined && existing.workStatus) {
      for (const [key, newVal] of Object.entries(workStatus)) {
        const oldVal = (existing.workStatus as any)[key]
        if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
          oldValues[`workStatus.${key}`] = oldVal
          newValues[`workStatus.${key}`] = newVal
        }
      }
    }

    if (employment !== undefined && existing.employment) {
      for (const [key, newVal] of Object.entries(employment)) {
        const oldVal = (existing.employment as any)[key]
        if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
          oldValues[`employment.${key}`] = oldVal
          newValues[`employment.${key}`] = newVal
        }
      }
    }

    if (salaryProfile !== undefined && existing.salaryProfile) {
      for (const [key, newVal] of Object.entries(salaryProfile)) {
        const oldVal = (existing.salaryProfile as any)[key]
        if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
          oldValues[`salaryProfile.${key}`] = oldVal
          newValues[`salaryProfile.${key}`] = newVal
        }
      }
    }

    // Only create audit log if there were actual changes
    if (Object.keys(newValues).length > 0) {
      await createAuditLog({
        action: 'UPDATE',
        entity: 'Employee',
        entityId: id,
        oldValues,
        newValues,
      })
    }

    return success(employee)
  } catch (err: any) {
    console.error(`PUT /api/employees error:`, err)

    if (err.code === 'P2002') {
      return error('A unique constraint violation occurred', 409)
    }

    return error(err.message || 'Failed to update employee', 500)
  }
}

// ==================== DELETE /api/employees/[id] ====================
// Soft delete - sets deletedAt timestamp

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    const existing = await prisma.employee.findUnique({
      where: { id, deletedAt: null },
    })

    if (!existing) {
      return error('Employee not found', 404)
    }

    await prisma.employee.update({
      where: { id },
      data: { deletedAt: new Date() },
    })

    await createAuditLog({
      action: 'DELETE',
      entity: 'Employee',
      entityId: id,
      oldValues: { status: existing.status },
      newValues: { deletedAt: new Date().toISOString() },
    })

    return success({ message: 'Employee deleted successfully' })
  } catch (err: any) {
    console.error(`DELETE /api/employees error:`, err)
    return error(err.message || 'Failed to delete employee', 500)
  }
}
