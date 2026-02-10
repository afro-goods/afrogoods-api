import { Injectable, Logger } from '@nestjs/common';
import * as Handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class EmailTemplateService {
    private readonly logger = new Logger(EmailTemplateService.name);
    private templates: Record<string, Handlebars.TemplateDelegate> = {};
    private baseLayout: Handlebars.TemplateDelegate | null = null;
    private templatesLoaded = false;

    constructor() {
        this.loadTemplates();
        this.registerHelpers();
    }

    private loadTemplates(): void {
        const templatesDir = path.join(__dirname, '../templates');

        // Check if templates directory exists
        if (!fs.existsSync(templatesDir)) {
            this.logger.warn(
                `Templates directory not found: ${templatesDir}. Email templates will not be available.`,
            );
            return;
        }

        const templateFiles = [
            'welcomeemail.html',
            'orderconfirmation.html',
            'ordercancellation.html',
            'orderstatusupdate.html',
            'passwordreset.html',
        ];

        // Load base layout first
        try {
            const layoutPath = path.join(templatesDir, 'base-layout.html');
            if (fs.existsSync(layoutPath)) {
                const layoutContent = fs.readFileSync(layoutPath, 'utf-8');
                this.baseLayout = Handlebars.compile(layoutContent);
                this.logger.debug('Loaded base layout template');
            } else {
                this.logger.warn('Base layout template not found');
            }
        } catch (error) {
            this.logger.warn(`Failed to load base layout: ${error.message}`);
        }

        // Load individual templates
        let loadedCount = 0;
        templateFiles.forEach((file) => {
            try {
                const templatePath = path.join(templatesDir, file);
                if (fs.existsSync(templatePath)) {
                    const templateContent = fs.readFileSync(templatePath, 'utf-8');
                    const templateName = file.replace('.html', '');
                    this.templates[templateName] = Handlebars.compile(templateContent);
                    this.logger.debug(`Loaded template: ${templateName}`);
                    loadedCount++;
                } else {
                    this.logger.warn(`Template file not found: ${file}`);
                }
            } catch (error) {
                this.logger.warn(`Failed to load template ${file}: ${error.message}`);
            }
        });

        this.templatesLoaded = loadedCount > 0;
        if (this.templatesLoaded) {
            this.logger.log(`Loaded ${loadedCount} email templates`);
        } else {
            this.logger.warn('No email templates loaded. Emails will use fallback text.');
        }
    }

    private registerHelpers(): void {
        // Currency formatting helper
        Handlebars.registerHelper(
            'currency',
            (amount: number, currencyCode: string = 'USD') => {
                if (typeof amount !== 'number') {
                    return amount;
                }
                const formatter = new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: currencyCode,
                });
                return formatter.format(amount);
            },
        );

        // Date formatting helper
        Handlebars.registerHelper('formatDate', (date: string | Date) => {
            try {
                const dateObj = typeof date === 'string' ? new Date(date) : date;
                return dateObj.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                });
            } catch (error) {
                this.logger.error(`Failed to format date: ${error.message}`);
                return date;
            }
        });

        // Time formatting helper
        Handlebars.registerHelper('formatTime', (date: string | Date) => {
            try {
                const dateObj = typeof date === 'string' ? new Date(date) : date;
                return dateObj.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true,
                });
            } catch (error) {
                this.logger.error(`Failed to format time: ${error.message}`);
                return date;
            }
        });

        // Pluralize helper
        Handlebars.registerHelper('pluralize', (count: number, word: string) => {
            return count === 1 ? word : word + 's';
        });

        // Equality check helper
        Handlebars.registerHelper('eq', (a: any, b: any) => {
            return a === b;
        });
    }

    render(
        templateName: string,
        data: Record<string, any> = {},
        includeLayout: boolean = true,
    ): string {
        const template = this.templates[templateName];

        if (!template) {
            // Return a simple fallback HTML if template not found
            this.logger.warn(`Template '${templateName}' not found, using fallback`);
            return this.renderFallback(templateName, data);
        }

        try {
            const contentHtml = template(data);

            if (!includeLayout || !this.baseLayout) {
                return contentHtml;
            }

            // Prepare data for layout
            const layoutData = {
                ...data,
                content: contentHtml,
                currentYear: new Date().getFullYear(),
                appName: data.appName || 'AfroGoods',
                appUrl: data.appUrl || 'https://afrogoods.com',
                customerEmail: data.customerEmail || data.email || '',
                companyAddress: data.companyAddress || '123 AfroGoods St, New York, NY 10001',
            };

            return this.baseLayout(layoutData);
        } catch (error) {
            this.logger.error(
                `Failed to render template '${templateName}': ${error.message}`,
            );
            return this.renderFallback(templateName, data);
        }
    }

    private renderFallback(templateName: string, data: Record<string, any>): string {
        // Simple fallback HTML for when templates aren't available
        const title = templateName.replace(/([A-Z])/g, ' $1').trim();
        return `
            <html>
            <body style="font-family: Arial, sans-serif; padding: 20px;">
                <h1>AfroGoods</h1>
                <h2>${title}</h2>
                <p>Thank you for using AfroGoods.</p>
                ${data.orderId ? `<p>Order ID: ${data.orderId}</p>` : ''}
                ${data.customerName ? `<p>Dear ${data.customerName},</p>` : ''}
                <p>If you have any questions, please contact our support team.</p>
            </body>
            </html>
        `;
    }

    getAvailableTemplates(): string[] {
        return Object.keys(this.templates);
    }
}
