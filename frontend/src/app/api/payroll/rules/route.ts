import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success, error } from '@/lib/api-response'
import { createAuditLog } from '@/lib/audit'
import { getCurrentUser } from '@/lib/auth'

// ==================== GET /api/payroll/rules ====================
// List payroll rules with current versions

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category') || ''
    const isActive = searchParams.get('isActive')

    const where: Record<string, unknown> = {}
    if (category) where.category = category
    if (isActive !== null && isActive !== '') where.isActive = isActive === 'true'

    const rules = await prisma.payrollRule.findMany({
      where: where as any,
      orderBy: [{ category: 'asc' }, { code: 'asc' }],
      include: {
        versions: {
          orderBy: { effectiveFrom: 'desc' },
          take: 1,
        },
      },
    })

    // Flatten: attach current version info directly
    const data = rules.map((rule: any) => ({
      ...rule,
      currentVersion: rule.versions[0] || null,
      versions: undefined,
    }))

    return success(data)
  } catch (err) {
    console.error('GET /api/payroll/rules error:', err)
    return error('FETCH_FAILED', 500)
  }
}

// ==================== POST /api/payroll/rules ====================
// Create payroll rule with initial version

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    if (!user) return error('UNAUTHORIZED', 401)

    const body = await request.json()
    const { code, nameTr, nameRu, nameEn, category, rate, isPercentage, effectiveFrom, minBase, maxBase, notes } = body

    if (!code || !nameTr || !nameRu || !nameEn || !category) {
      return error('FIELDS_REQUIRED', 400)
    }

    if (rate === undefined || effectiveFrom === undefined) {
      return error('FIELDS_REQUIRED', 400)
    }

    const existing = await prisma.payrollRule.findUnique({
      where: { code },
    })
    if (existing) {
      return error('ALREADY_EXISTS', 409)
    }

    const rule = await prisma.payrollRule.create({
      data: {
        code,
        nameTr,
        nameRu,
        nameEn,
        category,
        isActive: body.isActive ?? true,
        versions: {
          create: {
            rate,
            isPercentage: isPercentage ?? true,
            effectiveFrom: new Date(effectiveFrom),
            minBase: minBase ?? null,
            maxBase: maxBase ?? null,
            notes: notes || null,
            createdById: user.id,
          },
        },
      },
      include: {
        versions: {
          orderBy: { effectiveFrom: 'desc' },
          take: 1,
        },
      },
    })

    await createAuditLog({
      userId: user.id,
      action: 'CREATE',
      entity: 'PayrollRule',
      entityId: rule.id,
      newValues: body,
    })

    return success({
      ...rule,
      currentVersion: rule.versions[0] || null,
    }, 201)
  } catch (err) {
    console.error('POST /api/payroll/rules error:', err)
    return error('CREATE_FAILED', 500)
  }
}
