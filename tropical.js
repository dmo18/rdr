(() => {
  const def = CFG.views.find(v => v.id === 'tropics');
  const node = state.nodes.get('tropics');
  if (!def || !node) return;

  def.type = 'tropical';
  def.center = { lat: 24.5, lon: -62 };
  def.zoom = 3;
  def.duration = 9000;
  def.source = 'NHC · 7-DAY OUTLOOK · TRACKS / CONES';
  def.labels = ['florida','cuba','bahamas','gulf','puertorico','caribbean','atlantic'];

  Object.assign(CFG.places, {
    puertorico:{lat:18.22,lon:-66.59,label:'PUERTO RICO'},
    caribbean:{lat:16.6,lon:-72.0,label:'CARIBBEAN',region:true},
    atlantic:{lat:30.0,lon:-48.0,label:'ATLANTIC',region:true}
  });
  CFG.services.tropical = {
    url:'https://mapservices.weather.noaa.gov/tropical/rest/services/tropical/NHC_tropical_weather_summary/MapServer'
  };

  node.root.innerHTML = '<div class="tile-layer"></div><div class="image-layer tropical-overlay"><img alt=""></div><div class="shade"></div><div class="label-layer"></div>';
  node.base = node.root.querySelector('.tile-layer');
  node.labels = node.root.querySelector('.label-layer');
  node.tropical = node.root.querySelector('.tropical-overlay img');
  node.root.querySelector('.tropical-overlay').style.background = 'transparent';
  node.tropical.style.objectFit = 'fill';
  node.tropical.style.filter = 'saturate(1.22) contrast(1.08) drop-shadow(0 0 1px #000)';
  node.tropical.referrerPolicy = 'no-referrer';

  function exportUrl(){
    const map = viewMap(def);
    const vp = viewport(map);
    const params = new URLSearchParams({
      bbox:vp.bbox.join(','),
      bboxSR:'3857',
      imageSR:'3857',
      size:`${map.width},${map.height}`,
      format:'png32',
      transparent:'true',
      layers:'show:2,33,3,5,6,7,8,10,11,15,16',
      f:'image',
      _:String(Date.now())
    });
    return `${CFG.services.tropical.url}/export?${params}`;
  }

  function refreshTropics(){
    renderBase(node);
    renderLabels(node);
    node.root.dataset.image = 'loading';
    node.tropical.src = exportUrl();
  }

  node.tropical.addEventListener('load', () => {
    node.root.dataset.image = 'ok';
    state.loaded.add('tropics');
  });
  node.tropical.addEventListener('error', () => {
    node.root.dataset.image = 'down';
    state.errors.push('tropics GIS image');
  });

  const baseUpdateTelemetry = updateTelemetry;
  updateTelemetry = function(){
    baseUpdateTelemetry();
    if (CFG.views[state.current]?.id === 'tropics') loopRange.textContent = 'NHC';
  };

  if (demo) {
    renderLabels(node);
    state.loaded.add('tropics');
    node.root.dataset.image = 'demo';
  } else {
    refreshTropics();
    setInterval(refreshTropics, 15 * 60 * 1000);
  }

  if (forcedView === 'tropics') {
    const idx = CFG.views.findIndex(v => v.id === 'tropics');
    if (idx >= 0) showView(idx);
  }
})();
