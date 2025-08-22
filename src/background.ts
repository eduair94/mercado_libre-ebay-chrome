console.log("🚀 MercadoLibre Extension - Background Script Loaded!");

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  console.log("📨 Background received message:", request);
  console.log("👤 Sender:", sender);

  if (request.msg == "request") {
    console.log("🌐 Fetching URL:", request.url);
    console.log("🔍 Search type:", request.searchType);
    console.log("🏷️ Product name:", request.productName);

    fetch(request.url)
      .then((res) => {
        console.log("✅ Fetch response status:", res.status, res.statusText);
        return res.text();
      })
      .then((htmlData) => {
        console.log("📝 Response length:", htmlData.length);
        console.log("📤 Sending HTML data back to content script for parsing");

        // Send back the HTML data along with metadata for content script to parse
        sendResponse({
          success: true,
          searchType: request.searchType,
          productName: request.productName,
          htmlData: htmlData,
        });
      })
      .catch((error) => {
        console.error("❌ Fetch error:", error);
        sendResponse({
          success: false,
          searchType: request.searchType,
          productName: request.productName,
          error: `Fetch error: ${error.message}`,
        });
      });
  }
  return true; // Will respond asynchronously
});
