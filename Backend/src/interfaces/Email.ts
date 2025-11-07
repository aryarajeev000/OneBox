
// Define the categories required by the assignment (Point 3)
export type AICategory = 'Interested' | 'Meeting Booked' | 'Not Interested' | 'Spam' | 'Out of Office' | 'Uncategorized';

export interface EmailDocument {
    id: string; // Unique ID (e.g., IMAP UID + Account ID)
    account_id: string; // The ID of the synchronized email account (for filtering)
    folder: string; // The email folder (e.g., 'INBOX', 'Sent')
    message_id: string; // The email's unique Message-ID header
    subject: string;
    body_text: string; // Plain text body for search/AI
    body_html: string; // HTML body for display
    from: string; // Sender's email address
    to: string; // Recipient's email address(es)
    date: Date; // The email date (for sorting/filtering)
    ai_category: AICategory; // Field for AI categorization (Point 3)
    read: boolean;
    flags: string[]; // IMAP flags like '\Seen', '\Answered'
}