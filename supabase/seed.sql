-- SafeWatch seed data — 10 zones with real Navi Mumbai lat/lng coordinates.
-- slug must match PLACES[*].id in src/lib/types.ts for the projection to work.
-- x/y pixel positions are computed by api.ts latLngToXY() — not stored here.

insert into zones (name, slug, zone, lat, lng, radius_m) values
  ('College Gate',       'college-gate',    'North Campus',  19.0334, 73.0169, 80),
  ('Station Road',       'station-road',    'Sector 3',      19.0175, 73.0093, 100),
  ('Market Entrance',    'market-entrance', 'Old Market',    19.0249, 73.0040, 70),
  ('Hostel Road',        'hostel-road',     'South Campus',  19.0298, 73.0125, 60),
  ('Bus Depot Underpass','bus-underpass',   'Sector 5',      19.0142, 73.0212, 90),
  ('Library Lane',       'library-lane',    'North Campus',  19.0359, 73.0148, 50),
  ('Metro Exit B',       'metro-exit',      'Sector 3',      19.0190, 73.0181, 80),
  ('Lake Promenade',     'lake-promenade',  'Waterfront',    19.0410, 72.9990, 120),
  ('Tuition Hub Lane',   'tuition-hub',     'Sector 7',      19.0228, 73.0071, 60),
  ('Park Street',        'park-street',     'Sector 8',      19.0155, 73.0265, 80)
on conflict (slug) do nothing;
