/**
 * Architect #6: auth model (SSO vs standalone Firebase Auth) is an open
 * question. This stub unblocks widget work without committing to that
 * decision. The real implementation is a single-function swap — it MUST
 * NOT silently remain the pilot's actual auth; track replacing it before
 * any non-pilot rollout.
 */
export interface AgencyContext {
  agencyId: string;
  agencyName: string;
  authenticated: boolean;
}

export async function getAgencyContext(token: string | null): Promise<AgencyContext> {
  if (!token) {
    return { agencyId: "", agencyName: "", authenticated: false };
  }

  // STUB: accepts any non-empty token for the pilot. Replace with real
  // SSO/Firebase Auth verification before production rollout.
  return { agencyId: `stub-${token}`, agencyName: "Pilot Partner Agency", authenticated: true };
}
