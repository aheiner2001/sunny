import React from 'react';
import TimesheetsClient from './TimesheetsClient';

export const metadata = {
  title: 'Timesheets | Sunny Fleet Accountability',
  description: 'Employee time records, individual shift approval, and weekly summaries.',
};

export default function TimesheetsPage() {
  return <TimesheetsClient />;
}
