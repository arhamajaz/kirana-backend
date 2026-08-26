import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';

export interface CreateItemDTO {
  name: string;
  qty?: number;
  minReorderQty?: number;
  buyPrice?: number;
  sellPrice?: number;
}

export interface UpdateItemDTO {
  name?: string;
  qty?: number;
  minReorderQty?: number;
  buyPrice?: number;
  sellPrice?: number;
}

export class ItemService {
  public async getItems(userId: string) {
    return prisma.item.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
    });
  }

  public async getItemById(userId: string, id: string) {
    const item = await prisma.item.findFirst({
      where: { id, userId },
    });
    if (!item) {
      throw new AppError('Item not found', 404);
    }
    return item;
  }

  public async createItem(userId: string, data: CreateItemDTO) {
    if (!data.name || data.name.trim() === '') {
      throw new AppError('Item name is required', 400);
    }

    return prisma.item.create({
      data: {
        userId,
        name: data.name.trim(),
        qty: data.qty ?? 0,
        minReorderQty: data.minReorderQty ?? 5,
        buyPrice: data.buyPrice ?? 0,
        sellPrice: data.sellPrice ?? 0,
      },
    });
  }

  public async updateItem(userId: string, id: string, data: UpdateItemDTO) {
    await this.getItemById(userId, id);

    return prisma.item.update({
      where: { id },
      data: {
        ...(data.name ? { name: data.name.trim() } : {}),
        ...(data.qty !== undefined ? { qty: data.qty } : {}),
        ...(data.minReorderQty !== undefined ? { minReorderQty: data.minReorderQty } : {}),
        ...(data.buyPrice !== undefined ? { buyPrice: data.buyPrice } : {}),
        ...(data.sellPrice !== undefined ? { sellPrice: data.sellPrice } : {}),
      },
    });
  }

  public async deleteItem(userId: string, id: string) {
    await this.getItemById(userId, id);
    await prisma.item.delete({
      where: { id },
    });
    return { success: true };
  }
}
