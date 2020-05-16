import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
  price?: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateProductService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const findCustomer = await this.customersRepository.findById(customer_id);

    if (!findCustomer) {
      throw new AppError('Customer not found.');
    }

    const findProducts = await this.productsRepository.findAllById(products);

    if (findProducts.length !== products.length) {
      throw new AppError('Products not found.');
    }

    const order = await this.ordersRepository.create({
      customer: findCustomer,
      products: products.map(orderProduct => {
        const dbProduct = findProducts.find(p => p.id === orderProduct.id);

        if (dbProduct && dbProduct.quantity < orderProduct.quantity) {
          throw new AppError('Product with insufficient quantity.');
        }

        if (dbProduct) {
          dbProduct.quantity -= orderProduct.quantity;

          return {
            product_id: dbProduct.id,
            quantity: orderProduct.quantity,
            price: dbProduct.price,
          };
        }
        throw new AppError('Product not found');
      }),
    });

    await this.productsRepository.updateQuantity(products);

    return order;
  }
}

export default CreateProductService;
