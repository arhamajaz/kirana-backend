import { PrismaClient, CompoundingFrequency, TransactionType } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import bcrypt from 'bcryptjs';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding database...');

  // 1. Clean existing data (avoid duplicate keys on multiple runs)
  await prisma.transaction.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.user.deleteMany();

  // 2. Create a test merchant user
  const passwordHash = await bcrypt.hash('password123', 10);
  const user = await prisma.user.create({
    data: {
      email: 'merchant@test.com',
      passwordHash,
      businessName: 'Gupta Kirana & Grain Store',
    },
  });
  console.log(`Created merchant user: ${user.email}`);

  // 3. Create mock customers
  const customer1 = await prisma.customer.create({
    data: {
      userId: user.id,
      name: 'Rajesh Kumar',
      phoneNumber: '9876543210',
      lendingRate: 24.0, // 24% P.A.
      depositRate: 12.0, // 12% P.A.
      compoundingFrequency: CompoundingFrequency.MONTHLY,
      isActive: true,
    },
  });

  const customer2 = await prisma.customer.create({
    data: {
      userId: user.id,
      name: 'Amit Sharma',
      phoneNumber: '9123456789',
      lendingRate: 18.0, // 18% P.A.
      depositRate: 8.0,  // 8% P.A.
      compoundingFrequency: CompoundingFrequency.QUARTERLY,
      isActive: true,
    },
  });
  console.log(`Created customers: ${customer1.name}, ${customer2.name}`);

  // 4. Create mock transactions for Customer 1 (Rajesh Kumar)
  // Monthly compounding, lending rate 24%, deposit rate 12%
  await prisma.transaction.createMany({
    data: [
      {
        customerId: customer1.id,
        type: TransactionType.DEBIT,
        amount: 10000.0,
        date: new Date('2026-01-01T00:00:00Z'),
        interestStartDate: new Date('2026-01-01T00:00:00Z'),
        remarks: 'Rice bag and wheat bulk purchase',
        isVoided: false,
      },
      {
        customerId: customer1.id,
        type: TransactionType.DEBIT,
        amount: 5000.0,
        date: new Date('2026-01-15T00:00:00Z'),
        interestStartDate: new Date('2026-01-15T00:00:00Z'),
        remarks: 'Fertilizers supply',
        isVoided: false,
      },
      {
        customerId: customer1.id,
        type: TransactionType.CREDIT,
        amount: 3000.0,
        date: new Date('2026-02-05T00:00:00Z'),
        interestStartDate: new Date('2026-02-05T00:00:00Z'),
        remarks: 'UPI Payment received',
        isVoided: false,
      },
    ],
  });

  // 5. Create mock transactions for Customer 2 (Amit Sharma)
  // Quarterly compounding, lending rate 18%, deposit rate 8%
  await prisma.transaction.createMany({
    data: [
      {
        customerId: customer2.id,
        type: TransactionType.DEBIT,
        amount: 20000.0,
        date: new Date('2026-01-10T00:00:00Z'),
        // Interest starts 10 days later
        interestStartDate: new Date('2026-01-20T00:00:00Z'),
        remarks: 'Cash loan for store expansion',
        isVoided: false,
      },
      {
        customerId: customer2.id,
        type: TransactionType.CREDIT,
        amount: 5000.0,
        date: new Date('2026-02-28T00:00:00Z'),
        interestStartDate: new Date('2026-02-28T00:00:00Z'),
        remarks: 'Bank transfer received',
        isVoided: false,
      },
    ],
  });

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
