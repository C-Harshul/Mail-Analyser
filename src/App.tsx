import React, { useState, useEffect } from 'react';
import { EmailList } from './components/EmailList';
import { EmailViewer } from './components/EmailViewer';
import { AuthButton } from './components/AuthButton';
import { Email } from './types/Email';
import { emailService } from './services/emailService';

function App() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [loading, setLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  // Check URL parameters for auth callback
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const authStatus = urlParams.get('auth');
    
    if (authStatus === 'success') {
      console.log('🎉 Frontend: Authentication successful from callback');
      setIsAuthenticated(true);
      window.history.replaceState({}, document.title, '/');
      loadEmails();
    } else if (authStatus === 'error') {
      console.error('❌ Frontend: Authentication failed from callback');
      window.history.replaceState({}, document.title, '/');
    }
  }, []);

  // Check auth status on mount
  useEffect(() => {
    console.log('🚀 Frontend: App starting up...');
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      console.log('🔍 Frontend: Checking initial auth status...');
      const authenticated = await emailService.checkAuthStatus();
      setIsAuthenticated(authenticated);
      if (authenticated) {
        console.log('✅ Frontend: User is authenticated, loading real emails...');
        loadEmails();
      } else {
        console.log('🎭 Frontend: User not authenticated, loading mock data...');
        // Load mock data for demo
        loadMockEmails();
      }
    } catch (error) {
      console.error('❌ Frontend: Error checking auth status:', error);
      loadMockEmails();
    }
  };

  const loadEmails = async () => {
    console.log('📧 Frontend: Loading real emails...');
    setLoading(true);
    try {
      const fetchedEmails = await emailService.getEmails();
      setEmails(fetchedEmails);
      console.log(`✅ Frontend: Successfully loaded ${fetchedEmails.length} emails`);
    } catch (error) {
      console.error('❌ Frontend: Error loading emails:', error);
      // Fallback to mock data
      console.log('🎭 Frontend: Falling back to mock data...');
      loadMockEmails();
    } finally {
      setLoading(false);
    }
  };

  const loadMockEmails = async () => {
    console.log('🎭 Frontend: Loading mock emails...');
    setLoading(true);
    try {
      const mockEmails = await emailService.getMockEmails();
      setEmails(mockEmails);
      console.log(`✅ Frontend: Successfully loaded ${mockEmails.length} mock emails`);
    } catch (error) {
      console.error('❌ Frontend: Error loading mock emails:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    console.log('🔐 Frontend: Starting login process...');
    console.log('🔍 Frontend: Checking if backend is reachable...');
    setAuthLoading(true);
    try {
      // First test if backend is reachable
      console.log('🏥 Frontend: Testing backend health...');
      const healthResponse = await fetch('http://localhost:3001/');
      console.log('🏥 Frontend: Backend health check:', healthResponse.ok ? 'OK' : 'FAILED');
      
      const authUrl = await emailService.getAuthUrl();
      console.log('🔗 Frontend: Redirecting to Google OAuth...');
      window.location.href = authUrl;
    } catch (error) {
      console.error('❌ Frontend: Error during login:', error);
      console.error('❌ Frontend: Make sure the backend server is running on port 3001');
      setAuthLoading(false);
    }
  };

  const handleEmailSelect = (email: Email) => {
    console.log('📧 Frontend: Email selected:', email.subject);
    setSelectedEmail(email);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Gmail Viewer</h1>
                <p className="text-sm text-gray-600">Financial Email Review Tool</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <AuthButton 
                onLogin={handleLogin}
                isAuthenticated={isAuthenticated}
                loading={authLoading}
              />
              {!isAuthenticated && (
                <span className="text-sm text-gray-500">Demo mode - showing sample data</span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-[calc(100vh-140px)]">
          <div className="flex h-full">
            {/* Email List Panel */}
            <div className="w-1/3 border-r border-gray-200 flex flex-col">
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                <h2 className="font-semibold text-gray-900">
                  Inbox ({emails.length})
                </h2>
                <p className="text-sm text-gray-600">
                  Latest financial emails
                </p>
              </div>
              
              <EmailList
                emails={emails}
                selectedEmailId={selectedEmail?.id || null}
                onEmailSelect={handleEmailSelect}
                loading={loading}
              />
            </div>

            {/* Email Viewer Panel */}
            <div className="flex-1 flex flex-col">
              <EmailViewer email={selectedEmail} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;