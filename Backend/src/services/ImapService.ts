import { ImapFlow, ImapFlowOptions, FetchMessageObject } from 'imapflow';
import { simpleParser } from 'mailparser';
import { EmailDocument, AICategory } from '../interfaces/Email';
import { ElasticsearchService } from './ElasticsearchService';
import { AIService } from './AIService'; 
import { AutomationService } from './AutomationService'; 

// Define the configuration needed for each account
export interface AccountConfig {
    id: string;
    host: string;
    port: number;
    secure: boolean;
    auth: {
        user: string;
        pass: string; // IMPORTANT: Must be a Gmail App Password
    };
}

// Configuration for our two required accounts (Uses .env variables)
const ACCOUNT_CONFIGS: AccountConfig[] = [
    {
        id: 'gmail-account-1',
        host: 'imap.gmail.com',
        port: 993,
        secure: true,
        auth: {
            user: process.env.IMAP_ACCOUNT_1_USER!,
            pass: process.env.IMAP_ACCOUNT_1_PASS!,
        }
    },
    {
        id: 'placeholder-account-2',
        host: process.env.IMAP_ACCOUNT_2_HOST || 'imap.example.com',
        port: 993,
        secure: true,
        auth: {
            user: process.env.IMAP_ACCOUNT_2_USER!,
            pass: process.env.IMAP_ACCOUNT_2_PASS!,
        }
    }
];

export class ImapService {
    private esService: ElasticsearchService;
    private aiService: AIService; 
    private automationService: AutomationService; 
    private clients: Map<string, ImapFlow> = new Map();

    // UPDATED CONSTRUCTOR: Now accepts AI and Automation services
    constructor(
        esService: ElasticsearchService,
        aiService: AIService,
        automationService: AutomationService
    ) {
        this.esService = esService;
        this.aiService = aiService;
        this.automationService = automationService;
    }

    public async startSync(): Promise<void> {
        for (const config of ACCOUNT_CONFIGS) {
            if (config.id !== 'placeholder-account-2' || (config.auth.user && config.auth.pass)) {
                await this.connectAndSyncAccount(config);
            } else {
                console.warn(`[IMAP:${config.id}] Skipping sync: Credentials missing in .env.`);
            }
        }
    }

    private async connectAndSyncAccount(config: AccountConfig): Promise<void> {
        const clientOptions: ImapFlowOptions = {
            host: config.host,
            port: config.port,
            secure: config.secure,
            auth: config.auth,
            logger: false
        };

        const client = new ImapFlow(clientOptions);
        this.clients.set(config.id, client);

        try {
            await client.connect();
            console.log(`[IMAP:${config.id}] Connected successfully.`);

            await this.initialSync(client, config.id);
            this.setupRealTimeIdle(client, config.id);

        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            console.error(`[IMAP:${config.id}] Connection or sync failed:`, msg);
        }
    }

    private async initialSync(client: ImapFlow, accountId: string): Promise<void> {
        console.log(`[IMAP:${accountId}] Starting 30-day historical sync...`);

        const date30DaysAgo = new Date();
        date30DaysAgo.setDate(date30DaysAgo.getDate() - 30);
        const sinceDate = date30DaysAgo.toISOString().split('T')[0];

        const folder = 'INBOX';
        const lock = await client.getMailboxLock(folder);
        try {
            const searchResult = await client.search({ since: sinceDate });
            const uids = Array.isArray(searchResult) ? searchResult : [];
            console.log(`[IMAP:${accountId}] Found ${uids.length} emails in the last 30 days.`);

            for (const uid of uids) {
                // Fetch email source for full parsing
                const msg = await client.fetchOne(uid, { uid: true, envelope: true, flags: true, source: true }, { uid: true });
                if (msg) {
                    await this.processAndIndexEmail(msg, accountId, folder);
                }
            }
        } finally {
            lock.release();
        }
        console.log(`[IMAP:${accountId}] Historical sync complete.`);
    }

