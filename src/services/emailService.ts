import { Email } from '../types/Email';

const API_BASE_URL = 'http://localhost:3001';

export const emailService = {
  async getAuthUrl(): Promise<string> {
    try {
      console.log('🔗 Frontend: Requesting auth URL...');
      console.log('🌐 Frontend: Attempting to connect to:', `${API_BASE_URL}/auth/url`);
      const response = await fetch(`${API_BASE_URL}/auth/url`);
      console.log('📡 Frontend: Response status:', response.status);
      console.log('📡 Frontend: Response ok:', response.ok);
      const data = await response.json();
      console.log('✅ Frontend: Auth URL received');
      return data.authUrl;
    } catch (error) {
      console.error('❌ Frontend: Error getting auth URL:', error);
      console.error('❌ Frontend: Error details:', error.message);
      console.error('❌ Frontend: Is the backend server running on port 3001?');
      throw error;
    }
  },

  async checkAuthStatus(): Promise<boolean> {
    try {
      console.log('🔍 Frontend: Checking auth status...');
      const response = await fetch(`${API_BASE_URL}/auth/status`);
      const data = await response.json();
      console.log('📊 Frontend: Auth status:', data.authenticated ? 'Authenticated' : 'Not authenticated');
      return data.authenticated;
    } catch (error) {
      console.error('❌ Frontend: Error checking auth status:', error);
      return false;
    }
  },

  async getEmails(): Promise<Email[]> {
    try {
      console.log('📧 Frontend: Requesting real emails...');
      const response = await fetch(`${API_BASE_URL}/emails`);
      if (response.status === 401) {
        console.log('🔒 Frontend: Not authenticated for real emails');
        throw new Error('Not authenticated');
      }
      const emails = await response.json();
      console.log(`✅ Frontend: Received ${emails.length} real emails`);
      return emails;
    } catch (error) {
      console.error('❌ Frontend: Error fetching real emails:', error);
      // Fallback to mock data for demo
      console.log('🎭 Frontend: Falling back to mock data...');
      return this.getMockEmails();
    }
  },

  async getMockEmails(): Promise<Email[]> {
    try {
      console.log('🎭 Frontend: Requesting mock emails...');
      const response = await fetch(`${API_BASE_URL}/emails/mock`);
      const emails = await response.json();
      console.log(`✅ Frontend: Received ${emails.length} mock emails`);
      return emails;
    } catch (error) {
      console.error('❌ Frontend: Error fetching mock emails:', error);
      throw error;
    }
  }
};