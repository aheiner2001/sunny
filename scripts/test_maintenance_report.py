"""Behavior checks for the offline, standard-library maintenance report."""
import copy
import csv
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

SCRIPT = Path(__file__).with_name('maintenance_report.py')


def fleet():
    return {
        'vehicles': [{
            'id': 'v1', 'vehicleNumber': 'Sample van', 'odometer': 12000,
            'maintenance': {'rules': [{
                'id': 'oil', 'title': 'Oil service', 'kind': 'oil',
                'intervalMiles': 5000, 'intervalMonths': 6,
                'recurrence': 'after_service', 'source': 'Synthetic training rule',
                'confirmed': True,
            }]},
            'maintenanceReadings': [
                {'date': '2026-09-08', 'odometer': 11000, 'confirmed': True},
                {'date': '2026-10-08', 'odometer': 12000, 'confirmed': True},
            ],
            'serviceHistory': [{
                'id': 's1', 'ruleId': 'oil', 'kind': 'oil', 'title': 'Oil service',
                'date': '2026-05-01', 'odometer': 10000, 'recordedBy': 'Sample manager',
            }],
        }],
        'equipment': [],
    }


class ReportTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not SCRIPT.exists():
            return
        spec = importlib.util.spec_from_file_location('maintenance_report', SCRIPT)
        cls.report = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.report)

    def build(self, data=None, day='2026-10-08'):
        self.assertTrue(SCRIPT.exists(), 'The report CLI has not been implemented')
        return self.report.build_report(data or fleet(), day)

    def test_calendar_limit_precedes_mileage_limit(self):
        row = self.build()[0]
        self.assertEqual(row['dueDate'], '2026-11-01')
        self.assertEqual(row['dueOdometer'], 15000)
        self.assertEqual(row['status'], 'due_soon')
        self.assertIn('calendar', row['reason'].lower())

    def test_measured_mileage_limit_precedes_calendar_limit(self):
        data = fleet()
        data['vehicles'][0]['maintenance']['rules'][0]['intervalMonths'] = 12
        data['vehicles'][0]['maintenanceReadings'][0]['odometer'] = 9000
        row = self.build(data)[0]
        self.assertEqual(row['dueDate'], '2026-11-07')
        self.assertIn('mileage', row['reason'].lower())

    def test_correction_replaces_baseline_and_keeps_audit_lineage(self):
        data = fleet()
        old = data['vehicles'][0]['serviceHistory'][0]
        data['vehicles'][0]['serviceHistory'].append({
            **old, 'id': 's2', 'date': '2026-07-01', 'odometer': 10500,
            'supersedesId': 's1', 'correctionReason': 'Transcription error',
            'recordedAt': '2026-10-08T12:00:00Z',
        })
        row = self.build(data)[0]
        self.assertEqual(row['dueDate'], '2027-01-01')
        self.assertEqual(row['dueOdometer'], 15500)
        self.assertEqual(row['lastServiceId'], 's2')
        self.assertIn('s1', '; '.join(row['basis']))

    def test_missing_baseline_is_explicit(self):
        data = fleet()
        data['vehicles'][0]['serviceHistory'] = []
        row = self.build(data)[0]
        self.assertEqual(row['status'], 'needs_setup')
        self.assertTrue(row['missing'])
        self.assertIsNone(row['dueDate'])

    def test_rule_requires_confirmation_and_source(self):
        for field, value in [('confirmed', False), ('source', '')]:
            with self.subTest(field=field):
                data = fleet()
                data['vehicles'][0]['maintenance']['rules'][0][field] = value
                self.assertEqual(self.build(data)[0]['status'], 'needs_setup')

    def test_draft_readings_never_drive_mileage_estimate(self):
        data = fleet()
        data['vehicles'][0]['maintenance']['rules'][0]['intervalMonths'] = 12
        data['vehicles'][0]['maintenanceReadings'][0]['confirmed'] = False
        row = self.build(data)[0]
        self.assertEqual(row['dueDate'], '2027-05-01')
        self.assertIn('mileage', row['unknownData'].lower())

    def test_mileage_estimate_requires_current_reading_match(self):
        data = fleet()
        data['vehicles'][0]['odometer'] = 12100
        data['vehicles'][0]['maintenance']['rules'][0]['intervalMonths'] = 12
        self.assertEqual(self.build(data)[0]['status'], 'needs_setup')
        self.assertIn('confirmed', '; '.join(self.build(data)[0]['missing']).lower())

    def test_invalid_dates_and_mileage_are_rejected(self):
        for date_value, odometer in [('2026-02-30', 11000), ('2026-11-08', 11000), ('2026-09-08', -1), ('2026-09-08', 1.5), ('2026-09-08', True)]:
            with self.subTest(date=date_value, odometer=odometer):
                data = fleet()
                data['vehicles'][0]['maintenanceReadings'][0].update(date=date_value, odometer=odometer)
                with self.assertRaises(ValueError):
                    self.build(data)

    def test_decreasing_readings_are_rejected(self):
        data = fleet()
        data['vehicles'][0]['maintenanceReadings'][0]['odometer'] = 13000
        data['vehicles'][0]['odometer'] = 14000
        with self.assertRaisesRegex(ValueError, 'monotonic'):
            self.build(data)

    def test_service_cannot_exceed_current_odometer(self):
        data = fleet()
        data['vehicles'][0]['serviceHistory'][0]['odometer'] = 13000
        with self.assertRaises(ValueError):
            self.build(data)

    def test_correction_requires_original_reason_actor_and_timestamp(self):
        for bad in [{'supersedesId': 'missing'}, {'correctionReason': ''}, {'recordedBy': ''}, {'recordedAt': 'not-a-timestamp'}]:
            with self.subTest(bad=bad):
                data = fleet()
                data['vehicles'][0]['serviceHistory'].append({
                    **data['vehicles'][0]['serviceHistory'][0], 'id': 's2',
                    'supersedesId': 's1', 'correctionReason': 'Typo',
                    'recordedAt': '2026-10-08T12:00:00Z', **bad,
                })
                with self.assertRaises(ValueError):
                    self.build(data)

    def test_forked_correction_lineage_is_rejected(self):
        data = fleet()
        for id_value in ['s2', 's3']:
            data['vehicles'][0]['serviceHistory'].append({
                **data['vehicles'][0]['serviceHistory'][0], 'id': id_value,
                'supersedesId': 's1', 'correctionReason': 'Typo', 'recordedAt': '2026-10-08T12:00:00Z',
            })
        with self.assertRaises(ValueError):
            self.build(data)

    def test_initial_interval_is_used_before_first_completed_service(self):
        data = fleet()
        vehicle = data['vehicles'][0]
        vehicle['serviceHistory'] = []
        vehicle['maintenanceReadings'][0]['odometer'] = 9000
        vehicle['maintenance']['rules'][0].update(
            recurrence='initial_then_recurring', initialMiles=15000, initialMonths=12,
            baselineDate='2026-01-31', baselineOdometer=0,
        )
        self.assertEqual(self.build(data)[0]['dueDate'], '2026-11-07')
        self.assertEqual(self.build(data)[0]['dueOdometer'], 15000)

    def test_month_end_calendar_math_is_clamped(self):
        data = fleet()
        rule = data['vehicles'][0]['maintenance']['rules'][0]
        rule.update(intervalMonths=1, baselineDate='2026-01-31', baselineOdometer=10000)
        data['vehicles'][0]['serviceHistory'] = []
        self.assertEqual(self.build(data)[0]['dueDate'], '2026-02-28')

    def test_separate_readings_are_combined_with_embedded_readings(self):
        data = fleet()
        data['readings'] = {'v1': [data['vehicles'][0]['maintenanceReadings'].pop(0)]}
        data['vehicles'][0]['maintenance']['rules'][0]['intervalMonths'] = 12
        data['readings']['v1'][0]['odometer'] = 9000
        self.assertEqual(self.build(data)[0]['dueDate'], '2026-11-07')

    def test_external_readings_map_is_supported(self):
        data = fleet()
        data['readings'] = {'v1': data['vehicles'][0].pop('maintenanceReadings')}
        self.assertEqual(self.build(data)[0]['dueOdometer'], 15000)

    def test_equipment_actual_hours_are_independent_from_replacement_lifespan(self):
        data = {'vehicles': [], 'equipment': [{
            'id': 'e1', 'name': 'Sample pump', 'operatingHours': 140,
            'carsUsed': 9999, 'expectedCars': 100, 'dueDate': '2025-01-01',
            'maintenanceRules': [{
                'id': 'pump', 'title': 'Pump service', 'intervalHours': 50,
                'intervalMonths': 6, 'confirmed': True, 'source': 'Synthetic rule',
                'baselineDate': '2026-09-01', 'baselineHours': 100,
            }],
            'hoursReadings': [{'date': '2026-10-08', 'hours': 140, 'recordedBy': 'Sample manager'}],
        }]}
        row = self.build(data)[0]
        self.assertEqual(row['dueHours'], 150)
        self.assertEqual(row['dueDate'], '2027-03-01')
        self.assertEqual(row['status'], 'scheduled')

    def test_equipment_decreasing_hours_are_rejected(self):
        data = {'vehicles': [], 'equipment': [{
            'id': 'e1', 'name': 'Pump', 'operatingHours': 120,
            'hoursReadings': [{'date': '2026-09-01', 'hours': 100}, {'date': '2026-10-01', 'hours': 90}],
        }]}
        with self.assertRaisesRegex(ValueError, 'monotonic'):
            self.build(data)

    def test_grouping_only_moves_services_earlier(self):
        data = fleet()
        vehicle = data['vehicles'][0]
        second = copy.deepcopy(vehicle['maintenance']['rules'][0])
        second.update(id='filters', title='Filters', kind='filters', intervalMonths=6, baselineDate='2026-05-05', baselineOdometer=10000)
        vehicle['maintenance']['rules'].append(second)
        rows = self.build(data)
        self.assertEqual(rows[0]['suggestedDate'], '2026-11-01')
        self.assertEqual(rows[1]['suggestedDate'], '2026-11-01')
        self.assertLessEqual(rows[1]['suggestedDate'], rows[1]['dueDate'])

    def test_booked_appointment_does_not_replace_service_baseline(self):
        data = fleet()
        data['vehicles'][0]['maintenanceAppointments'] = [{
            'id': 'a1', 'ruleId': 'oil', 'title': 'Oil', 'date': '2026-11-05', 'status': 'booked',
        }]
        row = self.build(data)[0]
        self.assertEqual(row['dueDate'], '2026-11-01')
        self.assertIn('after', row['appointment'].lower())

    def test_cli_is_deterministic_and_escapes_csv_formulas_and_html(self):
        data = fleet()
        data['vehicles'][0]['vehicleNumber'] = '=2+2'
        data['vehicles'][0]['maintenance']['rules'][0]['title'] = '<script>alert(1)</script>'
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            source = folder / 'input.json'
            source.write_text(json.dumps(data), encoding='utf-8')
            original = source.read_bytes()
            first = subprocess.run([sys.executable, str(SCRIPT), str(source), '--as-of', '2026-10-08', '--output-dir', str(folder / 'out')], capture_output=True, text=True)
            self.assertEqual(first.returncode, 0, first.stderr)
            output = folder / 'out'
            snapshots = {path.name: path.read_bytes() for path in output.iterdir()}
            again = subprocess.run([sys.executable, str(SCRIPT), str(source), '--as-of', '2026-10-08', '--output-dir', str(output)], capture_output=True, text=True)
            self.assertEqual(again.returncode, 0, again.stderr)
            self.assertEqual(snapshots, {path.name: path.read_bytes() for path in output.iterdir()})
            self.assertEqual(source.read_bytes(), original)
            with (output / 'maintenance.csv').open(newline='', encoding='utf-8') as handle:
                row = next(csv.DictReader(handle))
            self.assertEqual(row['asset'], "'=2+2")
            html = (output / 'maintenance.html').read_text(encoding='utf-8')
            self.assertNotIn('<script>', html)
            self.assertIn('&lt;script&gt;', html)

    def test_new_mileage_rule_requires_fresh_confirmed_current_measurement(self):
        for change in [{'confirmed': False}, {'date': '2026-09-20'}]:
            with self.subTest(change=change):
                data = fleet()
                data['vehicles'][0]['maintenanceReadings'][1].update(change)
                self.assertEqual(self.build(data)[0]['status'], 'needs_setup')

    def test_calendar_only_rule_does_not_require_confirmed_current_mileage(self):
        data = fleet()
        vehicle = data['vehicles'][0]
        vehicle['maintenance']['rules'][0].pop('intervalMiles')
        vehicle.pop('odometer')
        vehicle['maintenanceReadings'] = []
        self.assertEqual(self.build(data)[0]['dueDate'], '2026-11-01')

    def test_initial_mileage_limit_is_absolute_even_with_nonzero_baseline(self):
        data = fleet()
        vehicle = data['vehicles'][0]
        vehicle['serviceHistory'] = []
        vehicle['maintenance']['rules'][0].update(
            recurrence='initial_then_recurring', initialMiles=15000, initialMonths=12,
            baselineDate='2026-01-31', baselineOdometer=10000,
        )
        self.assertEqual(self.build(data)[0]['dueOdometer'], 15000)

    def test_equipment_hour_warning_uses_ten_percent_of_interval(self):
        data = {'vehicles': [], 'equipment': [{
            'id': 'e1', 'name': 'Pump', 'operatingHours': 285,
            'maintenanceRules': [{'id': 'pump', 'title': 'Pump service', 'intervalHours': 200,
                'confirmed': True, 'source': 'Synthetic rule', 'baselineHours': 100}],
        }]}
        self.assertEqual(self.build(data)[0]['status'], 'due_soon')

    def test_initial_calendar_limit_prioritizes_in_service_date(self):
        data = fleet()
        vehicle = data['vehicles'][0]
        vehicle['serviceHistory'] = []
        vehicle['maintenance']['inServiceDate'] = '2026-01-01'
        vehicle['maintenance']['rules'][0].update(
            recurrence='initial_then_recurring', initialMiles=100000, initialMonths=12,
            baselineDate='2026-09-01', baselineOdometer=10000,
        )
        self.assertEqual(self.build(data)[0]['dueDate'], '2027-01-01')

    def test_integral_json_floats_are_valid_whole_number_intervals(self):
        data = fleet()
        data['vehicles'][0]['maintenance']['rules'][0]['intervalMonths'] = 6.0
        self.assertEqual(self.build(data)[0]['dueDate'], '2026-11-01')

    def test_completed_appointment_must_link_to_same_rule(self):
        data = fleet()
        data['vehicles'][0]['maintenanceAppointments'] = [{
            'id': 'a1', 'ruleId': 'filters', 'title': 'Filters', 'date': '2026-05-01',
            'status': 'completed', 'serviceRecordId': 's1',
        }]
        with self.assertRaises(ValueError):
            self.build(data)

    def test_existing_rule_rejects_unknown_recurrence_and_negative_interval(self):
        for change in [{'recurrence': 'annual'}, {'intervalMiles': -1}, {'intervalMonths': 0}]:
            with self.subTest(change=change):
                data = fleet()
                data['vehicles'][0]['maintenance']['rules'][0].update(change)
                with self.assertRaises(ValueError):
                    self.build(data)

    def test_legacy_oil_profiles_remain_supported(self):
        data = fleet()
        data['vehicles'][0]['maintenance'] = {
            'oilIntervalMiles': 5000, 'oilIntervalMonths': 6,
            'scheduleConfirmed': True, 'scheduleSource': 'Synthetic legacy schedule',
        }
        self.assertEqual(self.build(data)[0]['dueDate'], '2026-11-01')

    def test_legacy_service_does_not_reset_independently_named_oil_rules(self):
        data = fleet()
        vehicle = data['vehicles'][0]
        vehicle['serviceHistory'][0].pop('ruleId')
        original = vehicle['maintenance']['rules'][0]
        vehicle['maintenance']['rules'] = [dict(original, id='engine-oil'), dict(original, id='gearbox-oil')]
        rows = self.build(data)
        self.assertEqual([row['status'] for row in rows], ['needs_setup', 'needs_setup'])
        self.assertTrue(all(row['lastServiceId'] is None for row in rows))

    def test_unknown_prior_history_blocks_initial_service_assumption(self):
        data = fleet()
        vehicle = data['vehicles'][0]
        vehicle['serviceHistory'] = []
        vehicle['maintenance'].update(baselineUnknown=True, inServiceDate='2026-01-01')
        vehicle['maintenance']['rules'][0].update(recurrence='initial_then_recurring', initialMiles=100000, initialMonths=60)
        row = self.build(data)[0]
        self.assertEqual(row['status'], 'needs_setup')
        self.assertIsNone(row['dueDate'])
        self.assertIn('history', '; '.join(row['missing']).lower())

    def test_effective_completed_service_resolves_unknown_history_for_its_rule(self):
        data = fleet()
        data['vehicles'][0]['maintenance']['baselineUnknown'] = True
        self.assertEqual(self.build(data)[0]['dueDate'], '2026-11-01')

    def test_initial_basis_describes_absolute_threshold_without_invented_baseline(self):
        data = fleet()
        vehicle = data['vehicles'][0]
        vehicle['serviceHistory'] = []
        vehicle['maintenance']['inServiceDate'] = '2026-01-01'
        vehicle['maintenance']['rules'][0].update(recurrence='initial_then_recurring', initialMiles=100000, initialMonths=60)
        basis = '; '.join(self.build(data)[0]['basis'])
        self.assertIn('absolute', basis.lower())
        self.assertNotIn('Explicit baseline', basis)
        self.assertNotIn('odometer=0', basis)

    def test_legacy_oil_remains_available_alongside_non_oil_rules(self):
        data = fleet()
        vehicle = data['vehicles'][0]
        vehicle['maintenance'].update(oilIntervalMiles=5000, oilIntervalMonths=6, scheduleConfirmed=True, scheduleSource='Synthetic legacy rule')
        vehicle['maintenance']['rules'] = [dict(vehicle['maintenance']['rules'][0], id='filters', kind='filters', baselineDate='2026-09-01', baselineOdometer=11000)]
        rows = self.build(data)
        self.assertEqual({row['ruleId'] for row in rows}, {'filters', 'oil'})
        self.assertEqual(next(row for row in rows if row['ruleId']=='oil')['dueDate'], '2026-11-01')

    def test_partial_draft_rule_without_intervals_is_setup_not_parse_failure(self):
        data = fleet()
        data['vehicles'][0]['maintenance']['rules'] = [{'id':'draft', 'title':'Draft', 'kind':'other', 'confirmed':False, 'source':'', 'recurrence':'after_service'}]
        self.assertEqual(self.build(data)[0]['status'], 'needs_setup')

    def test_cli_validation_error_does_not_create_report(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            source = folder / 'input.json'
            source.write_text('{"vehicles": [], "equipment": []}', encoding='utf-8')
            result = subprocess.run([sys.executable, str(SCRIPT), str(source), '--as-of', '2026-02-30', '--output-dir', str(folder / 'out')], capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertFalse((folder / 'out').exists())


if __name__ == '__main__':
    unittest.main()
