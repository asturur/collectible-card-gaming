import { paths } from '../../router';
import i18n from '../../i18n';
import NavTabs from '../ui/NavTabs';
import { ButtonRouteLink } from '../ui/Button';
import { cx, HEADING_SECTION } from '../ui/styles';
import { FAQ_SECTIONS } from './faqContent';
import { FAQ_SECTIONS_EN } from './faqContent.en';

/** FAQ nella lingua in uso: italiano (originale) o la copia inglese. */
const faqSections = () => (i18n.language === 'en' ? FAQ_SECTIONS_EN : FAQ_SECTIONS);

/**
 * FAQ delle statistiche: le sezioni del menu Statistiche in alto, sotto gli
 * argomenti della sezione (per Carte, uno per filtro). Sezione e argomento sono
 * nell'indirizzo, così ogni pagina statistica porta dritta alla sua spiegazione.
 */
export default function Faq({ sectionId, topicId }: { sectionId?: string; topicId?: string }) {
  const sections = faqSections();
  const section = sections.find((s) => s.id === sectionId) ?? sections[0];
  const topic = section.topics.find((t) => t.id === topicId) ?? section.topics[0];
  return (
    <>
      <NavTabs
        label={i18n.t('sezioni')}
        value={section.id}
        options={sections.map((s) => ({ value: s.id, label: s.label, to: paths.faqTopic(s.id) }))}
        className="mb-3"
      />
      {section.topics.length > 1 && (
        <NavTabs
          label={i18n.t('argomenti_di', { section: section.label })}
          value={topic.id}
          options={section.topics.map((t) => ({ value: t.id, label: t.label, to: paths.faqTopic(section.id, t.id) }))}
          className="mb-3 border-t border-zaff-border pt-3"
        />
      )}
      <article className="mt-4">
        <h2 className={cx(HEADING_SECTION, 'mb-3')}>
          {section.topics.length > 1 ? `${section.label} · ${topic.label}` : topic.label}
        </h2>
        {topic.body}
      </article>
    </>
  );
}

/** Link discreto, nelle pagine statistiche, alla spiegazione della statistica mostrata. */
export function HowItWorks({ to, className }: { to: string; className?: string }) {
  return (
    <ButtonRouteLink to={to} variant="text" size="sm" className={cx('-ml-3 mb-1', className)}>
      {i18n.t('come_si_calcola')}
    </ButtonRouteLink>
  );
}
