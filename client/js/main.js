fetch('components/header.html')
  .then(res => res.text())
  .then(html => document.getElementById('header').innerHTML = html);