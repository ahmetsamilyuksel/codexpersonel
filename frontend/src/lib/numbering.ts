import { prisma } from './prisma'

export async function generateNumber(entity: string): Promise<string> {
  const result = await prisma.$transaction(async (tx) => {
    const rule = await tx.numberingRule.findUnique({ where: { entity } })
    if (!rule) throw new Error(`No numbering rule for entity: ${entity}`)

    const nextNumber = rule.lastNumber + 1

    await tx.numberingRule.update({
      where: { entity },
      data: { lastNumber: nextNumber },
    })

    return `${rule.prefix}${String(nextNumber).padStart(rule.padLength, '0')}`
  })

  return result
}
