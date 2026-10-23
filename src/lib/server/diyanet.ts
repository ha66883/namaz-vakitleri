import { env } from "$env/dynamic/private";

const API_BASE = "https://awqatsalah.diyanet.gov.tr";

type TokenResponse = {
  data?: {
    accessToken?: string;
    refreshToken?: string;
  };
  success: boolean;
  message?: string | null;
};

let accessToken: string | null = null;
let refreshToken: string | null = null;
let accessTokenExpiresAt = 0;
let loginPromise: Promise<void> | null = null;

async function performLogin(): Promise<void> {
  const email = env.DIYANET_API_EMAIL;
  const password = env.DIYANET_API_PASSWORD;

  if (!email || !password) {
    throw new Error("Diyanet credentials are missing");
  }

  const response = await fetch(`${API_BASE}/Auth/Login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new Error(`Diyanet login failed: ${response.status}`);
  }

  const result: TokenResponse = await response.json();

  if (
    !result.success ||
    !result.data?.accessToken ||
    !result.data?.refreshToken
  ) {
    throw new Error("Diyanet login returned invalid tokens");
  }

  accessToken = result.data.accessToken;
  refreshToken = result.data.refreshToken;

  // Vor Ablauf der dokumentierten 45 Minuten erneut anmelden.
  accessTokenExpiresAt = Date.now() + 40 * 60 * 1000;
}

async function login(): Promise<void> {
  if (!loginPromise) {
    loginPromise = performLogin().finally(() => {
      loginPromise = null;
    });
  }

  await loginPromise;
}

async function getAccessToken(): Promise<string> {
  if (accessToken && Date.now() < accessTokenExpiresAt) {
    return accessToken;
  }

  // Der Refresh-Endpunkt liefert laut dem bisher geprüften Schema
  // keine neuen Token. Daher ist ein erneuter Login nötig.
  await login();

  if (!accessToken) {
    throw new Error("Diyanet access token is unavailable");
  }

  return accessToken;
}

export async function diyanetGet(path: string) {
  let token = await getAccessToken();

  let response = await fetch(`${API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (response.status === 401) {
    // Abgelehnten Token verwerfen und neu anmelden.
    accessToken = null;
    accessTokenExpiresAt = 0;

    await login();
    token = await getAccessToken();

    response = await fetch(`${API_BASE}${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });
  }

  if (!response.ok) {
    const errorBody = await response.text();

    console.error("Diyanet API error:", {
      status: response.status,
      path,
      body: errorBody,
    });

    throw new Error(
      `Diyanet API request failed: ${response.status} - ${errorBody}`,
    );
  }

  return response.json();
}
