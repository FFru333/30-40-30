import { useEffect, useState } from 'react';
import { LABEL_PROMPT, parseLabelReading, type LabelReading } from '../domain/food/label';

type SampleFn = {
  json: (input: string, opts?: { images?: Blob[]; signal?: AbortSignal; modelTier?: string }) => Promise<unknown>;
  limits: () => Promise<{ images?: { maxCount: number; mediaTypes: string[] } }>;
};

type ClaudeWindow = Window & { claude?: { use: (name: string) => Promise<unknown> } };

/**
 * Lettore di etichette via Claude (disponibile quando l'app gira come pagina Claude).
 * `null` finché non si sa, o se non è disponibile: in quel caso il pulsante non compare.
 */
export function useLabelScanner(): { scan: (files: File[], signal?: AbortSignal) => Promise<LabelReading>; maxImages: number } | null {
  const [state, setState] = useState<{ sample: SampleFn; maxImages: number } | null>(null);
  useEffect(() => {
    const c = (window as ClaudeWindow).claude;
    if (!c?.use) return;
    let alive = true;
    c.use('sample')
      .then(async (s) => {
        const sample = s as SampleFn | null;
        if (!sample || !alive) return;
        const lim = await sample.limits().catch(() => null);
        if (lim?.images && alive) setState({ sample, maxImages: lim.images.maxCount });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!state) return null;
  return {
    maxImages: state.maxImages,
    scan: async (files, signal) => {
      const raw = await state.sample.json(LABEL_PROMPT, {
        images: files.slice(0, state.maxImages),
        signal,
        modelTier: 'default',
      });
      return parseLabelReading(raw);
    },
  };
}

/** Testo per l'utente a partire da un errore della lettura. */
export function scanErrorText(e: unknown): string | null {
  const code = (e as { code?: string })?.code;
  switch (code) {
    case 'cancelled':
      return null;
    case 'not_granted':
    case 'sampling_disabled':
    case 'images_unavailable':
      return 'La lettura delle foto non è disponibile qui. Inserisci i valori a mano.';
    case 'image_rejected':
      return 'Foto non utilizzabile. Riprova con una foto JPEG o PNG più nitida.';
    case 'rate_limited':
      return 'Troppe letture ravvicinate. Riprova tra poco.';
    case 'invalid_json':
    case 'empty_completion':
      return 'Non sono riuscito a leggere la tabella. Riprova con una foto più dritta e vicina.';
    case 'refused':
      return 'La foto non è stata letta. Prova con una foto della sola tabella.';
    case undefined:
      return (e as Error)?.message || 'Lettura non riuscita.';
    default:
      return 'Lettura non riuscita. Riprova.';
  }
}
