import * as dotenv from 'dotenv';
import express, { Request, Response } from 'express';
import { ElasticsearchService } from './services/ElasticsearchService';
import { ImapService } from './services/ImapService';
import { AIService } from './services/AIService'; // NEW: For Point 3
import { AutomationService } from './services/AutomationService'; // NEW: For Point 4
import * as path from 'path'; // Needed to serve the frontend file later

// Load environment variables from .env file FIRST
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware setup
// Enable CORS for frontend development (since the frontend will run separately)
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});
app.use(express.json());

// Initialize all core services
const esService = new ElasticsearchService();
const aiService = new AIService(); // Initialize AI Service
const automationService = new AutomationService(); // Initialize Automation Service

// Dependency Injection: Injecting ES, AI, and Automation into the IMAP Service
const imapService = new ImapService(esService, aiService, automationService); 

// =========================================================
// API ENDPOINTS
// =========================================================

// 1. Frontend Hosting (Point 5 - will serve the UI we build next)
// For now, this serves a placeholder file, which we will replace with the real UI later.
app.use(express.static(path.join(__dirname, '..', 'public')));

// 2. Health Check and Connection Status (GET /api/status)
app.get('/api/status', async (req: Request, res: Response) => {
    const esConnected = await esService.connect(); 
    
    // Note: The IMAP service status is managed internally, we only report if it's running
    const imapClientCount = ((imapService as any).clients?.size) || 0;
    const imapStatus = imapClientCount > 0 ? 'Initialized and Syncing' : 'Not yet started';

    res.json({
        status: 'ReachInbox API Backend is online!',
        database: esConnected ? 'Elasticsearch Connected and Index Ready' : 'Elasticsearch Connection FAILED',
        ai_service: aiService ? 'Ready' : 'Not initialized',
        automation_service: automationService ? 'Ready' : 'Not initialized',
        imap_service: imapStatus,
        accounts_configured: imapClientCount,
    });
});

// 3. Searchable Storage Endpoint (GET /api/emails) - Fulfills Point 2 requirement
app.get('/api/emails', async (req: Request, res: Response) => {
    // Extract query parameters from the request
    const { q, accountId, folder, page, size } = req.query;

    const queryText = q as string | undefined;
    const filterAccount = accountId as string | undefined;
    const filterFolder = folder as string | undefined;
    
    const pageNum = parseInt(page as string) || 1;
    const pageSize = parseInt(size as string) || 20;

    try {
        const results = await esService.searchEmails(
            queryText, 
            filterAccount, 
            filterFolder, 
            pageNum, 
            pageSize
        );
        
        res.json(results);
    } catch (error) {
        console.error('Error fetching emails:', error);
        res.status(500).json({ message: 'Failed to retrieve emails from search service.' });
    }
});


// =========================================================
// APPLICATION STARTUP
// =========================================================

// Start the server
app.listen(PORT, async () => {
    console.log(`⚡️[server]: Server is running at http://localhost:${PORT}`);
    
    // 1. Connect and initialize Elasticsearch (Point 2)
    const esConnected = await esService.connect();

    if (esConnected) {
        // 2. Start IMAP Synchronization for all accounts (Point 1)
        console.log('--- Starting IMAP Sync and IDLE mode for all accounts ---');
        await imapService.startSync();
    } else {
        console.error('IMAP Sync SKIPPED: Cannot start without a healthy Elasticsearch connection.');
    }
});