import { Injectable } from '@nestjs/common';
import * as Handlebars from 'handlebars';

@Injectable()
export class EmailTemplateService {
  private templates = {
    welcome: `<h1>Welcome {{name}}!</h1><p>We're glad to have you at AfroGoods.</p>`,
    'password-reset': `<p>Hello {{name}}, use this token to reset your password: <strong>{{token}}</strong></p>`,
    'order-confirmation': `<h1>Order Confirmed!</h1><p>Order ID: {{orderId}}</p>`,
    // Add other templates here...
  };

  render(template: string, data: any) {
    const tpl = this.templates[template as keyof typeof this.templates];
    if (!tpl) throw new Error(`Template "${template}" not found`);
    return Handlebars.compile(tpl)(data);
  }
}