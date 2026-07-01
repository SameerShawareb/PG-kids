import React from 'react';
import { useTranslation } from 'react-i18next';
import { Instagram, Facebook, Linkedin, Youtube } from 'lucide-react';

const XIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const Footer: React.FC = () => {
  const { t } = useTranslation();

  return (
    <footer className="w-full bg-[#090D16]/90 border-t border-slate-800/80 py-8 px-4 mt-auto">
      <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-slate-400 text-xs font-semibold">
        {/* Horizontal Nav Links & Copyright */}
        <div className="flex flex-wrap items-center justify-center gap-2 text-center md:text-left rtl:md:text-right">
          <span>&copy; 2026 PG Kids</span>
          <span>&bull;</span>
          <a href="#" className="hover:text-white transition-colors">{t('footer.faq', 'الأسئلة الشائعة')}</a>
          <span>&bull;</span>
          <a href="#" className="hover:text-white transition-colors">{t('footer.buyGift', 'شراء بطاقة هدايا')}</a>
          <span>&bull;</span>
          <a href="#" className="hover:text-white transition-colors">{t('footer.getGift', 'احصل على بطاقة هدايا')}</a>
          <span>&bull;</span>
          <a href="#" className="hover:text-white transition-colors">{t('footer.terms', 'الاستخدام')}</a>
          <span>&bull;</span>
          <a href="#" className="hover:text-white transition-colors">{t('footer.privacy', 'الخصوصية')}</a>
        </div>

        {/* Social Media Links */}
        <div className="flex items-center gap-4 shrink-0">
          <a
            href="https://www.instagram.com/pgkids.arabia"
            target="_blank"
            rel="noopener noreferrer"
            className="w-8 h-8 rounded-full bg-slate-900 border border-slate-800 hover:border-pink-500 hover:text-pink-500 hover:bg-pink-500/10 flex items-center justify-center transition-all text-slate-400"
            aria-label="Instagram"
          >
            <Instagram className="w-4 h-4" />
          </a>
          <a
            href="https://www.facebook.com/PGKIDSArabia/"
            target="_blank"
            rel="noopener noreferrer"
            className="w-8 h-8 rounded-full bg-slate-900 border border-slate-800 hover:border-blue-600 hover:text-blue-500 hover:bg-blue-600/10 flex items-center justify-center transition-all text-slate-400"
            aria-label="Facebook"
          >
            <Facebook className="w-4 h-4" />
          </a>
          <a
            href="https://www.linkedin.com/company/pg-kids/"
            target="_blank"
            rel="noopener noreferrer"
            className="w-8 h-8 rounded-full bg-slate-900 border border-slate-800 hover:border-sky-500 hover:text-sky-400 hover:bg-sky-500/10 flex items-center justify-center transition-all text-slate-400"
            aria-label="LinkedIn"
          >
            <Linkedin className="w-4 h-4" />
          </a>
          <a
            href="https://www.youtube.com/@PGKIDS-Tube"
            target="_blank"
            rel="noopener noreferrer"
            className="w-8 h-8 rounded-full bg-slate-900 border border-slate-800 hover:border-red-600 hover:text-red-500 hover:bg-red-600/10 flex items-center justify-center transition-all text-slate-400"
            aria-label="YouTube"
          >
            <Youtube className="w-4 h-4" />
          </a>
          <a
            href="https://x.com/PGKIDS_Arabia"
            target="_blank"
            rel="noopener noreferrer"
            className="w-8 h-8 rounded-full bg-slate-900 border border-slate-800 hover:border-slate-100 hover:text-white hover:bg-white/10 flex items-center justify-center transition-all text-slate-400"
            aria-label="X (formerly Twitter)"
          >
            <XIcon className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
