/**
 * Scratch host page demonstrating embed.js — exercises the same path a
 * partner's portal would use to drop in the widget (AC5 widget E2E test
 * target).
 */
export default function PortalDemoPage() {
  return (
    <main className="p-8">
      <h1 className="text-xl font-semibold">Partner Portal (demo host)</h1>
      <p className="mt-2 text-sm text-gray-600">
        This page simulates a partner portal embedding the assistant via{" "}
        <code>embed.js</code>. In production the agency&apos;s real portal session token is
        passed as <code>data-token</code>.
      </p>
      {/* eslint-disable-next-line @next/next/no-sync-scripts */}
      <script src="/embed.js" data-token="demo-agency-token" async></script>
    </main>
  );
}
