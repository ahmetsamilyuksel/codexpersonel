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
    if (userCount > 0) {
      console.log('✅ Database already seeded, skipping...')
      return
    }

    console.log('🌱 Database is empty, running seed...')
    // Import and run the seed
    const { execSync } = await import('child_process')
    execSync('npx tsx prisma/seed.ts', { stdio: 'inherit', cwd: process.cwd() })

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
