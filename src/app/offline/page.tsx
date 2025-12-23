'use client';

export const dynamic = 'force-dynamic';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

export default function OfflinePage() {
  const [cachedData, setCachedData] = useState<string[]>([]);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [lastConnection, setLastConnection] = useState<string | null>(null);
  
  useEffect(() => {
    // Try to get the last connection time from localStorage
    const lastConnectionTime = localStorage.getItem('last-online-time');
    if (lastConnectionTime) {
      setLastConnection(new Date(lastConnectionTime).toLocaleString());
    }
    
    // Collect cached resources for display
    if ('caches' in window) {
      caches.keys().then(cacheNames => {
        const promises = cacheNames.map(cacheName => {
          return caches.open(cacheName).then(cache => {
            return cache.keys().then(requests => {
              return requests.map(request => {
                // Extract just the pathname from the URL to make it more readable
                const url = new URL(request.url);
                return url.pathname;
              });
            });
          });
        });
        
        Promise.all(promises).then(results => {
          // Flatten the array of arrays and remove duplicates
          const allUrls = Array.from(new Set(results.flat()));
          setCachedData(allUrls.slice(0, 5)); // Show only the first 5 for brevity
        });
      });
    }
    
    // Set up a periodic connection check
    const checkConnection = () => {
      if (navigator.onLine) {
        // If we're back online, reload the page
        window.location.reload();
      } else {
        setReconnectAttempts(prev => prev + 1);
      }
    };
    
    const intervalId = setInterval(checkConnection, 10000); // Check every 10 seconds
    
    return () => clearInterval(intervalId);
  }, []);
  
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 p-4">
      <div className="max-w-md w-full bg-slate-800 rounded-xl p-8 shadow-xl text-white">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-red-600/20 rounded-full flex items-center justify-center">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-10 w-10 text-red-500" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
              />
            </svg>
          </div>
        </div>
        
        <h1 className="text-2xl font-bold text-center mb-2">You&apos;re Offline</h1>
        
        <p className="text-slate-300 text-center mb-6">
          It looks like you lost your internet connection. Some features will be unavailable until you reconnect.
        </p>
        
        <div className="bg-slate-700/50 p-4 rounded-lg mb-6">
          <h2 className="text-lg font-semibold text-white mb-2">What you can do:</h2>
          
          <ul className="text-slate-300 space-y-2">
            <li className="flex items-center">
              <svg className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Check your Wi-Fi or mobile data connection
            </li>
            <li className="flex items-center">
              <svg className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Try accessing cached content in the app
            </li>
            <li className="flex items-center">
              <svg className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Retry connection when you&apos;re back online
            </li>
          </ul>
        </div>
        
        {lastConnection && (
          <div className="mb-6 text-sm text-slate-400 bg-slate-700/30 p-3 rounded">
            <p>Last online: {lastConnection}</p>
            <p>Auto-reconnect attempts: {reconnectAttempts}</p>
          </div>
        )}
        
        <div className="flex flex-col space-y-3">
          <button
            onClick={() => {
              setReconnectAttempts(prev => prev + 1);
              window.location.reload();
            }}
            className="w-full py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retry Connection
          </button>
          
          <Link href="/"
            className="w-full py-3 text-center bg-slate-700 text-white font-medium rounded-lg hover:bg-slate-600 transition-colors"
          >
            Try Homepage (Cached)
          </Link>
        </div>
        
        {cachedData.length > 0 && (
          <div className="mt-6 border-t border-slate-700 pt-4">
            <p className="text-sm font-medium text-slate-300 mb-2">Available cached content:</p>
            <ul className="text-xs text-slate-400">
              {cachedData.map((url, index) => (
                <li key={index} className="truncate">
                  • {url}
                </li>
              ))}
              {cachedData.length === 5 && <li>• ...</li>}
            </ul>
          </div>
        )}
        
        <div className="mt-6 text-xs text-slate-400 text-center">
          <p>Any changes made while offline will sync when you reconnect.</p>
        </div>
      </div>
    </div>
  );
}
