'use client';
import { useState } from 'react';

export default function Reports() {
    const [folio, setFolio] = useState(''); const [owner, setOwner] = useState('');
    const [neighborhood, setNeighborhood] = useState(''); const [limit, setLimit] = useState('10');
    const [busy, setBusy] = useState(false); const [out, setOut] = useState<any>(null);

    async function run() {
        setBusy(true);
        try {
            const qs = new URLSearchParams();
            if (folio) qs.set('folio', folio);
            if (owner) qs.set('owner', owner);
            if (neighborhood) qs.set('neighborhood', neighborhood);
            if (limit) qs.set('limit', limit);
            const res = await fetch(`/api/reports/summary?${qs.toString()}`);
            const data = await res.json();
            setOut(data);
        } finally { setBusy(false); }
    }

    return (
        <main className="mx-auto max-w-4xl p-6 space-y-4">
            <h1 className="text-2xl font-semibold">Property Summary (View)</h1>
            <div className="grid gap-3 md:grid-cols-4">
                <input className="border rounded px-3 py-2" placeholder="Folio" value={folio} onChange={e => setFolio(e.target.value)} />
                <input className="border rounded px-3 py-2" placeholder="Owner contains" value={owner} onChange={e => setOwner(e.target.value)} />
                <input className="border rounded px-3 py-2" placeholder="Neighborhood code" value={neighborhood} onChange={e => setNeighborhood(e.target.value)} />
                <input className="border rounded px-3 py-2" placeholder="Limit" value={limit} onChange={e => setLimit(e.target.value)} />
            </div>
            <button className="rounded bg-black text-white px-4 py-2 disabled:opacity-60" onClick={run} disabled={busy}>
                {busy ? 'Loading…' : 'Search'}
            </button>
            <pre className="rounded border bg-gray-50 p-3 text-sm overflow-auto max-h-[60vh] mt-3">
                {out ? JSON.stringify(out, null, 2) : 'Run a search to see results.'}
            </pre>
        </main>
    );
}
