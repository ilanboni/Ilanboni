import { chromium, Browser, Page, BrowserContext } from 'playwright';

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15'
];

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function randomDelay(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

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

async function createStealthContext(browser: Browser): Promise<BrowserContext> {
  const userAgent = getRandomUserAgent();
  
  const context = await browser.newContext({
    userAgent: userAgent,
    viewport: { width: 1920, height: 1080 },
    locale: 'it-IT',
    timezoneId: 'Europe/Rome',
    geolocation: { latitude: 45.4642, longitude: 9.1900 },
    permissions: ['geolocation'],
    extraHTTPHeaders: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1'
    }
  });
  
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    Object.defineProperty(navigator, 'languages', { get: () => ['it-IT', 'it', 'en-US', 'en'] });
    (window as any).chrome = { runtime: {} };
    Object.defineProperty(navigator, 'permissions', {
      get: () => ({
        query: () => Promise.resolve({ state: 'granted' })
      })
    });
  });
  
  return context;
}

async function handleCookieConsent(page: Page): Promise<void> {
  const cookieSelectors = [
    '#didomi-notice-agree-button',
    '[data-testid="accept-cookies"]',
    'button[id*="accept"]',
    'button[class*="accept"]',
    '.qc-cmp2-summary-buttons button:first-child',
    '#onetrust-accept-btn-handler',
    '.cc-accept-all',
    '[aria-label*="ccetta"]',
    'button:has-text("Accetta")',
    'button:has-text("Accept")',
    'button:has-text("Accetto")'
  ];
  
  for (const selector of cookieSelectors) {
    try {
      const btn = await page.$(selector);
      if (btn) {
        await btn.click();
        console.log(`[URL-EXTRACTOR] 🍪 Cookie consent clicked: ${selector}`);
        await page.waitForTimeout(randomDelay(500, 1000));
        break;
      }
    } catch (e) {
    }
  }
}

async function simulateHumanBehavior(page: Page): Promise<void> {
  await page.waitForTimeout(randomDelay(1000, 2000));
  await page.mouse.move(randomDelay(100, 500), randomDelay(100, 300));
  await page.evaluate(() => window.scrollBy(0, Math.random() * 300 + 100));
  await page.waitForTimeout(randomDelay(500, 1000));
  await page.evaluate(() => window.scrollBy(0, Math.random() * 200 + 100));
  await page.waitForTimeout(randomDelay(300, 700));
}

async function checkForBlock(page: Page): Promise<boolean> {
  const html = await page.content();
  const blockIndicators = [
    'captcha',
    'robot',
    'blocked',
    'verifica che non sei un robot',
    'unusual traffic',
    'access denied',
    'verificare la propria identità'
  ];
  
  const lowerHtml = html.toLowerCase();
  for (const indicator of blockIndicators) {
    if (lowerHtml.includes(indicator)) {
      console.log(`[URL-EXTRACTOR] ⚠️ Block detected: ${indicator}`);
      return true;
    }
  }
  return false;
}

