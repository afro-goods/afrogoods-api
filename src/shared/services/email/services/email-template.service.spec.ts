import { Test, TestingModule } from '@nestjs/testing';
import { EmailTemplateService } from '../../shared/services/email/services/email-template.service';

describe('EmailTemplateService', () => {
  let service: EmailTemplateService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EmailTemplateService],
    }).compile();

    service = module.get<EmailTemplateService>(EmailTemplateService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Template Loading', () => {
    it('should load all available templates', () => {
      const availableTemplates = service.getAvailableTemplates();
      expect(availableTemplates).toContain('welcomeemail');
      expect(availableTemplates).toContain('orderconfirmation');
      expect(availableTemplates).toContain('ordercancellation');
      expect(availableTemplates).toContain('orderstatusupdate');
      expect(availableTemplates).toContain('passwordreset');
      expect(availableTemplates.length).toBe(5);
    });
  });

  describe('Welcome Email Template', () => {
    it('should render welcome email with basic data', () => {
      const data = {
        appName: 'AfroGoods',
        name: 'John Doe',
        appUrl: 'https://afrogoods.com',
      };

      const html = service.render('welcomeemail', data);

      expect(html).toContain('Welcome to AfroGoods, John Doe!');
      expect(html).toContain('Start Shopping');
      expect(html).toContain('https://afrogoods.com/shop');
    });

    it('should handle all welcome email variables', () => {
      const data = {
        appName: 'AfroGoods',
        name: 'Jane Smith',
        appUrl: 'https://afrogoods.com',
      };

      const html = service.render('welcomeemail', data);

      expect(html).toContain('Jane Smith');
      expect(html).toContain('AfroGoods');
    });
  });

  describe('Order Confirmation Template', () => {
    it('should render order confirmation with complete order data', () => {
      const data = {
        customerName: 'Alice Johnson',
        orderId: 'ORD-12345',
        orderDate: '2026-02-05T10:00:00Z',
        total: 150.99,
        currency: 'USD',
        itemCount: 2,
        items: [
          {
            name: 'African Fabric',
            quantity: 1,
            price: 89.99,
            variant: 'Blue Pattern',
          },
          {
            name: 'Traditional Beads',
            quantity: 1,
            price: 61.0,
          },
        ],
        subtotal: 150.99,
        shippingCost: 0,
        shippingAddress: {
          name: 'Alice Johnson',
          street: '123 Main St',
          city: 'New York',
          state: 'NY',
          zipCode: '10001',
          country: 'United States',
        },
        paymentMethod: 'Credit Card',
        appUrl: 'https://afrogoods.com',
      };

      const html = service.render('orderconfirmation', data);

      expect(html).toContain('Order Confirmation');
      expect(html).toContain('Alice Johnson');
      expect(html).toContain('ORD-12345');
      expect(html).toContain('African Fabric');
      expect(html).toContain('Traditional Beads');
      expect(html).toContain('$150.99');
      expect(html).toContain('123 Main St');
    });

    it('should handle conditional discount in order confirmation', () => {
      const data = {
        customerName: 'Bob Smith',
        orderId: 'ORD-67890',
        orderDate: '2026-02-05T10:00:00Z',
        total: 135.99,
        currency: 'USD',
        itemCount: 1,
        items: [
          {
            name: 'Premium Kente Cloth',
            quantity: 1,
            price: 149.99,
          },
        ],
        subtotal: 149.99,
        discount: 14.0,
        discountCode: 'AFRO20',
        shippingCost: 0,
        shippingAddress: {
          name: 'Bob Smith',
          street: '456 Oak Ave',
          city: 'Los Angeles',
          state: 'CA',
          zipCode: '90001',
          country: 'United States',
        },
        paymentMethod: 'PayPal',
        appUrl: 'https://afrogoods.com',
      };

      const html = service.render('orderconfirmation', data);

      expect(html).toContain('AFRO20');
      expect(html).toContain('$14.00');
      expect(html).toContain('Discount');
    });

    it('should handle tax calculation in order confirmation', () => {
      const data = {
        customerName: 'Carol White',
        orderId: 'ORD-11111',
        orderDate: '2026-02-05T10:00:00Z',
        total: 108.9,
        currency: 'USD',
        itemCount: 1,
        items: [
          {
            name: 'Shea Butter Gift Set',
            quantity: 1,
            price: 100.0,
          },
        ],
        subtotal: 100.0,
        tax: 8.9,
        shippingCost: 0,
        shippingAddress: {
          name: 'Carol White',
          street: '789 Pine St',
          city: 'Chicago',
          state: 'IL',
          zipCode: '60601',
          country: 'United States',
        },
        paymentMethod: 'Credit Card',
        appUrl: 'https://afrogoods.com',
      };

      const html = service.render('orderconfirmation', data);

      expect(html).toContain('Tax');
      expect(html).toContain('$8.90');
    });
  });

  describe('Order Cancellation Template', () => {
    it('should render order cancellation with cancellation details', () => {
      const data = {
        customerName: 'David Brown',
        orderId: 'ORD-22222',
        orderDate: '2026-02-01T10:00:00Z',
        cancellationDate: '2026-02-03T14:00:00Z',
        orderTotal: 200.0,
        currency: 'USD',
        cancellationReason: 'Customer requested cancellation',
        items: [
          {
            name: 'Ankara Dress',
            quantity: 1,
            price: 200.0,
          },
        ],
        appUrl: 'https://afrogoods.com',
      };

      const html = service.render('ordercancellation', data);

      expect(html).toContain('Order Cancellation Confirmation');
      expect(html).toContain('David Brown');
      expect(html).toContain('ORD-22222');
      expect(html).toContain('Cancellation Reason');
    });

    it('should handle refund information in order cancellation', () => {
      const data = {
        customerName: 'Eva Martinez',
        orderId: 'ORD-33333',
        orderDate: '2026-01-30T10:00:00Z',
        cancellationDate: '2026-02-04T10:00:00Z',
        orderTotal: 150.0,
        currency: 'USD',
        items: [
          {
            name: 'Traditional Mask',
            quantity: 1,
            price: 150.0,
          },
        ],
        hasRefund: true,
        refundAmount: 150.0,
        refundMethod: 'Original Credit Card',
        refundTimeline: '5-7 business days',
        appUrl: 'https://afrogoods.com',
      };

      const html = service.render('ordercancellation', data);

      expect(html).toContain('Refund Information');
      expect(html).toContain('$150.00');
      expect(html).toContain('Original Credit Card');
    });

    it('should handle partial cancellation', () => {
      const data = {
        customerName: 'Frank Wilson',
        orderId: 'ORD-44444',
        orderDate: '2026-02-02T10:00:00Z',
        cancellationDate: '2026-02-04T10:00:00Z',
        orderTotal: 100.0,
        currency: 'USD',
        items: [
          {
            name: 'Cancelled Item',
            quantity: 1,
            price: 50.0,
          },
        ],
        partialCancellation: true,
        remainingOrderId: 'ORD-44444-PARTIAL',
        appUrl: 'https://afrogoods.com',
      };

      const html = service.render('ordercancellation', data);

      expect(html).toContain('Partial Cancellation');
      expect(html).toContain('ORD-44444-PARTIAL');
    });
  });

  describe('Order Status Update Template', () => {
    it('should render order status update for processing status', () => {
      const data = {
        customerName: 'Grace Lee',
        orderId: 'ORD-55555',
        previousStatus: 'Pending',
        newStatus: 'Processing',
        updateDate: '2026-02-05T10:00:00Z',
        appUrl: 'https://afrogoods.com',
      };

      const html = service.render('orderstatusupdate', data);

      expect(html).toContain('Order Status Update');
      expect(html).toContain('Grace Lee');
      expect(html).toContain('ORD-55555');
      expect(html).toContain('Processing');
      expect(html).toContain('Pending');
    });

    it('should render order status update for shipped status with tracking', () => {
      const data = {
        customerName: 'Henry Davis',
        orderId: 'ORD-66666',
        previousStatus: 'Processing',
        newStatus: 'Shipped',
        updateDate: '2026-02-05T10:00:00Z',
        trackingNumber: '1Z999AA10123456784',
        carrier: 'UPS',
        trackingUrl:
          'https://tracking.ups.com/track?tracknum=1Z999AA10123456784',
        estimatedDelivery: '2026-02-08',
        appUrl: 'https://afrogoods.com',
      };

      const html = service.render('orderstatusupdate', data);

      expect(html).toContain('Shipped');
      expect(html).toContain('1Z999AA10123456784');
      expect(html).toContain('UPS');
      expect(html).toContain('Track Your Package');
    });

    it('should render order status update for delivered status', () => {
      const data = {
        customerName: 'Iris Taylor',
        orderId: 'ORD-77777',
        previousStatus: 'Out for Delivery',
        newStatus: 'Delivered',
        updateDate: '2026-02-05T10:00:00Z',
        deliveryDate: '2026-02-05T14:30:00Z',
        appUrl: 'https://afrogoods.com',
      };

      const html = service.render('orderstatusupdate', data);

      expect(html).toContain('Delivered');
      expect(html).toContain('Leave a Review');
    });

    it('should render order status update for cancelled status with refund info', () => {
      const data = {
        customerName: 'Jack Anderson',
        orderId: 'ORD-88888',
        previousStatus: 'Processing',
        newStatus: 'Cancelled',
        updateDate: '2026-02-05T10:00:00Z',
        refundInfo:
          'Full refund of $175.50 will be processed within 5-7 business days',
        appUrl: 'https://afrogoods.com',
      };

      const html = service.render('orderstatusupdate', data);

      expect(html).toContain('Cancelled');
      expect(html).toContain('refund');
    });

    it('should render order status update with admin message', () => {
      const data = {
        customerName: 'Kelly Green',
        orderId: 'ORD-99999',
        previousStatus: 'Processing',
        newStatus: 'Processing',
        updateDate: '2026-02-05T10:00:00Z',
        adminMessage: 'Your order is being specially packed with care.',
        appUrl: 'https://afrogoods.com',
      };

      const html = service.render('orderstatusupdate', data);

      expect(html).toContain('Message from');
      expect(html).toContain('Your order is being specially packed with care.');
    });
  });

  describe('Password Reset Template', () => {
    it('should render password reset email with reset link', () => {
      const data = {
        name: 'Michael Johnson',
        appName: 'AfroGoods',
        email: 'michael@example.com',
        resetUrl:
          'https://afrogoods.com/auth/reset-password?token=abc123def456',
        expiryMinutes: 60,
      };

      const html = service.render('passwordreset', data);

      expect(html).toContain('Password Reset Request');
      expect(html).toContain('Michael Johnson');
      expect(html).toContain('michael@example.com');
      expect(html).toContain('https://afrogoods.com/auth/reset-password?token');
      expect(html).toContain('abc123def456');
      expect(html).toContain('60');
      expect(html).toContain('minutes');
    });

    it('should include security notice in password reset', () => {
      const data = {
        name: 'Nicole Brown',
        appName: 'AfroGoods',
        email: 'nicole@example.com',
        resetUrl:
          'https://afrogoods.com/auth/reset-password?token=xyz789uvw012',
        expiryMinutes: 30,
      };

      const html = service.render('passwordreset', data);

      expect(html).toContain('Security Notice');
      expect(html).toContain('request');
    });
  });

  describe('Helper Functions', () => {
    it('should format currency correctly', () => {
      const data = {
        amount: 99.99,
        currency: 'USD',
      };

      const html = service.render('welcomeemail', {
        appName: 'Test',
        name: 'User',
        appUrl: 'https://test.com',
      });

      expect(html).toBeTruthy();
    });

    it('should format dates correctly in order confirmation', () => {
      const data = {
        customerName: 'Test User',
        orderId: 'TEST-001',
        orderDate: '2026-02-05T10:00:00Z',
        total: 100,
        currency: 'USD',
        itemCount: 1,
        items: [{ name: 'Test Item', quantity: 1, price: 100 }],
        subtotal: 100,
        shippingCost: 0,
        shippingAddress: {
          name: 'Test User',
          street: 'Test St',
          city: 'Test City',
          state: 'TS',
          zipCode: '00000',
          country: 'Test Country',
        },
        paymentMethod: 'Card',
        appUrl: 'https://test.com',
      };

      const html = service.render('orderconfirmation', data);

      expect(html).toContain('February 5, 2026');
    });
  });

  describe('Base Layout', () => {
    it('should include base layout with header and footer', () => {
      const data = {
        appName: 'AfroGoods',
        name: 'John Doe',
        appUrl: 'https://afrogoods.com',
        email: 'john@example.com',
      };

      const html = service.render('welcomeemail', data, true);

      // Should have HTML structure
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html lang="en">');

      // Should have header
      expect(html).toContain('AfroGoods');
      expect(html).toContain('Authentic African Products & Goods');

      // Should have main content
      expect(html).toContain('John Doe');

      // Should have footer
      expect(html).toContain('Help & Support');
      expect(html).toContain('Connect With Us');
      expect(html).toContain('Legal');
      expect(html).toContain('Privacy Policy');
      expect(html).toContain('Terms of Service');
      expect(html).toContain('Unsubscribe');
    });

    it('should render without layout when includeLayout is false', () => {
      const data = {
        appName: 'AfroGoods',
        name: 'Jane Doe',
        appUrl: 'https://afrogoods.com',
      };

      const html = service.render('welcomeemail', data, false);

      // Should not have HTML structure
      expect(html).not.toContain('<!DOCTYPE html>');
      expect(html).not.toContain('</html>');

      // Should only have content
      expect(html).toContain('Welcome to AfroGoods, Jane Doe!');
    });

    it('should include current year in footer', () => {
      const data = {
        appName: 'AfroGoods',
        name: 'Test User',
        appUrl: 'https://afrogoods.com',
      };

      const html = service.render('welcomeemail', data, true);
      const currentYear = new Date().getFullYear();

      expect(html).toContain(currentYear.toString());
    });

    it('should include footer links with app URL', () => {
      const data = {
        appName: 'Test App',
        name: 'User',
        appUrl: 'https://example.com',
      };

      const html = service.render('welcomeemail', data, true);

      expect(html).toContain('https://example.com/help/faq');
      expect(html).toContain('https://example.com/contact');
      expect(html).toContain('https://example.com/privacy');
      expect(html).toContain('https://example.com/terms');
    });
  });
});
