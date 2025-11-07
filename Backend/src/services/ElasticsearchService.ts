// src/services/ElasticsearchService.ts

import { Client } from '@elastic/elasticsearch';
import { EmailDocument } from '../interfaces/Email';

const INDEX_NAME = 'emails';

export class ElasticsearchService {
    private client: Client;

    constructor() {
        // Connect to the local Dockerized instance
        // Assuming the standard port and connection details from docker-compose.yml
        this.client = new Client({
            node: 'http://localhost:9200',
        });
        console.log('[Elasticsearch] Client Initialized.');
    }

    // 1. Connect, Ping, and Initialize Index
    public async connect(): Promise<boolean> {
        try {
            await this.client.info();
            console.log('[Elasticsearch] Connection successful. Cluster Info received.');
            await this.createIndexWithMapping();
            return true;
        } catch (error) {
            const errorMsg = (error instanceof Error) ? error.message : String(error);
            console.error('[Elasticsearch] Connection failed. Is Docker running? Error:', errorMsg);
            return false;
        }
    }

    // 2. Define and Create Index Mapping (Optimization for search and filtering)
    private async createIndexWithMapping(): Promise<void> {
        const exists = await this.client.indices.exists({ index: INDEX_NAME });

        if (exists) {
            console.log(`[Elasticsearch] Index '${INDEX_NAME}' already exists.`);
            return;
        }

        console.log(`[Elasticsearch] Creating index '${INDEX_NAME}' with custom mapping...`);

        // Custom Mapping for Email Search/Filtering (Point 2 requirement)
        const mapping = {
            properties: {
                // 'text' for full-text search on subject/body
                subject: { type: 'text' },
                body_text: { type: 'text' },

                // 'keyword' for exact filtering (Point 2 requirement)
                id: { type: 'keyword' },
                account_id: { type: 'keyword' }, // Used for filtering by account
                folder: { type: 'keyword' }, // Used for filtering by folder
                from: { type: 'keyword' },
                to: { type: 'keyword' },

                // 'date' for sorting and range queries
                date: { type: 'date' },

                // 'keyword' for filtering by AI category (Point 3)
                ai_category: { type: 'keyword' },

                read: { type: 'boolean' },
                flags: { type: 'keyword' },
            }
        };

        await this.client.indices.create({
            index: INDEX_NAME,
            mappings: {
                properties: {
                    // 'text' for full-text search on subject/body
                    subject: { type: 'text' },
                    body_text: { type: 'text' },

                    // 'keyword' for exact filtering (Point 2 requirement)
                    id: { type: 'keyword' },
                    account_id: { type: 'keyword' }, // Used for filtering by account
                    folder: { type: 'keyword' }, // Used for filtering by folder
                    from: { type: 'keyword' },
                    to: { type: 'keyword' },

                    // 'date' for sorting and range queries
                    date: { type: 'date' },

                    // 'keyword' for filtering by AI category (Point 3)
                    ai_category: { type: 'keyword' },

                    read: { type: 'boolean' },
                    flags: { type: 'keyword' },
                }
            },
        });

        console.log(`[Elasticsearch] Index '${INDEX_NAME}' created successfully.`);
    }

    // 3. Index a Single Email Document
    public async indexDocument(email: EmailDocument): Promise<void> {
        try {
            await this.client.index({
                index: INDEX_NAME,
                id: email.id, // Use the combined ID as the Elasticsearch document ID
                document: email
            });
            // console.log(`[Elasticsearch] Indexed email ID: ${email.id}`);
        } catch (error) {
            const errorMsg = (error instanceof Error) ? error.message : String(error);
            console.error(`[Elasticsearch] Failed to index email ID ${email.id}:`, errorMsg);
        }
    }

    // 4. Search and Filter Emails (Fulfills Point 2 requirement)
    public async searchEmails(
        queryText: string = '',
        accountId?: string,
        folder?: string,
        page: number = 1,
        pageSize: number = 20
    ): Promise<{ emails: EmailDocument[], total: number }> {
        const must: any[] = [];
        const filter: any[] = [];
        const from = (page - 1) * pageSize;

        // A. Full-Text Search (if queryText is provided)
        if (queryText) {
            // Use multi_match to search across subject and body_text fields
            must.push({
                multi_match: {
                    query: queryText,
                    fields: ['subject', 'body_text'],
                    type: 'best_fields',
                },
            });
        }

        // B. Filtering by Folder (if folder is provided)
        if (folder) {
            // Use 'term' filter on the 'folder' keyword field for exact match
            filter.push({ term: { folder: folder } });
        }

        // C. Filtering by Account (if accountId is provided)
        if (accountId) {
            // Use 'term' filter on the 'account_id' keyword field for exact match
            filter.push({ term: { account_id: accountId } });
        }

        // Combine search and filters using a bool query
        const esQuery = {
            bool: {
                // 'must' clauses contribute to the score (our text search)
                must: must.length > 0 ? must : [{ match_all: {} }], // Default to match_all if no text query
                // 'filter' clauses are fast, cached, and don't affect scoring (our exact filters)
                filter: filter,
            },
        };

        try {
            const response: any = await this.client.search({
                index: INDEX_NAME,
                from: from,
                size: pageSize,
                sort: [{ date: { order: 'desc' } }], // Sort by date descending (latest first)
                query: esQuery,
            });

            const total = response.body?.hits?.total?.value ?? 0;
            // Map the search results back to our TypeScript interface
            const emails = (response.body?.hits?.hits || []).map((hit: any) => hit._source as EmailDocument);

            return { emails, total };

        } catch (error) {
            console.error('[Elasticsearch] Search failed:', (error as Error).message);
            return { emails: [], total: 0 };
        }
    }
}