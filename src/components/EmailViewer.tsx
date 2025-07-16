import React from 'react';
import { Email } from '../types/Email';
import { sanitizeHtml } from '../utils/sanitizeHtml';
import { formatDate } from '../utils/dateUtils';

interface EmailViewerProps {
  email: Email | null;
}

export const EmailViewer: React.FC<EmailViewerProps> = ({ email }) => {
  if (!email) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-gray-500">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-lg font-medium">Select an email to view</p>
          <p className="text-sm">Choose an email from the list to see its content</p>
        </div>
      </div>
    );
  }

  const renderEmailBody = () => {
    if (email.isHtml) {
      const sanitizedHtml = sanitizeHtml(email.body);
      return (
        <div
          className="prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
        />
      );
    } else {
      return (
        <div className="whitespace-pre-wrap text-gray-800 leading-relaxed">
          {email.body}
        </div>
      );
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Email Header */}
      <div className="border-b border-gray-200 p-6 bg-white">
        <div className="mb-4">
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            {email.subject}
          </h1>
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div>
              <span className="font-medium">From: </span>
              <span>{email.from.replace(/<.*?>/g, '').trim()}</span>
            </div>
            <div>
              <span className="font-medium">Date: </span>
              <span>{formatDate(email.date)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Email Body */}
      <div className="flex-1 overflow-y-auto p-6 bg-white">
        {renderEmailBody()}
      </div>
    </div>
  );
};