import { prisma } from './prisma'

interface AuditParams {
  userId?: string
  action: string
  entity: string
  entityId?: string
  oldValues?: any
  newValues?: any
  ipAddress?: string
  userAgent?: string
}

export async function createAuditLog(params: AuditParams) {
  return prisma.auditLog.create({ data: params })
}
