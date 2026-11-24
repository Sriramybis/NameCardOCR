/**
 * Business Card OCR Text Parser
 * Extracts structured fields (Name, Company, Phone 1, Phone 2, Email, Title, Website, Address)
 * from raw OCR text lines.
 */

class BusinessCardParser {
  constructor() {
    this.titleKeywords = [
      'chief executive officer', 'chief technology officer', 'chief operating officer',
      'chief financial officer', 'ceo', 'cto', 'coo', 'cfo', 'president', 'vice president',
      'vp', 'director', 'managing director', 'executive director', 'general manager',
      'manager', 'senior manager', 'project manager', 'product manager', 'sales manager',
      'account manager', 'marketing manager', 'operations manager', 'hr manager',
      'software engineer', 'senior engineer', 'lead engineer', 'engineer', 'architect',
      'developer', 'full stack developer', 'frontend developer', 'backend developer',
      'consultant', 'senior consultant', 'specialist', 'advisor', 'analyst', 'data scientist',
      'designer', 'ui/ux designer', 'lead', 'team lead', 'head of', 'partner', 'associate',
      'founder', 'co-founder', 'owner', 'proprietor', 'accountant', 'attorney', 'lawyer',
      'officer', 'representative', 'coordinator', 'supervisor', 'executive'
    ];

    this.companyKeywords = [
      'inc', 'incorporated', 'llc', 'ltd', 'limited', 'corp', 'corporation', 'co.', 'co',
      'technologies', 'technology', 'tech', 'solutions', 'systems', 'enterprises', 'enterprise',
      'group', 'holdings', 'labs', 'laboratories', 'services', 'consulting', 'global',
      'international', 'studios', 'agency', 'pvt', 'private limited', 'gmbh', 'pty',
      'bank', 'insurance', 'industries', 'ventures', 'media', 'network', 'digital'
    ];

    this.addressKeywords = [
      'street', 'st.', 'st,', 'st ', 'avenue', 'ave', 'road', 'rd.', 'rd,', 'rd ',
      'boulevard', 'blvd', 'lane', 'ln.', 'drive', 'dr.', 'suite', 'ste', 'ste.', 'floor', 'fl.',
      'bldg', 'building', 'tower', 'block', 'highway', 'hwy', 'parkway', 'pkwy', 'plaza',
      'box', 'po box', 'p.o. box', 'zip', 'postal', 'sector', 'nagar', 'city', 'country'
    ];

    this.personPrefixes = ['dr', 'dr.', 'mr', 'mr.', 'ms', 'ms.', 'mrs', 'mrs.', 'prof', 'prof.', 'er', 'er.'];
  }

  parse(rawText) {
    if (!rawText || typeof rawText !== 'string') {
      return this.emptyResult(rawText);
    }

    const lines = rawText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && !/^[\W_]+$/.test(line));

    const result = {
      name: '',
      company: '',
      phone: '',
      phone2: '',
      email: '',
      title: '',
      website: '',
      address: '',
      rawText: rawText.trim(),
      needsEdit: false
    };

    const unusedLines = [];
    const phoneList = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let lineUsed = false;

