import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting seed...')

  // ==================== PERMISSIONS ====================
  const modules = [
    'employees', 'worksites', 'attendance', 'payroll', 'hakkedis',
    'assets', 'documents', 'leaves', 'transfers', 'alerts',
    'reports', 'settings', 'users',
  ]
  const actions = ['view', 'create', 'edit', 'delete', 'approve', 'export']
  const extraPermissions = [
    { code: 'salary.view', module: 'salary', action: 'view', nameTr: 'Maaş Görüntüle', nameRu: 'Просмотр зарплаты', nameEn: 'View Salary' },
    { code: 'salary.edit', module: 'salary', action: 'edit', nameTr: 'Maaş Düzenle', nameRu: 'Редактировать зарплату', nameEn: 'Edit Salary' },
    { code: 'documents.download', module: 'documents', action: 'download', nameTr: 'Belge İndir', nameRu: 'Скачать документ', nameEn: 'Download Document' },
    { code: 'audit.view', module: 'audit', action: 'view', nameTr: 'Audit Log Görüntüle', nameRu: 'Просмотр журнала аудита', nameEn: 'View Audit Log' },
  ]

  const permissionNames: Record<string, { tr: string; ru: string; en: string }> = {
    view: { tr: 'Görüntüle', ru: 'Просмотр', en: 'View' },
    create: { tr: 'Oluştur', ru: 'Создать', en: 'Create' },
    edit: { tr: 'Düzenle', ru: 'Редактировать', en: 'Edit' },
    delete: { tr: 'Sil', ru: 'Удалить', en: 'Delete' },
    approve: { tr: 'Onayla', ru: 'Утвердить', en: 'Approve' },
    export: { tr: 'Dışa Aktar', ru: 'Экспорт', en: 'Export' },
  }

  const moduleNames: Record<string, { tr: string; ru: string; en: string }> = {
    employees: { tr: 'Personel', ru: 'Сотрудники', en: 'Employees' },
    worksites: { tr: 'Şantiyeler', ru: 'Объекты', en: 'Worksites' },
    attendance: { tr: 'Puantaj', ru: 'Табель', en: 'Attendance' },
    payroll: { tr: 'Bordro', ru: 'Расчёт зарплаты', en: 'Payroll' },
    hakkedis: { tr: 'Hakediş', ru: 'Хакедиш', en: 'Progress Payment' },
    assets: { tr: 'Zimmetler', ru: 'Имущество', en: 'Assets' },
    documents: { tr: 'Belgeler', ru: 'Документы', en: 'Documents' },
    leaves: { tr: 'İzinler', ru: 'Отпуска', en: 'Leaves' },
    transfers: { tr: 'Transferler', ru: 'Переводы', en: 'Transfers' },
    alerts: { tr: 'Uyarılar', ru: 'Уведомления', en: 'Alerts' },
    reports: { tr: 'Raporlar', ru: 'Отчёты', en: 'Reports' },
    settings: { tr: 'Ayarlar', ru: 'Настройки', en: 'Settings' },
    users: { tr: 'Kullanıcılar', ru: 'Пользователи', en: 'Users' },
  }

  const allPermissions = []
  for (const mod of modules) {
    for (const act of actions) {
      allPermissions.push({
        code: `${mod}.${act}`,
        module: mod,
        action: act,
        nameTr: `${moduleNames[mod].tr} ${permissionNames[act].tr}`,
        nameRu: `${moduleNames[mod].ru} - ${permissionNames[act].ru}`,
        nameEn: `${moduleNames[mod].en} ${permissionNames[act].en}`,
      })
    }
  }
  allPermissions.push(...extraPermissions)

  for (const p of allPermissions) {
    await prisma.permission.upsert({
      where: { code: p.code },
      update: {},
      create: p,
    })
  }
  console.log(`✅ ${allPermissions.length} permissions created`)

  // ==================== ROLES ====================
  const roles = [
    { code: 'SUPER_ADMIN', nameTr: 'Süper Admin', nameRu: 'Супер Админ', nameEn: 'Super Admin', isSystem: true },
    { code: 'ADMIN', nameTr: 'Admin', nameRu: 'Администратор', nameEn: 'Admin', isSystem: true },
    { code: 'HR', nameTr: 'İnsan Kaynakları', nameRu: 'Кадры', nameEn: 'HR', isSystem: true },
    { code: 'ACCOUNTANT', nameTr: 'Muhasebe', nameRu: 'Бухгалтер', nameEn: 'Accountant', isSystem: true },
    { code: 'SITE_MANAGER', nameTr: 'Şantiye Şefi', nameRu: 'Начальник участка', nameEn: 'Site Manager', isSystem: true, siteScoped: true },
    { code: 'PROJECT_MANAGER', nameTr: 'Proje Müdürü', nameRu: 'Руководитель проекта', nameEn: 'Project Manager', isSystem: true },
    { code: 'VIEWER', nameTr: 'Görüntüleyici', nameRu: 'Наблюдатель', nameEn: 'Viewer', isSystem: true },
  ]

  for (const r of roles) {
    await prisma.role.upsert({
      where: { code: r.code },
      update: {},
      create: r,
    })
  }
  console.log(`✅ ${roles.length} roles created`)

  // Assign all permissions to ADMIN role
  const adminRole = await prisma.role.findUnique({ where: { code: 'ADMIN' } })
  const allPerms = await prisma.permission.findMany()
  if (adminRole) {
    for (const perm of allPerms) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: adminRole.id, permissionId: perm.id } },
        update: {},
        create: { roleId: adminRole.id, permissionId: perm.id },
      })
    }
  }

  // VIEWER role: only view permissions
  const viewerRole = await prisma.role.findUnique({ where: { code: 'VIEWER' } })
  const viewPerms = allPerms.filter((p) => p.action === 'view')
  if (viewerRole) {
    for (const perm of viewPerms) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: viewerRole.id, permissionId: perm.id } },
        update: {},
        create: { roleId: viewerRole.id, permissionId: perm.id },
      })
    }
  }

  // SITE_MANAGER: view + edit + approve for attendance, employees, assets, documents
  const smRole = await prisma.role.findUnique({ where: { code: 'SITE_MANAGER' } })
  const smModules = ['employees', 'attendance', 'assets', 'documents', 'hakkedis', 'transfers']
  const smActions = ['view', 'create', 'edit', 'approve']
  if (smRole) {
    for (const perm of allPerms) {
      if (smModules.includes(perm.module) && smActions.includes(perm.action)) {
        await prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: smRole.id, permissionId: perm.id } },
          update: {},
          create: { roleId: smRole.id, permissionId: perm.id },
        })
      }
    }
  }

  // HR: all employee, document, leave, transfer permissions + salary view
  const hrRole = await prisma.role.findUnique({ where: { code: 'HR' } })
  const hrModules = ['employees', 'documents', 'leaves', 'transfers', 'alerts', 'reports']
  if (hrRole) {
    for (const perm of allPerms) {
      if (hrModules.includes(perm.module) || perm.code === 'salary.view') {
        await prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: hrRole.id, permissionId: perm.id } },
          update: {},
          create: { roleId: hrRole.id, permissionId: perm.id },
        })
      }
    }
  }

  // ACCOUNTANT: payroll, salary, reports, attendance view
  const accRole = await prisma.role.findUnique({ where: { code: 'ACCOUNTANT' } })
  const accModules = ['payroll', 'hakkedis', 'reports']
  if (accRole) {
    for (const perm of allPerms) {
      if (accModules.includes(perm.module) || ['salary.view', 'salary.edit', 'employees.view', 'attendance.view', 'attendance.approve'].includes(perm.code)) {
        await prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: accRole.id, permissionId: perm.id } },
          update: {},
          create: { roleId: accRole.id, permissionId: perm.id },
        })
      }
    }
  }

  console.log('✅ Role permissions assigned')

  // ==================== SUPER ADMIN USER ====================
  const hashedPassword = await bcrypt.hash('Admin123!', 12)
  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@saela.com' },
    update: {},
    create: {
      email: 'admin@saela.com',
      password: hashedPassword,
      firstName: 'Super',
      lastName: 'Admin',
      locale: 'tr',
      status: 'ACTIVE',
    },
  })

  const saRole = await prisma.role.findUnique({ where: { code: 'SUPER_ADMIN' } })
  if (saRole) {
    await prisma.userRole.upsert({
      where: { userId_roleId_worksiteId: { userId: superAdmin.id, roleId: saRole.id, worksiteId: '' } },
      update: {},
      create: { userId: superAdmin.id, roleId: saRole.id },
    })
  }
  console.log('✅ Super Admin user created: admin@saela.com / Admin123!')

  // ==================== NUMBERING RULES ====================
  const numberingRules = [
    { entity: 'EMPLOYEE', prefix: 'SAELA-EMP-', padLength: 6 },
    { entity: 'ASSET', prefix: 'SAELA-AST-', padLength: 6 },
    { entity: 'DOCUMENT', prefix: 'SAELA-DOC-', padLength: 6 },
  ]
  for (const rule of numberingRules) {
    await prisma.numberingRule.upsert({
      where: { entity: rule.entity },
      update: {},
      create: rule,
    })
  }
  console.log('✅ Numbering rules created')

  // ==================== NATIONALITIES ====================
  const nationalities = [
    { code: 'UZ', nameTr: 'Özbek', nameRu: 'Узбек', nameEn: 'Uzbek', sortOrder: 1 },
    { code: 'TJ', nameTr: 'Tacik', nameRu: 'Таджик', nameEn: 'Tajik', sortOrder: 2 },
    { code: 'TM', nameTr: 'Türkmen', nameRu: 'Туркмен', nameEn: 'Turkmen', sortOrder: 3 },
    { code: 'TR', nameTr: 'Türk', nameRu: 'Турок', nameEn: 'Turkish', sortOrder: 4 },
    { code: 'AZ', nameTr: 'Azeri', nameRu: 'Азербайджанец', nameEn: 'Azerbaijani', sortOrder: 5 },
    { code: 'RU', nameTr: 'Rus', nameRu: 'Русский', nameEn: 'Russian', sortOrder: 6 },
    { code: 'IN', nameTr: 'Hintli', nameRu: 'Индиец', nameEn: 'Indian', sortOrder: 7 },
    { code: 'KR', nameTr: 'Koreli', nameRu: 'Кореец', nameEn: 'Korean', sortOrder: 8 },
    { code: 'KG', nameTr: 'Kırgız', nameRu: 'Киргиз', nameEn: 'Kyrgyz', sortOrder: 9 },
    { code: 'KZ', nameTr: 'Kazak', nameRu: 'Казах', nameEn: 'Kazakh', sortOrder: 10 },
    { code: 'GE', nameTr: 'Gürcü', nameRu: 'Грузин', nameEn: 'Georgian', sortOrder: 11 },
    { code: 'AM', nameTr: 'Ermeni', nameRu: 'Армянин', nameEn: 'Armenian', sortOrder: 12 },
  ]
  for (const n of nationalities) {
    await prisma.nationality.upsert({ where: { code: n.code }, update: {}, create: n })
  }
  console.log('✅ Nationalities created')

  // ==================== PROFESSIONS ====================
  const professions = [
    { code: 'ISCI', nameTr: 'İşçi', nameRu: 'Рабочий', nameEn: 'Worker', sortOrder: 1 },
    { code: 'USTA', nameTr: 'Usta', nameRu: 'Мастер', nameEn: 'Foreman/Skilled Worker', sortOrder: 2 },
    { code: 'KALIPCI', nameTr: 'Kalıpçı', nameRu: 'Опалубщик', nameEn: 'Formwork Worker', sortOrder: 3 },
    { code: 'DEMIRCI', nameTr: 'Demirci', nameRu: 'Арматурщик', nameEn: 'Rebar Worker', sortOrder: 4 },
    { code: 'BETONCU', nameTr: 'Betoncu', nameRu: 'Бетонщик', nameEn: 'Concrete Worker', sortOrder: 5 },
    { code: 'KAYNAK', nameTr: 'Kaynakçı', nameRu: 'Сварщик', nameEn: 'Welder', sortOrder: 6 },
    { code: 'ELEKTRIK', nameTr: 'Elektrikçi', nameRu: 'Электрик', nameEn: 'Electrician', sortOrder: 7 },
    { code: 'TESISAT', nameTr: 'Tesisatçı', nameRu: 'Сантехник', nameEn: 'Plumber', sortOrder: 8 },
    { code: 'OPERATOR', nameTr: 'Operatör', nameRu: 'Оператор', nameEn: 'Equipment Operator', sortOrder: 9 },
    { code: 'SOFOR', nameTr: 'Şoför', nameRu: 'Водитель', nameEn: 'Driver', sortOrder: 10 },
    { code: 'FORMEN', nameTr: 'Formen', nameRu: 'Бригадир', nameEn: 'Foreman', sortOrder: 11 },
    { code: 'MUHENDIS', nameTr: 'Mühendis', nameRu: 'Инженер', nameEn: 'Engineer', sortOrder: 12 },
    { code: 'MIMAR', nameTr: 'Mimar', nameRu: 'Архитектор', nameEn: 'Architect', sortOrder: 13 },
    { code: 'OFIS', nameTr: 'Ofis Personeli', nameRu: 'Офисный сотрудник', nameEn: 'Office Staff', sortOrder: 14 },
    { code: 'BOYACI', nameTr: 'Boyacı', nameRu: 'Маляр', nameEn: 'Painter', sortOrder: 15 },
    { code: 'IZOLASYON', nameTr: 'İzolasyoncu', nameRu: 'Изолировщик', nameEn: 'Insulation Worker', sortOrder: 16 },
  ]
  for (const p of professions) {
    await prisma.profession.upsert({ where: { code: p.code }, update: {}, create: p })
  }
  console.log('✅ Professions created')

  // ==================== DEPARTMENTS ====================
  const departments = [
    { code: 'YONETIM', nameTr: 'Yönetim', nameRu: 'Управление', nameEn: 'Management', sortOrder: 1 },
    { code: 'IK', nameTr: 'İnsan Kaynakları', nameRu: 'Кадры', nameEn: 'Human Resources', sortOrder: 2 },
    { code: 'MUHASEBE', nameTr: 'Muhasebe', nameRu: 'Бухгалтерия', nameEn: 'Accounting', sortOrder: 3 },
    { code: 'INSAAT', nameTr: 'İnşaat', nameRu: 'Строительство', nameEn: 'Construction', sortOrder: 4 },
    { code: 'MEKANIK', nameTr: 'Mekanik', nameRu: 'Механический', nameEn: 'Mechanical', sortOrder: 5 },
    { code: 'ELEKTRIK', nameTr: 'Elektrik', nameRu: 'Электрический', nameEn: 'Electrical', sortOrder: 6 },
    { code: 'LOJISTIK', nameTr: 'Lojistik', nameRu: 'Логистика', nameEn: 'Logistics', sortOrder: 7 },
    { code: 'GUVENLIK', nameTr: 'İş Güvenliği', nameRu: 'Охрана труда', nameEn: 'Safety', sortOrder: 8 },
  ]
  for (const d of departments) {
    await prisma.department.upsert({ where: { code: d.code }, update: {}, create: d })
  }
  console.log('✅ Departments created')

  // ==================== EMPLOYEE TYPES ====================
  const employeeTypes = [
    { code: 'WORKER', nameTr: 'İşçi', nameRu: 'Рабочий', nameEn: 'Worker', sortOrder: 1 },
    { code: 'SKILLED', nameTr: 'Usta', nameRu: 'Мастер', nameEn: 'Skilled Worker', sortOrder: 2 },
    { code: 'FOREMAN', nameTr: 'Formen', nameRu: 'Бригадир', nameEn: 'Foreman', sortOrder: 3 },
    { code: 'ENGINEER', nameTr: 'Mühendis', nameRu: 'Инженер', nameEn: 'Engineer', sortOrder: 4 },
    { code: 'OFFICE', nameTr: 'Ofis Personeli', nameRu: 'Офисный сотрудник', nameEn: 'Office Staff', sortOrder: 5 },
    { code: 'MANAGER', nameTr: 'Yönetici', nameRu: 'Руководитель', nameEn: 'Manager', sortOrder: 6 },
  ]
  for (const et of employeeTypes) {
    await prisma.employeeType.upsert({ where: { code: et.code }, update: {}, create: et })
  }
  console.log('✅ Employee types created')

  // ==================== SHIFTS ====================
  const shifts = [
    { code: 'GUNDUZ', nameTr: 'Gündüz', nameRu: 'Дневная', nameEn: 'Day Shift', startTime: '08:00', endTime: '17:00', breakMinutes: 60, isNightShift: false },
    { code: 'GECE', nameTr: 'Gece', nameRu: 'Ночная', nameEn: 'Night Shift', startTime: '20:00', endTime: '08:00', breakMinutes: 60, isNightShift: true },
    { code: 'UZUN', nameTr: 'Uzun Mesai', nameRu: 'Длинная смена', nameEn: 'Long Shift', startTime: '07:00', endTime: '19:00', breakMinutes: 90, isNightShift: false },
  ]
  for (const s of shifts) {
    await prisma.shift.upsert({ where: { code: s.code }, update: {}, create: s })
  }
  console.log('✅ Shifts created')

  // ==================== DOCUMENT TYPES ====================
  const documentTypes = [
    { code: 'PASSPORT', nameTr: 'Pasaport', nameRu: 'Паспорт', nameEn: 'Passport', category: 'IDENTITY', hasExpiry: true, defaultAlertDays: 90, sortOrder: 1 },
    { code: 'MIGRATION_CARD', nameTr: 'Göç Kartı', nameRu: 'Миграционная карта', nameEn: 'Migration Card', category: 'IMMIGRATION', hasExpiry: true, defaultAlertDays: 30, sortOrder: 2 },
    { code: 'REGISTRATION', nameTr: 'Kayıt (Регистрация)', nameRu: 'Регистрация', nameEn: 'Registration', category: 'IMMIGRATION', hasExpiry: true, defaultAlertDays: 30, sortOrder: 3 },
    { code: 'PATENT', nameTr: 'Patent', nameRu: 'Патент', nameEn: 'Work Patent', category: 'IMMIGRATION', hasExpiry: true, defaultAlertDays: 60, sortOrder: 4 },
    { code: 'VISA', nameTr: 'Vize', nameRu: 'Виза', nameEn: 'Visa', category: 'IMMIGRATION', hasExpiry: true, defaultAlertDays: 60, sortOrder: 5 },
    { code: 'WORK_PERMIT', nameTr: 'Çalışma İzni', nameRu: 'Разрешение на работу', nameEn: 'Work Permit', category: 'IMMIGRATION', hasExpiry: true, defaultAlertDays: 90, sortOrder: 6 },
    { code: 'RESIDENCE_PERMIT', nameTr: 'Oturma İzni', nameRu: 'Вид на жительство', nameEn: 'Residence Permit', category: 'IMMIGRATION', hasExpiry: true, defaultAlertDays: 90, sortOrder: 7 },
    { code: 'CONTRACT', nameTr: 'İş Sözleşmesi', nameRu: 'Трудовой договор', nameEn: 'Employment Contract', category: 'EMPLOYMENT', hasExpiry: true, defaultAlertDays: 30, sortOrder: 8 },
    { code: 'MEDICAL', nameTr: 'Sağlık Raporu', nameRu: 'Медицинская справка', nameEn: 'Medical Certificate', category: 'MEDICAL', hasExpiry: true, defaultAlertDays: 30, sortOrder: 9 },
    { code: 'SAFETY_CERT', nameTr: 'İş Güvenliği Belgesi', nameRu: 'Удостоверение по ОТ', nameEn: 'Safety Certificate', category: 'SAFETY', hasExpiry: true, defaultAlertDays: 60, sortOrder: 10 },
    { code: 'SNILS', nameTr: 'SNILS', nameRu: 'СНИЛС', nameEn: 'SNILS', category: 'IDENTITY', hasExpiry: false, defaultAlertDays: 0, sortOrder: 11 },
    { code: 'INN', nameTr: 'INN', nameRu: 'ИНН', nameEn: 'INN (Tax ID)', category: 'IDENTITY', hasExpiry: false, defaultAlertDays: 0, sortOrder: 12 },
    { code: 'BANK_DETAILS', nameTr: 'Banka Bilgileri', nameRu: 'Банковские реквизиты', nameEn: 'Bank Details', category: 'EMPLOYMENT', hasExpiry: false, defaultAlertDays: 0, sortOrder: 13 },
    { code: 'PHOTO', nameTr: 'Fotoğraf', nameRu: 'Фотография', nameEn: 'Photo', category: 'IDENTITY', hasExpiry: false, defaultAlertDays: 0, sortOrder: 14 },
    { code: 'TRANSLATION', nameTr: 'Tercüme', nameRu: 'Перевод', nameEn: 'Translation', category: 'IDENTITY', hasExpiry: false, defaultAlertDays: 0, sortOrder: 15 },
    { code: 'SITE_PASS', nameTr: 'Şantiye Kartı', nameRu: 'Пропуск на объект', nameEn: 'Site Pass', category: 'EMPLOYMENT', hasExpiry: true, defaultAlertDays: 30, sortOrder: 16 },
  ]
  for (const dt of documentTypes) {
    await prisma.documentType.upsert({ where: { code: dt.code }, update: {}, create: dt })
  }
  console.log('✅ Document types created')

  // ==================== DOCUMENT REQUIREMENTS ====================
  const docReqs = [
    { docCode: 'PASSPORT', statuses: ['PATENT', 'VISA', 'WORK_PERMIT', 'RESIDENCE_PERMIT'] },
    { docCode: 'MIGRATION_CARD', statuses: ['PATENT', 'VISA', 'WORK_PERMIT'] },
    { docCode: 'REGISTRATION', statuses: ['PATENT', 'VISA', 'WORK_PERMIT', 'RESIDENCE_PERMIT'] },
    { docCode: 'PATENT', statuses: ['PATENT'] },
    { docCode: 'VISA', statuses: ['VISA'] },
    { docCode: 'WORK_PERMIT', statuses: ['WORK_PERMIT'] },
    { docCode: 'RESIDENCE_PERMIT', statuses: ['RESIDENCE_PERMIT'] },
    { docCode: 'CONTRACT', statuses: ['LOCAL', 'PATENT', 'VISA', 'WORK_PERMIT', 'RESIDENCE_PERMIT'] },
    { docCode: 'SNILS', statuses: ['LOCAL', 'PATENT', 'VISA', 'WORK_PERMIT', 'RESIDENCE_PERMIT'] },
    { docCode: 'INN', statuses: ['LOCAL', 'PATENT', 'WORK_PERMIT', 'RESIDENCE_PERMIT'] },
    { docCode: 'MEDICAL', statuses: ['LOCAL', 'PATENT', 'VISA', 'WORK_PERMIT', 'RESIDENCE_PERMIT'] },
    { docCode: 'SAFETY_CERT', statuses: ['LOCAL', 'PATENT', 'VISA', 'WORK_PERMIT', 'RESIDENCE_PERMIT'] },
  ]
  for (const req of docReqs) {
    const docType = await prisma.documentType.findUnique({ where: { code: req.docCode } })
    if (docType) {
      for (const status of req.statuses) {
        await prisma.documentRequirement.upsert({
          where: { documentTypeId_workStatusType: { documentTypeId: docType.id, workStatusType: status } },
          update: {},
          create: { documentTypeId: docType.id, workStatusType: status },
        })
      }
    }
  }
  console.log('✅ Document requirements created')

  // ==================== LEAVE TYPES ====================
  const leaveTypes = [
    { code: 'ANNUAL', nameTr: 'Yıllık İzin', nameRu: 'Ежегодный отпуск', nameEn: 'Annual Leave', isPaid: true, maxDaysYear: 28, sortOrder: 1 },
    { code: 'UNPAID', nameTr: 'Ücretsiz İzin', nameRu: 'Отпуск без содержания', nameEn: 'Unpaid Leave', isPaid: false, maxDaysYear: null, sortOrder: 2 },
    { code: 'SICK', nameTr: 'Hastalık İzni', nameRu: 'Больничный', nameEn: 'Sick Leave', isPaid: true, maxDaysYear: null, sortOrder: 3 },
    { code: 'PERSONAL', nameTr: 'Mazeret İzni', nameRu: 'Отгул', nameEn: 'Personal Leave', isPaid: true, maxDaysYear: 5, sortOrder: 4 },
    { code: 'ROTATION', nameTr: 'Rotasyon İzni', nameRu: 'Ротационный отпуск', nameEn: 'Rotation Leave', isPaid: true, maxDaysYear: null, sortOrder: 5 },
  ]
  for (const lt of leaveTypes) {
    await prisma.leaveType.upsert({ where: { code: lt.code }, update: {}, create: lt })
  }
  console.log('✅ Leave types created')

  // ==================== ASSET CATEGORIES ====================
  const assetCategories = [
    { code: 'TOOL', nameTr: 'Alet/Ekipman', nameRu: 'Инструмент', nameEn: 'Tool/Equipment', sortOrder: 1 },
    { code: 'PPE', nameTr: 'KKD (Kişisel Koruyucu)', nameRu: 'СИЗ', nameEn: 'PPE', sortOrder: 2 },
    { code: 'DEVICE', nameTr: 'Cihaz', nameRu: 'Прибор', nameEn: 'Device', sortOrder: 3 },
    { code: 'PHONE', nameTr: 'Telefon', nameRu: 'Телефон', nameEn: 'Phone', sortOrder: 4 },
    { code: 'KEY', nameTr: 'Anahtar/Kart', nameRu: 'Ключ/Карта', nameEn: 'Key/Card', sortOrder: 5 },
    { code: 'VEHICLE', nameTr: 'Araç', nameRu: 'Транспорт', nameEn: 'Vehicle', sortOrder: 6 },
    { code: 'LAPTOP', nameTr: 'Laptop/Bilgisayar', nameRu: 'Ноутбук/ПК', nameEn: 'Laptop/Computer', sortOrder: 7 },
  ]
  for (const ac of assetCategories) {
    await prisma.assetCategory.upsert({ where: { code: ac.code }, update: {}, create: ac })
  }
  console.log('✅ Asset categories created')

  // ==================== PAYROLL RULES ====================
  const payrollRules = [
    { code: 'NDFL_RESIDENT', nameTr: 'NDFL (Yerleşik)', nameRu: 'НДФЛ (Резидент)', nameEn: 'NDFL (Resident)', category: 'TAX', rate: 13.0000 },
    { code: 'NDFL_NON_RESIDENT', nameTr: 'NDFL (Yerleşik Olmayan)', nameRu: 'НДФЛ (Нерезидент)', nameEn: 'NDFL (Non-Resident)', category: 'TAX', rate: 30.0000 },
    { code: 'NDFL_PATENT', nameTr: 'NDFL (Patent)', nameRu: 'НДФЛ (Патент)', nameEn: 'NDFL (Patent)', category: 'TAX', rate: 13.0000 },
    { code: 'EMPLOYER_PFR', nameTr: 'İşveren PFR', nameRu: 'Работодатель ПФР', nameEn: 'Employer PFR', category: 'EMPLOYER_CONTRIBUTION', rate: 22.0000 },
    { code: 'EMPLOYER_FSS', nameTr: 'İşveren FSS', nameRu: 'Работодатель ФСС', nameEn: 'Employer FSS', category: 'EMPLOYER_CONTRIBUTION', rate: 2.9000 },
    { code: 'EMPLOYER_FOMS', nameTr: 'İşveren FOMS', nameRu: 'Работодатель ФОМС', nameEn: 'Employer FOMS', category: 'EMPLOYER_CONTRIBUTION', rate: 5.1000 },
  ]
  for (const pr of payrollRules) {
    const rule = await prisma.payrollRule.upsert({
      where: { code: pr.code },
      update: {},
      create: { code: pr.code, nameTr: pr.nameTr, nameRu: pr.nameRu, nameEn: pr.nameEn, category: pr.category },
    })
    // Create initial version
    const existingVersion = await prisma.payrollRuleVersion.findFirst({
      where: { payrollRuleId: rule.id },
    })
    if (!existingVersion) {
      await prisma.payrollRuleVersion.create({
        data: {
          payrollRuleId: rule.id,
          rate: pr.rate,
          isPercentage: true,
          effectiveFrom: new Date('2024-01-01'),
        },
      })
    }
  }
  console.log('✅ Payroll rules created')

  // ==================== EARNING CATEGORIES ====================
  const earningCategories = [
    { code: 'BONUS', nameTr: 'Prim', nameRu: 'Премия', nameEn: 'Bonus', sortOrder: 1 },
    { code: 'TRANSPORT', nameTr: 'Yol', nameRu: 'Транспорт', nameEn: 'Transport', sortOrder: 2 },
    { code: 'MEAL', nameTr: 'Yemek', nameRu: 'Питание', nameEn: 'Meal', sortOrder: 3 },
    { code: 'ACCOMMODATION', nameTr: 'Konaklama', nameRu: 'Проживание', nameEn: 'Accommodation', sortOrder: 4 },
    { code: 'OVERTIME_PAY', nameTr: 'Fazla Mesai', nameRu: 'Сверхурочные', nameEn: 'Overtime Pay', sortOrder: 5 },
  ]
  for (const ec of earningCategories) {
    await prisma.earningCategory.upsert({ where: { code: ec.code }, update: {}, create: ec })
  }

  // ==================== DEDUCTION CATEGORIES ====================
  const deductionCategories = [
    { code: 'ADVANCE', nameTr: 'Avans', nameRu: 'Аванс', nameEn: 'Advance', sortOrder: 1 },
    { code: 'PENALTY', nameTr: 'Ceza', nameRu: 'Штраф', nameEn: 'Penalty', sortOrder: 2 },
    { code: 'ASSET_LOSS', nameTr: 'Zimmet Kaybı', nameRu: 'Утеря имущества', nameEn: 'Asset Loss', sortOrder: 3 },
    { code: 'PATENT_TAX', nameTr: 'Patent Vergisi', nameRu: 'Патентный налог', nameEn: 'Patent Tax', sortOrder: 4 },
  ]
  for (const dc of deductionCategories) {
    await prisma.deductionCategory.upsert({ where: { code: dc.code }, update: {}, create: dc })
  }
  console.log('✅ Earning/Deduction categories created')

  // ==================== ALERT RULES ====================
  const alertRules = [
    { code: 'VISA_EXPIRY', nameTr: 'Vize Bitiş', nameRu: 'Истечение визы', nameEn: 'Visa Expiry', entity: 'VISA', dateField: 'visaEnd', warningDays: 30, criticalDays: 7 },
    { code: 'PATENT_EXPIRY', nameTr: 'Patent Bitiş', nameRu: 'Истечение патента', nameEn: 'Patent Expiry', entity: 'PATENT', dateField: 'patentEnd', warningDays: 60, criticalDays: 14 },
    { code: 'REGISTRATION_EXPIRY', nameTr: 'Registration Bitiş', nameRu: 'Истечение регистрации', nameEn: 'Registration Expiry', entity: 'REGISTRATION', dateField: 'registrationEnd', warningDays: 30, criticalDays: 7 },
    { code: 'MIGRATION_CARD_EXPIRY', nameTr: 'Migration Card Bitiş', nameRu: 'Истечение миграционной карты', nameEn: 'Migration Card Expiry', entity: 'MIGRATION_CARD', dateField: 'migrationCardEnd', warningDays: 30, criticalDays: 7 },
    { code: 'PASSPORT_EXPIRY', nameTr: 'Pasaport Bitiş', nameRu: 'Истечение паспорта', nameEn: 'Passport Expiry', entity: 'PASSPORT', dateField: 'passportExpiryDate', warningDays: 90, criticalDays: 30 },
    { code: 'WORK_PERMIT_EXPIRY', nameTr: 'Çalışma İzni Bitiş', nameRu: 'Истечение разрешения на работу', nameEn: 'Work Permit Expiry', entity: 'WORK_PERMIT', dateField: 'workPermitExpiryDate', warningDays: 60, criticalDays: 14 },
    { code: 'CONTRACT_EXPIRY', nameTr: 'Sözleşme Bitiş', nameRu: 'Истечение договора', nameEn: 'Contract Expiry', entity: 'CONTRACT', dateField: 'contractEnd', warningDays: 30, criticalDays: 7 },
    { code: 'PROBATION_END', nameTr: 'Deneme Süresi Bitiş', nameRu: 'Окончание испытательного срока', nameEn: 'Probation End', entity: 'PROBATION', dateField: 'probationEnd', warningDays: 14, criticalDays: 3 },
    { code: 'MEDICAL_EXPIRY', nameTr: 'Sağlık Raporu Bitiş', nameRu: 'Истечение медсправки', nameEn: 'Medical Certificate Expiry', entity: 'MEDICAL', dateField: 'expiryDate', warningDays: 30, criticalDays: 7 },
    { code: 'SAFETY_CERT_EXPIRY', nameTr: 'İş Güvenliği Belgesi Bitiş', nameRu: 'Истечение удостоверения по ОТ', nameEn: 'Safety Certificate Expiry', entity: 'SAFETY_CERT', dateField: 'expiryDate', warningDays: 30, criticalDays: 7 },
    { code: 'RESIDENCE_PERMIT_EXPIRY', nameTr: 'Oturma İzni Bitiş', nameRu: 'Истечение ВНЖ', nameEn: 'Residence Permit Expiry', entity: 'RESIDENCE_PERMIT', dateField: 'residencePermitEnd', warningDays: 90, criticalDays: 30 },
  ]
  for (const ar of alertRules) {
    await prisma.alertRule.upsert({ where: { code: ar.code }, update: {}, create: ar })
  }
  console.log('✅ Alert rules created')

  // ==================== DEFAULT SETTINGS ====================
  const settings = [
    { category: 'GENERAL', key: 'company.name', value: 'SAELA', dataType: 'STRING' },
    { category: 'GENERAL', key: 'company.timezone', value: 'Europe/Moscow', dataType: 'STRING' },
    { category: 'GENERAL', key: 'company.currency', value: 'RUB', dataType: 'STRING' },
    { category: 'GENERAL', key: 'company.locale', value: 'tr', dataType: 'STRING' },
    { category: 'STORAGE', key: 'storage.folderTemplate', value: '/personel/{employee_no}/{document_type}/{yyyy}/{file}', dataType: 'STRING' },
    { category: 'PAYROLL', key: 'payroll.workingDaysPerMonth', value: '22', dataType: 'NUMBER' },
    { category: 'PAYROLL', key: 'payroll.workingHoursPerDay', value: '8', dataType: 'NUMBER' },
    { category: 'PAYROLL', key: 'payroll.nightShiftStart', value: '22:00', dataType: 'STRING' },
    { category: 'PAYROLL', key: 'payroll.nightShiftEnd', value: '06:00', dataType: 'STRING' },
  ]
  for (const s of settings) {
    await prisma.setting.upsert({ where: { key: s.key }, update: {}, create: s })
  }
  console.log('✅ Default settings created')

  // ==================== DEMO WORKSITE ====================
  await prisma.worksite.upsert({
    where: { code: 'MSK-01' },
    update: {},
    create: {
      code: 'MSK-01',
      name: 'Москва - Жилой Комплекс',
      address: 'г. Москва, ул. Строителей, д. 1',
      city: 'Москва',
      region: 'Московская область',
      startDate: new Date('2024-01-15'),
      projectManager: 'Ahmet Yılmaz',
      siteManager: 'Иван Петров',
      client: 'ООО "СтройИнвест"',
      status: 'ACTIVE',
    },
  })
  await prisma.worksite.upsert({
    where: { code: 'SPB-01' },
    update: {},
    create: {
      code: 'SPB-01',
      name: 'Санкт-Петербург - Бизнес Центр',
      address: 'г. Санкт-Петербург, Невский пр., д. 100',
      city: 'Санкт-Петербург',
      region: 'Ленинградская область',
      startDate: new Date('2024-06-01'),
      projectManager: 'Mehmet Demir',
      siteManager: 'Сергей Козлов',
      client: 'ЗАО "НеваСтрой"',
      status: 'ACTIVE',
    },
  })
  console.log('✅ Demo worksites created')

  console.log('\n🎉 Seed completed successfully!')
  console.log('📧 Login: admin@saela.com')
  console.log('🔑 Password: Admin123!')
}

main()
  .catch((e) => {
    console.error('Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
