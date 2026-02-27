/**
 * DEMO SEED DATA
 * Creates 150 demo employees with full data: identity, work status, employment,
 * salary, attendance, documents, leaves, assets, payroll, hakkedis.
 *
 * Run: npx tsx prisma/seed-demo.ts
 * Called automatically by setup.ts during Vercel build.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ===== NAME POOLS =====
const TR_MALE = ['Ahmet','Mehmet','Mustafa','Ali','Hasan','Hüseyin','İbrahim','Osman','Murat','Kemal','Emre','Burak','Serkan','Fatih','Tolga','Yusuf','Onur','Cem','Barış','Deniz','Can','Kaan','Taner','Selim','Volkan','Uğur','Sinan','Erhan','Caner','Berk']
const TR_FEMALE = ['Ayşe','Fatma','Zeynep','Elif','Esra','Merve','Derya','Özlem','Selin','Gül','Aslı','Pınar','İrem','Başak','Ceren','Damla','Ece','Gizem','Hande','Nur']
const TR_LAST = ['Yılmaz','Kaya','Demir','Çelik','Şahin','Yıldız','Yıldırım','Öztürk','Aydın','Özdemir','Arslan','Doğan','Kılıç','Aslan','Çetin','Kara','Koç','Kurt','Özkan','Şen','Polat','Korkmaz','Bayrak','Aktaş','Güneş','Erdoğan','Acar','Tekin','Ünal','Balcı']
const UZ_MALE = ['Rustam','Dilshod','Sherzod','Jasur','Bekzod','Murod','Abdulla','Davron','Kamol','Sardor','Nodir','Akbar','Bakhtiyor','Farkhod','Islom','Jamshid','Otabek','Sanjar','Ulugbek','Aziz']
const UZ_LAST = ['Karimov','Rakhimov','Tashmatov','Mirzaev','Tursunov','Ergashev','Yusupov','Alimov','Rasulov','Khamidov','Saidov','Nazarov','Umarov','Sultanov','Ismoilov']
const UZ_PAT = ['Akbarovich','Bahodirovich','Yusufovich','Anvarovich','Ulugbekovich','Olimovich','Ilhomovich','Shavkatovich','Rustamovich','Abdurahimovich']
const TJ_MALE = ['Timur','Farkhod','Daler','Parviz','Komron','Firuz','Somon','Bahrom','Manuchehr','Iskandar']
const TJ_LAST = ['Normatov','Rahimov','Safarov','Kamolov','Sharipov','Mirzoev','Boboev','Nazarov','Khudoyorov','Salimov']
const KG_MALE = ['Bakyt','Marat','Azamat','Aibek','Nurlan','Ermek','Almaz','Chingiz','Dastan','Kuban']
const KG_LAST = ['Asanov','Sadykov','Toktogulev','Ataev','Imankulov','Zheenbekov','Orozov','Kasymov','Duisheev','Tashiev']
const RU_MALE = ['Sergey','Nikolay','Viktor','Dmitry','Andrey','Alexey','Ivan','Pavel','Mikhail','Vladimir']
const RU_LAST = ['Ivanov','Petrov','Sokolov','Volkov','Kozlov','Novikov','Morozov','Smirnov','Lebedev','Kuznetsov']
const RU_PAT = ['Petrovich','Alexandrovich','Dmitrievich','Ivanovich','Sergeevich','Nikolaevich','Vladimirovich','Andreevich','Pavlovich','Mikhailovich']
const AZ_MALE = ['Aslan','Eldar','Rashad','Farid','Murad','Orkhan','Tural','Vugar','Samir','Ruslan']
const AZ_LAST = ['Mammadov','Aliyev','Hasanov','Huseynov','Guliyev','Ismayilov','Bayramov','Musayev','Rzayev','Orujov']
const TM_MALE = ['Nurmuhammed','Merdan','Gurban','Dovlet','Yazmurad','Batyr','Mekan','Serdar','Ashyr','Muhammet']
const TM_LAST = ['Durdyev','Berdyev','Annayev','Charyyev','Ovezmyradov','Rejepov','Nuryyev','Gurbanov','Sapargeldyyev','Myradov']

// Must match codes from prisma/seed.ts
const PROF_CODES = ['ISCI','USTA','KALIPCI','DEMIRCI','BETONCU','KAYNAK','ELEKTRIK','TESISAT','OPERATOR','SOFOR','FORMEN','MUHENDIS','MIMAR','OFIS','BOYACI','IZOLASYON']
const DEPT_CODES = ['YONETIM','IK','MUHASEBE','INSAAT','MEKANIK','ELEKTRIK','LOJISTIK','GUVENLIK']
const NAT_CODES = ['TR','UZ','TJ','KG','RU','AZ','TM']
const WORK_STATUS_TYPES = ['LOCAL','PATENT','VISA','WORK_PERMIT','RESIDENCE_PERMIT']

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] }
function randDate(start: string, end: string): Date {
  const s = new Date(start).getTime(), e = new Date(end).getTime()
  return new Date(s + Math.random() * (e - s))
}
function pad(n: number, len = 4): string { return String(n).padStart(len, '0') }

async function main() {
  console.log('🎭 Starting demo data seed...')

  // Check if demo data already exists
  const existingCount = await prisma.employee.count({ where: { employeeNo: { startsWith: 'DEMO-' } } })
  if (existingCount >= 100) {
    console.log('✅ Demo data already exists (' + existingCount + ' employees), skipping.')
    return
  }

  // Get reference data
  const [nationalities, professions, departments, shifts, documentTypes, leaveTypes, assetCategories] = await Promise.all([
    prisma.nationality.findMany(),
    prisma.profession.findMany(),
    prisma.department.findMany(),
    prisma.shift.findMany(),
    prisma.documentType.findMany(),
    prisma.leaveType.findMany(),
    prisma.assetCategory.findMany(),
  ])

  const natMap = Object.fromEntries(nationalities.map(n => [n.code, n.id]))
  const profMap = Object.fromEntries(professions.map(p => [p.code, p.id]))
  const deptMap = Object.fromEntries(departments.map(d => [d.code, d.id]))
  const shiftIds = shifts.map(s => s.id)

  // ===== WORKSITES (upsert 5) =====
  const worksiteDefs = [
    { code: 'MSK-02', name: 'Москва - ЖК Солнечный', address: 'г. Москва, ул. Ленина, д. 55', city: 'Москва', region: 'Московская обл.', projectManager: 'Ahmet Yılmaz', siteManager: 'Иван Петров', client: 'ООО "МосСтрой"' },
    { code: 'SPB-02', name: 'Санкт-Петербург - ТЦ Невский', address: 'г. СПб, Невский пр., д. 200', city: 'Санкт-Петербург', region: 'Ленинградская обл.', projectManager: 'Mehmet Kaya', siteManager: 'Сергей Козлов', client: 'ЗАО "НеваСтрой"' },
    { code: 'KZN-01', name: 'Казань - Жилой Комплекс Ривьера', address: 'г. Казань, ул. Пушкина, д. 42', city: 'Казань', region: 'Республика Татарстан', projectManager: 'Osman Yıldız', siteManager: 'Дмитрий Волков', client: 'ООО "Казань-Строй"' },
    { code: 'NSK-01', name: 'Новосибирск - Бизнес Парк Сибирь', address: 'г. Новосибирск, ул. Кирова, д. 10', city: 'Новосибирск', region: 'Новосибирская обл.', projectManager: 'Ali Çelik', siteManager: 'Алексей Морозов', client: 'АО "СибирьСтрой"' },
    { code: 'EKB-01', name: 'Екатеринбург - ЖК Уральский', address: 'г. Екатеринбург, ул. Мира, д. 33', city: 'Екатеринбург', region: 'Свердловская обл.', projectManager: 'Hasan Demir', siteManager: 'Павел Новиков', client: 'ООО "УралДевелопмент"' },
  ]

  const worksiteIds: string[] = []
  for (const ws of worksiteDefs) {
    const result = await prisma.worksite.upsert({
      where: { code: ws.code },
      update: {},
      create: { ...ws, startDate: randDate('2024-01-01', '2025-01-01'), status: 'ACTIVE' },
    })
    worksiteIds.push(result.id)
  }

  const existingWs = await prisma.worksite.findMany({ where: { code: { notIn: worksiteDefs.map(w => w.code) } } })
  for (const ews of existingWs) worksiteIds.push(ews.id)
  console.log('  ✅ Worksites ready (' + worksiteIds.length + ')')

  // ===== GENERATE 150 EMPLOYEES DATA =====
  type EmpData = {
    idx: number; firstName: string; lastName: string; patronymic: string;
    nat: string; isFemale: boolean; wsType: string; isMonthly: boolean;
    prof: string; dept: string; salary: number; status: string;
  }

  const empDataList: EmpData[] = []
  for (let idx = 0; idx < 150; idx++) {
    const nat = NAT_CODES[idx % NAT_CODES.length]
    const isFemale = idx % 11 === 0
    let firstName: string, lastName: string, patronymic: string

    if (nat === 'TR') {
      firstName = isFemale ? TR_FEMALE[idx % TR_FEMALE.length] : TR_MALE[idx % TR_MALE.length]
      lastName = TR_LAST[idx % TR_LAST.length]
      patronymic = ''
    } else if (nat === 'UZ') {
      firstName = UZ_MALE[idx % UZ_MALE.length]; lastName = UZ_LAST[idx % UZ_LAST.length]; patronymic = UZ_PAT[idx % UZ_PAT.length]
    } else if (nat === 'TJ') {
      firstName = TJ_MALE[idx % TJ_MALE.length]; lastName = TJ_LAST[idx % TJ_LAST.length]; patronymic = pick(UZ_PAT)
    } else if (nat === 'KG') {
      firstName = KG_MALE[idx % KG_MALE.length]; lastName = KG_LAST[idx % KG_LAST.length]; patronymic = pick(UZ_PAT)
    } else if (nat === 'RU') {
      firstName = RU_MALE[idx % RU_MALE.length]; lastName = RU_LAST[idx % RU_LAST.length]; patronymic = RU_PAT[idx % RU_PAT.length]
    } else if (nat === 'AZ') {
      firstName = AZ_MALE[idx % AZ_MALE.length]; lastName = AZ_LAST[idx % AZ_LAST.length]; patronymic = pick(RU_PAT)
    } else {
      firstName = TM_MALE[idx % TM_MALE.length]; lastName = TM_LAST[idx % TM_LAST.length]; patronymic = pick(UZ_PAT)
    }

    const wsType = nat === 'TR' ? 'LOCAL' : nat === 'RU' ? (idx % 3 === 0 ? 'VISA' : 'LOCAL') : WORK_STATUS_TYPES[1 + (idx % 4)]
    const isMonthly = nat === 'TR' || nat === 'RU' || idx % 5 === 0
    const prof = PROF_CODES[idx % PROF_CODES.length]
    const dept = DEPT_CODES[idx % DEPT_CODES.length]
    const salary = isMonthly ? 55000 + (idx * 1777) % 95000 : 250 + (idx * 13) % 200

    let status = 'ACTIVE'
    if (idx >= 140 && idx < 145) status = 'ON_LEAVE'
    if (idx >= 145) status = 'TERMINATED'

    empDataList.push({ idx, firstName, lastName, patronymic, nat, isFemale, wsType, isMonthly, prof, dept, salary, status })
  }

  // ===== BATCH CREATE EMPLOYEES =====
  await prisma.employee.createMany({
    data: empDataList.map(emp => ({
      employeeNo: `DEMO-${pad(emp.idx + 1)}`,
      firstName: emp.firstName,
      lastName: emp.lastName,
      patronymic: emp.patronymic || null,
      gender: emp.isFemale ? 'FEMALE' : 'MALE',
      birthDate: randDate('1975-01-01', '2000-12-31'),
      nationalityId: natMap[emp.nat] || null,
      professionId: profMap[emp.prof] || null,
      departmentId: deptMap[emp.dept] || null,
      phone: `+7${String(9001000000 + emp.idx * 71717).slice(0, 10)}`,
      status: emp.status,
    })),
    skipDuplicates: true,
  })
  console.log('  ✅ 150 employees created')

  const createdEmployees = await prisma.employee.findMany({
    where: { employeeNo: { startsWith: 'DEMO-' } },
    select: { id: true, employeeNo: true },
    orderBy: { employeeNo: 'asc' },
  })
  const empIdMap = new Map(createdEmployees.map(e => {
    const idx = parseInt(e.employeeNo.replace('DEMO-', '')) - 1
    return [idx, e.id]
  }))

  // ===== BATCH CREATE IDENTITIES =====
  await prisma.employeeIdentity.createMany({
    data: empDataList.map(emp => {
      const empId = empIdMap.get(emp.idx)
      if (!empId) return null
      return {
        employeeId: empId,
        passportNo: `${emp.nat}${pad(10000000 + emp.idx * 12345, 8)}`,
        passportAuthority: emp.nat === 'TR' ? 'Nüfus Müdürlüğü' : 'МВД России',
        passportIssueDate: randDate('2018-01-01', '2023-06-01'),
        passportExpiryDate: emp.idx < 10 ? randDate('2025-03-01', '2025-06-01') : randDate('2027-01-01', '2032-12-31'),
        inn: `77${pad(10000000000 + emp.idx * 111111111, 10)}`,
        snils: emp.nat === 'RU' ? `${pad(100 + emp.idx, 3)}-${pad(200 + emp.idx, 3)}-${pad(300 + emp.idx, 3)} ${pad(40 + emp.idx % 100, 2)}` : null,
        bankName: emp.idx % 3 === 0 ? 'Сбербанк' : emp.idx % 3 === 1 ? 'ВТБ' : 'Тинькофф',
        bankAccountNo: `40817810${pad(100000000000 + emp.idx * 11111111111, 12)}`,
      }
    }).filter(Boolean) as any[],
    skipDuplicates: true,
  })
  console.log('  ✅ Identities created')

  // ===== BATCH CREATE WORK STATUSES =====
  await prisma.employeeWorkStatus.createMany({
    data: empDataList.map(emp => {
      const empId = empIdMap.get(emp.idx)
      if (!empId) return null
      return {
        employeeId: empId, workStatusType: emp.wsType,
        russiaEntryDate: emp.wsType !== 'LOCAL' ? randDate('2023-06-01', '2025-01-01') : null,
        migrationCardNo: emp.wsType === 'PATENT' ? `MC-${pad(100000 + emp.idx)}` : null,
        migrationCardStart: emp.wsType === 'PATENT' ? randDate('2024-01-01', '2024-12-01') : null,
        migrationCardEnd: emp.wsType === 'PATENT' ? (emp.idx < 20 ? randDate('2025-02-01', '2025-04-01') : randDate('2025-06-01', '2026-06-01')) : null,
        registrationAddress: emp.wsType !== 'LOCAL' ? 'г. Москва, ул. Тверская, д. 1' : null,
        registrationStart: emp.wsType !== 'LOCAL' ? randDate('2024-01-01', '2024-12-01') : null,
        registrationEnd: emp.wsType !== 'LOCAL' ? (emp.idx < 15 ? randDate('2025-02-15', '2025-04-15') : randDate('2025-08-01', '2026-08-01')) : null,
        patentNo: emp.wsType === 'PATENT' ? `PAT-${pad(100000 + emp.idx)}` : null,
        patentRegion: emp.wsType === 'PATENT' ? 'Москва' : null,
        patentStart: emp.wsType === 'PATENT' ? randDate('2024-01-01', '2024-12-01') : null,
        patentEnd: emp.wsType === 'PATENT' ? (emp.idx < 25 ? randDate('2025-03-01', '2025-05-01') : randDate('2025-07-01', '2026-07-01')) : null,
        visaNo: emp.wsType === 'VISA' ? `VISA-${pad(200000 + emp.idx)}` : null,
        visaStart: emp.wsType === 'VISA' ? randDate('2024-01-01', '2024-06-01') : null,
        visaEnd: emp.wsType === 'VISA' ? (emp.idx < 10 ? randDate('2025-03-01', '2025-05-01') : randDate('2025-12-01', '2026-12-01')) : null,
        visaType: emp.wsType === 'VISA' ? 'WORK' : null,
        visaEntryType: emp.wsType === 'VISA' ? 'MULTI' : null,
        workPermitNo: emp.wsType === 'WORK_PERMIT' ? `WP-${pad(300000 + emp.idx)}` : null,
        workPermitExpiryDate: emp.wsType === 'WORK_PERMIT' ? randDate('2025-06-01', '2027-01-01') : null,
      }
    }).filter(Boolean) as any[],
    skipDuplicates: true,
  })
  console.log('  ✅ Work statuses created')

  // ===== BATCH CREATE EMPLOYMENTS =====
  await prisma.employeeEmployment.createMany({
    data: empDataList.map(emp => {
      const empId = empIdMap.get(emp.idx)
      if (!empId) return null
      return {
        employeeId: empId, worksiteId: worksiteIds[emp.idx % worksiteIds.length],
        shiftId: shiftIds.length > 0 ? shiftIds[emp.idx % shiftIds.length] : null,
        hireDate: randDate('2023-06-01', '2025-01-15'),
        actualStartDate: randDate('2023-06-05', '2025-01-20'),
        contractType: emp.isMonthly ? 'PERMANENT' : 'TEMPORARY',
        contractDate: randDate('2023-06-01', '2025-01-10'),
      }
    }).filter(Boolean) as any[],
    skipDuplicates: true,
  })
  console.log('  ✅ Employments created')

  // ===== BATCH CREATE SALARY PROFILES =====
  await prisma.employeeSalaryProfile.createMany({
    data: empDataList.map(emp => {
      const empId = empIdMap.get(emp.idx)
      if (!empId) return null
      return {
        employeeId: empId,
        paymentType: emp.isMonthly ? 'MONTHLY' : (emp.idx % 3 === 0 ? 'DAILY' : 'HOURLY'),
        netSalary: emp.isMonthly ? emp.salary : null,
        grossSalary: emp.isMonthly ? Math.round(emp.salary * 1.149) : null,
        hourlyRate: !emp.isMonthly && emp.idx % 3 !== 0 ? emp.salary : null,
        dailyRate: !emp.isMonthly && emp.idx % 3 === 0 ? emp.salary * 8 : null,
        overtimeMultiplier: 1.5, nightMultiplier: 1.2, holidayMultiplier: 2.0,
        paymentMethod: emp.isMonthly ? 'BANK' : 'CASH',
        taxStatus: emp.wsType === 'LOCAL' ? 'RESIDENT' : 'NON_RESIDENT',
        ndflRate: emp.wsType === 'LOCAL' ? 13 : 30,
        effectiveFrom: new Date('2024-01-01'),
      }
    }).filter(Boolean) as any[],
    skipDuplicates: true,
  })
  console.log('  ✅ Salary profiles created')

  // ===== BATCH CREATE ATTENDANCE =====
  const now = new Date()
  const yr = now.getFullYear(), mo = now.getMonth() + 1
  const maxDay = Math.min(now.getDate(), new Date(yr, mo, 0).getDate())
  const attendanceRecords: any[] = []
  for (let empIdx = 0; empIdx < 50; empIdx++) {
    const empId = empIdMap.get(empIdx)
    if (!empId) continue
    const wsId = worksiteIds[empIdx % worksiteIds.length]
    for (let day = 1; day <= maxDay; day++) {
      const date = new Date(yr, mo - 1, day)
      const dow = date.getDay()
      const isWeekend = dow === 0 || dow === 6
      let type = 'NORMAL', hours = 8, ot = 0, nh = 0
      if (isWeekend) { type = 'REST_DAY'; hours = 0 }
      else if (empIdx % 7 === 0 && day === 10) { type = 'ON_LEAVE'; hours = 0 }
      else if (empIdx % 5 === 0 && day === 15) { type = 'ABSENT'; hours = 0 }
      else if (day % 4 === 0) { type = 'OVERTIME'; hours = 10; ot = 2 }
      else if (empIdx % 3 === 0 && day % 5 === 0) { type = 'NIGHT_SHIFT'; hours = 8; nh = 8 }
      else if (day === 1 && empIdx % 8 === 0) { type = 'HOLIDAY'; hours = 8 }
      attendanceRecords.push({ employeeId: empId, date, attendanceType: type, totalHours: hours, overtimeHours: ot, nightHours: nh, worksiteId: wsId })
    }
  }
  for (let i = 0; i < attendanceRecords.length; i += 500) {
    await prisma.attendanceRecord.createMany({ data: attendanceRecords.slice(i, i + 500), skipDuplicates: true })
  }
  console.log('  ✅ Attendance records created (' + attendanceRecords.length + ')')

  // ===== BATCH CREATE DOCUMENTS =====
  const passportType = documentTypes.find(dt => dt.code === 'PASSPORT')
  const migCardType = documentTypes.find(dt => dt.code === 'MIGRATION_CARD')
  const medType = documentTypes.find(dt => dt.code === 'MEDICAL')
  const safetyType = documentTypes.find(dt => dt.code === 'SAFETY_CERT')
  const regType = documentTypes.find(dt => dt.code === 'REGISTRATION')
  const docRecords: any[] = []
  for (let i = 0; i < 100; i++) {
    const empId = empIdMap.get(i)
    if (!empId) continue
    const emp = empDataList[i]
    if (passportType) docRecords.push({ employeeId: empId, documentTypeId: passportType.id, documentNo: `PP-${pad(100000 + i)}`, issuedBy: emp.nat === 'TR' ? 'Nüfus Müdürlüğü' : 'МВД', issueDate: randDate('2019-01-01', '2023-01-01'), expiryDate: i < 8 ? randDate('2025-02-01', '2025-04-01') : randDate('2028-01-01', '2033-01-01'), isVerified: i % 2 === 0 })
    if (migCardType && emp.wsType === 'PATENT') docRecords.push({ employeeId: empId, documentTypeId: migCardType.id, documentNo: `MC-${pad(200000 + i)}`, issueDate: randDate('2024-01-01', '2024-12-01'), expiryDate: i < 15 ? randDate('2025-02-01', '2025-03-30') : randDate('2025-08-01', '2026-06-01'), isVerified: false })
    if (medType && i % 3 === 0) docRecords.push({ employeeId: empId, documentTypeId: medType.id, documentNo: `MED-${pad(300000 + i)}`, issueDate: randDate('2024-01-01', '2024-12-01'), expiryDate: i < 10 ? randDate('2025-01-01', '2025-03-01') : randDate('2025-08-01', '2026-01-01'), isVerified: true })
    if (safetyType && i % 4 === 0) docRecords.push({ employeeId: empId, documentTypeId: safetyType.id, documentNo: `SAF-${pad(400000 + i)}`, issueDate: randDate('2024-03-01', '2024-11-01'), expiryDate: randDate('2025-06-01', '2026-06-01'), isVerified: i % 2 === 0 })
    if (regType && emp.wsType !== 'LOCAL' && i % 2 === 0) docRecords.push({ employeeId: empId, documentTypeId: regType.id, documentNo: `REG-${pad(500000 + i)}`, issueDate: randDate('2024-01-01', '2024-12-01'), expiryDate: i < 12 ? randDate('2025-02-01', '2025-04-01') : randDate('2025-09-01', '2026-09-01'), isVerified: false })
  }
  await prisma.employeeDocument.createMany({ data: docRecords, skipDuplicates: true })
  console.log('  ✅ Documents created (' + docRecords.length + ')')

  // ===== BATCH CREATE LEAVE REQUESTS =====
  if (leaveTypes.length > 0) {
    const leaveRecords: any[] = []
    for (let i = 0; i < 40; i++) {
      const empId = empIdMap.get(i * 3)
      if (!empId) continue
      const lt = leaveTypes[i % leaveTypes.length]
      const startDay = 5 + (i % 20)
      leaveRecords.push({ employeeId: empId, leaveTypeId: lt.id, startDate: new Date(2025, 2 + (i % 4), startDay), endDate: new Date(2025, 2 + (i % 4), startDay + 3 + (i % 7)), totalDays: 3 + (i % 7), reason: i % 3 === 0 ? 'Yıllık izin' : i % 3 === 1 ? 'Aile ziyareti' : 'Sağlık kontrolü', status: i < 10 ? 'APPROVED' : i < 25 ? 'PENDING' : 'REJECTED' })
    }
    await prisma.leaveRequest.createMany({ data: leaveRecords, skipDuplicates: true })
    console.log('  ✅ Leave requests created (' + leaveRecords.length + ')')
  }

  // ===== BATCH CREATE ASSETS =====
  if (assetCategories.length > 0) {
    const assetNames = ['Hilti Matkap TE 30','Bosch Taşlama GWS','3M Baret H-700','Makita Vidalama DDF','Leica Lazer Ölçer','Lincoln Kaynak Maskesi','Gedore Anahtar Seti','DeWalt Kırıcı D25','Milwaukee İmpakt','Flex Polisaj','Husqvarna Kesici','Metabo Taşlama','Stihl Motorlu Testere','Honda Jeneratör','Karcher Yıkama','Hilti Lazer PR 2','Bosch Şarjlı Matkap','3M Kulaklık X5A','Uvex Gözlük','Petzl Emniyet Kemeri','Cat Dozer D6','Liebherr Vinç LTM','JCB Kepçe 3CX','Volvo Kamyon FH16','Atlas Copco Kompresör','Weber Sıkıştırma','Wacker Vibratör','Putzmeister Pompa','Schwing Beton Pompası','Topcon Total Station']
    const assetRecords: any[] = []
    for (let i = 0; i < 30; i++) {
      const hasAssign = i < 20 && empIdMap.has(i * 5)
      assetRecords.push({ assetNo: `DEMO-A${pad(i + 1, 3)}`, name: assetNames[i], brand: assetNames[i].split(' ')[0], model: assetNames[i].split(' ').slice(1).join(' '), categoryId: assetCategories[i % assetCategories.length].id, worksiteId: worksiteIds[i % worksiteIds.length], purchasePrice: 1000 + (i * 2500) % 50000, depositAmount: i % 3 === 0 ? 500 + (i * 100) % 5000 : null, status: hasAssign ? 'ASSIGNED' : i >= 25 ? 'DAMAGED' : 'AVAILABLE' })
    }
    await prisma.asset.createMany({ data: assetRecords, skipDuplicates: true })
    const assets = await prisma.asset.findMany({ where: { assetNo: { startsWith: 'DEMO-A' } }, select: { id: true, assetNo: true, status: true } })
    const assignmentRecords: any[] = []
    for (const asset of assets) {
      if (asset.status === 'ASSIGNED') {
        const assetIdx = parseInt(asset.assetNo.replace('DEMO-A', '')) - 1
        const empId = empIdMap.get(assetIdx * 5)
        if (empId) assignmentRecords.push({ assetId: asset.id, employeeId: empId, assignedDate: randDate('2024-06-01', '2025-01-15') })
      }
    }
    if (assignmentRecords.length > 0) await prisma.assetAssignment.createMany({ data: assignmentRecords, skipDuplicates: true })
    console.log('  ✅ Assets created (' + assetRecords.length + ')')
  }

  // ===== BATCH CREATE TRANSFERS =====
  const transferRecords: any[] = []
  for (let i = 0; i < 20; i++) {
    const empId = empIdMap.get(i * 7)
    if (!empId) continue
    const fromWs = worksiteIds[i % worksiteIds.length]
    const toWs = worksiteIds[(i + 1) % worksiteIds.length]
    if (fromWs === toWs) continue
    transferRecords.push({ employeeId: empId, fromWorksiteId: fromWs, toWorksiteId: toWs, transferDate: randDate('2024-08-01', '2025-03-01'), transferType: i % 2 === 0 ? 'TEMPORARY' : 'PERMANENT', reason: i % 3 === 0 ? 'Proje ihtiyacı' : i % 3 === 1 ? 'Şantiye kapanışı' : 'Yeniden yapılanma', status: i < 8 ? 'APPROVED' : i < 15 ? 'PENDING' : 'COMPLETED' })
  }
  if (transferRecords.length > 0) await prisma.employeeSiteTransfer.createMany({ data: transferRecords, skipDuplicates: true })
  console.log('  ✅ Transfers created')

  // ===== EMPLOYEE TYPES (Hierarchy Levels) =====
  const levelDefs = [
    { code: 'WORKER', nameTr: 'İşçi', nameRu: 'Рабочий', nameEn: 'Worker', sortOrder: 1 },
    { code: 'JOURNEYMAN', nameTr: 'Kalfa', nameRu: 'Подмастерье', nameEn: 'Journeyman', sortOrder: 2 },
    { code: 'MASTER', nameTr: 'Usta', nameRu: 'Мастер', nameEn: 'Master', sortOrder: 3 },
    { code: 'FOREMAN', nameTr: 'Ustabaşı', nameRu: 'Бригадир', nameEn: 'Foreman', sortOrder: 4 },
    { code: 'ENGINEER', nameTr: 'Mühendis', nameRu: 'Инженер', nameEn: 'Engineer', sortOrder: 5 },
    { code: 'MANAGER', nameTr: 'Müdür', nameRu: 'Начальник', nameEn: 'Manager', sortOrder: 6 },
    { code: 'DIRECTOR', nameTr: 'Genel Müdür', nameRu: 'Генеральный директор', nameEn: 'Director', sortOrder: 7 },
  ]
  const levelIds: Record<string, string> = {}
  for (const lv of levelDefs) {
    const result = await prisma.employeeType.upsert({ where: { code: lv.code }, update: {}, create: lv })
    levelIds[lv.code] = result.id
  }
  const levelAssignment = (idx: number): string => {
    if (idx < 5) return 'DIRECTOR'
    if (idx < 15) return 'MANAGER'
    if (idx < 30) return 'ENGINEER'
    if (idx < 50) return 'FOREMAN'
    if (idx < 80) return 'MASTER'
    if (idx < 110) return 'JOURNEYMAN'
    return 'WORKER'
  }
  for (let idx = 0; idx < 150; idx++) {
    const empId = empIdMap.get(idx)
    if (!empId) continue
    const levelCode = levelAssignment(idx)
    let supervisorId: string | null = null
    if (levelCode === 'MANAGER' && empIdMap.has(idx % 5)) supervisorId = empIdMap.get(idx % 5) || null
    else if (levelCode === 'ENGINEER' && empIdMap.has(5 + idx % 10)) supervisorId = empIdMap.get(5 + idx % 10) || null
    else if (levelCode === 'FOREMAN' && empIdMap.has(15 + idx % 15)) supervisorId = empIdMap.get(15 + idx % 15) || null
    else if (levelCode === 'MASTER' && empIdMap.has(30 + idx % 20)) supervisorId = empIdMap.get(30 + idx % 20) || null
    else if (levelCode === 'JOURNEYMAN' && empIdMap.has(50 + idx % 30)) supervisorId = empIdMap.get(50 + idx % 30) || null
    else if (levelCode === 'WORKER' && empIdMap.has(80 + idx % 30)) supervisorId = empIdMap.get(80 + idx % 30) || null
    await prisma.employee.update({ where: { id: empId }, data: { employeeTypeId: levelIds[levelCode] } })
    if (supervisorId) await prisma.employeeEmployment.updateMany({ where: { employeeId: empId }, data: { supervisorId } })
  }
  console.log('  ✅ Hierarchy levels assigned')

  // ===== ATTENDANCE PERIODS =====
  const periodStr = `${yr}-${String(mo).padStart(2, '0')}`
  for (const wsId of worksiteIds.slice(0, 5)) {
    await prisma.attendancePeriod.upsert({ where: { period_worksiteId: { period: periodStr, worksiteId: wsId } }, update: {}, create: { period: periodStr, worksiteId: wsId, status: 'OPEN' } })
  }

  // ===== PAYROLL RUNS (last 3 months) =====
  for (let mOff = 1; mOff <= 3; mOff++) {
    const pm = new Date(yr, mo - 1 - mOff, 1)
    const pStr = `${pm.getFullYear()}-${String(pm.getMonth() + 1).padStart(2, '0')}`
    for (const wsId of worksiteIds.slice(0, 5)) {
      const run = await prisma.payrollRun.upsert({
        where: { period_worksiteId: { period: pStr, worksiteId: wsId } }, update: {},
        create: { period: pStr, worksiteId: wsId, status: mOff >= 2 ? 'PAID' : 'CALCULATED', totalGross: 0, totalNet: 0, totalTax: 0 },
      })
      const wsEmps = empDataList.filter(e => worksiteIds[e.idx % worksiteIds.length] === wsId && e.idx < 140)
      const payrollItems: any[] = []
      let totalGross = 0, totalNet = 0, totalTax = 0
      for (const emp of wsEmps.slice(0, 20)) {
        const empId = empIdMap.get(emp.idx)
        if (!empId) continue
        const base = emp.isMonthly ? emp.salary : emp.salary * 22
        const gross = Math.round(base * 1.149)
        const ndfl = Math.round(gross * (emp.wsType === 'LOCAL' ? 0.13 : 0.30))
        const net = gross - ndfl
        totalGross += gross; totalNet += net; totalTax += ndfl
        payrollItems.push({ payrollRunId: run.id, employeeId: empId, baseSalary: base, workedDays: 22, workedHours: 176, overtimeHours: emp.idx % 4 === 0 ? 12 : 0, nightHours: emp.idx % 3 === 0 ? 16 : 0, holidayHours: 0, grossAmount: gross, netAmount: net, ndflAmount: ndfl, totalEarnings: gross, totalDeductions: ndfl })
      }
      if (payrollItems.length > 0) {
        await prisma.payrollItem.createMany({ data: payrollItems, skipDuplicates: true })
        await prisma.payrollRun.update({ where: { id: run.id }, data: { totalGross, totalNet, totalTax } })
      }
    }
  }
  console.log('  ✅ Payroll runs created (3 months)')

  // ===== HAKKEDIS =====
  const workItems = [
    { name: 'Beton Döküm', unit: 'm³', price: 1200 }, { name: 'Demir İşleri', unit: 'ton', price: 8500 },
    { name: 'Kalıp İşleri', unit: 'm²', price: 450 }, { name: 'Sıva İşleri', unit: 'm²', price: 180 },
    { name: 'Boya Badana', unit: 'm²', price: 120 }, { name: 'Elektrik Tesisatı', unit: 'm', price: 250 },
    { name: 'Su Tesisatı', unit: 'm', price: 200 }, { name: 'İzolasyon', unit: 'm²', price: 350 },
  ]
  for (let mOff = 1; mOff <= 3; mOff++) {
    const hm = new Date(yr, mo - 1 - mOff, 1)
    const hStr = `${hm.getFullYear()}-${String(hm.getMonth() + 1).padStart(2, '0')}`
    for (const wsId of worksiteIds.slice(0, 5)) {
      const totalAmt = workItems.reduce((sum, wi) => sum + wi.price * (10 + Math.random() * 50), 0)
      const hak = await prisma.hakkedis.create({ data: { worksiteId: wsId, period: hStr, status: mOff >= 2 ? 'APPROVED' : 'DRAFT', totalAmount: Math.round(totalAmt) } }).catch(() => null)
      if (hak) {
        const satirs: any[] = []
        for (const wi of workItems) {
          const qty = 10 + Math.round(Math.random() * 50)
          const total = qty * wi.price
          for (let e = 0; e < 3; e++) {
            const empIdx = (worksiteIds.indexOf(wsId) * 30 + e * 10 + mOff) % 150
            const empId = empIdMap.get(empIdx)
            if (!empId) continue
            const pct = e === 0 ? 50 : e === 1 ? 30 : 20
            satirs.push({ hakkediId: hak.id, employeeId: empId, workItem: wi.name, unit: wi.unit, quantity: qty, unitPrice: wi.price, totalAmount: total, teamName: `Ekip-${worksiteIds.indexOf(wsId) + 1}`, distributionPercent: pct, distributionAmount: Math.round(total * pct / 100), date: new Date(hm.getFullYear(), hm.getMonth(), 15) })
          }
        }
        if (satirs.length > 0) await prisma.hakkedisSatir.createMany({ data: satirs, skipDuplicates: true })
      }
    }
  }
  console.log('  ✅ Hakkedis created (3 months x 5 worksites)')

  console.log('\n🎉 Demo seed completed!')
}

main()
  .catch((e) => { console.error('Demo seed failed:', e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
