import { PrismaClient } from '@prisma/client'

/**
 * This script runs during Vercel build to ensure database tables exist
 * and seed data is populated. Safe to run multiple times (uses upserts).
 */
async function setup() {
  const prisma = new PrismaClient()

  try {
    // Quick check if database has been seeded
    const userCount = await prisma.user.count()
    if (userCount === 0) {
      console.log('🌱 Database is empty, running seed...')
      const { execSync } = await import('child_process')
      execSync('npx tsx prisma/seed.ts', { stdio: 'inherit', cwd: process.cwd() })
    } else {
      console.log('✅ Base data already seeded.')
    }

    // Check if demo data exists, seed if not
    const demoCount = await prisma.employee.count({ where: { employeeNo: { startsWith: 'DEMO-' } } })
    if (demoCount < 100) {
      console.log('🎭 Seeding demo data...')
      const { execSync } = await import('child_process')
      execSync('npx tsx prisma/seed-demo.ts', { stdio: 'inherit', cwd: process.cwd() })
    } else {
      console.log('✅ Demo data already exists (' + demoCount + ' employees).')
    }

  } catch (err: any) {
    // Table might not exist yet - that's OK, db push will create them
    if (err.code === 'P2021' || err.code === 'P1001') {
      console.log('⚠️  Database tables not ready yet. Run `npx prisma db push` first.')
    } else {
      console.error('Setup error:', err.message)
    }
  } finally {
    await prisma.$disconnect()
  }
}

setup()
