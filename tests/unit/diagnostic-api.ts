import axios from "axios";

export async function submitDiagnostic(payload: any): Promise<any> {
  // Diagnostic API endpoint must be provided via environment; no hard-coded defaults
  const endpoint = process.env.DIAGNOSTIC_API_URL;
  if (!endpoint) {
    throw new Error(
      "DIAGNOSTIC_API_URL must be set in the test environment to submit diagnostics."
    );
  }

  const token = process.env.DIAGNOSTIC_API_TOKEN || "";
  try {
    const response = await axios.post(endpoint, payload, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    return response.data;
  } catch (error) {
    // Log error for test diagnostics
    return { error: error.message };
  }
}
