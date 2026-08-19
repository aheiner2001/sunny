import InspectClient from './InspectClient';

export function generateStaticParams() {
  return [
    { id: 'van-1' },
    { id: 'van-2' },
    { id: 'van-3' },
    { id: 'van-4' },
    { id: 'van-5' },
    { id: 'van-6' },
  ];
}

export default function InspectVehiclePage() {
  return <InspectClient />;
}
