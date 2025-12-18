import { Link, useLocation } from "wouter";
import { Phone, Mail, MapPin, Instagram, Facebook, Linkedin } from "lucide-react";

interface WebsiteLayoutProps {
  children: React.ReactNode;
}

export default function WebsiteLayout({ children }: WebsiteLayoutProps) {
  const [location] = useLocation();
  
  const isPreview = location.startsWith("/sito-preview");
  const basePath = isPreview ? "/sito-preview" : "/sito";

  const navLinks = [
    { href: basePath, label: "Home" },
    { href: `${basePath}/immobili`, label: "Immobili" },
    { href: `${basePath}/blog`, label: "Journal" },
    { href: `${basePath}/chi-siamo`, label: "Chi Siamo" },
    { href: `${basePath}/contatti`, label: "Contatti" },
  ];

  const isActive = (href: string) => {
    if (href === basePath) return location === basePath;
    return location.startsWith(href);
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ fontFamily: "'Manrope', sans-serif", background: '#FFFFFF' }}>
      <header 
        className="sticky top-0 z-50 border-b"
        style={{ 
          background: 'rgba(255,255,255,0.95)', 
          backdropFilter: 'blur(12px)',
          borderColor: 'rgba(0,0,0,0.08)'
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <Link href={basePath} className="flex items-center gap-2" data-testid="link-home-logo">
              <span 
                className="w-2 h-2 rounded-full"
                style={{ background: '#C5A059' }}
              />
              <span 
                className="text-sm font-semibold tracking-widest uppercase"
                style={{ color: '#1A1A1A', fontFamily: "'Manrope', sans-serif" }}
              >
                Cavour Immobiliare
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-8" data-testid="nav-desktop">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-xs font-medium tracking-widest uppercase transition-colors"
                  style={{ 
                    color: isActive(link.href) ? '#C5A059' : '#666666',
                  }}
                  data-testid={`link-nav-${link.label.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-4">
              <a
                href="tel:+390276007544"
                className="hidden lg:flex items-center gap-2 text-xs tracking-wide transition-colors"
                style={{ color: '#666666' }}
                data-testid="link-phone-header"
              >
                <Phone className="w-4 h-4" />
                <span>02 7600 7544</span>
              </a>
              <Link
                href={`${basePath}/contatti`}
                className="px-5 py-2.5 text-xs font-semibold tracking-widest uppercase transition-colors"
                style={{ 
                  background: '#C5A059', 
                  color: '#FFFFFF',
                }}
                data-testid="button-contact-header"
              >
                Contattaci
              </Link>
            </div>
          </div>

          <nav className="md:hidden pb-4 flex justify-center gap-6 border-t pt-3" style={{ borderColor: 'rgba(0,0,0,0.08)' }} data-testid="nav-mobile">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-xs font-medium tracking-wider uppercase"
                style={{ 
                  color: isActive(link.href) ? '#C5A059' : '#666666'
                }}
                data-testid={`link-nav-mobile-${link.label.toLowerCase().replace(/\s+/g, '-')}`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="flex-grow">
        {children}
      </main>

      <footer style={{ background: '#0b0b0b', color: '#FFFFFF' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-6">
                <span 
                  className="w-2 h-2 rounded-full"
                  style={{ background: '#C5A059' }}
                />
                <span 
                  className="text-sm font-semibold tracking-widest uppercase"
                  style={{ fontFamily: "'Manrope', sans-serif" }}
                >
                  Cavour Immobiliare
                </span>
              </div>
              <p className="text-sm leading-relaxed max-w-md" style={{ color: 'rgba(255,255,255,0.6)' }}>
                Da oltre 30 anni, selezioniamo immobili di prestigio nel cuore di Milano. 
                Esperienza, competenza e passione al servizio dei nostri clienti più esigenti.
              </p>
            </div>

            <div>
              <h3 className="text-xs font-semibold tracking-widest uppercase mb-6" style={{ color: '#C5A059' }}>Contatti</h3>
              <ul className="space-y-4 text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
                <li className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#C5A059' }} />
                  <span>Via Statuto 10, 20121 Milano</span>
                </li>
                <li className="flex items-center gap-3">
                  <Phone className="w-4 h-4 flex-shrink-0" style={{ color: '#C5A059' }} />
                  <a href="tel:+390276007544" className="hover:text-white transition-colors">02 7600 7544</a>
                </li>
                <li className="flex items-center gap-3">
                  <Mail className="w-4 h-4 flex-shrink-0" style={{ color: '#C5A059' }} />
                  <a href="mailto:info@cavourimmobiliare.it" className="hover:text-white transition-colors">info@cavourimmobiliare.it</a>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-xs font-semibold tracking-widest uppercase mb-6" style={{ color: '#C5A059' }}>Seguici</h3>
              <div className="flex gap-3">
                <a href="#" className="w-10 h-10 flex items-center justify-center transition-colors" style={{ border: '1px solid rgba(255,255,255,0.2)' }}>
                  <Instagram className="w-4 h-4" />
                </a>
                <a href="#" className="w-10 h-10 flex items-center justify-center transition-colors" style={{ border: '1px solid rgba(255,255,255,0.2)' }}>
                  <Facebook className="w-4 h-4" />
                </a>
                <a href="#" className="w-10 h-10 flex items-center justify-center transition-colors" style={{ border: '1px solid rgba(255,255,255,0.2)' }}>
                  <Linkedin className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>

          <div 
            className="mt-12 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-xs"
            style={{ borderTop: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)' }}
          >
            <p>&copy; {new Date().getFullYear()} Cavour Immobiliare S.r.l. - P.IVA 12345678901</p>
            <div className="flex gap-6">
              <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-white transition-colors">Cookie Policy</a>
            </div>
          </div>
        </div>
      </footer>

      {/* Mobile Action Bar */}
      <div 
        className="fixed bottom-0 left-0 right-0 z-50 md:hidden flex"
        style={{ 
          background: 'white', 
          borderTop: '1px solid #eee',
          boxShadow: '0 -5px 20px rgba(0,0,0,0.1)'
        }}
      >
        <a
          href="tel:+390276007544"
          className="flex-1 flex items-center justify-center gap-2 py-4 text-xs font-bold uppercase tracking-wide transition-colors"
          style={{ color: '#1A1A1A', borderRight: '1px solid #eee' }}
        >
          <Phone className="w-4 h-4" />
          Chiama
        </a>
        <a
          href="https://wa.me/390276007544"
          className="flex-1 flex items-center justify-center gap-2 py-4 text-xs font-bold uppercase tracking-wide transition-colors"
          style={{ background: '#C5A059', color: 'white' }}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
          WhatsApp
        </a>
      </div>

      <div className="h-14 md:hidden" />
    </div>
  );
}
