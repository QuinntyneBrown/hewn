// Slide runtime for docs/videos/*/slides.html. One 1920x1080 <section> is visible at a time.
// ?slide=N (1-based), #N or the arrow keys pick it; tools/video-build screenshots ?slide=N with ?render=1
// (pins the scale), and ?audit=1 publishes overflow problems on <body data-audit> and every .clip box on
// <body data-clips> so recordings can be overlaid. Adds the part header and progress bar from data-parts,
// and turns <pre class="code" data-mark="2,5-6"> into numbered lines with the marked ones highlighted.
(function () {
  const body = document.body;
  // Decks are always light, whatever the renderer's OS preference.
  document.documentElement.setAttribute('data-theme', 'light');
  const slides = Array.from(document.querySelectorAll('body > section'));
  const params = new URLSearchParams(location.search);
  const parts = (body.dataset.parts || '').split('|').filter(Boolean);
  let current = 0;

  const mark =
    '<svg viewBox="0 0 32 32" aria-hidden="true"><rect class="mark__body" x="0" y="0" width="10" height="32"/><rect class="mark__body" x="10" y="13" width="12" height="6"/><polygon class="mark__body" points="22,10 32,0 32,32 22,32"/><polygon class="mark__chip" points="22,0 29,0 22,7"/></svg>';

  slides.forEach((s, i) => {
    if (i > 0 && !s.classList.contains('title')) {
      const part = Number(s.dataset.part || 0);
      const head = document.createElement('div');
      head.className = 'deck-head';
      head.innerHTML = `${mark}<span>Hewn · Video ${body.dataset.videoNumber || ''}</span><span>·</span><span class="deck-head__part">${parts[part] || ''}</span><span class="deck-head__bar" style="width:${((i + 1) / slides.length) * 100}%"></span>`;
      s.prepend(head);
    }
  });

  document.querySelectorAll('pre.code').forEach((pre) => {
    const marked = new Set();
    (pre.dataset.mark || '').split(',').filter(Boolean).forEach((r) => {
      const [a, b] = r.split('-').map(Number);
      for (let n = a; n <= (b || a); n++) marked.add(n);
    });
    const lines = pre.innerHTML.replace(/^\n/, '').replace(/\n$/, '').split('\n');
    pre.innerHTML = lines.map((l, i) => `<span class="ln${marked.has(i + 1) ? ' mark' : ''}">${l || ' '}</span>`).join('');
  });

  function fit() {
    const k = params.has('render') ? 1 : Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    document.documentElement.style.setProperty('--fit', String(k));
  }
  function show(i) {
    current = Math.max(0, Math.min(slides.length - 1, i));
    slides.forEach((s, j) => s.classList.toggle('active', j === current));
  }
  show((Number(params.get('slide') || location.hash.replace('#', '')) || 1) - 1);
  fit();
  window.addEventListener('resize', fit);
  window.addEventListener('keydown', (e) => {
    if (['ArrowRight', 'PageDown', ' '].includes(e.key)) show(current + 1);
    if (['ArrowLeft', 'PageUp'].includes(e.key)) show(current - 1);
    history.replaceState(null, '', '#' + (current + 1));
  });
  if (params.has('audit')) {
    const problems = [];
    const clips = [];
    slides.forEach((s, i) => {
      show(i);
      if (s.scrollHeight > 1081 || s.scrollWidth > 1921) problems.push({ slide: i + 1, id: s.id, issue: 'content overflows the slide', height: s.scrollHeight });
      const clip = s.querySelector('.clip');
      if (clip) {
        const r = clip.getBoundingClientRect();
        clips.push({ slide: i + 1, x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) });
      }
    });
    body.setAttribute('data-audit', JSON.stringify(problems));
    body.setAttribute('data-clips', JSON.stringify(clips));
    show(0);
  }
  body.classList.add('ready');
})();
