export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const applicationId = process.env.SQUARE_APPLICATION_ID;
  const locationId = process.env.SQUARE_LOCATION_ID;
  const environment = (process.env.SQUARE_ENVIRONMENT || 'production').toLowerCase();

  if (!applicationId || !locationId) {
    return res.status(503).json({
      ok: false,
      error: 'Square is not configured yet.'
    });
  }

  return res.status(200).json({
    ok: true,
    applicationId,
    locationId,
    environment: environment === 'sandbox' ? 'sandbox' : 'production'
  });
}
