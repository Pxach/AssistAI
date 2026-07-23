/**
 * Utility to convert an array of objects to CSV format.
 * Automatically extracts object keys as column headers and escapes fields.
 *
 * @param { Array<Object> } data - Array of objects to convert
 * @returns { string } Formatted CSV string
 */
export function convertToCSV(data) {
  if (!data || !data.length) {
    return '';
  }

  const headers = Object.keys(data[0]);
  const csvRows = [headers.join(',')];

  for (const row of data) {
    const values = headers.map(header => {
      const val = row[header] === null || row[header] === undefined ? '' : row[header];
      // Escape double quotes and enclose values in double quotes
      const escaped = String(val).replace(/"/g, '""');
      return `"${escaped}"`;
    });
    csvRows.push(values.join(','));
  }

  return csvRows.join('\n');
}