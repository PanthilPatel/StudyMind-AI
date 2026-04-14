/**
 * Simple Markdown-to-HTML Converter
 * 
 * Converts Gemini's markdown output into formatted HTML for display.
 * Handles headings, bold, italic, code blocks, lists, and horizontal rules.
 * No external dependencies required.
 */

export function markdownToHtml(markdown) {
  if (!markdown) return '';

  let html = markdown
    // Escape HTML entities first
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    
    // Code blocks (```language\n...\n```)
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>')
    
    // Inline code (`code`)
    .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
    
    // Headings (### H3, ## H2, # H1)
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    
    // Bold and italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    
    // Horizontal rule
    .replace(/^---$/gm, '<hr />')
    
    // Unordered list items (- item)
    .replace(/^[\-\*] (.+)$/gm, '<li>$1</li>')
    
    // Ordered list items (1. item)
    .replace(/^\d+\. (.+)$/gm, '<li class="ordered">$1</li>')
    
    // Wrap consecutive <li> in <ul>
    .replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>')
    .replace(/((?:<li class="ordered">.*<\/li>\n?)+)/g, '<ol>$1</ol>')
    
    // Paragraphs — wrap standalone text lines
    .replace(/^(?!<[houplir])((?!<).+)$/gm, '<p>$1</p>')
    
    // Clean up empty paragraphs
    .replace(/<p>\s*<\/p>/g, '')
    
    // Line breaks
    .replace(/\n\n/g, '')
    .replace(/\n/g, '');

  return html;
}
