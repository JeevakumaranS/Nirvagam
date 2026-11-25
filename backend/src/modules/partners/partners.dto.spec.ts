import { validateSync } from 'class-validator';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { CreateSupplierDto } from './dto/create-supplier.dto';

describe('partner create DTOs', () => {
  it('accepts a customer without address or GSTIN when the phone has 10 digits', () => {
    const dto = Object.assign(new CreateCustomerDto(), {
      name: 'Customer',
      phone: '9876543210',
    });

    expect(validateSync(dto)).toHaveLength(0);
  });

  it('rejects invalid customer phone and GSTIN lengths', () => {
    const dto = Object.assign(new CreateCustomerDto(), {
      name: 'Customer',
      phone: '12345',
      gstin: '33AABCK1234F1Z',
    });

    expect(validateSync(dto).map(({ property }) => property)).toEqual(
      expect.arrayContaining(['phone', 'gstin']),
    );
  });

  it('limits customer name to 50 characters and city to 30', () => {
    const dto = Object.assign(new CreateCustomerDto(), {
      name: 'C'.repeat(51),
      phone: '9876543210',
      billingCity: 'C'.repeat(31),
    });

    expect(validateSync(dto).map(({ property }) => property)).toEqual(
      expect.arrayContaining(['name', 'billingCity']),
    );
  });

  it('accepts a supplier without address or GSTIN when the phone has 10 digits', () => {
    const dto = Object.assign(new CreateSupplierDto(), {
      name: 'Supplier',
      companyName: 'Supplier Company',
      phone: '9876543210',
    });

    expect(validateSync(dto)).toHaveLength(0);
  });

  it('rejects invalid supplier phone and GSTIN lengths', () => {
    const dto = Object.assign(new CreateSupplierDto(), {
      name: 'Supplier',
      companyName: 'Supplier Company',
      phone: '12345',
      gstin: '33AABCS5432G1Z',
    });

    expect(validateSync(dto).map(({ property }) => property)).toEqual(
      expect.arrayContaining(['phone', 'gstin']),
    );
  });

  it('limits supplier name to 50 characters and city to 30', () => {
    const dto = Object.assign(new CreateSupplierDto(), {
      name: 'S'.repeat(51),
      companyName: 'Supplier Company',
      phone: '9876543210',
      city: 'C'.repeat(31),
    });

    expect(validateSync(dto).map(({ property }) => property)).toEqual(
      expect.arrayContaining(['name', 'city']),
    );
  });

  it('requires a supplier company name', () => {
    const dto = Object.assign(new CreateSupplierDto(), {
      name: 'Supplier',
      phone: '9876543210',
    });

    expect(validateSync(dto).map(({ property }) => property)).toContain('companyName');
  });
});
