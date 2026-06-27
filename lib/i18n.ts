/**
 * UI + assistant response language. The KB content itself stays English
 * (source format open question, spec's original language scope) — Claude
 * translates its grounded answer into the selected language at generation
 * time (security.ts system prompt instructs "translate faithfully, do not
 * add facts"). Denylist/security heuristics are pattern-matched in both
 * languages so routing safety doesn't regress when a user switches.
 */
export type Language = "en" | "vi";

export const LANGUAGES: { code: Language; label: string }[] = [
  { code: "en", label: "EN" },
  { code: "vi", label: "VI" },
];

export const UI_STRINGS: Record<Language, {
  title: string;
  placeholder: string;
  send: string;
  thinking: string;
  connectingToTeam: string;
  sourceLabel: string;
  errorMessage: string;
  notAuthenticated: string;
  loading: string;
}> = {
  en: {
    title: "Partner Support Assistant",
    placeholder: "Ask about pricing, settlement, ticket usage…",
    send: "Send",
    thinking: "Thinking…",
    connectingToTeam: "Connecting you with our team →",
    sourceLabel: "Source",
    errorMessage: "Sorry, something went wrong.",
    notAuthenticated: "Not authenticated. Pass a valid agency token (?token=...) to open this widget.",
    loading: "Loading…",
  },
  vi: {
    title: "Trợ Lý Hỗ Trợ Đối Tác",
    placeholder: "Hỏi về giá, thanh toán, cách sử dụng vé…",
    send: "Gửi",
    thinking: "Đang xử lý…",
    connectingToTeam: "Đang kết nối bạn với đội ngũ của chúng tôi →",
    sourceLabel: "Nguồn",
    errorMessage: "Xin lỗi, đã có lỗi xảy ra.",
    notAuthenticated: "Chưa xác thực. Vui lòng cung cấp token đại lý hợp lệ (?token=...) để mở widget này.",
    loading: "Đang tải…",
  },
};
