export async function registerPushToken(token, accessToken) {
  const res = await fetch(
    `${import.meta.env.VITE_API_URL}/push/register`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({ token })
    }
  );

  if (!res.ok) {
    throw new Error('Failed to register push token');
  }

  return res.json();
}
