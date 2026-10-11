/* Sets the initial Chakra color mode before first paint (external file so CSP can stay script-src 'self'). */
(function () {
  var mode = 'light';
  try {
    var stored = window.localStorage.getItem('chakra-ui-color-mode');
    if (stored === 'light' || stored === 'dark') {
      mode = stored;
    } else {
      mode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
  } catch (e) {
    mode = 'light';
  }
  var root = document.documentElement;
  root.setAttribute('data-theme', mode);
  root.style.colorScheme = mode;
  var body = document.body;
  var other = mode === 'dark' ? 'chakra-ui-light' : 'chakra-ui-dark';
  root.classList.remove(other);
  root.classList.add('chakra-ui-' + mode);
  if (body) {
    body.classList.remove(other);
    body.classList.add('chakra-ui-' + mode);
  }
})();
