'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';

/**
 * Custom GraphQL Playground with organized tabs:
 * 1. Authentication - Set Firebase auth token
 * 2. Variables - GraphQL variables
 * 3. Query/Mutation - Type selector and editor
 */
export default function GraphQLPlayground() {
  const [activeTab, setActiveTab] = useState<'auth' | 'vars' | 'query'>('query');
  const [authToken, setAuthToken] = useState('');
  const [variables, setVariables] = useState('{}');
  const [queryType, setQueryType] = useState<'query' | 'mutation'>('query');
  const [query, setQuery] = useState(`query {
  me {
    id
    email
    displayName
  }
}`);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const executeQuery = async () => {
    setLoading(true);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // Add auth token if provided
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
        // Also set as cookie for Firebase compatibility
        document.cookie = `firebase-id-token=${authToken}; path=/`;
      }

      const response = await fetch('/api/graphql', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          query: query,
          variables: variables ? JSON.parse(variables) : {},
        }),
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({ error: String(error) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Celora GraphQL Playground</h1>

        {/* Tabs Navigation */}
        <div className="flex space-x-2 mb-4 border-b border-gray-700">
          <button
            onClick={() => setActiveTab('auth')}
            className={`px-4 py-2 ${
              activeTab === 'auth'
                ? 'border-b-2 border-blue-500 text-blue-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            🔐 Authentication
          </button>
          <button
            onClick={() => setActiveTab('vars')}
            className={`px-4 py-2 ${
              activeTab === 'vars'
                ? 'border-b-2 border-blue-500 text-blue-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            📝 Variables
          </button>
          <button
            onClick={() => setActiveTab('query')}
            className={`px-4 py-2 ${
              activeTab === 'query'
                ? 'border-b-2 border-blue-500 text-blue-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {queryType === 'query' ? '🔍 Query' : '✏️ Mutation'}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left Panel - Input */}
          <div className="space-y-4">
            {/* Authentication Tab */}
            {activeTab === 'auth' && (
              <div className="bg-gray-800 rounded-lg p-4">
                <h2 className="text-xl font-semibold mb-4">Authentication</h2>
                <p className="text-sm text-gray-400 mb-4">
                  Sett Firebase ID token for autentisering. Token sendes både som Authorization header og cookie.
                </p>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Firebase ID Token
                    </label>
                    <textarea
                      value={authToken}
                      onChange={(e) => setAuthToken(e.target.value)}
                      placeholder="Lim inn Firebase ID token her..."
                      className="w-full bg-gray-700 text-white p-3 rounded border border-gray-600 focus:border-blue-500 focus:outline-none font-mono text-sm"
                      rows={6}
                    />
                  </div>
                  <div className="text-xs text-gray-500">
                    <p>💡 Tips:</p>
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li>Hent token fra Firebase Auth i browser console</li>
                      <li>Token sendes automatisk som cookie for kompatibilitet</li>
                      <li>Hvis tom, brukes eksisterende cookies fra session</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Variables Tab */}
            {activeTab === 'vars' && (
              <div className="bg-gray-800 rounded-lg p-4">
                <h2 className="text-xl font-semibold mb-4">Variables</h2>
                <p className="text-sm text-gray-400 mb-4">
                  Legg til GraphQL variabler som JSON objekt.
                </p>
                <textarea
                  value={variables}
                  onChange={(e) => setVariables(e.target.value)}
                  placeholder='{ "blockchain": "SOLANA", "label": "Min Wallet" }'
                  className="w-full bg-gray-700 text-white p-3 rounded border border-gray-600 focus:border-blue-500 focus:outline-none font-mono text-sm"
                  rows={12}
                />
                <div className="text-xs text-gray-500 mt-2">
                  <p>💡 Eksempel:</p>
                  <pre className="mt-1 bg-gray-900 p-2 rounded">
{`{
  "blockchain": "SOLANA",
  "label": "Min Wallet",
  "isDefault": true
}`}
                  </pre>
                </div>
              </div>
            )}

            {/* Query/Mutation Tab */}
            {activeTab === 'query' && (
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold">
                    {queryType === 'query' ? 'Query' : 'Mutation'}
                  </h2>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => {
                        setQueryType('query');
                        setQuery(`query {
  me {
    id
    email
    displayName
  }
}`);
                      }}
                      className={`px-3 py-1 rounded ${
                        queryType === 'query'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      Query
                    </button>
                    <button
                      onClick={() => {
                        setQueryType('mutation');
                        setQuery(`mutation {
  wallet_insert(data: {
    blockchain: SOLANA
    label: "Min Wallet"
    userId_expr: "auth.uid"
  }) {
    id
    blockchain
    address
  }
}`);
                      }}
                      className={`px-3 py-1 rounded ${
                        queryType === 'mutation'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      Mutation
                    </button>
                  </div>
                </div>
                <textarea
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full bg-gray-700 text-white p-3 rounded border border-gray-600 focus:border-blue-500 focus:outline-none font-mono text-sm"
                  rows={20}
                />
                <button
                  onClick={executeQuery}
                  disabled={loading}
                  className="mt-4 w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded"
                >
                  {loading ? 'Kjører...' : '▶️ Kjør ' + (queryType === 'query' ? 'Query' : 'Mutation')}
                </button>
              </div>
            )}
          </div>

          {/* Right Panel - Results */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h2 className="text-xl font-semibold mb-4">Results</h2>
            <pre className="bg-gray-900 p-4 rounded overflow-auto max-h-[600px] text-sm">
              {result ? JSON.stringify(result, null, 2) : 'Ingen resultater ennå. Kjør en query eller mutation.'}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

