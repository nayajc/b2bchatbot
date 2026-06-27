export default function Home() {
  return (
    <main className="p-8">
      <h1 className="text-xl font-semibold">B2B Ticket FAQ Assistant</h1>
      <p className="mt-2 text-sm text-gray-600">
        Pilot RAG chatbot for travel agency partners. See <code>/widget</code> for the embeddable
        chat, <code>/staff/escalations</code> for the staff queue, and{" "}
        <code>/admin/metrics</code> for the pilot dashboard.
      </p>
    </main>
  );
}
