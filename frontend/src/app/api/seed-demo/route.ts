import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success, error } from '@/lib/api-response'

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

const PROF_CODES = ['WELDER','ELECTRICIAN','MASON','PLUMBER','LABORER','PAINTER','FOREMAN','ENGINEER','CRANE_OP','SAFETY','ADMIN','CARPENTER','INSULATOR','REBAR','CONCRETE','SURVEYOR']
const DEPT_CODES = ['CONSTRUCTION','ELECTRICAL','MECHANICAL','FINISHING','ENGINEERING','SAFETY','ADMIN','MACHINERY']
const NAT_CODES = ['TR','UZ','TJ','KG','RU','AZ','TM']
const WORK_STATUS_TYPES = ['LOCAL','PATENT','VISA','WORK_PERMIT','RESIDENCE_PERMIT']

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] }
function pickIdx(max: number): number { return Math.floor(Math.random() * max) }
function randDate(start: string, end: string): Date {
  const s = new Date(start).getTime(), e = new Date(end).getTime()
  return new Date(s + Math.random() * (e - s))
}
function pad(n: number, len = 4): string { return String(n).padStart(len, '0') }

export async function POST(request: NextRequest) {
  try {
    // Check for cleanup
    const url = new URL(request.url)
    if (url.searchParams.get('cleanup') === 'true') {
      return await cleanupDemo()
    }

    console.log('Starting massive demo seed...')

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

    // ===== 5 WORKSITES =====
    const worksiteDefs = [
      { code: 'MSK-02', name: 'Москва - ЖК Солнечный', address: 'г. Москва, ул. Ленина, д. 55', city: 'Москва', region: 'Московская обл.', pm: 'Ahmet Yılmaz', sm: 'Иван Петров', client: 'ООО "МосСтрой"' },
      { code: 'SPB-02', name: 'Санкт-Петербург - ТЦ Невский', address: 'г. СПб, Невский пр., д. 200', city: 'Санкт-Петербург', region: 'Ленинградская обл.', pm: 'Mehmet Kaya', sm: 'Сергей Козлов', client: 'ЗАО "НеваСтрой"' },
      { code: 'KZN-01', name: 'Казань - Жилой Комплекс Ривьера', address: 'г. Казань, ул. Пушкина, д. 42', city: 'Казань', region: 'Республика Татарстан', pm: 'Osman Yıldız', sm: 'Дмитрий Волков', client: 'ООО "Казань-Строй"' },
      { code: 'NSK-01', name: 'Новосибирск - Бизнес Парк Сибирь', address: 'г. Новосибирск, ул. Кирова, д. 10', city: 'Новосибирск', region: 'Новосибирская обл.', pm: 'Ali Çelik', sm: 'Алексей Морозов', client: 'АО "СибирьСтрой"' },
      { code: 'EKB-01', name: 'Екатеринбург - ЖК Уральский', address: 'г. Екатеринбург, ул. Мира, д. 33', city: 'Екатеринбург', region: 'Свердловская обл.', pm: 'Hasan Demir', sm: 'Павел Новиков', client: 'ООО "УралДевелопмент"' },
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

    // Also get existing worksites
    const existingWs = await prisma.worksite.findMany({ where: { code: { notIn: worksiteDefs.map(w => w.code) } } })
    for (const ews of existingWs) worksiteIds.push(ews.id)

    // ===== 150 EMPLOYEES =====
    function generateEmployee(idx: number) {
      const nat = NAT_CODES[idx % NAT_CODES.length]
      const isFemale = idx % 11 === 0 // ~10% female
      let firstName: string, lastName: string, patronymic: string

      if (nat === 'TR') {
        firstName = isFemale ? TR_FEMALE[idx % TR_FEMALE.length] : TR_MALE[idx % TR_MALE.length]
        lastName = TR_LAST[idx % TR_LAST.length]
        patronymic = ''
      } else if (nat === 'UZ') {
        firstName = UZ_MALE[idx % UZ_MALE.length]
        lastName = UZ_LAST[idx % UZ_LAST.length]
        patronymic = UZ_PAT[idx % UZ_PAT.length]
      } else if (nat === 'TJ') {
        firstName = TJ_MALE[idx % TJ_MALE.length]
        lastName = TJ_LAST[idx % TJ_LAST.length]
        patronymic = pick(UZ_PAT)
      } else if (nat === 'KG') {
        firstName = KG_MALE[idx % KG_MALE.length]
        lastName = KG_LAST[idx % KG_LAST.length]
        patronymic = pick(UZ_PAT)
      } else if (nat === 'RU') {
        firstName = RU_MALE[idx % RU_MALE.length]
        lastName = RU_LAST[idx % RU_LAST.length]
        patronymic = RU_PAT[idx % RU_PAT.length]
      } else if (nat === 'AZ') {
        firstName = AZ_MALE[idx % AZ_MALE.length]
        lastName = AZ_LAST[idx % AZ_LAST.length]
        patronymic = pick(RU_PAT)
      } else {
        firstName = TM_MALE[idx % TM_MALE.length]
        lastName = TM_LAST[idx % TM_LAST.length]
        patronymic = pick(UZ_PAT)
      }

      const wsType = nat === 'TR' ? 'LOCAL' : nat === 'RU' ? (idx % 3 === 0 ? 'VISA' : 'LOCAL') : WORK_STATUS_TYPES[1 + (idx % 4)]
      const isMonthly = nat === 'TR' || nat === 'RU' || idx % 5 === 0
      const prof = PROF_CODES[idx % PROF_CODES.length]
      const dept = DEPT_CODES[idx % DEPT_CODES.length]
      const salary = isMonthly ? 55000 + (idx * 1777) % 95000 : 250 + (idx * 13) % 200

      let status = 'ACTIVE'
      if (idx >= 140 && idx < 145) status = 'ON_LEAVE'
      if (idx >= 145) status = 'TERMINATED'

      return { idx, firstName, lastName, patronymic, nat, isFemale, wsType, isMonthly, prof, dept, salary, status }
    }

    const employeeIds: string[] = []
    const batchSize = 10

    for (let batch = 0; batch < 15; batch++) {
      const promises = []
      for (let i = 0; i < batchSize; i++) {
        const idx = batch * batchSize + i
        if (idx >= 150) break
        const emp = generateEmployee(idx)
        const empNo = `DEMO-${pad(idx + 1)}`

        promises.push((async () => {
          const employee = await prisma.employee.upsert({
            where: { employeeNo: empNo },
            update: {},
            create: {
              employeeNo: empNo,
              firstName: emp.firstName,
              lastName: emp.lastName,
              patronymic: emp.patronymic || null,
              gender: emp.isFemale ? 'FEMALE' : 'MALE',
              birthDate: randDate('1975-01-01', '2000-12-31'),
              nationalityId: natMap[emp.nat] || null,
              professionId: profMap[emp.prof] || null,
              departmentId: deptMap[emp.dept] || null,
              phone: `+7${String(9001000000 + idx * 71717).slice(0, 10)}`,
              status: emp.status,
            },
          })
          employeeIds[idx] = employee.id

          // Identity
          await prisma.employeeIdentity.upsert({
            where: { employeeId: employee.id },
            update: {},
            create: {
              employeeId: employee.id,
              passportNo: `${emp.nat}${pad(10000000 + idx * 12345, 8)}`,
              passportAuthority: emp.nat === 'TR' ? 'Nüfus Müdürlüğü' : 'МВД России',
              passportIssueDate: randDate('2018-01-01', '2023-06-01'),
              passportExpiryDate: idx < 10 ? randDate('2025-03-01', '2025-06-01') : randDate('2027-01-01', '2032-12-31'),
              inn: `77${pad(10000000000 + idx * 111111111, 10)}`,
              snils: emp.nat === 'RU' ? `${pad(100 + idx, 3)}-${pad(200 + idx, 3)}-${pad(300 + idx, 3)} ${pad(40 + idx % 100, 2)}` : null,
              bankName: idx % 3 === 0 ? 'Сбербанк' : idx % 3 === 1 ? 'ВТБ' : 'Тинькофф',
              bankAccountNo: `40817810${pad(100000000000 + idx * 11111111111, 12)}`,
            },
          })

          // Work status
          await prisma.employeeWorkStatus.upsert({
            where: { employeeId: employee.id },
            update: {},
            create: {
              employeeId: employee.id,
              workStatusType: emp.wsType,
              russiaEntryDate: emp.wsType !== 'LOCAL' ? randDate('2023-06-01', '2025-01-01') : null,
              migrationCardNo: emp.wsType === 'PATENT' ? `MC-${pad(100000 + idx)}` : null,
              migrationCardStart: emp.wsType === 'PATENT' ? randDate('2024-01-01', '2024-12-01') : null,
              migrationCardEnd: emp.wsType === 'PATENT' ? (idx < 20 ? randDate('2025-02-01', '2025-04-01') : randDate('2025-06-01', '2026-06-01')) : null,
              registrationAddress: emp.wsType !== 'LOCAL' ? 'г. Москва, ул. Тверская, д. 1' : null,
              registrationStart: emp.wsType !== 'LOCAL' ? randDate('2024-01-01', '2024-12-01') : null,
              registrationEnd: emp.wsType !== 'LOCAL' ? (idx < 15 ? randDate('2025-02-15', '2025-04-15') : randDate('2025-08-01', '2026-08-01')) : null,
              patentNo: emp.wsType === 'PATENT' ? `PAT-${pad(100000 + idx)}` : null,
              patentRegion: emp.wsType === 'PATENT' ? 'Москва' : null,
              patentStart: emp.wsType === 'PATENT' ? randDate('2024-01-01', '2024-12-01') : null,
              patentEnd: emp.wsType === 'PATENT' ? (idx < 25 ? randDate('2025-03-01', '2025-05-01') : randDate('2025-07-01', '2026-07-01')) : null,
              visaNo: emp.wsType === 'VISA' ? `VISA-${pad(200000 + idx)}` : null,
              visaStart: emp.wsType === 'VISA' ? randDate('2024-01-01', '2024-06-01') : null,
              visaEnd: emp.wsType === 'VISA' ? (idx < 10 ? randDate('2025-03-01', '2025-05-01') : randDate('2025-12-01', '2026-12-01')) : null,
              visaType: emp.wsType === 'VISA' ? 'WORK' : null,
              visaEntryType: emp.wsType === 'VISA' ? 'MULTI' : null,
              workPermitNo: emp.wsType === 'WORK_PERMIT' ? `WP-${pad(300000 + idx)}` : null,
              workPermitExpiryDate: emp.wsType === 'WORK_PERMIT' ? randDate('2025-06-01', '2027-01-01') : null,
            },
          })

          // Employment
          const wsId = worksiteIds[idx % worksiteIds.length]
          await prisma.employeeEmployment.upsert({
            where: { employeeId: employee.id },
            update: {},
            create: {
              employeeId: employee.id,
              worksiteId: wsId,
              shiftId: shiftIds.length > 0 ? shiftIds[idx % shiftIds.length] : null,
              hireDate: randDate('2023-06-01', '2025-01-15'),
              actualStartDate: randDate('2023-06-05', '2025-01-20'),
              contractType: emp.isMonthly ? 'PERMANENT' : 'TEMPORARY',
              contractDate: randDate('2023-06-01', '2025-01-10'),
            },
          })

          // Salary
          await prisma.employeeSalaryProfile.upsert({
            where: { employeeId: employee.id },
            update: {},
            create: {
              employeeId: employee.id,
              paymentType: emp.isMonthly ? 'MONTHLY' : (idx % 3 === 0 ? 'DAILY' : 'HOURLY'),
              netSalary: emp.isMonthly ? emp.salary : null,
              grossSalary: emp.isMonthly ? Math.round(emp.salary * 1.149) : null,
              hourlyRate: !emp.isMonthly && idx % 3 !== 0 ? emp.salary : null,
              dailyRate: !emp.isMonthly && idx % 3 === 0 ? emp.salary * 8 : null,
              overtimeMultiplier: 1.5,
              nightMultiplier: 1.2,
              holidayMultiplier: 2.0,
              paymentMethod: emp.isMonthly ? 'BANK' : 'CASH',
              taxStatus: emp.wsType === 'LOCAL' ? 'RESIDENT' : 'NON_RESIDENT',
              ndflRate: emp.wsType === 'LOCAL' ? 13 : 30,
              effectiveFrom: new Date('2024-01-01'),
            },
          })

          return employee.id
        })())
      }
      await Promise.all(promises)
    }
    console.log('150 employees created')

    // ===== ATTENDANCE (current + previous month for first 80 employees) =====
    const now = new Date()
    for (let monthOffset = 0; monthOffset <= 1; monthOffset++) {
      const m = new Date(now.getFullYear(), now.getMonth() - monthOffset, 1)
      const yr = m.getFullYear(), mo = m.getMonth() + 1
      const daysInMonth = new Date(yr, mo, 0).getDate()
      const maxDay = monthOffset === 0 ? Math.min(now.getDate(), daysInMonth) : daysInMonth

      for (let empIdx = 0; empIdx < 80; empIdx++) {
        const empId = employeeIds[empIdx]
        if (!empId) continue
        const records = []
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

          records.push({
            employeeId: empId,
            date,
            attendanceType: type,
            totalHours: hours,
            overtimeHours: ot,
            nightHours: nh,
            worksiteId: worksiteIds[empIdx % worksiteIds.length],
          })
        }
        // Batch insert
        for (const rec of records) {
          await prisma.attendanceRecord.upsert({
            where: { employeeId_date: { employeeId: rec.employeeId, date: rec.date } },
            update: {},
            create: rec,
          })
        }
      }
    }
    console.log('Attendance records created')

    // ===== DOCUMENTS (for first 100 employees) =====
    const passportType = documentTypes.find(dt => dt.code === 'PASSPORT')
    const migCardType = documentTypes.find(dt => dt.code === 'MIGRATION_CARD')
    const medType = documentTypes.find(dt => dt.code === 'MEDICAL_CERT')
    const safetyType = documentTypes.find(dt => dt.code === 'SAFETY_CERT')
    const regType = documentTypes.find(dt => dt.code === 'REGISTRATION')

    for (let i = 0; i < 100; i++) {
      const empId = employeeIds[i]
      if (!empId) continue
      const emp = generateEmployee(i)

      if (passportType) {
        await prisma.employeeDocument.create({
          data: {
            employeeId: empId,
            documentTypeId: passportType.id,
            documentNo: `PP-${pad(100000 + i)}`,
            issuedBy: emp.nat === 'TR' ? 'Nüfus Müdürlüğü' : 'МВД',
            issueDate: randDate('2019-01-01', '2023-01-01'),
            expiryDate: i < 8 ? randDate('2025-02-01', '2025-04-01') : randDate('2028-01-01', '2033-01-01'),
            isVerified: i % 2 === 0,
          },
        }).catch(() => {}) // skip if duplicate
      }
      if (migCardType && emp.wsType === 'PATENT') {
        await prisma.employeeDocument.create({
          data: {
            employeeId: empId,
            documentTypeId: migCardType.id,
            documentNo: `MC-${pad(200000 + i)}`,
            issueDate: randDate('2024-01-01', '2024-12-01'),
            expiryDate: i < 15 ? randDate('2025-02-01', '2025-03-30') : randDate('2025-08-01', '2026-06-01'),
            isVerified: false,
          },
        }).catch(() => {})
      }
      if (medType && i % 3 === 0) {
        await prisma.employeeDocument.create({
          data: {
            employeeId: empId,
            documentTypeId: medType.id,
            documentNo: `MED-${pad(300000 + i)}`,
            issueDate: randDate('2024-01-01', '2024-12-01'),
            expiryDate: i < 10 ? randDate('2025-01-01', '2025-03-01') : randDate('2025-08-01', '2026-01-01'),
            isVerified: true,
          },
        }).catch(() => {})
      }
      if (safetyType && i % 4 === 0) {
        await prisma.employeeDocument.create({
          data: {
            employeeId: empId,
            documentTypeId: safetyType.id,
            documentNo: `SAF-${pad(400000 + i)}`,
            issueDate: randDate('2024-03-01', '2024-11-01'),
            expiryDate: randDate('2025-06-01', '2026-06-01'),
            isVerified: i % 2 === 0,
          },
        }).catch(() => {})
      }
      if (regType && emp.wsType !== 'LOCAL' && i % 2 === 0) {
        await prisma.employeeDocument.create({
          data: {
            employeeId: empId,
            documentTypeId: regType.id,
            documentNo: `REG-${pad(500000 + i)}`,
            issueDate: randDate('2024-01-01', '2024-12-01'),
            expiryDate: i < 12 ? randDate('2025-02-01', '2025-04-01') : randDate('2025-09-01', '2026-09-01'),
            isVerified: false,
          },
        }).catch(() => {})
      }
    }
    console.log('Documents created')

    // ===== LEAVE REQUESTS =====
    if (leaveTypes.length > 0) {
      for (let i = 0; i < 40; i++) {
        const empIdx = i * 3
        const empId = employeeIds[empIdx]
        if (!empId) continue
        const lt = leaveTypes[i % leaveTypes.length]
        const startDay = 5 + (i % 20)
        await prisma.leaveRequest.create({
          data: {
            employeeId: empId,
            leaveTypeId: lt.id,
            startDate: new Date(2025, 2 + (i % 4), startDay),
            endDate: new Date(2025, 2 + (i % 4), startDay + 3 + (i % 7)),
            totalDays: 3 + (i % 7),
            reason: i % 3 === 0 ? 'Yıllık izin' : i % 3 === 1 ? 'Aile ziyareti' : 'Sağlık kontrolü',
            status: i < 10 ? 'APPROVED' : i < 25 ? 'PENDING' : 'REJECTED',
          },
        }).catch(() => {})
      }
    }
    console.log('Leave requests created')

    // ===== ASSETS (30 items) =====
    if (assetCategories.length > 0) {
      const assetNames = [
        'Hilti Matkap TE 30','Bosch Taşlama GWS','3M Baret H-700','Makita Vidalama DDF','Leica Lazer Ölçer',
        'Lincoln Kaynak Maskesi','Gedore Anahtar Seti','DeWalt Kırıcı D25','Milwaukee İmpakt','Flex Polisaj',
        'Husqvarna Kesici','Metabo Taşlama','Stihl Motorlu Testere','Honda Jeneratör','Karcher Yıkama',
        'Hilti Lazer PR 2','Bosch Şarjlı Matkap','3M Kulaklık X5A','Uvex Gözlük','Petzl Emniyet Kemeri',
        'Cat Dozer D6','Liebherr Vinç LTM','JCB Kepçe 3CX','Volvo Kamyon FH16','Atlas Copco Kompresör',
        'Weber Sıkıştırma','Wacker Vibratör','Putzmeister Pompa','Schwing Beton Pompası','Topcon Total Station',
      ]
      for (let i = 0; i < 30; i++) {
        const catId = assetCategories[i % assetCategories.length].id
        const wsId = worksiteIds[i % worksiteIds.length]
        const assetNo = `DEMO-A${pad(i + 1, 3)}`
        const hasAssign = i < 20 && employeeIds[i * 5]

        const asset = await prisma.asset.upsert({
          where: { assetNo },
          update: {},
          create: {
            assetNo,
            name: assetNames[i % assetNames.length],
            brand: assetNames[i % assetNames.length].split(' ')[0],
            model: assetNames[i % assetNames.length].split(' ').slice(1).join(' '),
            categoryId: catId,
            worksiteId: wsId,
            purchasePrice: 1000 + (i * 2500) % 50000,
            depositAmount: i % 3 === 0 ? 500 + (i * 100) % 5000 : null,
            status: hasAssign ? 'ASSIGNED' : i >= 25 ? 'DAMAGED' : 'AVAILABLE',
          },
        })

        if (hasAssign && employeeIds[i * 5]) {
          await prisma.assetAssignment.create({
            data: {
              assetId: asset.id,
              employeeId: employeeIds[i * 5],
              assignedDate: randDate('2024-06-01', '2025-01-15'),
            },
          }).catch(() => {})
        }
      }
    }
    console.log('Assets created')

    // ===== TRANSFERS (20) =====
    for (let i = 0; i < 20; i++) {
      const empId = employeeIds[i * 7]
      if (!empId) continue
      const fromWs = worksiteIds[i % worksiteIds.length]
      const toWs = worksiteIds[(i + 1) % worksiteIds.length]
      if (fromWs === toWs) continue
      await prisma.employeeSiteTransfer.create({
        data: {
          employeeId: empId,
          fromWorksiteId: fromWs,
          toWorksiteId: toWs,
          transferDate: randDate('2024-08-01', '2025-03-01'),
          transferType: i % 2 === 0 ? 'TEMPORARY' : 'PERMANENT',
          reason: i % 3 === 0 ? 'Proje ihtiyacı' : i % 3 === 1 ? 'Şantiye kapanışı' : 'Yeniden yapılanma',
          status: i < 8 ? 'APPROVED' : i < 15 ? 'PENDING' : 'COMPLETED',
        },
      }).catch(() => {})
    }
    console.log('Transfers created')

    // Count results
    const totalEmployees = await prisma.employee.count({ where: { employeeNo: { startsWith: 'DEMO-' } } })
    const totalWorksites = worksiteDefs.length
    const totalAttendance = await prisma.attendanceRecord.count({ where: { employee: { employeeNo: { startsWith: 'DEMO-' } } } })
    const totalDocs = await prisma.employeeDocument.count({ where: { employee: { employeeNo: { startsWith: 'DEMO-' } } } })

    return success({
      message: 'Demo seed completed!',
      counts: {
        employees: totalEmployees,
        worksites: totalWorksites,
        attendanceRecords: totalAttendance,
        documents: totalDocs,
      },
    })
  } catch (e: any) {
    console.error('Seed error:', e)
    return error(e.message || 'Seed failed', 500)
  }
}

