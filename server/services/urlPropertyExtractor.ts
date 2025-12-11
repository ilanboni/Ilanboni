import { chromium, Browser, Page } from 'playwright';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export interface ExtractedProperty {
  address: string;
  city: string;
  price: number | null;
  size: number | null;
  description: string;
  ownerName: string | null;
  ownerPhone: string | null;
  ownerEmail: string | null;
  externalLink: string;
  portalSource: string;
  hasWebContact: boolean;
  bedrooms: number | null;
  bathrooms: number | null;
  floor: string | null;
  imageUrls: string[];
}

function detectPortal(url: string): string {
  if (url.includes('idealista.it')) return 'Idealista';
  if (url.includes('immobiliare.it')) return 'Immobiliare.it';
  if (url.includes('casadaprivato.it')) return 'CasaDaPrivato';
  if (url.includes('clickcase.it')) return 'ClickCase';
  if (url.includes('casa.it')) return 'Casa.it';
  if (url.includes('subito.it')) return 'Subito.it';
  return 'Altro';
}

function cleanPrice(priceText: string): number | null {
  if (!priceText) return null;
  const cleaned = priceText.replace(/[^\d]/g, '');
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? null : num;
}

function cleanSize(sizeText: string): number | null {
  if (!sizeText) return null;
  const match = sizeText.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

function extractPhoneNumbers(text: string): string[] {
  const phonePatterns = [
    /(?:\+39|0039)?[\s.-]?3[0-9]{2}[\s.-]?\d{6,7}/g,
    /(?:\+39|0039)?[\s.-]?0[0-9]{1,3}[\s.-]?\d{6,8}/g,
    /3\d{9}/g,
    /0\d{8,10}/g
  ];
  
  const phones: string[] = [];
  for (const pattern of phonePatterns) {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach(m => {
        const cleaned = m.replace(/[\s.-]/g, '').replace(/^(0039|\+39)/, '');
        if (cleaned.length >= 9 && cleaned.length <= 12 && !phones.includes(cleaned)) {
          phones.push(cleaned);
        }
      });
    }
  }
  return phones;
}

function extractEmails(text: string): string[] {
  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = text.match(emailPattern);
  return matches ? [...new Set(matches)] : [];
}

export async function extractPropertyFromUrl(url: string): Promise<ExtractedProperty> {
  const portal = detectPortal(url);
  console.log(`[URL-EXTRACTOR] 🔍 Extracting from ${portal}: ${url}`);
  
  let browser: Browser | null = null;
  
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: USER_AGENT,
      viewport: { width: 1920, height: 1080 }
    });
    const page = await context.newPage();
    
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    
    let result: ExtractedProperty;
    
    switch (portal) {
      case 'Idealista':
        result = await extractFromIdealista(page, url);
        break;
      case 'Immobiliare.it':
        result = await extractFromImmobiliare(page, url);
        break;
      case 'CasaDaPrivato':
      case 'ClickCase':
        result = await extractFromCasaDaPrivato(page, url, portal);
        break;
      default:
        result = await extractGeneric(page, url, portal);
    }
    
    await browser.close();
    console.log(`[URL-EXTRACTOR] ✅ Extracted: ${result.address}, €${result.price}, ${result.size}mq`);
    return result;
    
  } catch (error) {
    if (browser) await browser.close();
    console.error(`[URL-EXTRACTOR] ❌ Error extracting from ${url}:`, error);
    throw error;
  }
}

