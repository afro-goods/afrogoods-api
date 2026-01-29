import { Injectable } from '@nestjs/common';
import * as Handlebars from 'handlebars';

@Injectable()
export class EmailTemplateService {
  private templates = {
    welcome: `<h1>Welcome {{name}}!</h1><p>We're glad to have you at AfroGoods.</p>`,
    'password-reset': `<p>Hello {{name}},</p><p>Click the link below to reset your password:</p><p><a href="{{token}}" style="color:#0066cc;">Reset password</a></p><p>If the link doesn't work, copy and paste this URL into your browser: {{token}}</p>`,
    'order-confirmation': `<h1>Order Confirmed!</h1><p>Thank you for your order{{#if customerName}}, {{customerName}}{{/if}}.</p><p>Order ID: <strong>{{orderId}}</strong></p><p>Total: {{totalAmount}}</p><p>Items: {{itemCount}}</p>`,
    'order-status-update': `<h1>Order Status Update</h1><p>Hello{{#if customerName}} {{customerName}}{{/if}},</p><p>Your order <strong>{{orderId}}</strong> status has been updated.</p><p>Previous status: {{previousStatus}}</p><p>New status: <strong>{{newStatus}}</strong></p>{{#if adminMessage}}<p>Message: {{adminMessage}}</p>{{/if}}{{#if trackingNumber}}<p>Tracking number: {{trackingNumber}}</p>{{/if}}{{#if orderTrackingUrl}}<p><a href="{{orderTrackingUrl}}">Track your order</a></p>{{/if}}`,
    'order-cancellation-confirmation': `<h1>Order Cancelled</h1><p>Hello{{#if customerName}} {{customerName}}{{/if}},</p><p>Your order <strong>{{orderId}}</strong> has been cancelled.</p><p>Order total: {{orderTotal}}</p><p>Reason: {{cancellationReason}}</p>{{#if hasRefund}}<p>Refund amount: {{refundAmount}}</p><p>Refund timeline: {{refundTimeline}}</p>{{/if}}`,
  };

  render(template: string, data: any) {
    const tpl = this.templates[template as keyof typeof this.templates];
    if (!tpl) throw new Error(`Template "${template}" not found`);
    return Handlebars.compile(tpl)(data);
  }
}