
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
	if (request.msg == 'request') {
		fetch(request.url).then((res) => res.text()).then(res=>sendResponse(res));
	}
	return true;
});
