import { Inspection, Issue } from '@/types';

/**
 * Export inspections as CSV format
 */
export const exportInspectionsAsCSV = (inspections: Inspection[], filename?: string) => {
  // CSV headers
  const headers = [
    'Date',
    'Vehicle',
    'Driver',
    'Status',
    'Issues Found',
    'General Notes',
    'Approval Status'
  ];

  // CSV rows
  const rows = inspections.map(insp => [
    new Date(insp.submittedAt).toLocaleDateString(),
    insp.vehicleNumber,
    insp.userName,
    insp.status === 'passed' ? 'Passed' : 'Issues Found',
    insp.issueIds?.length || 0,
    (insp.generalNotes || '').replace(/"/g, '""'), // Escape quotes for CSV
    insp.status === 'approved'
      ? 'Approved'
      : insp.status === 'rejected'
      ? 'Rejected'
      : insp.status === 'submitted'
      ? 'Pending Review'
      : 'In Progress'
  ]);

  // Build CSV string
  const csvContent = [
    headers.map(h => `"${h}"`).join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  // Create blob and trigger download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute(
    'download',
    filename || `inspections-${new Date().toISOString().split('T')[0]}.csv`
  );
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Export issues as CSV format
 */
export const exportIssuesAsCSV = (issues: Issue[], filename?: string) => {
  const headers = [
    'Date Reported',
    'Vehicle',
    'Equipment',
    'Issue Title',
    'Description',
    'Type',
    'Status',
    'Reported By',
    'Date Resolved',
    'Resolved By'
  ];

  const rows = issues.map(issue => [
    new Date(issue.reportedAt).toLocaleDateString(),
    issue.vehicleNumber,
    issue.equipmentName,
    issue.title,
    (issue.description || '').replace(/"/g, '""'),
    issue.type,
    issue.status,
    issue.reportedByName,
    issue.resolvedAt ? new Date(issue.resolvedAt).toLocaleDateString() : 'N/A',
    issue.resolvedByName || 'N/A'
  ]);

  const csvContent = [
    headers.map(h => `"${h}"`).join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute(
    'download',
    filename || `issues-${new Date().toISOString().split('T')[0]}.csv`
  );
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Export compliance report as HTML (printable to PDF)
 */
export interface ComplianceReportData {
  userName: string;
  passRate: number;
  passedInspections: number;
  totalInspections: number;
  trend: number;
  commonIssues: Array<[string, number]>;
}

export const exportComplianceReportAsHTML = (
  reports: ComplianceReportData[],
  filename?: string
) => {
  const timestamp = new Date().toLocaleString();
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Driver Compliance Report</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 40px;
      color: #333;
    }
    h1 {
      color: #1e40af;
      border-bottom: 3px solid #1e40af;
      padding-bottom: 10px;
    }
    .report-meta {
      color: #666;
      margin-bottom: 30px;
      font-size: 12px;
    }
    .driver-report {
      page-break-inside: avoid;
      border: 1px solid #ddd;
      padding: 20px;
      margin-bottom: 20px;
      border-radius: 8px;
    }
    .driver-header {
      display: flex;
      justify-content: space-between;
      align-items: start;
      margin-bottom: 15px;
    }
    .driver-name {
      font-size: 18px;
      font-weight: bold;
      color: #1e40af;
    }
    .status-badge {
      padding: 6px 12px;
      border-radius: 4px;
      font-weight: bold;
      font-size: 12px;
    }
    .status-excellent {
      background-color: #dcfce7;
      color: #166534;
    }
    .status-fair {
      background-color: #fef3c7;
      color: #92400e;
    }
    .status-poor {
      background-color: #fee2e2;
      color: #991b1b;
    }
    .pass-rate {
      font-size: 24px;
      font-weight: bold;
      color: #1e40af;
      margin-top: 10px;
    }
    .pass-rate-label {
      color: #666;
      font-size: 12px;
    }
    .trend {
      margin-top: 8px;
      font-size: 12px;
    }
    .trend-up {
      color: #16a34a;
      font-weight: bold;
    }
    .trend-down {
      color: #dc2626;
      font-weight: bold;
    }
    .issues-section {
      margin-top: 15px;
      padding-top: 15px;
      border-top: 1px solid #eee;
    }
    .issues-title {
      font-size: 12px;
      font-weight: bold;
      color: #666;
      margin-bottom: 8px;
    }
    .issue-tag {
      display: inline-block;
      background-color: #f3f4f6;
      padding: 4px 8px;
      border-radius: 4px;
      margin-right: 8px;
      margin-bottom: 4px;
      font-size: 12px;
    }
    .summary {
      background-color: #f0f9ff;
      border: 1px solid #bfdbfe;
      border-radius: 8px;
      padding: 15px;
      margin-bottom: 20px;
    }
    .summary-title {
      font-weight: bold;
      color: #1e40af;
      margin-bottom: 8px;
    }
    .summary-stat {
      margin-bottom: 6px;
      font-size: 14px;
    }
    @media print {
      body { margin: 0; }
      .driver-report { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <h1>Driver Compliance Report</h1>
  <div class="report-meta">
    Generated: ${timestamp}
  </div>
  
  <div class="summary">
    <div class="summary-title">Summary</div>
    <div class="summary-stat">Total Drivers: ${reports.length}</div>
    <div class="summary-stat">Average Pass Rate: ${(
      reports.reduce((sum, r) => sum + r.passRate, 0) / reports.length
    ).toFixed(1)}%</div>
    <div class="summary-stat">Total Inspections: ${reports.reduce(
      (sum, r) => sum + r.totalInspections,
      0
    )}</div>
  </div>

  ${reports
    .sort((a, b) => b.passRate - a.passRate)
    .map(
      report => `
    <div class="driver-report">
      <div class="driver-header">
        <div>
          <div class="driver-name">${report.userName}</div>
          <div class="pass-rate-label">Pass Rate</div>
          <div class="pass-rate">${report.passRate}%</div>
          <div class="pass-rate-label">${report.passedInspections}/${report.totalInspections} inspections</div>
          <div class="trend">
            ${
              report.trend > 0
                ? `<span class="trend-up">↑ Improving (+${report.trend}%)</span>`
                : report.trend < 0
                ? `<span class="trend-down">↓ Declining (${report.trend}%)</span>`
                : '<span>→ Stable</span>'
            }
          </div>
        </div>
        <div class="status-badge ${
          report.passRate >= 90
            ? 'status-excellent'
            : report.passRate >= 75
            ? 'status-fair'
            : 'status-poor'
        }">
          ${
            report.passRate >= 90
              ? '✓ Excellent'
              : report.passRate >= 75
              ? '⚠ Fair'
              : '✗ Needs Training'
          }
        </div>
      </div>
      
      ${
        report.commonIssues && report.commonIssues.length > 0
          ? `
      <div class="issues-section">
        <div class="issues-title">Common Issues</div>
        ${report.commonIssues
          .slice(0, 5)
          .map(
            ([issue, count]) =>
              `<div class="issue-tag">${issue} <strong>×${count}</strong></div>`
          )
          .join('')}
      </div>
      `
          : ''
      }
    </div>
  `
    )
    .join('')}

  <div class="report-meta" style="margin-top: 40px; border-top: 1px solid #ddd; padding-top: 20px;">
    This report was automatically generated. For questions or detailed analysis, contact your fleet manager.
  </div>
</body>
</html>
  `;

  // Create blob and trigger download
  const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute(
    'download',
    filename || `compliance-report-${new Date().toISOString().split('T')[0]}.html`
  );
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Print inspection details
 */
export const printInspection = (inspection: Inspection) => {
  const printWindow = window.open('', '', 'height=600,width=800');
  if (!printWindow) {
    alert('Could not open print window');
    return;
  }

  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Inspection Report - ${inspection.vehicleNumber}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    h1 { color: #1e40af; }
    .info-section { margin-bottom: 20px; padding: 10px; background: #f3f4f6; border-radius: 4px; }
    .info-row { display: flex; justify-content: space-between; margin-bottom: 5px; }
    .label { font-weight: bold; }
  </style>
</head>
<body>
  <h1>Inspection Report</h1>
  <div class="info-section">
    <div class="info-row">
      <span class="label">Vehicle:</span>
      <span>${inspection.vehicleNumber}</span>
    </div>
    <div class="info-row">
      <span class="label">Inspector:</span>
      <span>${inspection.userName}</span>
    </div>
    <div class="info-row">
      <span class="label">Date:</span>
      <span>${new Date(inspection.submittedAt).toLocaleString()}</span>
    </div>
    <div class="info-row">
      <span class="label">Status:</span>
      <span>${inspection.status}</span>
    </div>
  </div>
  
  ${inspection.generalNotes ? `<p><strong>Notes:</strong> ${inspection.generalNotes}</p>` : ''}
  
  <script>
    window.print();
  </script>
</body>
</html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
};
