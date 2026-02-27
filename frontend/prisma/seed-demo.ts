/**
 * DEMO SEED DATA
 * Creates 25+ demo employees across multiple worksites with different
 * nationalities, professions, salary types, attendance records, etc.
 *
 * Run: npx ts-node prisma/seed-demo.ts
 * Cleanup: npx ts-node prisma/seed-demo.ts --cleanup
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const DEMO_PREFIX = 'DEMO-'

// Helper to generate employee numbers
const empNo = (n: number) => `${DEMO_PREFIX}${String(n).padStart(4, '0')}`

async function cleanup() {
  console.log('🧹 Cleaning up demo data...')

  // Delete in reverse dependency order
  await prisma.attendanceRecord.deleteMany({
    where: { employee: { employeeNo: { startsWith: DEMO_PREFIX } } },
  })
  await prisma.leaveRequest.deleteMany({
    where: { employee: { employeeNo: { startsWith: DEMO_PREFIX } } },
  })
  await prisma.leaveBalance.deleteMany({
    where: { employee: { employeeNo: { startsWith: DEMO_PREFIX } } },
  })
  await prisma.assetAssignment.deleteMany({
    where: { employee: { employeeNo: { startsWith: DEMO_PREFIX } } },
  })
  await prisma.employeeSiteTransfer.deleteMany({
    where: { employee: { employeeNo: { startsWith: DEMO_PREFIX } } },
  })
  await prisma.payrollItem.deleteMany({
    where: { employee: { employeeNo: { startsWith: DEMO_PREFIX } } },
  })
  await prisma.patentPayment.deleteMany({
    where: { employee: { employeeNo: { startsWith: DEMO_PREFIX } } },
  })
  await prisma.alert.deleteMany({
    where: { employee: { employeeNo: { startsWith: DEMO_PREFIX } } },
  })
  await prisma.hakkedisSatir.deleteMany({
    where: { employee: { employeeNo: { startsWith: DEMO_PREFIX } } },
  })
  await prisma.customFieldValue.deleteMany({
    where: { employee: { employeeNo: { startsWith: DEMO_PREFIX } } },
  })

  // Delete documents and files for demo employees
  const demoEmployees = await prisma.employee.findMany({
    where: { employeeNo: { startsWith: DEMO_PREFIX } },
    include: { documents: { include: { files: true } } },
  })
  for (const emp of demoEmployees) {
    for (const doc of emp.documents) {
      await prisma.documentFile.deleteMany({ where: { documentId: doc.id } })
    }
    await prisma.employeeDocument.deleteMany({ where: { employeeId: emp.id } })
  }

  // Delete salary profiles, employment, identity, work status, contacts
  await prisma.employeeSalaryProfile.deleteMany({
    where: { employee: { employeeNo: { startsWith: DEMO_PREFIX } } },
  })
  await prisma.employeeEmployment.deleteMany({
    where: { employee: { employeeNo: { startsWith: DEMO_PREFIX } } },
  })
  await prisma.employeeIdentity.deleteMany({
    where: { employee: { employeeNo: { startsWith: DEMO_PREFIX } } },
  })
  await prisma.employeeWorkStatus.deleteMany({
    where: { employee: { employeeNo: { startsWith: DEMO_PREFIX } } },
  })
  await prisma.employeeContact.deleteMany({
    where: { employee: { employeeNo: { startsWith: DEMO_PREFIX } } },
  })

  // Delete demo employees
  await prisma.employee.deleteMany({
    where: { employeeNo: { startsWith: DEMO_PREFIX } },
  })

  // Delete demo assets
  await prisma.asset.deleteMany({
    where: { assetNo: { startsWith: DEMO_PREFIX } },
  })

  // Delete demo worksites (only ones created by demo)
  await prisma.worksite.deleteMany({
    where: { code: { in: ['DEMO-ANK', 'DEMO-IZM', 'DEMO-KAZ'] } },
  })

  // Delete demo payroll runs (linked to demo worksites)
  await prisma.payrollRun.deleteMany({
    where: { worksite: { code: { in: ['DEMO-ANK', 'DEMO-IZM', 'DEMO-KAZ'] } } },
  })

  // Delete demo attendance periods (linked to demo worksites)
  await prisma.attendancePeriod.deleteMany({
    where: { worksite: { code: { in: ['DEMO-ANK', 'DEMO-IZM', 'DEMO-KAZ'] } } },
  })

  console.log('✅ Demo data cleaned up successfully!')
}

async function seedDemo() {
  console.log('🌱 Creating comprehensive demo data...')

  // Get existing reference data
  const nationalities = await prisma.nationality.findMany()
  const professions = await prisma.profession.findMany()
  const departments = await prisma.department.findMany()
  const shifts = await prisma.shift.findMany()
  const employeeTypes = await prisma.employeeType.findMany()
  const documentTypes = await prisma.documentType.findMany()
  const leaveTypes = await prisma.leaveType.findMany()
  const assetCategories = await prisma.assetCategory.findMany()

  const getNatId = (code: string) => nationalities.find((n) => n.code === code)?.id
  const getProfId = (code: string) => professions.find((p) => p.code === code)?.id
  const getDeptId = (code: string) => departments.find((d) => d.code === code)?.id
  const getShiftId = (code: string) => shifts.find((s) => s.code === code)?.id
  const getEmpTypeId = (code: string) => employeeTypes.find((e) => e.code === code)?.id

  // ==================== DEMO WORKSITES ====================
  const demoWorksites = [
    {
      code: 'DEMO-ANK',
      name: 'Ankara - Hastane İnşaatı',
      address: 'Çankaya, Ankara',
      city: 'Ankara',
      region: 'İç Anadolu',
      startDate: new Date('2024-03-01'),
      projectManager: 'Ali Kaya',
      siteManager: 'Murat Özdemir',
      client: 'Sağlık Bakanlığı',
      status: 'ACTIVE',
    },
    {
      code: 'DEMO-IZM',
      name: 'İzmir - AVM Projesi',
      address: 'Konak, İzmir',
      city: 'İzmir',
      region: 'Ege',
      startDate: new Date('2024-07-15'),
      projectManager: 'Hasan Çelik',
      siteManager: 'Kemal Aydın',
      client: 'ABC Holding',
      status: 'ACTIVE',
    },
    {
      code: 'DEMO-KAZ',
      name: 'Казань - Жилой Комплекс Ривьера',
      address: 'ул. Пушкина, д. 42, Казань',
      city: 'Казань',
      region: 'Республика Татарстан',
      startDate: new Date('2025-01-10'),
      projectManager: 'Osman Yıldız',
      siteManager: 'Дмитрий Волков',
      client: 'ООО "Казань-Строй"',
      status: 'ACTIVE',
    },
  ]

  const worksiteIds: Record<string, string> = {}
  for (const ws of demoWorksites) {
    const result = await prisma.worksite.upsert({
      where: { code: ws.code },
      update: {},
      create: ws,
    })
    worksiteIds[ws.code] = result.id
  }

  // Also get existing worksites
  const existingWorksites = await prisma.worksite.findMany()
  for (const ws of existingWorksites) {
    worksiteIds[ws.code] = ws.id
  }

  console.log('✅ Demo worksites created')

  // ==================== DEMO EMPLOYEES ====================
  const demoEmployees = [
    // Ankara şantiyesi - Türk işçiler
    { no: 1, fn: 'Ahmet', ln: 'Yılmaz', pat: '', gender: 'MALE', birth: '1985-03-15', nat: 'TR', prof: 'WELDER', dept: 'CONSTRUCTION', ws: 'DEMO-ANK', wsType: 'LOCAL', salary: 85000, payType: 'MONTHLY' },
    { no: 2, fn: 'Mehmet', ln: 'Kaya', pat: '', gender: 'MALE', birth: '1990-07-22', nat: 'TR', prof: 'ELECTRICIAN', dept: 'ELECTRICAL', ws: 'DEMO-ANK', wsType: 'LOCAL', salary: 78000, payType: 'MONTHLY' },
    { no: 3, fn: 'Fatma', ln: 'Demir', pat: '', gender: 'FEMALE', birth: '1988-11-10', nat: 'TR', prof: 'ENGINEER', dept: 'ENGINEERING', ws: 'DEMO-ANK', wsType: 'LOCAL', salary: 120000, payType: 'MONTHLY' },
    { no: 4, fn: 'Ali', ln: 'Çelik', pat: '', gender: 'MALE', birth: '1992-05-03', nat: 'TR', prof: 'PLUMBER', dept: 'MECHANICAL', ws: 'DEMO-ANK', wsType: 'LOCAL', salary: 72000, payType: 'MONTHLY' },
    { no: 5, fn: 'Ayşe', ln: 'Öztürk', pat: '', gender: 'FEMALE', birth: '1995-09-18', nat: 'TR', prof: 'ADMIN', dept: 'ADMIN', ws: 'DEMO-ANK', wsType: 'LOCAL', salary: 55000, payType: 'MONTHLY' },

    // Ankara - Özbek işçiler (Patent)
    { no: 6, fn: 'Rustam', ln: 'Karimov', pat: 'Akbarovich', gender: 'MALE', birth: '1987-02-14', nat: 'UZ', prof: 'MASON', dept: 'CONSTRUCTION', ws: 'DEMO-ANK', wsType: 'PATENT', salary: 350, payType: 'HOURLY' },
    { no: 7, fn: 'Dilshod', ln: 'Rakhimov', pat: 'Bahodirovich', gender: 'MALE', birth: '1993-08-25', nat: 'UZ', prof: 'LABORER', dept: 'CONSTRUCTION', ws: 'DEMO-ANK', wsType: 'PATENT', salary: 280, payType: 'HOURLY' },
    { no: 8, fn: 'Sherzod', ln: 'Tashmatov', pat: 'Yusufovich', gender: 'MALE', birth: '1991-12-07', nat: 'UZ', prof: 'PAINTER', dept: 'FINISHING', ws: 'DEMO-ANK', wsType: 'PATENT', salary: 300, payType: 'HOURLY' },

    // İzmir şantiyesi - Karışık milletler
    { no: 9, fn: 'Sergey', ln: 'Ivanov', pat: 'Petrovich', gender: 'MALE', birth: '1986-04-20', nat: 'RU', prof: 'FOREMAN', dept: 'CONSTRUCTION', ws: 'DEMO-IZM', wsType: 'VISA', salary: 95000, payType: 'MONTHLY' },
    { no: 10, fn: 'Nikolay', ln: 'Petrov', pat: 'Alexandrovich', gender: 'MALE', birth: '1989-06-11', nat: 'RU', prof: 'WELDER', dept: 'CONSTRUCTION', ws: 'DEMO-IZM', wsType: 'VISA', salary: 88000, payType: 'MONTHLY' },
    { no: 11, fn: 'Bakyt', ln: 'Asanov', pat: 'Ermekovich', gender: 'MALE', birth: '1994-01-30', nat: 'KG', prof: 'MASON', dept: 'CONSTRUCTION', ws: 'DEMO-IZM', wsType: 'PATENT', salary: 320, payType: 'HOURLY' },
    { no: 12, fn: 'Nurmuhammed', ln: 'Durdyev', pat: 'Myratovich', gender: 'MALE', birth: '1996-10-05', nat: 'TM', prof: 'LABORER', dept: 'CONSTRUCTION', ws: 'DEMO-IZM', wsType: 'PATENT', salary: 260, payType: 'HOURLY' },
    { no: 13, fn: 'Aslan', ln: 'Mammadov', pat: 'Eldarovich', gender: 'MALE', birth: '1988-07-19', nat: 'AZ', prof: 'ELECTRICIAN', dept: 'ELECTRICAL', ws: 'DEMO-IZM', wsType: 'WORK_PERMIT', salary: 82000, payType: 'MONTHLY' },
    { no: 14, fn: 'Hüseyin', ln: 'Şahin', pat: '', gender: 'MALE', birth: '1991-03-22', nat: 'TR', prof: 'CRANE_OP', dept: 'MACHINERY', ws: 'DEMO-IZM', wsType: 'LOCAL', salary: 400, payType: 'DAILY' },
    { no: 15, fn: 'Zeynep', ln: 'Arslan', pat: '', gender: 'FEMALE', birth: '1993-12-08', nat: 'TR', prof: 'SAFETY', dept: 'SAFETY', ws: 'DEMO-IZM', wsType: 'LOCAL', salary: 68000, payType: 'MONTHLY' },

    // Kazan şantiyesi - Orta Asya ağırlıklı
    { no: 16, fn: 'Timur', ln: 'Sultanov', pat: 'Rustamovich', gender: 'MALE', birth: '1990-05-14', nat: 'TJ', prof: 'MASON', dept: 'CONSTRUCTION', ws: 'DEMO-KAZ', wsType: 'PATENT', salary: 300, payType: 'HOURLY' },
    { no: 17, fn: 'Farkhod', ln: 'Normatov', pat: 'Abdurahimovich', gender: 'MALE', birth: '1988-09-27', nat: 'TJ', prof: 'LABORER', dept: 'CONSTRUCTION', ws: 'DEMO-KAZ', wsType: 'PATENT', salary: 250, payType: 'HOURLY' },
    { no: 18, fn: 'Jasur', ln: 'Mirzaev', pat: 'Anvarovich', gender: 'MALE', birth: '1995-11-03', nat: 'UZ', prof: 'PLUMBER', dept: 'MECHANICAL', ws: 'DEMO-KAZ', wsType: 'PATENT', salary: 330, payType: 'HOURLY' },
    { no: 19, fn: 'Marat', ln: 'Sadykov', pat: 'Nurlanovich', gender: 'MALE', birth: '1987-01-16', nat: 'KG', prof: 'WELDER', dept: 'CONSTRUCTION', ws: 'DEMO-KAZ', wsType: 'PATENT', salary: 370, payType: 'HOURLY' },
    { no: 20, fn: 'Osman', ln: 'Aydoğan', pat: '', gender: 'MALE', birth: '1984-08-09', nat: 'TR', prof: 'FOREMAN', dept: 'CONSTRUCTION', ws: 'DEMO-KAZ', wsType: 'LOCAL', salary: 110000, payType: 'MONTHLY' },
    { no: 21, fn: 'Erhan', ln: 'Yıldırım', pat: '', gender: 'MALE', birth: '1992-04-12', nat: 'TR', prof: 'ENGINEER', dept: 'ENGINEERING', ws: 'DEMO-KAZ', wsType: 'LOCAL', salary: 130000, payType: 'MONTHLY' },

    // MSK-01 mevcut şantiyeye ek çalışanlar
    { no: 22, fn: 'Abdulla', ln: 'Rahimov', pat: 'Farkhodovich', gender: 'MALE', birth: '1993-06-30', nat: 'UZ', prof: 'PAINTER', dept: 'FINISHING', ws: 'MSK-01', wsType: 'PATENT', salary: 290, payType: 'HOURLY' },
    { no: 23, fn: 'Davron', ln: 'Yusupov', pat: 'Ilhomovich', gender: 'MALE', birth: '1989-02-18', nat: 'UZ', prof: 'MASON', dept: 'CONSTRUCTION', ws: 'MSK-01', wsType: 'PATENT', salary: 340, payType: 'HOURLY' },
    { no: 24, fn: 'Murod', ln: 'Alimov', pat: 'Shavkatovich', gender: 'MALE', birth: '1991-10-25', nat: 'UZ', prof: 'LABORER', dept: 'CONSTRUCTION', ws: 'MSK-01', wsType: 'PATENT', salary: 270, payType: 'HOURLY' },
    { no: 25, fn: 'Viktor', ln: 'Sokolov', pat: 'Dmitrievich', gender: 'MALE', birth: '1986-12-01', nat: 'RU', prof: 'ELECTRICIAN', dept: 'ELECTRICAL', ws: 'MSK-01', wsType: 'LOCAL', salary: 90000, payType: 'MONTHLY' },

    // Pasif/izinli çalışanlar
    { no: 26, fn: 'Kamol', ln: 'Ergashev', pat: 'Olimovich', gender: 'MALE', birth: '1994-07-08', nat: 'UZ', prof: 'LABORER', dept: 'CONSTRUCTION', ws: 'DEMO-ANK', wsType: 'PATENT', salary: 260, payType: 'HOURLY', status: 'ON_LEAVE' },
    { no: 27, fn: 'Bekzod', ln: 'Tursunov', pat: 'Ulugbekovich', gender: 'MALE', birth: '1990-03-14', nat: 'UZ', prof: 'MASON', dept: 'CONSTRUCTION', ws: 'DEMO-IZM', wsType: 'PATENT', salary: 310, payType: 'HOURLY', status: 'TERMINATED' },
  ]

  const employeeIds: Record<number, string> = {}

  for (const emp of demoEmployees) {
    const employee = await prisma.employee.upsert({
      where: { employeeNo: empNo(emp.no) },
      update: {},
      create: {
        employeeNo: empNo(emp.no),
        firstName: emp.fn,
        lastName: emp.ln,
        patronymic: emp.pat || null,
        gender: emp.gender,
        birthDate: new Date(emp.birth),
        nationalityId: getNatId(emp.nat) || null,
        professionId: getProfId(emp.prof) || null,
        departmentId: getDeptId(emp.dept) || null,
        phone: `+7${String(9000000000 + emp.no * 1111111).slice(0, 10)}`,
        status: (emp as any).status || 'ACTIVE',
      },
    })
    employeeIds[emp.no] = employee.id

    // Create identity
    await prisma.employeeIdentity.upsert({
      where: { employeeId: employee.id },
      update: {},
      create: {
        employeeId: employee.id,
        passportNo: `${emp.nat}${String(10000000 + emp.no * 123456).slice(0, 8)}`,
        passportAuthority: emp.nat === 'TR' ? 'Nüfus Müdürlüğü' : emp.nat === 'RU' ? 'МВД России' : 'МВД',
        passportIssueDate: new Date('2020-01-15'),
        passportExpiryDate: emp.no <= 5 ? new Date('2030-01-15') : emp.no <= 8 ? new Date('2026-04-15') : new Date('2028-06-01'),
        snils: emp.nat === 'RU' ? `${String(100 + emp.no)}-${String(200 + emp.no)}-${String(300 + emp.no)} ${String(40 + emp.no)}` : null,
        inn: `77${String(10000000000 + emp.no * 111111111).slice(0, 10)}`,
        bankName: 'Сбербанк',
        bankAccountNo: `40817810${String(100000000000 + emp.no * 11111111111).slice(0, 12)}`,
      },
    })

    // Create work status
    await prisma.employeeWorkStatus.upsert({
      where: { employeeId: employee.id },
      update: {},
      create: {
        employeeId: employee.id,
        workStatusType: emp.wsType,
        russiaEntryDate: emp.wsType !== 'LOCAL' ? new Date('2024-06-01') : null,
        migrationCardNo: emp.wsType === 'PATENT' ? `${emp.no}MC${String(1000000 + emp.no)}` : null,
        migrationCardStart: emp.wsType === 'PATENT' ? new Date('2024-06-01') : null,
        migrationCardEnd: emp.wsType === 'PATENT' ? new Date('2025-06-01') : null,
        registrationAddress: emp.wsType !== 'LOCAL' ? 'г. Москва, ул. Тверская, д. 1' : null,
        registrationStart: emp.wsType !== 'LOCAL' ? new Date('2024-06-15') : null,
        registrationEnd: emp.wsType !== 'LOCAL' ? new Date('2025-06-15') : null,
        patentNo: emp.wsType === 'PATENT' ? `PAT-${String(100000 + emp.no)}` : null,
        patentRegion: emp.wsType === 'PATENT' ? 'Москва' : null,
        patentStart: emp.wsType === 'PATENT' ? new Date('2024-07-01') : null,
        patentEnd: emp.wsType === 'PATENT' ? new Date('2025-07-01') : null,
        visaNo: emp.wsType === 'VISA' ? `VISA-${String(200000 + emp.no)}` : null,
        visaStart: emp.wsType === 'VISA' ? new Date('2024-01-01') : null,
        visaEnd: emp.wsType === 'VISA' ? new Date('2025-12-31') : null,
        visaType: emp.wsType === 'VISA' ? 'WORK' : null,
        visaEntryType: emp.wsType === 'VISA' ? 'MULTI' : null,
      },
    })

    // Create employment
    const shiftId = getShiftId(emp.no % 3 === 0 ? 'NIGHT' : 'DAY') || getShiftId('DAY')
    await prisma.employeeEmployment.upsert({
      where: { employeeId: employee.id },
      update: {},
      create: {
        employeeId: employee.id,
        worksiteId: worksiteIds[emp.ws] || Object.values(worksiteIds)[0],
        shiftId: shiftId || null,
        hireDate: new Date(`2024-0${Math.min(emp.no % 9 + 1, 9)}-15`),
        actualStartDate: new Date(`2024-0${Math.min(emp.no % 9 + 1, 9)}-16`),
        contractType: emp.payType === 'MONTHLY' ? 'PERMANENT' : 'TEMPORARY',
        contractDate: new Date(`2024-0${Math.min(emp.no % 9 + 1, 9)}-14`),
      },
    })

    // Create salary profile
    const isMonthly = emp.payType === 'MONTHLY'
    await prisma.employeeSalaryProfile.upsert({
      where: { employeeId: employee.id },
      update: {},
      create: {
        employeeId: employee.id,
        paymentType: emp.payType,
        netSalary: isMonthly ? emp.salary : null,
        grossSalary: isMonthly ? Math.round(emp.salary * 1.149) : null,
        hourlyRate: emp.payType === 'HOURLY' ? emp.salary : null,
        dailyRate: emp.payType === 'DAILY' ? emp.salary : null,
        overtimeMultiplier: 1.5,
        nightMultiplier: 1.2,
        holidayMultiplier: 2.0,
        paymentMethod: isMonthly ? 'BANK' : 'CASH',
        taxStatus: emp.wsType === 'LOCAL' || emp.nat === 'RU' ? 'RESIDENT' : 'NON_RESIDENT',
        ndflRate: emp.wsType === 'LOCAL' || emp.nat === 'RU' ? 13 : 30,
        effectiveFrom: new Date('2024-01-01'),
      },
    })
  }
  console.log(`✅ ${demoEmployees.length} demo employees created with identity, work status, employment, salary`)

  // ==================== DEMO ATTENDANCE (current month) ====================
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const period = `${year}-${String(month).padStart(2, '0')}`
  const daysInMonth = new Date(year, month, 0).getDate()
  const today = now.getDate()

  // Create attendance for first 15 employees for current month
  for (let empNo = 1; empNo <= 15; empNo++) {
    const empId = employeeIds[empNo]
    if (!empId) continue

    for (let day = 1; day <= Math.min(today, daysInMonth); day++) {
      const date = new Date(year, month - 1, day)
      const dow = date.getDay()
      const isWeekend = dow === 0 || dow === 6

      let attendanceType = 'NORMAL'
      let totalHours = 8
      let overtimeHours = 0
      let nightHours = 0

      if (isWeekend) {
        attendanceType = 'REST_DAY'
        totalHours = 0
      } else if (empNo % 7 === 0 && day === 10) {
        attendanceType = 'ON_LEAVE'
        totalHours = 0
      } else if (empNo % 5 === 0 && day === 15) {
        attendanceType = 'ABSENT'
        totalHours = 0
      } else if (day % 3 === 0 && !isWeekend) {
        attendanceType = 'OVERTIME'
        totalHours = 10
        overtimeHours = 2
      } else if (empNo % 3 === 0 && !isWeekend) {
        attendanceType = 'NIGHT_SHIFT'
        totalHours = 8
        nightHours = 8
      }

      await prisma.attendanceRecord.upsert({
        where: {
          employeeId_date: {
            employeeId: empId,
            date: date,
          },
        },
        update: {},
        create: {
          employeeId: empId,
          date: date,
          attendanceType,
          totalHours,
          overtimeHours,
          nightHours,
          worksiteId: worksiteIds[demoEmployees[empNo - 1].ws],
        },
      })
    }
  }
  console.log('✅ Demo attendance records created')

  // ==================== DEMO LEAVE REQUESTS ====================
  for (const empNo of [1, 5, 9, 15, 20]) {
    const empId = employeeIds[empNo]
    if (!empId || !leaveTypes.length) continue

    const leaveTypeId = leaveTypes[empNo % leaveTypes.length]?.id
    if (!leaveTypeId) continue

    await prisma.leaveRequest.create({
      data: {
        employeeId: empId,
        leaveTypeId,
        startDate: new Date(`2025-03-${String(10 + empNo).padStart(2, '0')}`),
        endDate: new Date(`2025-03-${String(15 + empNo).padStart(2, '0')}`),
        totalDays: 5,
        reason: empNo <= 5 ? 'Yıllık izin' : 'Отпуск',
        status: empNo === 1 ? 'APPROVED' : empNo === 5 ? 'PENDING' : 'PENDING',
      },
    })
  }
  console.log('✅ Demo leave requests created')

  // ==================== DEMO ASSETS ====================
  if (assetCategories.length > 0) {
    const demoAssets = [
      { no: 1, name: 'Hilti Matkap TE 30-A36', brand: 'Hilti', model: 'TE 30-A36', cat: 0, ws: 'DEMO-ANK', price: 25000, assignTo: 1 },
      { no: 2, name: 'Bosch Taşlama GWS 180-LI', brand: 'Bosch', model: 'GWS 180-LI', cat: 0, ws: 'DEMO-ANK', price: 12000, assignTo: 2 },
      { no: 3, name: 'İş Güvenliği Bareti', brand: '3M', model: 'H-700', cat: 0, ws: 'DEMO-ANK', price: 850, assignTo: 6 },
      { no: 4, name: 'Makita Şarjlı Vidalama', brand: 'Makita', model: 'DDF484Z', cat: 0, ws: 'DEMO-IZM', price: 18000, assignTo: 9 },
      { no: 5, name: 'Ölçüm Cihazı Laser', brand: 'Leica', model: 'DISTO D2', cat: 0, ws: 'DEMO-IZM', price: 8500, assignTo: null },
      { no: 6, name: 'Kaynak Maskesi Otomatik', brand: 'Lincoln', model: 'Viking 3350', cat: 0, ws: 'DEMO-KAZ', price: 15000, assignTo: 19 },
      { no: 7, name: 'Şantiye Anahtarı Seti', brand: 'Gedore', model: 'SET-28', cat: 0, ws: 'DEMO-KAZ', price: 4500, assignTo: 16 },
      { no: 8, name: 'Pnömatik Kırıcı', brand: 'DeWalt', model: 'D25960K', cat: 0, ws: 'MSK-01', price: 35000, assignTo: 23 },
    ]

    for (const asset of demoAssets) {
      const catId = assetCategories[asset.cat % assetCategories.length]?.id
      if (!catId) continue

      const created = await prisma.asset.upsert({
        where: { assetNo: `${DEMO_PREFIX}A${String(asset.no).padStart(3, '0')}` },
        update: {},
        create: {
          assetNo: `${DEMO_PREFIX}A${String(asset.no).padStart(3, '0')}`,
          name: asset.name,
          brand: asset.brand,
          model: asset.model,
          categoryId: catId,
          worksiteId: worksiteIds[asset.ws],
          purchasePrice: asset.price,
          status: asset.assignTo ? 'ASSIGNED' : 'AVAILABLE',
        },
      })

      if (asset.assignTo && employeeIds[asset.assignTo]) {
        await prisma.assetAssignment.create({
          data: {
            assetId: created.id,
            employeeId: employeeIds[asset.assignTo],
            assignedDate: new Date('2024-09-01'),
          },
        })
      }
    }
    console.log('✅ Demo assets created')
  }

  // ==================== DEMO DOCUMENTS (for some employees) ====================
  if (documentTypes.length > 0) {
    const passportType = documentTypes.find((dt) => dt.code === 'PASSPORT')
    const migrationCardType = documentTypes.find((dt) => dt.code === 'MIGRATION_CARD')
    const medicalType = documentTypes.find((dt) => dt.code === 'MEDICAL_CERT')

    for (let empNo = 1; empNo <= 15; empNo++) {
      const empId = employeeIds[empNo]
      if (!empId) continue

      // Passport doc for everyone
      if (passportType) {
        await prisma.employeeDocument.create({
          data: {
            employeeId: empId,
            documentTypeId: passportType.id,
            documentNo: `PP-${String(100000 + empNo)}`,
            issuedBy: 'Government',
            issueDate: new Date('2020-01-01'),
            expiryDate: empNo <= 3 ? new Date('2025-04-01') : new Date('2030-01-01'), // Some expiring soon
            isVerified: empNo % 2 === 0,
          },
        })
      }

      // Migration card for patent workers
      if (migrationCardType && demoEmployees[empNo - 1]?.wsType === 'PATENT') {
        await prisma.employeeDocument.create({
          data: {
            employeeId: empId,
            documentTypeId: migrationCardType.id,
            documentNo: `MC-${String(200000 + empNo)}`,
            issueDate: new Date('2024-06-01'),
            expiryDate: empNo <= 8 ? new Date('2025-03-15') : new Date('2025-12-01'), // Some expired/expiring
            isVerified: false,
          },
        })
      }

      // Medical cert for some
      if (medicalType && empNo % 3 === 0) {
        await prisma.employeeDocument.create({
          data: {
            employeeId: empId,
            documentTypeId: medicalType.id,
            documentNo: `MED-${String(300000 + empNo)}`,
            issueDate: new Date('2024-08-01'),
            expiryDate: new Date('2025-08-01'),
            isVerified: true,
          },
        })
      }
    }
    console.log('✅ Demo documents created')
  }

  // ==================== DEMO TRANSFERS ====================
  await prisma.employeeSiteTransfer.create({
    data: {
      employeeId: employeeIds[6],
      fromWorksiteId: worksiteIds['DEMO-ANK'],
      toWorksiteId: worksiteIds['DEMO-IZM'],
      transferDate: new Date('2025-02-01'),
      transferType: 'TEMPORARY',
      reason: 'Proje ihtiyacı',
      status: 'PENDING',
    },
  })
  await prisma.employeeSiteTransfer.create({
    data: {
      employeeId: employeeIds[10],
      fromWorksiteId: worksiteIds['DEMO-IZM'],
      toWorksiteId: worksiteIds['DEMO-KAZ'],
      transferDate: new Date('2025-01-15'),
      transferType: 'PERMANENT',
      reason: 'Şantiye kapanışı',
      status: 'APPROVED',
    },
  })
  console.log('✅ Demo transfers created')

  console.log('\n🎉 Demo seed completed! All demo data has DEMO- prefix for easy cleanup.')
  console.log('Run with --cleanup flag to remove all demo data.')
}

async function main() {
  const isCleanup = process.argv.includes('--cleanup')

  if (isCleanup) {
    await cleanup()
  } else {
    await seedDemo()
  }
}

main()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
