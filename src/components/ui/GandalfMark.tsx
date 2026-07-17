import { useTheme } from '../../lib/theme';
import hatDark from '../../assets/gandalf-hat-dark.png';
import hatLight from '../../assets/gandalf-hat-light.png';

/** Wizard-hat brand mark — the platform's actual logo art, recolored to the accent purple per theme. */
export function GandalfMark({ size = 18, className = '' }: { size?: number; className?: string }) {
  const { theme } = useTheme();
  return <img src={theme === 'dark' ? hatDark : hatLight} width={size} height={size} className={className} style={{ objectFit: 'contain' }} alt="" aria-hidden="true" />;
}
