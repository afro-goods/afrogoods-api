// Admin order notification parameters
export interface AdminOrderNotificationParams {
  adminEmail: string;
  orderId: string;
  totalAmount: number;
  customerName: string;
  customerEmail: string;
}

// Email result interface for return type
export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}
