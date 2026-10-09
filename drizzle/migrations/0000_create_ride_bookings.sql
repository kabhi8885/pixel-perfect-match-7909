CREATE TABLE public.ride_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pickup_label TEXT NOT NULL,
  pickup_lat DOUBLE PRECISION NOT NULL,
  pickup_lng DOUBLE PRECISION NOT NULL,
  destination_label TEXT NOT NULL,
  destination_lat DOUBLE PRECISION NOT NULL,
  destination_lng DOUBLE PRECISION NOT NULL,
  vehicle TEXT NOT NULL,
  fare INTEGER NOT NULL,
  distance_km DOUBLE PRECISION NOT NULL,
  duration_minutes INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'en_route', 'reached')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.ride_bookings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ride_bookings TO authenticated;
GRANT ALL ON public.ride_bookings TO service_role;

ALTER TABLE public.ride_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create a booking" ON public.ride_bookings FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Anyone can view bookings" ON public.ride_bookings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Anyone can update booking status" ON public.ride_bookings FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);