      // 1. Extract Email
      if (!result.email) {
        const emailMatch = line.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i);
        if (emailMatch) {
          result.email = emailMatch[0].toLowerCase();
          lineUsed = true;
        }
      }

      // 2. Extract Website (only if not an email line)
      if (!result.website && !line.includes('@')) {
        // Look for http/https, www., or standard website endings
        const webMatch = line.match(/(https?:\/\/[^\s]+|www\.[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|(?:https?:\/\/)?(?:[a-zA-Z0-9-]+\.)+(?:com|org|net|io|ai|co|in|sg|me|biz|info|gov|edu)(?:\/[^\s]*)?)/i);
        if (webMatch) {
          result.website = webMatch[0];
          lineUsed = true;
        }
      }

      // 3. Extract Phone numbers
      // Match phone numbers with prefixes like Tel, Mob, Phone, Fax, Ph, or typical digit patterns
      const phoneRegex = /(?:\b(?:telephone|tel|mobile|mob|cell|phone|ph|fax|call|office|direct|dir)[\s.:#*-]*)?((?:\+?\d{1,4}[\s.-]*)?(?:\(?\d{2,5}\)?[\s.-]*)?\d{3,5}[\s.-]*\d{3,5}(?:[\s.-]*\d{1,4})?)/gi;
      let match;
      let lineHadPhone = false;
      while ((match = phoneRegex.exec(line)) !== null) {
        const candidate = match[1].trim();
        const digits = candidate.replace(/\D/g, '');
        if (digits.length >= 7 && digits.length <= 15) {
          if (!phoneList.includes(candidate)) {
            phoneList.push(candidate);
          }
          lineHadPhone = true;
        }
      }
      if (lineHadPhone) {
        // Check if line only contains phone and label
        const withoutPhones = line.replace(/\b(?:telephone|tel|mobile|mob|cell|phone|ph|fax|call|office|direct|dir)[\s.:#*-]*/gi, '')
                                  .replace(/[+\d()\-.\s/]/g, '').trim();
        if (withoutPhones.length < 3) {
          lineUsed = true;
        }
      }

      if (!lineUsed) {
        unusedLines.push(line);
      }
    }

    // Assign Phone 1 and Phone 2
    if (phoneList.length > 0) result.phone = phoneList[0];
    if (phoneList.length > 1) result.phone2 = phoneList[1];

    // 4. Extract Job Title from remaining lines
    const remainingAfterTitle = [];
    for (const line of unusedLines) {
      if (!result.title) {
        const lower = line.toLowerCase();
        const matchedTitle = this.titleKeywords.find(keyword => {
          const regex = new RegExp(`\\b${keyword}\\b`, 'i');
          return regex.test(lower);
        });

        if (matchedTitle) {
          result.title = this.cleanLine(line);
          continue;
        }
      }
      remainingAfterTitle.push(line);
    }

    // 5. Extract Company Name
    const remainingAfterCompany = [];
    for (const line of remainingAfterTitle) {
      if (!result.company) {
        const lower = line.toLowerCase();
        const matchedCompany = this.companyKeywords.find(keyword => {
          const regex = new RegExp(`\\b${keyword}\\b`, 'i');
          return regex.test(lower);
        });

        if (matchedCompany) {
          result.company = this.cleanLine(line);
          continue;
        }
      }
      remainingAfterCompany.push(line);
    }

    // 6. Extract Address
    const addressLines = [];
    const remainingAfterAddress = [];
    for (const line of remainingAfterCompany) {
      const lower = line.toLowerCase();
      const hasZip = /\b\d{5,6}\b/.test(line);
      const isAddress = hasZip || this.addressKeywords.some(keyword => {
        const regex = new RegExp(`\\b${keyword}\\b`, 'i');
        return regex.test(lower);
      });

      if (isAddress) {
        addressLines.push(this.cleanLine(line));
      } else {
        remainingAfterAddress.push(line);
      }
    }
    if (addressLines.length > 0) {
      result.address = addressLines.join(', ');
    }

    // 7. Extract Name from remaining lines
    // Best name candidate: line with honorific or first short prominent line (2-4 capitalized words)
    let bestName = '';
    for (let i = 0; i < remainingAfterAddress.length; i++) {
      const line = remainingAfterAddress[i];
      const lower = line.toLowerCase();
      const words = line.split(/\s+/);

      // Check for honorific / title prefix
      const hasPrefix = this.personPrefixes.some(p => lower.startsWith(p + ' ') || lower.startsWith(p + '.'));
      if (hasPrefix && words.length >= 2 && words.length <= 5) {
        bestName = line;
        remainingAfterAddress.splice(i, 1);
        break;
      }

      // Check for clean personal name (2 to 4 words, letters & hyphens only, starts with capital)
      const isNamePattern = /^[A-Z][a-zA-Z'-]+(?:\s+[A-Z][a-zA-Z'.-]+){1,3}$/.test(line);
      if (isNamePattern && !bestName) {
        bestName = line;
        remainingAfterAddress.splice(i, 1);
        break;
      }
    }

    // Fallback name: if still not found, take first reasonable text line that isn't too long
    if (!bestName && remainingAfterAddress.length > 0) {
      for (let i = 0; i < remainingAfterAddress.length; i++) {
        const line = remainingAfterAddress[i];
        if (line.length >= 3 && line.length <= 40 && !/\d{3,}/.test(line)) {
          bestName = line;
          remainingAfterAddress.splice(i, 1);
          break;
        }
      }
    }

    result.name = this.cleanLine(bestName);

    // Fallback company: if no company identified yet, take top line if name was picked from below
    if (!result.company && remainingAfterAddress.length > 0) {
      const candidate = remainingAfterAddress[0];
      if (candidate.length >= 3 && candidate.length <= 60 && candidate !== result.name) {
        result.company = this.cleanLine(candidate);
      }
    }

    // If company is still empty, guess from email domain
    if (!result.company && result.email) {
      const domain = result.email.split('@')[1];
      if (domain && !domain.includes('gmail') && !domain.includes('yahoo') && !domain.includes('hotmail') && !domain.includes('outlook')) {
        const brand = domain.split('.')[0];
        if (brand && brand.length > 2) {
          result.company = brand.charAt(0).toUpperCase() + brand.slice(1);
        }
      }
    }

    return result;
  }

  cleanLine(str) {
    if (!str) return '';
    return str
      .replace(/^[^a-zA-Z0-9#+]+/, '')
      .replace(/[^a-zA-Z0-9.)]+$/, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  emptyResult(raw = '') {
    return {
      name: '',
      company: '',
      phone: '',
      phone2: '',
      email: '',
      title: '',
      website: '',
      address: '',
      rawText: raw,
      needsEdit: false
    };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = BusinessCardParser;
}
