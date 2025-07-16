// Simple HTML sanitizer to prevent XSS attacks
export const sanitizeHtml = (html: string): string => {
  // Remove script tags and their content
  html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Remove dangerous event handlers
  html = html.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
  
  // Remove javascript: protocols
  html = html.replace(/javascript:/gi, '');
  
  // Remove dangerous tags while preserving content
  const dangerousTags = ['object', 'embed', 'applet', 'form', 'input', 'button'];
  dangerousTags.forEach(tag => {
    const regex = new RegExp(`<${tag}\\b[^>]*>`, 'gi');
    html = html.replace(regex, '');
    html = html.replace(new RegExp(`</${tag}>`, 'gi'), '');
  });
  
  return html;
};