import React from 'react';
import { Email } from '../types/Email';
import { formatDistanceToNow } from '../utils/dateUtils';

interface EmailListProps {
  emails: Email[];
  selectedEmailId: string | null;
  onEmailSelect: (email: Email) => void;
  loading: boolean;
}

export const EmailList: React.FC<EmailListProps> = ({
  emails,
  selectedEmailId,
  onEmailSelect,
  loading
}) => {
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading emails...</p>
        </div>
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-gray-500">
          <p>No emails found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      {emails.map((email) => (
        <div
          key={email.id}
          onClick={() => onEmailSelect(email)}
          className={`p-4 border-b border-gray-200 cursor-pointer transition-colors ${
            selectedEmailId === email.id
              ? 'bg-blue-50 border-l-4 border-l-blue-600'
              : 'hover:bg-gray-50'
          }`}
        >
          <div className="flex justify-between items-start mb-1">
            <span className="font-medium text-gray-900 truncate flex-1 mr-2">
              {email.from.replace(/<.*?>/g, '').trim()}
            </span>
            <span className="text-xs text-gray-500 whitespace-nowrap">
              {formatDistanceToNow(email.date)}
            </span>
          </div>
          
          <h3 className="font-semibold text-gray-800 mb-1 truncate">
            {email.subject}
          </h3>
          
          <p className="text-sm text-gray-600 line-clamp-2">
            {email.snippet}
          </p>
        </div>
      ))}
    </div>
  );
};