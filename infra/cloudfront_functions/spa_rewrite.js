// Viewer-request function for the web behavior. Requests whose last path
// segment has no file extension are client-side routes and get index.html;
// anything that looks like a file (assets, favicon, index.html itself) passes
// through so a genuinely missing asset still returns an error.
function handler(event) {
  var request = event.request;
  var uri = request.uri;
  var lastSegment = uri.substring(uri.lastIndexOf('/') + 1);
  if (lastSegment.indexOf('.') === -1) {
    request.uri = '/index.html';
  }
  return request;
}
