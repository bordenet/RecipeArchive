// ignore_for_file: dangling_library_doc_comments
/// Utility functions for handling HTML content in recipes

/// Decodes HTML entities in text strings
/// Handles common entities like &#39; -> ', &quot; -> ", &amp; -> &, etc.
String decodeHtmlEntities(String text) {
  if (text.isEmpty) return text;
  
  // Common HTML entities mapping
  final entityMap = {
    // Numeric entities
    '&#39;': "'",
    '&#x27;': "'",
    '&#34;': '"',
    '&#x22;': '"',
    '&#38;': '&',
    '&#x26;': '&',
    '&#60;': '<',
    '&#x3C;': '<', 
    '&#62;': '>',
    '&#x3E;': '>',
    '&#32;': ' ',
    '&#x20;': ' ',
    '&#160;': ' ', // Non-breaking space
    '&#xa0;': ' ', // Non-breaking space (hex)
    
    // Named entities
    '&quot;': '"',
    '&apos;': "'",
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&nbsp;': ' ', // Non-breaking space
    '&ndash;': '–', // En dash
    '&mdash;': '—', // Em dash
    '&hellip;': '…', // Horizontal ellipsis
    '&rsquo;': ''', // Right single quotation mark
    '&lsquo;': ''', // Left single quotation mark  
    '&rdquo;': '"', // Right double quotation mark
    '&ldquo;': '"', // Left double quotation mark
    '&deg;': '°',   // Degree symbol
    '&frac12;': '½', // Fraction 1/2
    '&frac14;': '¼', // Fraction 1/4
    '&frac34;': '¾', // Fraction 3/4
  };
  
  String decoded = text;
  
  // Replace all known entities
  for (final entry in entityMap.entries) {
    decoded = decoded.replaceAll(entry.key, entry.value);
  }
  
  // Handle generic numeric entities (&#123; format)
  decoded = decoded.replaceAllMapped(
    RegExp(r'&#(\d+);'),
    (match) {
      try {
        final code = int.parse(match.group(1)!);
        return String.fromCharCode(code);
      } catch (e) {
        return match.group(0)!; // Return original if parsing fails
      }
    },
  );
  
  // Handle generic hex entities (&#x1A; format)
  decoded = decoded.replaceAllMapped(
    RegExp(r'&#x([0-9A-Fa-f]+);'),
    (match) {
      try {
        final code = int.parse(match.group(1)!, radix: 16);
        return String.fromCharCode(code);
      } catch (e) {
        return match.group(0)!; // Return original if parsing fails
      }
    },
  );
  
  return decoded;
}

/// Clean and normalize recipe text
/// Combines HTML entity decoding with basic text normalization
String cleanRecipeText(String? text) {
  if (text == null || text.isEmpty) return '';
  
  // Decode HTML entities
  String cleaned = decodeHtmlEntities(text);
  
  // Normalize whitespace
  cleaned = cleaned.replaceAll(RegExp(r'\s+'), ' ').trim();
  
  // Remove excessive punctuation
  cleaned = cleaned.replaceAll(RegExp(r'\.{3,}'), '…');
  
  return cleaned;
}