    private setupRealTimeIdle(client: ImapFlow, accountId: string): void {
        client.on('exists', async ({ path, count }) => {
            console.log(`[IMAP:${accountId} - IDLE] New message detected in ${path}. Total count: ${count}`);

            try {
                const lock = await client.getMailboxLock(path);
                try {
                    // Search for the latest unseen message
                    const searchResult = await client.search({ seen: false });
                    const uids = Array.isArray(searchResult) ? searchResult : [];
                    if (uids.length > 0) {
                        const latestUid = uids[uids.length - 1];
                        console.log(`[IMAP:${accountId} - IDLE] Fetching new message with UID: ${latestUid}`);

                        const msg = await client.fetchOne(latestUid, { uid: true, envelope: true, flags: true, source: true }, { uid: true });
                        if (msg) {
                            await this.processAndIndexEmail(msg, accountId, path);
                        }
                    }
                } finally {
                    lock.release();
                }
            } catch (error: any) {
                console.error(`[IMAP:${accountId} - IDLE] Error processing new mail:`, error.message);
            }
        });

        client.on('error', (err) => {
            console.error(`[IMAP:${accountId}] IMAP Client Error:`, err);
        });

        console.log(`[IMAP:${accountId}] Real-Time IDLE mode listening...`);
    }

    // UPDATED: Includes AI categorization and conditional automation
    private async processAndIndexEmail(msg: FetchMessageObject, accountId: string, folder: string): Promise<void> {
        try {
            const sourceBuffer = msg.source;
            if (!sourceBuffer) {
                console.warn(`[IMAP:${accountId}] No source buffer for UID ${msg.uid}; skipping.`);
                return;
            }

            const parsed = await simpleParser(sourceBuffer);

            // --- 1. AI CATEGORIZATION (Point 3) ---
            const aiCategory = await this.aiService.categorizeEmail(
                parsed.subject || '(No Subject)', 
                parsed.text || parsed.html || ''
            );

            // FIX START: Safely extract recipient addresses 
            const toList = (() => {
                // If parsed.to is null or undefined, return the default
                if (!parsed.to) return 'unknown@example.com';
                
                // Use optional chaining and flatMap to safely extract addresses 
                // regardless of whether parsed.to is a single AddressObject or an array
                const recipients = (Array.isArray(parsed.to) ? parsed.to : [parsed.to]) as any[];
                
                const addresses = recipients.flatMap(recipient => 
                    recipient.value?.map((a: any) => a.address) ?? []
                );

                return addresses.filter(Boolean).join(', ') || 'unknown@example.com';
            })();
            // FIX END

            // Construct the final document
            const emailDocument: EmailDocument = {
                id: `${accountId}-${msg.uid}`,
                account_id: accountId,
                folder: folder,
                message_id: parsed.messageId || `no-id-${msg.uid}`,
                subject: parsed.subject || '(No Subject)',
                body_text: parsed.text || '',
                body_html: parsed.html || parsed.textAsHtml || '',
                from: parsed.from?.value?.[0]?.address || 'unknown@example.com',
                to: toList,
                date: parsed.date || new Date(),
                ai_category: aiCategory, // <-- Use the AI result here
                read: msg.flags ? Array.from(msg.flags).includes('\\Seen') : false,
                flags: msg.flags ? Array.from(msg.flags) : [],
            };

            // --- 2. INDEX DOCUMENT (Point 2) ---
            await this.esService.indexDocument(emailDocument);
            console.log(`[IMAP:${accountId}] Indexed: "${emailDocument.subject.substring(0, 40)}..." -> Category: ${aiCategory}`);
            
            // --- 3. CONDITIONAL AUTOMATION (Point 4) ---
            if (aiCategory === 'Interested') {
                await this.automationService.triggerInterestedAutomation(emailDocument);
            }

        } catch (error: unknown) {
            const msgText = error instanceof Error ? error.message : String(error);
            console.error(`[IMAP:${accountId}] Error processing UID ${msg.uid}:`, msgText);
        }
    }
}