import { useRef, useState } from 'react';
import { FiMessageSquare, FiSend, FiX } from 'react-icons/fi';
import { api, errorMessage } from '@/api/client';
import { Button, Notice } from './ui';

interface Turn { role: 'user' | 'assistant'; text: string }

/**
 * The assistant.
 *
 * It sends the question to the API and renders the answer. It does not answer
 * anything itself.
 *
 * That distinction is the whole design. This application shows loan balances,
 * repayment dates and service histories. A widget that guesses would eventually
 * tell a driver their arrears were cleared when they were not, and UZA would own
 * that. So when `POST /assistant/ask` is not deployed, it says so and stops — an
 * assistant that is honestly absent is safe, and one that improvises is not.
 *
 * Wiring the endpoint is the only change needed here; nothing on this side moves.
 */
export function ChatBot({ portalKey }: { portalKey: string }) {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  async function ask() {
    const question = draft.trim();
    if (!question || busy) return;

    setTurns((t) => [...t, { role: 'user', text: question }]);
    setDraft('');
    setBusy(true);
    setError(null);

    try {
      const { data } = await api.post<{ answer: string }>('/assistant/ask', {
        question,
        // The portal is context, not authorisation. The API re-derives what this
        // user may be told from their token, never from this field.
        context: portalKey,
      });
      setTurns((t) => [...t, { role: 'assistant', text: data.answer }]);
    } catch (e) {
      const status = (e as { response?: { status?: number } }).response?.status;
      if (status === 404 || status === 501) setUnavailable(true);
      else setError(errorMessage(e, 'The assistant could not answer. Please try again.'));
    } finally {
      setBusy(false);
      requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }));
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="Open assistant"
        className="fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-brand text-white shadow-lg"
      >
        <FiMessageSquare size={20} />
      </button>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 z-40 flex h-[26rem] w-[22rem] max-w-[calc(100vw-2.5rem)] flex-col rounded-xl border border-line bg-surface shadow-xl">
      <header className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <span className="text-sm font-semibold">Ask UZA</span>
        <button onClick={() => setOpen(false)} aria-label="Close assistant"><FiX size={16} /></button>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto p-4 text-sm">
        {turns.length === 0 && !unavailable && (
          <p className="text-ink-soft">
            Ask about your vehicle, a payment, a booking or a repair.
          </p>
        )}
        {turns.map((t, i) => (
          <div
            key={i}
            className={t.role === 'user'
              ? 'ml-auto w-fit max-w-[85%] rounded-lg bg-brand px-3 py-2 text-white'
              : 'w-fit max-w-[85%] rounded-lg bg-brand-soft px-3 py-2'}
          >
            {t.text}
          </div>
        ))}
        {busy && <p className="text-ink-soft">Thinking…</p>}
        {unavailable && (
          <Notice tone="neutral">
            The assistant is not connected in this environment yet. Nothing here is
            guessed — when the service is deployed, answers will appear in this window.
          </Notice>
        )}
        {error && <Notice>{error}</Notice>}
        <div ref={endRef} />
      </div>

      <form
        className="flex gap-2 border-t border-line p-3"
        onSubmit={(e) => { e.preventDefault(); void ask(); }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type your question"
          disabled={unavailable}
          className="min-w-0 flex-1 rounded-lg border border-line bg-ground px-3 py-2 text-sm"
        />
        <Button type="submit" disabled={busy || unavailable || !draft.trim()}>
          <FiSend size={14} />
        </Button>
      </form>
    </div>
  );
}