export async function extractPropertyFromUrl(url: string): Promise<ExtractedProperty> {
  const portal = detectPortal(url);
  console.log(`[URL-EXTRACTOR] 🔍 Extracting from ${portal}: ${url}`);
  
  let browser: Browser | null = null;
  
  try {
    browser = await chromium.launch({ 
      headless: true,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });
    
    const context = await createStealthContext(browser);
    const page = await context.newPage();
    
    console.log(`[URL-EXTRACTOR] 🌐 Navigating to ${url}...`);
    await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
    
    await handleCookieConsent(page);
    await simulateHumanBehavior(page);
    
    const isBlocked = await checkForBlock(page);
    if (isBlocked) {
      console.log(`[URL-EXTRACTOR] 🔄 Detected block, waiting and retrying...`);
      await page.waitForTimeout(randomDelay(3000, 5000));
      await page.reload({ waitUntil: 'networkidle' });
      await handleCookieConsent(page);
      await simulateHumanBehavior(page);
    }
    
    let result: ExtractedProperty;
    
    switch (portal) {
      case 'Idealista':
        result = await extractFromIdealistaEnhanced(page, url);
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

async function extractFromIdealistaEnhanced(page: Page, url: string): Promise<ExtractedProperty> {
  console.log(`[URL-EXTRACTOR] 📱 Attempting to reveal phone number...`);
  
  const phoneButtonSelectors = [
    'button[class*="phone"]',
    'a[class*="phone"]',
    '[data-testid="phone-button"]',
    '.icon-phone',
    'button:has-text("Chiama")',
    'button:has-text("Telefono")',
    'a:has-text("Chiama")',
    '.contact-phones button',
    '.phone-button',
    '[class*="showPhone"]',
    '.see-phones-btn',
    'button[data-action="show-phone"]'
  ];
  
  for (const selector of phoneButtonSelectors) {
    try {
      const btn = await page.$(selector);
      if (btn) {
        await btn.click();
        console.log(`[URL-EXTRACTOR] 📞 Phone button clicked: ${selector}`);
        await page.waitForTimeout(randomDelay(1500, 2500));
        break;
      }
    } catch (e) {
    }
  }
  
  await page.evaluate(() => {
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(randomDelay(500, 1000));
  
  const data = await page.evaluate(() => {
    let address = '';
    let city = '';
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
    
    const addressSelectors = [
      'h1.main-info__title-main',
      '.main-info__title-main',
      '[class*="title-main"]',
      'h1[class*="title"]',
      '.detail-info__title-main',
      'span.main-info__title-main'
    ];
    for (const sel of addressSelectors) {
      const el = document.querySelector(sel);
      if (el && el.textContent) {
        address = el.textContent.trim();
        break;
      }
    }
    
    const locationSelectors = [
      '.main-info__title-minor',
      '.detail-info__title-minor',
      '[class*="title-minor"]',
      '.main-info span.main-info__title-minor'
    ];
    for (const sel of locationSelectors) {
      const el = document.querySelector(sel);
      if (el && el.textContent) {
        city = el.textContent.trim();
        break;
      }
    }
    
    const priceSelectors = [
      '.info-data-price',
      '.price-info__container .info-data-price',
      '[class*="price"]',
      '.price',
      '.detail-info__price',
      'span[class*="Price"]'
    ];
    for (const sel of priceSelectors) {
      const el = document.querySelector(sel);
      if (el && el.textContent && el.textContent.includes('€')) {
        price = el.textContent.trim();
        break;
      }
    }
    
    const descSelectors = [
      '.comment p',
      '.adCommentsLanguage p',
      '.expandable-text',
      '.comment',
      '.description-container',
      '[class*="description"]',
      '.detail-info__comment'
    ];
    for (const sel of descSelectors) {
      const el = document.querySelector(sel);
      if (el && el.textContent && el.textContent.length > 50) {
        description = el.textContent.trim();
        break;
      }
    }
    
    const featureContainers = [
      '.info-features',
      '.details-property_features',
      '.info-data',
      '[class*="features"]',
      '.detail-info__features'
    ];
    
    for (const container of featureContainers) {
      const items = document.querySelectorAll(`${container} span, ${container} li, ${container} div`);
      items.forEach((item: any) => {
        const text = item.textContent?.toLowerCase() || '';
        
        if ((text.includes('m²') || text.includes('mq')) && !size) {
          const match = text.match(/(\d+)\s*(m²|mq)/);
          if (match) size = match[1];
        }
        
        if ((text.includes('camera') || text.includes('stanz') || text.includes('hab') || text.includes('local')) && !bedrooms) {
          const match = text.match(/(\d+)/);
          if (match) bedrooms = match[1];
        }
        
        if (text.includes('bagn') && !bathrooms) {
          const match = text.match(/(\d+)/);
          if (match) bathrooms = match[1];
        }
        
        if (text.includes('piano') && !floor) {
          const match = text.match(/piano\s*(\w+|\d+)/i);
          if (match) floor = match[1];
        }
      });
    }
    
    const ownerSelectors = [
      '.professional-name',
      '.advertiser-name-container',
      '.advertiser-name',
      '[class*="advertiser"]',
      '.contact-info__name',
      '.owner-name'
    ];
    for (const sel of ownerSelectors) {
      const el = document.querySelector(sel);
      if (el && el.textContent) {
        ownerName = el.textContent.trim();
        break;
      }
    }
    
    const phoneSelectors = [
      '.phone-owner-link',
      '[data-phone]',
      '.contact-phone',
      'a[href^="tel:"]',
      '.phone-number',
      '[class*="phone"]',
      '.contact-phones span'
    ];
    for (const sel of phoneSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        const dataPhone = el.getAttribute('data-phone');
        const href = el.getAttribute('href');
        const text = el.textContent?.trim() || '';
        
        if (dataPhone) {
          ownerPhone = dataPhone;
          break;
        } else if (href && href.startsWith('tel:')) {
          ownerPhone = href.replace('tel:', '');
          break;
        } else if (text && /\d{6,}/.test(text.replace(/\D/g, ''))) {
          ownerPhone = text;
          break;
        }
      }
    }
    
    const contactFormSelectors = [
      '[class*="contact"]',
      'button[class*="message"]',
      '.form-contact',
      '.contact-form',
      'form[class*="contact"]'
    ];
    for (const sel of contactFormSelectors) {
      const el = document.querySelector(sel);
      if (el && !ownerPhone) {
        hasWebContact = true;
        break;
      }
    }
    
    const imgSelectors = [
      'img[src*="idealista"]',
      'img[src*="/foto/"]',
      '.gallery img',
      '[class*="gallery"] img',
      '.slider img'
    ];
    for (const sel of imgSelectors) {
      document.querySelectorAll(sel).forEach((img: any) => {
        const src = img.src || img.getAttribute('data-src');
        if (src && !imageUrls.includes(src) && imageUrls.length < 20) {
          if (src.includes('idealista') || src.includes('/foto/')) {
            imageUrls.push(src);
          }
        }
      });
    }
    
    return { address, city, price, size, description, ownerName, ownerPhone, bedrooms, bathrooms, floor, hasWebContact, imageUrls };
  });
  
  const pageHtml = await page.content();
  let extractedPhone = data.ownerPhone;
  
  if (!extractedPhone) {
    const phonePatterns = [
      /(?:\+39|0039)?[\s.-]?3[0-9]{2}[\s.-]?\d{6,7}/g,
      /(?:\+39|0039)?[\s.-]?0[0-9]{1,3}[\s.-]?\d{6,8}/g
    ];
    
    for (const pattern of phonePatterns) {
      const matches = pageHtml.match(pattern);
      if (matches && matches.length > 0) {
        extractedPhone = matches[0].replace(/[\s.-]/g, '').replace(/^(0039|\+39)/, '');
        console.log(`[URL-EXTRACTOR] 📞 Phone found in HTML: ${extractedPhone}`);
        break;
      }
    }
  }
  
  let extractedCity = data.city || 'Milano';
  if (url.includes('milano')) extractedCity = 'Milano';
  else if (data.city) extractedCity = data.city.split(',')[0].trim();
  
  console.log(`[URL-EXTRACTOR] 📊 Extracted data:`, {
    address: data.address,
    price: data.price,
    size: data.size,
    phone: extractedPhone,
    bedrooms: data.bedrooms,
    images: data.imageUrls.length
  });
  
  return {
    address: data.address || 'Indirizzo da verificare',
    city: extractedCity,
    price: cleanPrice(data.price),
    size: cleanSize(data.size),
    description: data.description,
    ownerName: data.ownerName || null,
    ownerPhone: extractedPhone?.replace(/\D/g, '') || null,
    ownerEmail: null,
    externalLink: url,
    portalSource: 'Idealista',
    hasWebContact: data.hasWebContact || !extractedPhone,
    bedrooms: data.bedrooms ? parseInt(data.bedrooms) : null,
    bathrooms: data.bathrooms ? parseInt(data.bathrooms) : null,
    floor: data.floor || null,
    imageUrls: data.imageUrls
  };
}

async function extractFromIdealista(page: Page, url: string): Promise<ExtractedProperty> {
  return extractFromIdealistaEnhanced(page, url);
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
