function stamp() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvEscape(value) {
  const s = value == null ? '' : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function xmlEscape(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function matrixFromColumns(records, columns) {
  const headers = columns.map((c) => c.header);
  const rows = (records || []).map((record) =>
    columns.map((c) => {
      const raw = typeof c.value === 'function' ? c.value(record) : record[c.value];
      return raw == null ? '' : raw;
    })
  );
  return { headers, rows };
}

export function fileStamp() {
  return stamp();
}

export function downloadCsv(baseName, records, columns) {
  const { headers, rows } = matrixFromColumns(records, columns);
  const lines = [
    headers.map(csvEscape).join(','),
    ...rows.map((row) => row.map(csvEscape).join(',')),
  ];
  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, `${baseName}-${stamp()}.csv`);
}

export function downloadExcel(baseName, sheetName, records, columns) {
  const { headers, rows } = matrixFromColumns(records, columns);
  const headerRow = `<Row>${headers.map((h) => `<Cell><Data ss:Type="String">${xmlEscape(h)}</Data></Cell>`).join('')}</Row>`;
  const body = rows.map((row) => {
    const cells = row.map((value) => {
      if (typeof value === 'number' && Number.isFinite(value)) {
        return `<Cell><Data ss:Type="Number">${value}</Data></Cell>`;
      }
      return `<Cell><Data ss:Type="String">${xmlEscape(value)}</Data></Cell>`;
    }).join('');
    return `<Row>${cells}</Row>`;
  }).join('');

  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Worksheet ss:Name="${xmlEscape((sheetName || 'Sheet1').slice(0, 31))}">
    <Table>
      ${headerRow}
      ${body}
    </Table>
  </Worksheet>
</Workbook>`;

  const blob = new Blob([xml], { type: 'application/vnd.ms-excel' });
  triggerDownload(blob, `${baseName}-${stamp()}.xls`);
}