async function extractFromIdealista(page: Page, url: string): Promise<ExtractedProperty> {
  const data = await page.evaluate(() => {
    let address = '';
    let price = '';
    let size = '';
    let description = '';
    let ownerName = '';
    let ownerPhone = '';
    let bedrooms = '';
    let bathrooms = '';
    let floor = '';
    let hasWebContact = false;
    const imageUrls: string[] = [];
    
    const titleEl = document.querySelector('h1.main-info__title-main, .main-info__title-main');
    if (titleEl) address = titleEl.textContent?.trim() || '';
    
    const locationEl = document.querySelector('.main-info__title-minor');
    if (locationEl && !address) address = locationEl.textContent?.trim() || '';
    
    const priceEl = document.querySelector('.info-data-price, .price-info__container .info-data-price');
    if (priceEl) price = priceEl.textContent?.trim() || '';
    
    const descEl = document.querySelector('.comment p, .adCommentsLanguage p, .expandable-text');
    if (descEl) description = descEl.textContent?.trim() || '';
    
    const detailItems = document.querySelectorAll('.info-features span, .details-property_features li');
    detailItems.forEach((item: any) => {
      const text = item.textContent?.toLowerCase() || '';
      if (text.includes('m²') || text.includes('mq')) {
        const match = text.match(/(\d+)/);
        if (match) size = match[1];
      }
      if (text.includes('habitaci') || text.includes('camera') || text.includes('stanz')) {
        const match = text.match(/(\d+)/);
        if (match) bedrooms = match[1];
      }
      if (text.includes('bagn') || text.includes('baño')) {
        const match = text.match(/(\d+)/);
        if (match) bathrooms = match[1];
      }
      if (text.includes('piano')) {
        floor = text.replace('piano', '').trim();
      }
    });
    
    const advertiserEl = document.querySelector('.professional-name, .advertiser-name-container');
    if (advertiserEl) ownerName = advertiserEl.textContent?.trim() || '';
    
    const phoneEl = document.querySelector('.phone-owner-link, [data-phone], .contact-phone');
    if (phoneEl) {
      ownerPhone = phoneEl.getAttribute('data-phone') || phoneEl.textContent?.trim() || '';
    }
    
    const contactBtn = document.querySelector('[class*="contact"], button[class*="message"], .form-contact');
    if (contactBtn && !ownerPhone) hasWebContact = true;
    
    document.querySelectorAll('img[src*="idealista"]').forEach((img: any) => {
      const src = img.src;
      if (src && src.includes('/foto/') && !imageUrls.includes(src)) {
        imageUrls.push(src);
      }
    });
    
    return { address, price, size, description, ownerName, ownerPhone, bedrooms, bathrooms, floor, hasWebContact, imageUrls };
  });
  
  return {
    address: data.address || 'Indirizzo da verificare',
    city: 'Milano',
    price: cleanPrice(data.price),
    size: cleanSize(data.size),
    description: data.description,
    ownerName: data.ownerName || null,
    ownerPhone: data.ownerPhone?.replace(/\D/g, '') || null,
    ownerEmail: null,
    externalLink: url,
    portalSource: 'Idealista',
    hasWebContact: data.hasWebContact || !data.ownerPhone,
    bedrooms: data.bedrooms ? parseInt(data.bedrooms) : null,
    bathrooms: data.bathrooms ? parseInt(data.bathrooms) : null,
    floor: data.floor || null,
    imageUrls: data.imageUrls
  };
}

async function extractFromImmobiliare(page: Page, url: string): Promise<ExtractedProperty> {
  const data = await page.evaluate(() => {
    let address = '';
    let price = '';
    let size = '';
    let description = '';
    let ownerName = '';
    let ownerPhone = '';
    let bedrooms = '';
    let bathrooms = '';
    let floor = '';
    let hasWebContact = false;
    const imageUrls: string[] = [];
    
    const titleEl = document.querySelector('h1.re-title__title, .im-titleBlock__title');
    if (titleEl) address = titleEl.textContent?.trim() || '';
    
    const priceEl = document.querySelector('.re-overview__price, .im-mainFeatures__title--price');
    if (priceEl) price = priceEl.textContent?.trim() || '';
    
    const descEl = document.querySelector('.in-readAll, .im-description__text');
    if (descEl) description = descEl.textContent?.trim() || '';
    
    const features = document.querySelectorAll('.re-featuresItem, .nd-list__item');
    features.forEach((f: any) => {
      const text = f.textContent?.toLowerCase() || '';
      if (text.includes('superficie') || text.includes('m²')) {
        const match = text.match(/(\d+)/);
        if (match) size = match[1];
      }
      if (text.includes('local') || text.includes('stanz')) {
        const match = text.match(/(\d+)/);
        if (match) bedrooms = match[1];
      }
      if (text.includes('bagn')) {
        const match = text.match(/(\d+)/);
        if (match) bathrooms = match[1];
      }
      if (text.includes('piano')) {
        const match = text.match(/piano\s*(\w+)/i);
        if (match) floor = match[1];
      }
    });
    
    const agencyEl = document.querySelector('.re-contactSheet__agencyName, .in-referent__name');
    if (agencyEl) ownerName = agencyEl.textContent?.trim() || '';
    
    const phoneEl = document.querySelector('[href^="tel:"], .re-contactSheet__phone');
    if (phoneEl) {
      const href = phoneEl.getAttribute('href');
      ownerPhone = href ? href.replace('tel:', '') : phoneEl.textContent?.trim() || '';
    }
    
    const contactForm = document.querySelector('.re-contactForm, .in-contactForm');
    if (contactForm && !ownerPhone) hasWebContact = true;
    
    document.querySelectorAll('img[data-src], img[src*="pwm.im-cdn"]').forEach((img: any) => {
      const src = img.getAttribute('data-src') || img.src;
      if (src && !imageUrls.includes(src)) {
        imageUrls.push(src);
      }
    });
    
    return { address, price, size, description, ownerName, ownerPhone, bedrooms, bathrooms, floor, hasWebContact, imageUrls };
  });
  
  return {
    address: data.address || 'Indirizzo da verificare',
    city: 'Milano',
    price: cleanPrice(data.price),
    size: cleanSize(data.size),
    description: data.description,
    ownerName: data.ownerName || null,
    ownerPhone: data.ownerPhone?.replace(/\D/g, '') || null,
    ownerEmail: null,
    externalLink: url,
    portalSource: 'Immobiliare.it',
    hasWebContact: data.hasWebContact || !data.ownerPhone,
    bedrooms: data.bedrooms ? parseInt(data.bedrooms) : null,
    bathrooms: data.bathrooms ? parseInt(data.bathrooms) : null,
    floor: data.floor || null,
    imageUrls: data.imageUrls
  };
}

