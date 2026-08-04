import { Router } from 'express';
import { CustomerController } from '../controllers/customer.controller';
import {
  validateBody,
  validateQuery,
  createCustomerSchema,
  updateCustomerSchema,
  paginationAndSortSchema,
  searchCustomersSchema,
} from '../middleware/validation.middleware';

const router = Router();
const controller = new CustomerController();

// Create customer
router.post('/', validateBody(createCustomerSchema), controller.createCustomer);

// Search customers - placed before /:id to avoid ID conflict
router.get('/search', validateQuery(searchCustomersSchema), controller.searchCustomers);

// Get all customers
router.get('/', validateQuery(paginationAndSortSchema), controller.getAllCustomers);

// Get customer by ID
router.get('/:id', controller.getCustomer);

// Update customer
router.patch('/:id', validateBody(updateCustomerSchema), controller.updateCustomer);

// Soft delete customer
router.delete('/:id', controller.deleteCustomer);

export default router;
