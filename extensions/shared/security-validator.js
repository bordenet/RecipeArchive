// Input Sanitization and Validation Utility
// Provides security functions for recipe data validation and XSS prevention

class SecurityValidator {
  constructor() {
    // HTML tags that are allowed in recipe content (very restrictive)
    this.allowedTags = ['b', 'i', 'em', 'strong', 'br'];
    
    // Maximum lengths for recipe fields
    this.maxLengths = {
      title: 200,
      description: 1000,
      ingredient: 500,
      instruction: 1000,
      note: 500,
      tag: 50,
      url: 2000
    };

    // Regex patterns for validation
    this.patterns = {
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      url: /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/,
      time: /^(\d+\s*(hours?|hrs?|minutes?|mins?|seconds?|secs?)(\s+\d+\s*(minutes?|mins?|seconds?|secs?))?|\d+:\d+)$/i,
      serving: /^(\d+(-\d+)?(\s+(servings?|portions?|people|persons?|cups?|pieces?))?|\d+\s*-\s*\d+)$/i
    };
  }

  // Sanitize HTML content by removing dangerous elements
  sanitizeHTML(html) {
    if (!html || typeof html !== 'string') {
      return '';
    }

    // Remove script tags and their content
    html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    
    // Remove event handlers (onclick, onload, etc.)
    html = html.replace(/\s*on\w+\s*=\s*"[^"]*"/gi, '');
    html = html.replace(/\s*on\w+\s*=\s*'[^']*'/gi, '');
    html = html.replace(/\s*on\w+\s*=\s*[^\s>]*/gi, '');
    
    // Remove javascript: links
    html = html.replace(/href\s*=\s*["']?\s*javascript\s*:/gi, 'href="#"');
    
    // Remove style attributes that could contain malicious CSS
    html = html.replace(/\s*style\s*=\s*"[^"]*"/gi, '');
    html = html.replace(/\s*style\s*=\s*'[^']*'/gi, '');
    
    // Remove dangerous tags completely
    const dangerousTags = ['script', 'iframe', 'object', 'embed', 'link', 'meta', 'form', 'input', 'button'];
    dangerousTags.forEach(tag => {
      const regex = new RegExp(`<${tag}\\b[^>]*>.*?</${tag}>`, 'gis');
      html = html.replace(regex, '');
      const selfClosing = new RegExp(`<${tag}\\b[^>]*/>`, 'gi');
      html = html.replace(selfClosing, '');
    });

    return html.trim();
  }

  // Strip all HTML tags from text
  stripHTML(text) {
    if (!text || typeof text !== 'string') {
      return '';
    }
    return text.replace(/<[^>]*>/g, '').trim();
  }

  // Validate and sanitize recipe title
  validateTitle(title) {
    if (!title || typeof title !== 'string') {
      return { valid: false, error: 'Title is required' };
    }

    const sanitized = this.stripHTML(title).trim();
    
    if (sanitized.length === 0) {
      return { valid: false, error: 'Title cannot be empty' };
    }

    if (sanitized.length > this.maxLengths.title) {
      return { valid: false, error: `Title must be ${this.maxLengths.title} characters or less` };
    }

    return { valid: true, value: sanitized };
  }

  // Validate and sanitize recipe description
  validateDescription(description) {
    if (!description) {
      return { valid: true, value: '' };
    }

    if (typeof description !== 'string') {
      return { valid: false, error: 'Description must be text' };
    }

    const sanitized = this.sanitizeHTML(description).trim();
    
    if (sanitized.length > this.maxLengths.description) {
      return { valid: false, error: `Description must be ${this.maxLengths.description} characters or less` };
    }

    return { valid: true, value: sanitized };
  }

  // Validate and sanitize ingredients array
  validateIngredients(ingredients) {
    if (!Array.isArray(ingredients)) {
      return { valid: false, error: 'Ingredients must be an array' };
    }

    if (ingredients.length === 0) {
      return { valid: false, error: 'At least one ingredient is required' };
    }

    const sanitized = [];
    for (let i = 0; i < ingredients.length; i++) {
      const ingredient = ingredients[i];
      
      if (typeof ingredient !== 'string') {
        return { valid: false, error: `Ingredient ${i + 1} must be text` };
      }

      const clean = this.stripHTML(ingredient).trim();
      
      if (clean.length === 0) {
        continue; // Skip empty ingredients
      }

      if (clean.length > this.maxLengths.ingredient) {
        return { valid: false, error: `Ingredient ${i + 1} must be ${this.maxLengths.ingredient} characters or less` };
      }

      sanitized.push(clean);
    }

    if (sanitized.length === 0) {
      return { valid: false, error: 'At least one non-empty ingredient is required' };
    }

    return { valid: true, value: sanitized };
  }

  // Validate and sanitize instructions array
  validateInstructions(instructions) {
    if (!Array.isArray(instructions)) {
      return { valid: false, error: 'Instructions must be an array' };
    }

    if (instructions.length === 0) {
      return { valid: false, error: 'At least one instruction is required' };
    }

    const sanitized = [];
    for (let i = 0; i < instructions.length; i++) {
      const instruction = instructions[i];
      
      if (typeof instruction !== 'string') {
        return { valid: false, error: `Instruction ${i + 1} must be text` };
      }

      const clean = this.sanitizeHTML(instruction).trim();
      
      if (clean.length === 0) {
        continue; // Skip empty instructions
      }

      if (clean.length > this.maxLengths.instruction) {
        return { valid: false, error: `Instruction ${i + 1} must be ${this.maxLengths.instruction} characters or less` };
      }

      sanitized.push(clean);
    }

    if (sanitized.length === 0) {
      return { valid: false, error: 'At least one non-empty instruction is required' };
    }

    return { valid: true, value: sanitized };
  }

  // Validate URL
  validateURL(url) {
    if (!url) {
      return { valid: true, value: '' };
    }

    if (typeof url !== 'string') {
      return { valid: false, error: 'URL must be text' };
    }

    const clean = url.trim();
    
    if (clean.length > this.maxLengths.url) {
      return { valid: false, error: `URL must be ${this.maxLengths.url} characters or less` };
    }

    if (clean && !this.patterns.url.test(clean)) {
      return { valid: false, error: 'Invalid URL format' };
    }

    return { valid: true, value: clean };
  }

  // Validate cooking time
  validateTime(time) {
    if (!time) {
      return { valid: true, value: '' };
    }

    if (typeof time !== 'string') {
      return { valid: false, error: 'Time must be text' };
    }

    const clean = this.stripHTML(time).trim();
    
    // Allow common time formats but don't be too strict
    return { valid: true, value: clean };
  }

  // Validate serving size
  validateServing(serving) {
    if (!serving) {
      return { valid: true, value: '' };
    }

    if (typeof serving !== 'string') {
      return { valid: false, error: 'Serving size must be text' };
    }

    const clean = this.stripHTML(serving).trim();
    
    return { valid: true, value: clean };
  }

  // Validate complete recipe object
  validateRecipe(recipe) {
    const errors = [];
    const sanitized = {};

    // Validate title
    const titleResult = this.validateTitle(recipe.title);
    if (!titleResult.valid) {
      errors.push(titleResult.error);
    } else {
      sanitized.title = titleResult.value;
    }

    // Validate description
    const descResult = this.validateDescription(recipe.description);
    if (!descResult.valid) {
      errors.push(descResult.error);
    } else {
      sanitized.description = descResult.value;
    }

    // Validate ingredients
    const ingredientsResult = this.validateIngredients(recipe.ingredients);
    if (!ingredientsResult.valid) {
      errors.push(ingredientsResult.error);
    } else {
      sanitized.ingredients = ingredientsResult.value;
    }

    // Validate instructions
    const instructionsResult = this.validateInstructions(recipe.instructions);
    if (!instructionsResult.valid) {
      errors.push(instructionsResult.error);
    } else {
      sanitized.instructions = instructionsResult.value;
    }

    // Validate optional fields
    const urlResult = this.validateURL(recipe.url);
    if (!urlResult.valid) {
      errors.push(urlResult.error);
    } else {
      sanitized.url = urlResult.value;
    }

    sanitized.prepTime = this.validateTime(recipe.prepTime).value;
    sanitized.cookTime = this.validateTime(recipe.cookTime).value;
    sanitized.totalTime = this.validateTime(recipe.totalTime).value;
    sanitized.servingSize = this.validateServing(recipe.servingSize).value;

    // Validate tags if present
    if (recipe.tags && Array.isArray(recipe.tags)) {
      sanitized.tags = recipe.tags
        .map(tag => this.stripHTML(String(tag)).trim())
        .filter(tag => tag.length > 0 && tag.length <= this.maxLengths.tag)
        .slice(0, 20); // Limit number of tags
    }

    return {
      valid: errors.length === 0,
      errors: errors,
      sanitized: sanitized
    };
  }

  // Validate diagnostic data to prevent malicious payload injection
  validateDiagnosticData(data) {
    const errors = [];
    const sanitized = {};

    // Validate URL
    if (data.url) {
      const urlResult = this.validateURL(data.url);
      if (urlResult.valid) {
        sanitized.url = urlResult.value;
      } else {
        errors.push('Invalid URL in diagnostic data');
      }
    }

    // Validate user agent (strip HTML, limit length)
    if (data.userAgent) {
      sanitized.userAgent = this.stripHTML(String(data.userAgent)).slice(0, 500);
    }

    // Validate page analysis data (remove any potential script content)
    if (data.diagnosticData) {
      sanitized.diagnosticData = {};
      
      // Only allow specific safe fields in diagnostic data
      const allowedFields = ['pageAnalysis', 'extractionAttempts', 'errorMessages', 'selectors'];
      allowedFields.forEach(field => {
        if (data.diagnosticData[field]) {
          // Strip HTML and limit size for safety
          sanitized.diagnosticData[field] = this.stripHTML(JSON.stringify(data.diagnosticData[field])).slice(0, 10000);
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors: errors,
      sanitized: sanitized
    };
  }
}

// Export for both environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SecurityValidator;
} else {
  window.SecurityValidator = SecurityValidator;
}
