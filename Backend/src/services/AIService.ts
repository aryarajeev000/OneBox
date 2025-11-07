import OpenAI from 'openai';
import * as dotenv from 'dotenv';
import { AICategory, EmailDocument } from '../interfaces/Email';

// Load environment variables (ensure OPENAI_API_KEY is set in .env)
dotenv.config();

const VALID_CATEGORIES: AICategory[] = [
    'Interested',
    'Meeting Booked',
    'Not Interested',
    'Spam',
    'Out of Office',
    'Uncategorized', // For emails that don't fit the sales labels
];

export class AIService {
    private openai: OpenAI;
    private model = 'gpt-4o-mini'; // Fast and cost-effective model

    constructor() {
        if (!process.env.OPENAI_API_KEY) {
            console.error('OPENAI_API_KEY is not set. AI features are disabled.');
        }
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });
        console.log('[AIService] OpenAI Client Initialized.');
    }

    /**
     * Categorizes an email using the OpenAI API with structured JSON output.
     * @param subject The email subject.
     * @param body The email body text.
     * @returns The determined AICategory.
     */
    public async categorizeEmail(subject: string, body: string): Promise<AICategory> {
        if (!process.env.OPENAI_API_KEY) {
            return 'Uncategorized';
        }

        const systemPrompt = `You are an expert email analyst for a B2B sales outreach platform. Your task is to analyze the provided email subject and body and classify the email into one of the following exact categories: ${VALID_CATEGORIES.join(', ')}. Your response MUST be a single JSON object containing only the 'category' key.`;

        const userPrompt = `SUBJECT: "${subject}"\nBODY: "${body.substring(0, 2000)}..."`; // Limit body to prevent token overflow

        try {
            const response = await this.openai.chat.completions.create({
                model: this.model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                // Enforce JSON structured output for reliable parsing
                response_format: { type: 'json_object' },
                temperature: 0.0, // Low temperature for deterministic classification
            });

            const rawJson = response.choices[0].message.content;
            if (!rawJson) {
                console.warn('[AIService] Received empty response from OpenAI.');
                return 'Uncategorized';
            }
            
            const result = JSON.parse(rawJson);
            const category = result.category as AICategory;

            // Validate the result against our allowed categories
            if (category && VALID_CATEGORIES.includes(category)) {
                return category;
            } else {
                console.warn(`[AIService] Invalid category returned: ${category}. Falling back.`);
                return 'Uncategorized';
            }

        } catch (error) {
            console.error('[AIService] Error during classification API call:', error instanceof Error ? error.message : 'Unknown error');
            // Implement exponential backoff here in production, but for now, we return a safe default:
            return 'Uncategorized';
        }
    }
}