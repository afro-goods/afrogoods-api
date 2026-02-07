import { Injectable, Logger } from '@nestjs/common';
import * as Handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class EmailTemplateService {
    private readonly logger = new Logger(EmailTemplateService.name);
    private templates: Record<string, Handlebars.TemplateDelegate> = {};
    private baseLayout: Handlebars.TemplateDelegate;

    constructor() {
        this.loadTemplates();
        this.registerHelpers();
    }

    private loadTemplates(): void {
        const templatesDir = path.join(__dirname, '../templates');

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
            const layoutContent = fs.readFileSync(layoutPath, 'utf-8');
            this.baseLayout = Handlebars.compile(layoutContent);
            this.logger.debug('Loaded base layout template');
        } catch (error) {
            this.logger.error(`Failed to load base layout: ${error.message}`);
        }

        // Load individual templates
        templateFiles.forEach((file) => {
            try {
                const templatePath = path.join(templatesDir, file);
                const templateContent = fs.readFileSync(templatePath, 'utf-8');
                const templateName = file.replace('.html', '');
                this.templates[templateName] = Handlebars.compile(templateContent);
                this.logger.debug(`Loaded template: ${templateName}`);
            } catch (error) {
                this.logger.error(`Failed to load template ${file}: ${error.message}`);
            }
        });
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
            const errorMsg = `Template '${templateName}' not found`;
            this.logger.error(errorMsg);
            throw new Error(errorMsg);
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
            throw error;
        }
    }

    getAvailableTemplates(): string[] {
        return Object.keys(this.templates);
    }
}
