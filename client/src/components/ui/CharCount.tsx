import { cx } from './styles';

interface CharCountProps {
  value: string;
  max: number;
  id?: string;
}

/** "12/20" sotto un campo con limite di caratteri: in rosso se un nome già salvato lo supera. */
export default function CharCount({ value, max, id }: CharCountProps) {
  const over = value.length > max;
  return (
    <span id={id} className={cx('block text-right text-xs tabular-nums', over ? 'text-error' : 'text-base-content/60')}>
      {value.length}/{max}
    </span>
  );
}
