/**
 * Embeddable loader snippet for partner portal pages.
 * Usage: <script src="https://<host>/embed.js" data-token="AGENCY_TOKEN"></script>
 */
(function () {
  var script = document.currentScript;
  var token = script.getAttribute("data-token") || "";
  var host = new URL(script.src).origin;

  var iframe = document.createElement("iframe");
  iframe.src = host + "/widget?token=" + encodeURIComponent(token);
  iframe.style.position = "fixed";
  iframe.style.bottom = "16px";
  iframe.style.right = "16px";
  iframe.style.width = "380px";
  iframe.style.height = "560px";
  iframe.style.border = "1px solid #e5e7eb";
  iframe.style.borderRadius = "12px";
  iframe.style.boxShadow = "0 4px 16px rgba(0,0,0,0.12)";
  iframe.style.zIndex = "999999";
  iframe.title = "Partner Support Assistant";

  document.body.appendChild(iframe);
})();
