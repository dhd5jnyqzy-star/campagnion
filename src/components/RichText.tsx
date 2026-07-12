/**
 * Leichte Textdarstellung für Handouts & Deck-Karten: Leerzeilen trennen
 * Absätze, Zeilen mit "• " werden Aufzählungen, **fett** wird hervorgehoben,
 * Zeilen, die mit "##" beginnen, werden Zwischenüberschriften.
 */

function inline(text: string, keyPrefix: string): React.ReactNode[] {
  return text.split(/\*\*(.+?)\*\*/g).map((part, i) =>
    i % 2 === 1 ? <strong key={`${keyPrefix}-${i}`}>{part}</strong> : part,
  );
}

export function RichText({ body }: { body: string }) {
  const blocks = body.split(/\n\s*\n/);
  return (
    <div className="richtext">
      {blocks.map((block, bi) => {
        const lines = block.split('\n').filter((l) => l.trim() !== '');
        if (lines.length === 0) return null;
        if (lines.every((l) => l.trim().startsWith('• '))) {
          return (
            <ul key={bi}>
              {lines.map((l, li) => (
                <li key={li}>{inline(l.trim().slice(2), `${bi}-${li}`)}</li>
              ))}
            </ul>
          );
        }
        if (lines[0].startsWith('## ')) {
          return (
            <div key={bi}>
              <h4>{lines[0].slice(3)}</h4>
              {lines.length > 1 && <p>{inline(lines.slice(1).join(' '), `${bi}`)}</p>}
            </div>
          );
        }
        return <p key={bi}>{inline(lines.join(' '), `${bi}`)}</p>;
      })}
    </div>
  );
}
