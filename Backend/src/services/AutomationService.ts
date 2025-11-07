import axios from 'axios';
import * as dotenv from 'dotenv';
import { EmailDocument } from '../interfaces/Email';

// Load environment variables (ensures we get the URLs)
dotenv.config();

// Load URLs from the .env file. Use fallback message if not set.
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL; 
const EXTERNAL_WEBHOOK_URL = process.env.EXTERNAL_WEBHOOK_URL; 

export class AutomationService {
    
    /**
     * Triggers notifications and webhooks when an email is marked as 'Interested'.
     * This fulfills the Point 4 requirements.
     * @param email The categorized email document.
     */
    public async triggerInterestedAutomation(email: EmailDocument): Promise<void> {
        console.log(`[Automation] Triggering automation for ${email.id} (Category: ${email.ai_category})`);

        // 1. Send Slack Notification (Point 4 requirement)
        if (SLACK_WEBHOOK_URL) {
            await this.sendSlackNotification(email);
        } else {
            console.warn('[Automation] SLACK_WEBHOOK_URL not set. Skipping Slack notification.');
        }

        // 2. Trigger External Webhook (Point 4 requirement)
        if (EXTERNAL_WEBHOOK_URL) {
            await this.triggerExternalWebhook(email);
        } else {
            console.warn('[Automation] EXTERNAL_WEBHOOK_URL not set. Skipping external webhook.');
        }
    }

    /**
     * Sends a formatted Slack notification using blocks for a clean card appearance.
     */
    private async sendSlackNotification(email: EmailDocument): Promise<void> {
        const payload = {
            blocks: [
                {
                    type: "header",
                    text: {
                        type: "plain_text",
                        text: "🔥 NEW LEAD: Interested"
                    }
                },
                {
                    type: "section",
                    fields: [
                        { type: "mrkdwn", text: `*Account:*\n${email.account_id}` },
                        { type: "mrkdwn", text: `*From:*\n${email.from}` }
                    ]
                },
                {
                    type: "section",
                    text: {
                        type: "mrkdwn",
                        text: `*Subject:*\n${email.subject}`
                    }
                }
            ]
        };

        try {
            // axios post request to the Slack Webhook URL
            await axios.post(SLACK_WEBHOOK_URL!, payload);
            console.log('[Automation] Slack notification sent successfully.');
        } catch (error) {
             const errorMsg = (error instanceof Error) ? error.message : String(error);
             console.error(`[Elasticsearch] Failed to index email ID ${email.id}:`, errorMsg);
        }
    }

    /**
     * Triggers a generic POST request to an external webhook URL (e.g., webhook.site) 
     * to initiate external automation.
     */
    private async triggerExternalWebhook(email: EmailDocument): Promise<void> {
        try {
            // Send essential data points for external automation systems (like a CRM)
            await axios.post(EXTERNAL_WEBHOOK_URL!, {
                event: 'EMAIL_INTERESTED',
                email: {
                    id: email.id,
                    account_id: email.account_id,
                    subject: email.subject,
                    from: email.from,
                    date: email.date.toISOString(),
                }
            });
            console.log(`[Automation] Webhook triggered to ${EXTERNAL_WEBHOOK_URL}`);
        } catch (error) {
            const errorMsg = (error instanceof Error) ? error.message : String(error);
            console.error(`[Elasticsearch] Failed to index email ID ${email.id}:`, errorMsg);
        }
    }
}