async function cleanupDemo() {
  // Delete in reverse dependency order
  await prisma.attendanceRecord.deleteMany({ where: { employee: { employeeNo: { startsWith: 'DEMO-' } } } })
  await prisma.leaveRequest.deleteMany({ where: { employee: { employeeNo: { startsWith: 'DEMO-' } } } })
  await prisma.leaveBalance.deleteMany({ where: { employee: { employeeNo: { startsWith: 'DEMO-' } } } })
  await prisma.hakkedisSatir.deleteMany({ where: { employee: { employeeNo: { startsWith: 'DEMO-' } } } })
  await prisma.payrollItem.deleteMany({ where: { employee: { employeeNo: { startsWith: 'DEMO-' } } } })
  await prisma.patentPayment.deleteMany({ where: { employee: { employeeNo: { startsWith: 'DEMO-' } } } })
  await prisma.alert.deleteMany({ where: { employee: { employeeNo: { startsWith: 'DEMO-' } } } })
  await prisma.customFieldValue.deleteMany({ where: { employee: { employeeNo: { startsWith: 'DEMO-' } } } })
  await prisma.employeeSiteTransfer.deleteMany({ where: { employee: { employeeNo: { startsWith: 'DEMO-' } } } })

  // Asset assignments for demo employees
  await prisma.assetAssignment.deleteMany({ where: { employee: { employeeNo: { startsWith: 'DEMO-' } } } })

  // Documents
  const demoEmps = await prisma.employee.findMany({
    where: { employeeNo: { startsWith: 'DEMO-' } },
    select: { id: true, documents: { select: { id: true } } },
  })
  for (const emp of demoEmps) {
    for (const doc of emp.documents) {
      await prisma.documentFile.deleteMany({ where: { documentId: doc.id } })
    }
    await prisma.employeeDocument.deleteMany({ where: { employeeId: emp.id } })
  }

  await prisma.employeeSalaryProfile.deleteMany({ where: { employee: { employeeNo: { startsWith: 'DEMO-' } } } })
  await prisma.employeeEmployment.deleteMany({ where: { employee: { employeeNo: { startsWith: 'DEMO-' } } } })
  await prisma.employeeIdentity.deleteMany({ where: { employee: { employeeNo: { startsWith: 'DEMO-' } } } })
  await prisma.employeeWorkStatus.deleteMany({ where: { employee: { employeeNo: { startsWith: 'DEMO-' } } } })
  await prisma.employeeContact.deleteMany({ where: { employee: { employeeNo: { startsWith: 'DEMO-' } } } })
  await prisma.employee.deleteMany({ where: { employeeNo: { startsWith: 'DEMO-' } } })

  await prisma.asset.deleteMany({ where: { assetNo: { startsWith: 'DEMO-' } } })
  await prisma.worksite.deleteMany({ where: { code: { in: ['MSK-02', 'SPB-02', 'KZN-01', 'NSK-01', 'EKB-01'] } } })

  return success({ message: 'All demo data cleaned up!' })
}

export async function DELETE() {
  return await cleanupDemo()
}
