import { prisma } from '../config/database';

export interface UpdateInsuranceDTO {
  policyName?: string;
  provider?: string;
  premiumAmount?: number;
  renewalDate?: string;
}

export class InsuranceService {
  public async getInsurance(userId: string) {
    let insurance = await prisma.insurance.findUnique({
      where: { userId },
    });

    if (!insurance) {
      // Create empty default insurance record for user
      insurance = await prisma.insurance.create({
        data: {
          userId,
          policyName: 'Shop Safety Shield',
          provider: 'HDFC ERGO General Insurance',
          premiumAmount: 0.00,
        },
      });
    }

    return insurance;
  }

  public async updateInsurance(userId: string, data: UpdateInsuranceDTO) {
    return prisma.insurance.upsert({
      where: { userId },
      update: {
        ...(data.policyName !== undefined ? { policyName: data.policyName } : {}),
        ...(data.provider !== undefined ? { provider: data.provider } : {}),
        ...(data.premiumAmount !== undefined ? { premiumAmount: data.premiumAmount } : {}),
        ...(data.renewalDate ? { renewalDate: new Date(data.renewalDate) } : {}),
      },
      create: {
        userId,
        policyName: data.policyName || 'Shop Safety Shield',
        provider: data.provider || 'HDFC ERGO General Insurance',
        premiumAmount: data.premiumAmount || 0.00,
        renewalDate: data.renewalDate ? new Date(data.renewalDate) : null,
      },
    });
  }
}
