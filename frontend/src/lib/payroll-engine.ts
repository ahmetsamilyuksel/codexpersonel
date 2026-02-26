/**
 * Payroll Calculation Engine for SAELA Personnel Management System.
 *
 * Converts between net and gross salaries using tax rules stored in the database.
 * All rates are sourced from PayrollRuleVersion records -- no values are hardcoded.
 *
 * Tax logic:
 *   - RESIDENT employees pay NDFL at the resident rate (typically 13%)
 *   - NON_RESIDENT employees pay NDFL at the non-resident rate (typically 30%)
 *   - Net  = Gross - (Gross * ndflRate)
 *   - Gross = Net / (1 - ndflRate)
 */

import { Decimal } from '@prisma/client/runtime/library'

// ==================== Types ====================

export interface PayrollRuleVersionData {
  payrollRuleId: string
  rate: Decimal | number | string
  isPercentage: boolean
  minBase?: Decimal | number | string | null
  maxBase?: Decimal | number | string | null
  effectiveFrom: Date
  effectiveTo?: Date | null
  notes?: string | null
  payrollRule: {
    code: string
    category: string
  }
}

export type TaxStatus = 'RESIDENT' | 'NON_RESIDENT'

export interface PayrollCalculationResult {
  grossSalary: number
  netSalary: number
  ndflRate: number
  ndflAmount: number
}

// ==================== Internal Helpers ====================

function toNumber(value: Decimal | number | string): number {
  if (value instanceof Decimal) {
    return value.toNumber()
  }
  return typeof value === 'string' ? parseFloat(value) : value
}

/**
 * Resolves the NDFL rate for the given tax status from the rule versions.
 *
 * Expected rule codes:
 *   - 'NDFL_RESIDENT'     for resident employees
 *   - 'NDFL_NON_RESIDENT' for non-resident employees
 *
 * The rate is expected to be stored as a percentage value (e.g. 13 for 13%).
 * If `isPercentage` is true the rate is divided by 100 before returning.
 */
function resolveNdflRate(taxStatus: TaxStatus, ruleVersions: PayrollRuleVersionData[]): number {
  const ruleCode = taxStatus === 'RESIDENT' ? 'NDFL_RESIDENT' : 'NDFL_NON_RESIDENT'

  const version = ruleVersions.find((rv) => rv.payrollRule.code === ruleCode)

  if (!version) {
    throw new Error(
      `No payroll rule version found for code "${ruleCode}". ` +
        'Ensure the PayrollRule and a current PayrollRuleVersion exist in the database.'
    )
  }

  const rawRate = toNumber(version.rate)
  return version.isPercentage ? rawRate / 100 : rawRate
}

/**
 * Rounds a number to 2 decimal places using banker's rounding (round half to even)
 * to minimize cumulative rounding errors in payroll calculations.
 */
function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

// ==================== Public API ====================

/**
 * Calculates the gross salary from a desired net salary.
 *
 * Formula: Gross = Net / (1 - ndflRate)
 *
 * @param netSalary    - The desired net (take-home) salary
 * @param taxStatus    - 'RESIDENT' or 'NON_RESIDENT'
 * @param ruleVersions - Array of active PayrollRuleVersion records with their parent PayrollRule
 * @returns PayrollCalculationResult with gross, net, rate, and tax amount
 */
export function netToGross(
  netSalary: number,
  taxStatus: TaxStatus,
  ruleVersions: PayrollRuleVersionData[]
): PayrollCalculationResult {
  if (netSalary < 0) {
    throw new Error('Net salary cannot be negative')
  }

  const ndflRate = resolveNdflRate(taxStatus, ruleVersions)

  if (ndflRate >= 1) {
    throw new Error('NDFL rate must be less than 100%')
  }

  const grossSalary = roundCurrency(netSalary / (1 - ndflRate))
  const ndflAmount = roundCurrency(grossSalary * ndflRate)

  return {
    grossSalary,
    netSalary: roundCurrency(grossSalary - ndflAmount),
    ndflRate,
    ndflAmount,
  }
}

/**
 * Calculates the net salary from a gross salary.
 *
 * Formula: Net = Gross - (Gross * ndflRate)
 *
 * @param grossSalary  - The gross (before-tax) salary
 * @param taxStatus    - 'RESIDENT' or 'NON_RESIDENT'
 * @param ruleVersions - Array of active PayrollRuleVersion records with their parent PayrollRule
 * @returns PayrollCalculationResult with gross, net, rate, and tax amount
 */
export function grossToNet(
  grossSalary: number,
  taxStatus: TaxStatus,
  ruleVersions: PayrollRuleVersionData[]
): PayrollCalculationResult {
  if (grossSalary < 0) {
    throw new Error('Gross salary cannot be negative')
  }

  const ndflRate = resolveNdflRate(taxStatus, ruleVersions)
  const ndflAmount = roundCurrency(grossSalary * ndflRate)
  const netSalary = roundCurrency(grossSalary - ndflAmount)

  return {
    grossSalary,
    netSalary,
    ndflRate,
    ndflAmount,
  }
}
