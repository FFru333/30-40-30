import { useRef, useState } from 'react';
import type { LabelReading } from '../../domain/food/label';
import { scanErrorText, useLabelScanner } from '../../app/scanner';
import { IconScan } from '../../ui/icons';

/**
 * "Scansiona etichetta": foto della tabella nutrizionale (e del fronte, se vuoi il nome),
 * letta da Claude e restituita come bozza da controllare. Non compare dove non è disponibile.
 */
export function ScanButton({
  onRead,
  variant = 'pill',
}: {
  onRead: (r: LabelReading) => void;
  variant?: 'pill' | 'row';
}) {
  const scanner = useLabelScanner();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ctl = useRef<AbortController | null>(null);

  if (!scanner) return null;

  const run = async (files: File[]) => {
    if (!files.length) return;
    setError(null);
    setBusy(true);
    ctl.current = new AbortController();
    try {
      onRead(await scanner.scan(files, ctl.current.signal));
    } catch (e) {
      setError(scanErrorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`scan scan--${variant}`}>
      <label className={variant === 'row' ? 'scan__row' : 'pill pill--solid'}>
        <IconScan size={variant === 'row' ? 26 : 18} />
        <span>
          {variant === 'row' ? (
            <>
              <strong>Scansiona etichetta</strong>
              <small>Foto della tabella nutrizionale, e del fronte per il nome</small>
            </>
          ) : (
            'Scansiona'
          )}
        </span>
        <input
          id={`scan-input-${variant}`}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/*"
          multiple
          hidden
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = '';
            void run(files);
          }}
        />
      </label>
      {busy && (
        <div className="scan__busy" role="status">
          <div className="scan__pulse" />
          <p className="scan__title">Leggo l’etichetta…</p>
          <p className="scan__sub">Di solito servono 10–30 secondi.</p>
          <button className="btn btn--ghost" onClick={() => ctl.current?.abort()}>
            Annulla
          </button>
        </div>
      )}
      {error && <p className="scan__error">{error}</p>}
    </div>
  );
}
