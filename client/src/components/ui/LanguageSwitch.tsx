import { useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ButtonLink } from './Button';
import { cx } from './styles';
import { localeHref, type Locale } from '../../router';

/** Ogni lingua si presenta nella propria lingua (convenzione dei selettori di lingua). */
const LANGUAGES: { locale: Locale; code: string; name: string }[] = [
  { locale: 'it', code: 'IT', name: 'Italiano' },
  { locale: 'en', code: 'EN', name: 'English' },
];

/**
 * Selettore della lingua: due sigle, quella attiva evidenziata. Sono link veri alla stessa
 * pagina nell'altra lingua (`/it/…` ↔ `/en/…`): la pagina si ricarica nella lingua scelta.
 */
export default function LanguageSwitch({ className }: { className?: string }) {
  const { t, i18n } = useTranslation();
  const { pathname, search, hash } = useLocation();
  return (
    <div role="group" aria-label={t('lingua')} className={cx('flex gap-1', className)}>
      {LANGUAGES.map(({ locale, code, name }) => {
        const active = i18n.language === locale;
        return (
          <ButtonLink
            key={locale}
            href={localeHref(locale, pathname + search + hash)}
            variant={active ? 'primary' : 'ghost'}
            size="sm"
            aria-current={active ? 'true' : undefined}
            aria-label={name}
            title={name}
            lang={locale}
          >
            {code}
          </ButtonLink>
        );
      })}
    </div>
  );
}
