// app/page.tsx
'use client';

import { useState } from 'react';

type Json = Record<string, any>;

async function call(action: string, payload: Json = {}) {
  // GET requests (list latest)
  if (action === "listLatest") {
    const res = await fetch('/api/properties?limit=50');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  // All other actions -> POST
  const res = await fetch('/api/properties', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action,
      ...payload,
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export default function Home() {
  // state for all forms
  const [folio, setFolio] = useState('');
  const [address, setAddress] = useState('');
  const [zip, setZip] = useState('');               // Property.zipCode
  const [ownerId, setOwnerId] = useState('');       // optional existing ownerId
  const [ownerName, setOwnerName] = useState('');   // NEW
  const [ownerPhone, setOwnerPhone] = useState(''); // NEW
  const [ownerEmail, setOwnerEmail] = useState(''); // NEW

  const [landValue, setLandValue] = useState('');
  const [buildingValue, setBuildingValue] = useState('');

  const [saleDate, setSaleDate] = useState('');     // NEW
  const [salePrice, setSalePrice] = useState('');   // NEW

  const [assessmentYear, setAssessmentYear] = useState(''); // NEW

  const [minLand, setMinLand] = useState('');
  const [maxLand, setMaxLand] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [percent, setPercent] = useState('');
  const [threshold, setThreshold] = useState('');
  const [limit, setLimit] = useState('10');

  // 🔹 NEW: fields for stored procedure sp_adjust_land_values_by_zip
  const [bulkZip, setBulkZip] = useState('');
  const [bulkPercent, setBulkPercent] = useState('');

  const [output, setOutput] = useState<string>('');
  const [loading, setLoading] = useState<string | null>(null);

  function show(result: any) {
    setOutput(JSON.stringify(result, null, 2));
  }

  async function run(name: string, fn: () => Promise<any>) {
    try {
      setLoading(name);
      const data = await fn();
      show(data);
    } catch (e: any) {
      show({ error: e.message || String(e) });
    } finally {
      setLoading(null);
    }
  }

  // Helper to run /api/sql queries into the Result panel
  async function runSql(
    name: string,
    q: string,
    params: Record<string, string> = {}
  ) {
    const search = new URLSearchParams({ q, ...params });
    return run(name, async () => {
      const res = await fetch(`/api/sql?${search.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');
      return data;
    });
  }

  return (
    <main className="mx-auto max-w-4xl p-6 space-y-8">
      <h1 className="text-2xl font-semibold">Property Appraisal</h1>
      <p className="text-sm text-gray-600">
        Enter values and click a button to run one of the database actions.
      </p>

      {/* 1. Upsert full record */}
      <section className="rounded border p-4">
        <h2 className="font-medium">1) Insert / Upsert Property (with Owner, Sale, Assessment)</h2>

        {/* Property fields */}
        <h3 className="mt-2 text-sm font-semibold">Property</h3>
        <div className="grid grid-cols-2 gap-3 mt-2">
          <input
            className="border rounded px-3 py-2"
            placeholder="Folio *"
            value={folio}
            onChange={e => setFolio(e.target.value)}
          />
          <input
            className="border rounded px-3 py-2"
            placeholder="Address"
            value={address}
            onChange={e => setAddress(e.target.value)}
          />
          <input
            className="border rounded px-3 py-2"
            placeholder="ZIP Code"
            value={zip}
            onChange={e => setZip(e.target.value)}
          />
          <input
            className="border rounded px-3 py-2"
            placeholder="Existing Owner ID (optional)"
            value={ownerId}
            onChange={e => setOwnerId(e.target.value)}
          />
          <input
            className="border rounded px-3 py-2"
            placeholder="Land Value"
            value={landValue}
            onChange={e => setLandValue(e.target.value)}
          />
          <input
            className="border rounded px-3 py-2"
            placeholder="Building Value"
            value={buildingValue}
            onChange={e => setBuildingValue(e.target.value)}
          />
        </div>

        {/* Owner fields */}
        <h3 className="mt-4 text-sm font-semibold">Owner (optional – will create if no Owner ID)</h3>
        <div className="grid grid-cols-3 gap-3 mt-2">
          <input
            className="border rounded px-3 py-2"
            placeholder="Owner Name"
            value={ownerName}
            onChange={e => setOwnerName(e.target.value)}
          />
          <input
            className="border rounded px-3 py-2"
            placeholder="Owner Phone"
            value={ownerPhone}
            onChange={e => setOwnerPhone(e.target.value)}
          />
          <input
            className="border rounded px-3 py-2"
            placeholder="Owner Email"
            value={ownerEmail}
            onChange={e => setOwnerEmail(e.target.value)}
          />
        </div>

        {/* Sale fields */}
        <h3 className="mt-4 text-sm font-semibold">Sale (optional)</h3>
        <div className="grid grid-cols-2 gap-3 mt-2">
          <input
            className="border rounded px-3 py-2"
            placeholder="Sale Date (YYYY-MM-DD)"
            value={saleDate}
            onChange={e => setSaleDate(e.target.value)}
          />
          <input
            className="border rounded px-3 py-2"
            placeholder="Sale Price"
            value={salePrice}
            onChange={e => setSalePrice(e.target.value)}
          />
        </div>

        {/* Assessment fields */}
        <h3 className="mt-4 text-sm font-semibold">Assessment (optional)</h3>
        <div className="grid grid-cols-1 gap-3 mt-2">
          <input
            className="border rounded px-3 py-2"
            placeholder="Assessment Year (e.g. 2024)"
            value={assessmentYear}
            onChange={e => setAssessmentYear(e.target.value)}
          />
        </div>

        <button
          className="mt-4 rounded bg-black px-4 py-2 text-white disabled:opacity-60"
          disabled={!folio || loading === 'upsert'}
          onClick={() =>
            run('upsert', () =>
              call('upsert', {
                folio: folio.trim(),
                address: address.trim() || null,
                zipCode: zip.trim() || null,
                landValue,
                buildingValue,
                ownerId: ownerId.trim() || null,
                ownerName: ownerName.trim() || null,
                ownerPhone: ownerPhone.trim() || null,
                ownerEmail: ownerEmail.trim() || null,
                saleDate: saleDate.trim() || null,
                salePrice,
                assessmentYear: assessmentYear.trim() || null,
              })
            )
          }
        >
          {loading === 'upsert' ? 'Saving…' : 'Save / Upsert All'}
        </button>
      </section>

      {/* 2. Get by folio */}
      <section className="rounded border p-4">
        <h2 className="font-medium">2) Get property by folio</h2>
        <input
          className="border rounded px-3 py-2 mt-3"
          placeholder="Folio *"
          value={folio}
          onChange={e => setFolio(e.target.value)}
        />
        <button
          className="mt-3 rounded bg-black px-4 py-2 text-white disabled:opacity-60"
          disabled={!folio || loading === 'getByFolio'}
          onClick={() =>
            run('getByFolio', () =>
              call('getByFolio', { folio: folio.trim() })
            )
          }
        >
          {loading === 'getByFolio' ? 'Loading…' : 'Fetch'}
        </button>
      </section>

      {/* 3. Range by land value */}
      <section className="rounded border p-4">
        <h2 className="font-medium">3) Find properties by land value range</h2>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <input
            className="border rounded px-3 py-2"
            placeholder="Min"
            value={minLand}
            onChange={e => setMinLand(e.target.value)}
          />
          <input
            className="border rounded px-3 py-2"
            placeholder="Max"
            value={maxLand}
            onChange={e => setMaxLand(e.target.value)}
          />
        </div>
        <button
          className="mt-3 rounded bg-black px-4 py-2 text-white disabled:opacity-60"
          disabled={loading === 'rangeByLandValue'}
          onClick={() =>
            run('rangeByLandValue', () =>
              call('rangeByLandValue', { min: minLand, max: maxLand })
            )
          }
        >
          {loading === 'rangeByLandValue' ? 'Searching…' : 'Search'}
        </button>
      </section>

      {/* 4. Update address */}
      <section className="rounded border p-4">
        <h2 className="font-medium">4) Update address</h2>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <input
            className="border rounded px-3 py-2"
            placeholder="Folio *"
            value={folio}
            onChange={e => setFolio(e.target.value)}
          />
          <input
            className="border rounded px-3 py-2"
            placeholder="New address"
            value={newAddress}
            onChange={e => setNewAddress(e.target.value)}
          />
        </div>
        <button
          className="mt-3 rounded bg-black px-4 py-2 text-white disabled:opacity-60"
          disabled={!folio || loading === 'updateAddress'}
          onClick={() =>
            run('updateAddress', () =>
              call('updateAddress', {
                folio: folio.trim(),
                newAddress: newAddress.trim(),
              })
            )
          }
        >
          {loading === 'updateAddress' ? 'Updating…' : 'Update'}
        </button>
      </section>

      {/* 5. Adjust land by percent */}
      <section className="rounded border p-4">
        <h2 className="font-medium">
          5) Adjust land value by % (single folio)
        </h2>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <input
            className="border rounded px-3 py-2"
            placeholder="Folio *"
            value={folio}
            onChange={e => setFolio(e.target.value)}
          />
          <input
            className="border rounded px-3 py-2"
            placeholder="Percent (e.g., 5 or -10)"
            value={percent}
            onChange={e => setPercent(e.target.value)}
          />
        </div>
        <button
          className="mt-3 rounded bg-black px-4 py-2 text-white disabled:opacity-60"
          disabled={!folio || loading === 'adjustLandPercent'}
          onClick={() =>
            run('adjustLandPercent', () =>
              call('adjustLandPercent', { folio: folio.trim(), percent })
            )
          }
        >
          {loading === 'adjustLandPercent' ? 'Applying…' : 'Apply'}
        </button>
      </section>

      {/* 6. Delete by folio */}
      <section className="rounded border p-4">
        <h2 className="font-medium">6) Delete property by folio</h2>
        <input
          className="border rounded px-3 py-2 mt-3"
          placeholder="Folio *"
          value={folio}
          onChange={e => setFolio(e.target.value)}
        />
        <button
          className="mt-3 rounded bg-red-600 px-4 py-2 text-white disabled:opacity-60"
          disabled={!folio || loading === 'deleteByFolio'}
          onClick={() =>
            run('deleteByFolio', () =>
              call('deleteByFolio', { folio: folio.trim() })
            )
          }
        >
          {loading === 'deleteByFolio' ? 'Deleting…' : 'Delete'}
        </button>
      </section>

      {/* 7. Count above building threshold */}
      <section className="rounded border p-4">
        <h2 className="font-medium">
          7) Count where building value &gt; threshold
        </h2>
        <input
          className="border rounded px-3 py-2 mt-3"
          placeholder="Threshold"
          value={threshold}
          onChange={e => setThreshold(e.target.value)}
        />
        <button
          className="mt-3 rounded bg-black px-4 py-2 text-white disabled:opacity-60"
          disabled={loading === 'countAboveBuilding'}
          onClick={() =>
            run('countAboveBuilding', () =>
              call('countAboveBuilding', { threshold })
            )
          }
        >
          {loading === 'countAboveBuilding' ? 'Counting…' : 'Count'}
        </button>
      </section>

      {/* 8. List latest N */}
      <section className="rounded border p-4">
        <h2 className="font-medium">8) List latest N properties</h2>
        <input
          className="border rounded px-3 py-2 mt-3"
          placeholder="Limit (1-200)"
          value={limit}
          onChange={e => setLimit(e.target.value)}
        />
        <button
          className="mt-3 rounded bg-black px-4 py-2 text-white disabled:opacity-60"
          onClick={() =>
            run('listLatest', async () => {
              const res = await fetch(
                `/api/properties?limit=${encodeURIComponent(limit || '10')}`
              );
              const data = await res.json();
              if (!res.ok) throw new Error(data.error || 'Request failed');
              return data;
            })
          }
        >
          {loading === 'listLatest' ? 'Loading…' : 'Fetch'}
        </button>
      </section>

      {/* 9. Bulk adjust land by ZIP (Stored Procedure) */}
      <section className="rounded border p-4">
        <h2 className="font-medium">
          9) Bulk adjust land value by ZIP (Stored Procedure)
        </h2>
        <p className="text-xs text-gray-600 mt-1">
          Calls <code>sp_adjust_land_values_by_zip(zipCode, percent)</code> in the database.
        </p>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <input
            className="border rounded px-3 py-2"
            placeholder="ZIP Code *"
            value={bulkZip}
            onChange={e => setBulkZip(e.target.value)}
          />
          <input
            className="border rounded px-3 py-2"
            placeholder="Percent (e.g., 5 or -10)"
            value={bulkPercent}
            onChange={e => setBulkPercent(e.target.value)}
          />
        </div>
        <button
          className="mt-3 rounded bg-black px-4 py-2 text-white disabled:opacity-60"
          disabled={!bulkZip || loading === 'adjustLandByZip'}
          onClick={() =>
            run('adjustLandByZip', () =>
              call('adjustLandByZip', {
                zipCode: bulkZip.trim(),
                percent: bulkPercent,
              })
            )
          }
        >
          {loading === 'adjustLandByZip' ? 'Running…' : 'Run Stored Procedure'}
        </button>
      </section>

      {/* Output */}
      <section className="rounded border p-4">
        <h2 className="font-medium">Result</h2>
        <pre className="mt-3 overflow-auto max-h-80 text-sm bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 p-3 rounded border border-gray-200 dark:border-gray-700">
          {output || 'Run an action to see JSON output here.'}
        </pre>
      </section>

      {/* SQL-Based Reports into the same Result box */}
      <section className="rounded border p-4">
        <h2 className="font-medium mb-3">SQL-Based Reports</h2>
        <p className="text-sm text-gray-600 mb-3">
          These run the <code>/api/sql</code> queries and show the output in the Result section above.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            className="px-3 py-2 bg-black text-white rounded disabled:opacity-60"
            disabled={loading === 'properties_with_owner'}
            onClick={() =>
              runSql('properties_with_owner', 'properties_with_owner')
            }
          >
            Properties with Owner
          </button>
          <button
            className="px-3 py-2 bg-black text-white rounded disabled:opacity-60"
            disabled={loading === 'avg_sale_price_by_zip'}
            onClick={() =>
              runSql('avg_sale_price_by_zip', 'avg_sale_price_by_zip')
            }
          >
            Avg Sale Price by Zip
          </button>
          <button
            className="px-3 py-2 bg-black text-white rounded disabled:opacity-60"
            onClick={() =>
              runSql(
                'property_by_folio_sql',
                'property_by_folio',
                folio ? { folio: folio.trim() } : {}
              )
            }
          >
            Property List
          </button>
          <button
            className="px-3 py-2 bg-black text-white rounded disabled:opacity-60"
            onClick={() =>
              runSql('sales_history', 'sales_history')
            }
          >
            Sales History
          </button>
        </div>
      </section>
    </main>
  );
}
