import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PartnersService } from './partners.service';

describe('PartnersService', () => {
  it('rejects adding a customer with a phone number already in the business', async () => {
    const prisma = {
      customer: {
        findFirst: jest.fn().mockResolvedValue({ id: 'existing-customer' }),
        create: jest.fn(),
      },
    };
    const service = new PartnersService(prisma as unknown as PrismaService);

    await expect(service.createCustomer('business-a', {
      name: 'Customer',
      phone: '9876543210',
    })).rejects.toThrow(ConflictException);
    expect(prisma.customer.findFirst).toHaveBeenCalledWith({
      where: { businessId: 'business-a', isActive: true, phone: { contains: '9876543210' } },
      select: { id: true },
    });
    expect(prisma.customer.create).not.toHaveBeenCalled();
  });

  it('rejects adding a supplier with a phone number already in the business', async () => {
    const prisma = {
      supplier: {
        findFirst: jest.fn().mockResolvedValue({ id: 'existing-supplier' }),
        create: jest.fn(),
      },
    };
    const service = new PartnersService(prisma as unknown as PrismaService);

    await expect(service.createSupplier('business-a', {
      name: 'Supplier',
      companyName: 'Supplier Company',
      phone: '9876543210',
    })).rejects.toThrow(ConflictException);
    expect(prisma.supplier.findFirst).toHaveBeenCalledWith({
      where: { businessId: 'business-a', isActive: true, phone: { contains: '9876543210' } },
      select: { id: true },
    });
    expect(prisma.supplier.create).not.toHaveBeenCalled();
  });

  it('deactivates only a customer belonging to the current business', async () => {
    const prisma = {
      customer: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const service = new PartnersService(prisma as unknown as PrismaService);

    await expect(service.deleteCustomer('business-a', 'customer-id')).resolves.toEqual({
      success: true,
    });
    expect(prisma.customer.updateMany).toHaveBeenCalledWith({
      where: { id: 'customer-id', businessId: 'business-a', isActive: true },
      data: { isActive: false },
    });
  });

  it('does not update a customer outside the current business', async () => {
    const prisma = {
      customer: {
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
      },
    };
    const service = new PartnersService(prisma as unknown as PrismaService);

    await expect(service.updateCustomer('business-a', 'customer-id', {})).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.customer.update).not.toHaveBeenCalled();
  });

  it('deactivates only a supplier belonging to the current business', async () => {
    const prisma = {
      supplier: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const service = new PartnersService(prisma as unknown as PrismaService);

    await expect(service.deleteSupplier('business-a', 'supplier-id')).resolves.toEqual({
      success: true,
    });
    expect(prisma.supplier.updateMany).toHaveBeenCalledWith({
      where: { id: 'supplier-id', businessId: 'business-a', isActive: true },
      data: { isActive: false },
    });
  });
});