async function extractFromCasaDaPrivato(page: Page, url: string, portal: string): Promise<ExtractedProperty> {
  const data = await page.evaluate(() => {
    let address = '';
    let price = '';
    let size = '';
    let description = '';
    let ownerName = '';
    let ownerPhone = '';
    let hasWebContact = false;
    const imageUrls: string[] = [];
    
    const h1 = document.querySelector('h1');
    if (h1) address = h1.textContent?.trim() || '';
    
    const allText = document.body?.textContent || '';
    
    const priceMatch = allText.match(/€\s*([\d.,]+)/);
    if (priceMatch) price = priceMatch[1];
    
    const sizeMatch = allText.match(/(\d+)\s*m[²q]/i);
    if (sizeMatch) size = sizeMatch[1];
    
    const descSelectors = ['.description', '.descrizione', 'article p', '.detail-text'];
    for (const sel of descSelectors) {
      const el = document.querySelector(sel);
      if (el && el.textContent && el.textContent.length > 50) {
        description = el.textContent.trim();
        break;
      }
    }
    
    const phonePatterns = [
      /(?:\+39|0039)?[\s.-]?3[0-9]{2}[\s.-]?\d{6,7}/g,
      /3\d{9}/g
    ];
    for (const pattern of phonePatterns) {
      const matches = allText.match(pattern);
      if (matches && matches.length > 0) {
        ownerPhone = matches[0].replace(/[\s.-]/g, '');
        break;
      }
    }
    
    const contactBtn = document.querySelector('[class*="contact"], button[type="submit"]');
    if (contactBtn && !ownerPhone) hasWebContact = true;
    
    document.querySelectorAll('img').forEach((img: any) => {
      const src = img.src;
      if (src && (src.includes('annunci') || src.includes('immobil')) && !imageUrls.includes(src)) {
        imageUrls.push(src);
      }
    });
    
    return { address, price, size, description, ownerName, ownerPhone, hasWebContact, imageUrls };
  });
  
  return {
    address: data.address || 'Indirizzo da verificare',
    city: 'Milano',
    price: cleanPrice(data.price),
    size: cleanSize(data.size),
    description: data.description,
    ownerName: data.ownerName || null,
    ownerPhone: data.ownerPhone?.replace(/\D/g, '') || null,
    ownerEmail: null,
    externalLink: url,
    portalSource: portal,
    hasWebContact: data.hasWebContact || !data.ownerPhone,
    bedrooms: null,
    bathrooms: null,
    floor: null,
    imageUrls: data.imageUrls
  };
}

async function extractGeneric(page: Page, url: string, portal: string): Promise<ExtractedProperty> {
  const data = await page.evaluate(() => {
    let address = '';
    let price = '';
    let size = '';
    let description = '';
    let ownerPhone = '';
    let hasWebContact = false;
    const imageUrls: string[] = [];
    
    const h1 = document.querySelector('h1');
    if (h1) address = h1.textContent?.trim() || '';
    
    const allText = document.body?.textContent || '';
    
    const priceMatch = allText.match(/€\s*([\d.,]+)/);
    if (priceMatch) price = priceMatch[1];
    
    const sizeMatch = allText.match(/(\d+)\s*m[²q]/i);
    if (sizeMatch) size = sizeMatch[1];
    
    const paragraphs = document.querySelectorAll('p');
    for (const p of Array.from(paragraphs)) {
      if (p.textContent && p.textContent.length > 100) {
        description = p.textContent.trim();
        break;
      }
    }
    
    const phoneMatch = allText.match(/3\d{9}/);
    if (phoneMatch) ownerPhone = phoneMatch[0];
    
    const forms = document.querySelectorAll('form');
    if (forms.length > 0 && !ownerPhone) hasWebContact = true;
    
    return { address, price, size, description, ownerPhone, hasWebContact, imageUrls };
  });
  
  return {
    address: data.address || 'Indirizzo da verificare',
    city: 'Milano',
    price: cleanPrice(data.price),
    size: cleanSize(data.size),
    description: data.description,
    ownerName: null,
    ownerPhone: data.ownerPhone || null,
    ownerEmail: null,
    externalLink: url,
    portalSource: portal,
    hasWebContact: data.hasWebContact || !data.ownerPhone,
    bedrooms: null,
    bathrooms: null,
    floor: null,
    imageUrls: data.imageUrls
  };
}
