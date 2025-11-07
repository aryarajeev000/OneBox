import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Search, Filter, Mail, Globe, Clock, User, Server } from 'lucide-react';

// --- Type Definitions ---
export interface EmailDocument {
    id: string;
    account_id: string;
    folder: string;
    subject: string;
    body_text: string;
    from: string;
    to: string;
    date: string;
    ai_category: string;
}

interface SearchResults {
    emails: EmailDocument[];
    total: number;
}

interface Status {
    status?: string;
    database?: string;
    imap_service?: string;
    ai_service?: string;
}

// --- Constants ---
const API_BASE_URL = 'http://localhost:3000';
const ALL_CATEGORIES = [
    'Uncategorized', 'Interested', 'Meeting Booked', 'Not Interested',
    'Spam', 'Out of Office'
];
const ACCOUNT_OPTIONS = [
    { id: 'all', name: 'All Accounts' },
    { id: 'gmail-account-1', name: 'Gmail Account 1' },
    { id: 'placeholder-account-2', name: 'Account 2' },
];
const FOLDER_OPTIONS = ['all', 'INBOX', 'Sent'];

// --- Utility Functions ---
const getCategoryBadge = (category: string) => {
    let colorClass = 'bg-gray-100 text-gray-800';
    switch (category) {
        case 'Interested':
            colorClass = 'bg-green-100 text-green-800 font-semibold';
            break;
        case 'Meeting Booked':
            colorClass = 'bg-blue-100 text-blue-800 font-semibold';
            break;
        case 'Not Interested':
            colorClass = 'bg-yellow-100 text-yellow-800';
            break;
        case 'Spam':
            colorClass = 'bg-red-100 text-red-800';
            break;
        case 'Out of Office':
            colorClass = 'bg-purple-100 text-purple-800';
            break;
    }
    return (
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs transition-all duration-300 ${colorClass}`}>
            {category}
        </span>
    );
};

// --- Main Component ---
const App: React.FC = () => {
    const [emails, setEmails] = useState<EmailDocument[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterAccount, setFilterAccount] = useState('all');
    const [filterFolder, setFilterFolder] = useState('all');
    const [loading, setLoading] = useState(false);
    const [totalResults, setTotalResults] = useState(0);
    const [status, setStatus] = useState<Status>({});
    const [page, setPage] = useState(1);
    const pageSize = 10;

    // Fetch backend status
    useEffect(() => {
        const fetchStatus = async () => {
            try {
                const response = await axios.get<Status>(`${API_BASE_URL}/api/status`);
                setStatus(response.data);
            } catch (error) {
                setStatus({ status: 'Backend Offline', database: 'Failed to Connect' });
                console.error('Backend connection failed:', error);
            }
        };
        fetchStatus();
    }, []);

    // Fetch emails
    const fetchEmails = useCallback(async (newPage = 1) => {
        setLoading(true);
        try {
            const params: Record<string, string | number | undefined> = {
                q: searchTerm || undefined,
                accountId: filterAccount !== 'all' ? filterAccount : undefined,
                folder: filterFolder !== 'all' ? filterFolder : undefined,
                page: newPage,
                size: pageSize,
            };

            if (status.database && status.database.includes('FAILED')) {
                setEmails([]);
                setTotalResults(0);
                setLoading(false);
                return;
            }

            const response = await axios.get<SearchResults>(`${API_BASE_URL}/api/emails`, { params });
            setEmails(response.data.emails);
            setTotalResults(response.data.total);
            setPage(newPage);
        } catch (error) {
            console.error('Error fetching emails:', error);
            setEmails([]);
            setTotalResults(0);
        } finally {
            setLoading(false);
        }
    }, [searchTerm, filterAccount, filterFolder, status.database]);

    useEffect(() => {
        if (status.status) fetchEmails(1);
    }, [searchTerm, filterAccount, filterFolder, fetchEmails, status.status]);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
    };

    const totalPages = Math.ceil(totalResults / pageSize);

    // --- Components ---
    const EmailCard: React.FC<{ email: EmailDocument }> = ({ email }) => (
        <div className="bg-white p-5 border-b border-gray-100 transition-shadow duration-300 hover:shadow-lg rounded-xl mb-3">
            <div className="flex justify-between items-start mb-2 flex-wrap">
                <div className="text-xl font-bold text-indigo-700 w-full md:w-3/4 break-words">
                    {email.subject || '(No Subject)'}
                </div>
                <div className="mt-2 md:mt-0">{getCategoryBadge(email.ai_category)}</div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-2 text-sm text-gray-500">
                <div className="flex items-center">
                    <User className="w-4 h-4 mr-2 text-gray-400" />
                    <span className="font-medium text-gray-600">{email.from}</span>
                </div>
                <div className="flex items-center">
                    <Mail className="w-4 h-4 mr-2 text-gray-400" />
                    <span className="truncate" title={email.to}>To: {email.to.split(',')[0]}...</span>
                </div>
                <div className="flex items-center">
                    <Server className="w-4 h-4 mr-2 text-gray-400" />
                    <span>Account: {ACCOUNT_OPTIONS.find(a => a.id === email.account_id)?.name || email.account_id}</span>
                </div>
                <div className="flex items-center">
                    <Clock className="w-4 h-4 mr-2 text-gray-400" />
                    <span>{new Date(email.date).toLocaleDateString()}</span>
                </div>
            </div>
        </div>
    );

    const StatusBadge: React.FC<{ label: string; value: string }> = ({ label, value }) => {
        const isHealthy = value.includes('Connected') || value.includes('Ready') || value.includes('Syncing') || value.includes('Initialized');
        const color = isHealthy ? 'text-green-500' : 'text-red-500';
        return (
            <div className="flex items-center bg-white p-3 rounded-xl shadow-md border-l-4 border-indigo-500">
                <Globe className={`w-5 h-5 mr-3 ${color}`} />
                <div>
                    <div className="text-xs font-semibold uppercase text-gray-500">{label} Status</div>
                    <div className="font-bold text-sm text-gray-800 truncate">{value}</div>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gray-50 font-sans">
            <header className="bg-white shadow-md p-5 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto">
                    <h1 className="text-3xl font-extrabold text-gray-900 flex items-center">
                        <Mail className="w-8 h-8 mr-3 text-indigo-600" />
                        ReachInbox Onebox Aggregator
                    </h1>
                </div>
            </header>

            <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                    <StatusBadge label="Backend API" value={status.status || 'Offline'} />
                    <StatusBadge label="Elasticsearch" value={status.database || 'Offline'} />
                    <StatusBadge label="IMAP Sync" value={status.imap_service || 'Offline'} />
                    <StatusBadge label="AI/Automation" value={status.ai_service || 'Offline'} />
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-xl mb-6 border border-gray-100">
                    <h2 className="text-xl font-semibold mb-4 text-gray-700 flex items-center">
                        <Filter className="w-5 h-5 mr-2" />
                        Search & Filters
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="md:col-span-2">
                            <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
                                Full Text Search (Subject/Body)
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    id="search"
                                    placeholder="e.g., Interested lead, meeting link, report"
                                    value={searchTerm}
                                    onChange={handleSearchChange}
                                    onKeyDown={(e) => { if (e.key === 'Enter') fetchEmails(1); }}
                                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 transition duration-150"
                                />
                                <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="account" className="block text-sm font-medium text-gray-700 mb-1">
                                Filter by Account
                            </label>
                            <select
                                id="account"
                                value={filterAccount}
                                onChange={(e) => setFilterAccount(e.target.value)}
                                className="w-full py-2.5 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 transition duration-150"
                            >
                                {ACCOUNT_OPTIONS.map(opt => (
                                    <option key={opt.id} value={opt.id}>{opt.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label htmlFor="folder" className="block text-sm font-medium text-gray-700 mb-1">
                                Filter by Folder
                            </label>
                            <select
                                id="folder"
                                value={filterFolder}
                                onChange={(e) => setFilterFolder(e.target.value)}
                                className="w-full py-2.5 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 transition duration-150"
                            >
                                {FOLDER_OPTIONS.map(opt => (
                                    <option key={opt} value={opt}>{opt}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                <div className="flex justify-between items-center mb-4 pt-2">
                    <h2 className="text-2xl font-bold text-gray-900">Emails ({totalResults} total)</h2>
                    {loading && <span className="text-indigo-600 animate-pulse">Loading...</span>}
                </div>

                <div className="space-y-4">
                    {emails.length > 0 ? (
                        emails.map(email => <EmailCard key={email.id} email={email} />)
                    ) : (
                        !loading && (
                            <div className="text-center p-12 bg-white rounded-2xl shadow-xl text-gray-500">
                                <Mail className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                                <p className="font-semibold">No emails found matching the criteria.</p>
                                <p className="text-sm">Try adjusting your search query or filters.</p>
                                <p className="text-xs mt-2 text-red-500">
                                    {status.database && status.database.includes('FAILED') &&
                                        `Error: Elasticsearch connection failed. Please ensure Docker is running and healthy.`}
                                </p>
                            </div>
                        )
                    )}
                </div>

                {totalPages > 1 && (
                    <div className="flex justify-center items-center space-x-2 mt-8">
                        <button
                            onClick={() => fetchEmails(page - 1)}
                            disabled={page === 1 || loading}
                            className="px-4 py-2 bg-white border border-gray-300 text-sm font-medium rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                        >
                            Previous
                        </button>
                        <span className="text-sm text-gray-700">Page {page} of {totalPages}</span>
                        <button
                            onClick={() => fetchEmails(page + 1)}
                            disabled={page === totalPages || loading}
                            className="px-4 py-2 bg-white border border-gray-300 text-sm font-medium rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                        >
                            Next
                        </button>
                    </div>
                )}
            </main>

            <footer className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 text-center text-sm text-gray-500">
                Powered by Node.js, TypeScript, Elasticsearch, and OpenAI
            </footer>
        </div>
    );
};

export default App;
