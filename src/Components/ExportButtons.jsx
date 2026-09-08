import React from 'react';
import { downloadCsv, downloadExcel } from './exportDownload.js';

export default function ExportButtons({
  records = [],
  columns = [],
  filename = 'export',
  sheetName = 'Sheet1',
  disabled = false,
}) {
  const canExport = !disabled && Array.isArray(records) && records.length > 0 && columns.length > 0;

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        disabled={!canExport}
        onClick={() => downloadCsv(filename, records, columns)}
        className="btn-ghost !px-4 !py-2 text-sm"
      >
        Download CSV
      </button>
      <button
        type="button"
        disabled={!canExport}
        onClick={() => downloadExcel(filename, sheetName, records, columns)}
        className="btn-neon !px-4 !py-2 text-sm"
      >
        Download Excel
      </button>
    </div>
  );
}
