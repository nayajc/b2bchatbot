import { Suspense } from "react";
import WidgetChat from "./widget-chat";

export default function WidgetPage() {
  return (
    <Suspense fallback={<main className="p-8 text-sm text-gray-500">Loading…</main>}>
      <WidgetChat />
    </Suspense>
  );
}
