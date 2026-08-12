import os, re, io, json, gzip, math, urllib.request, urllib.parse
from datetime import datetime, timezone

import numpy as np
from PIL import Image
import tifffile

ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'..'))
DATA=os.path.join(ROOT,'data')
os.makedirs(DATA,exist_ok=True)
HOME=(26.06197904865014,-80.18787062578414)
UA='RDR-Yodeck-Ingest/10.0 contact=github.com/dmo18/rdr'
MRMS='https://mrms.ncep.noaa.gov/RIDGEII/L2'
VIEWS={
 'home':{'bbox':[-80.48,25.82,-79.92,26.31],'source':('CONUS','BREF_QCD')},
 'metro':{'bbox':[-81.08,25.20,-79.65,26.95],'source':('CONUS','BREF_QCD')},
 'florida':{'bbox':[-87.8,24.0,-79.3,31.25],'source':('CONUS','CREF_QCD')},
 'regional':{'bbox':[-98.0,18.0,-72.0,32.8],'source':('CONUS','CREF_QCD')},
}

def req(url, accept='*/*'):
    r=urllib.request.Request(url,headers={'User-Agent':UA,'Accept':accept})
    with urllib.request.urlopen(r,timeout=60) as f:return f.read()

def get_json(url):return json.loads(req(url,'application/json').decode('utf-8'))

def latest_file(domain,product,offset=0):
    base=f'{MRMS}/{domain}/{product}/'
    html=req(base,'text/html').decode('utf-8','replace')
    rx=re.compile(rf'{domain}_L2_{product}_\d{{8}}_\d{{6}}\.tif\.gz')
    names=sorted(set(rx.findall(html)))
    if not names:raise RuntimeError(f'no MRMS files for {domain}/{product}')
    name=names[-1-offset]
    m=re.search(r'_(\d{8})_(\d{6})\.tif\.gz$',name)
    stamp=datetime.strptime(m.group(1)+m.group(2),'%Y%m%d%H%M%S').replace(tzinfo=timezone.utc)
    return base+name,stamp

def read_mrms(domain,product,offset=0):
    url,stamp=latest_file(domain,product,offset)
    raw=gzip.decompress(req(url,'application/octet-stream'))
    with tifffile.TiffFile(io.BytesIO(raw)) as tf:
        page=tf.pages[0]
        arr=page.asarray().astype(np.float32)
        tags=page.tags
        scale=tuple(tags['ModelPixelScaleTag'].value)
        tie=tuple(tags['ModelTiepointTag'].value)
        sx,sy=scale[0],scale[1]
        lon0=tie[3]-tie[0]*sx
        lat0=tie[4]+tie[1]*sy
        nodata=None
        if 'GDAL_NODATA' in tags:
            try:nodata=float(tags['GDAL_NODATA'].value)
            except:nodata=None
    return {'arr':arr,'lon0':lon0,'lat0':lat0,'sx':sx,'sy':sy,'nodata':nodata,'time':stamp,'url':url}

def crop_grid(src,bbox,w=456,h=216):
    west,south,east,north=bbox
    arr=src['arr']; H,W=arr.shape[-2],arr.shape[-1]
    x0=(west-src['lon0'])/src['sx']; x1=(east-src['lon0'])/src['sx']
    y0=(src['lat0']-north)/src['sy']; y1=(src['lat0']-south)/src['sy']
    xs=np.linspace(x0,x1,w).round().astype(int)
    ys=np.linspace(y0,y1,h).round().astype(int)
    xs=np.clip(xs,0,W-1); ys=np.clip(ys,0,H-1)
    out=arr[np.ix_(ys,xs)]
    if src['nodata'] is not None:out=np.where(out==src['nodata'],np.nan,out)
    return out

def colorize(dbz):
    h,w=dbz.shape
    rgba=np.zeros((h,w,4),dtype=np.uint8)
    stops=[
      (5,(20,95,115)),(10,(25,140,125)),(15,(20,175,85)),(20,(35,205,55)),
      (25,(105,225,45)),(30,(200,230,35)),(35,(255,210,30)),(40,(255,155,25)),
      (45,(255,90,25)),(50,(240,40,35)),(55,(205,35,100)),(60,(180,40,180)),
      (65,(150,55,220)),(70,(235,235,255))]
    valid=np.isfinite(dbz)&(dbz>=5)&(dbz<=95)
    for i,(lo,col) in enumerate(stops):
        hi=stops[i+1][0] if i+1<len(stops) else 96
        m=valid&(dbz>=lo)&(dbz<hi)
        rgba[m,:3]=col; rgba[m,3]=232
    return rgba

def nearest_and_status(grid,bbox):
    west,south,east,north=bbox; lat,lon=HOME
    x=int(round((lon-west)/(east-west)*(grid.shape[1]-1)))
    y=int(round((north-lat)/(north-south)*(grid.shape[0]-1)))
    v=float(grid[np.clip(y,0,grid.shape[0]-1),np.clip(x,0,grid.shape[1]-1)])
    if not math.isfinite(v):v=-99
    status='INTENSE' if v>=50 else 'HEAVY' if v>=35 else 'RAIN' if v>=20 else 'SPRINKLE' if v>=5 else 'DRY'
    nearest=None
    for r in range(2,160,2):
      found=False
      for deg in range(0,360,8):
        xx=int(round(x+math.cos(math.radians(deg))*r)); yy=int(round(y+math.sin(math.radians(deg))*r))
        if 0<=xx<grid.shape[1] and 0<=yy<grid.shape[0] and np.isfinite(grid[yy,xx]) and grid[yy,xx]>=20:
          kmx=(east-west)*111.32*math.cos(math.radians(lat))/grid.shape[1]
          kmy=(north-south)*111.32/grid.shape[0]
          dx=math.cos(math.radians(deg))*r*kmx; dy=-math.sin(math.radians(deg))*r*kmy
          mi=math.hypot(dx,dy)*0.621371; bearing=(math.degrees(math.atan2(dx,dy))+360)%360
          dirs=['N','NE','E','SE','S','SW','W','NW']
          nearest={'miles':round(mi,1),'dir':dirs[round(bearing/45)%8]}; found=True; break
      if found:break
    return {'dbz':round(v,1),'status':status,'nearest':nearest}

def motion(a,b,bbox):
    best=(1e9,0,0)
    H,W=a.shape
    for dy in range(-10,11,2):
      for dx in range(-10,11,2):
        vals=[]
        for y in range(14,H-14,7):
          yy=y+dy
          for x in range(14,W-14,7):
            xx=x+dx
            av=a[y,x]; bv=b[yy,xx]
            if (math.isfinite(av) and av>=15) or (math.isfinite(bv) and bv>=15):
              vals.append(abs(max(0,float(av) if math.isfinite(av) else 0)-max(0,float(bv) if math.isfinite(bv) else 0)))
        if len(vals)>20:
          score=sum(vals)/len(vals)
          if score<best[0]:best=(score,dx,dy)
    _,dx,dy=best
    west,south,east,north=bbox; lat=HOME[0]
    kmx=(east-west)*111.32*math.cos(math.radians(lat))/a.shape[1]
    kmy=(north-south)*111.32/a.shape[0]
    mph=math.hypot(dx*kmx,dy*kmy)*0.621371*30
    bearing=(math.degrees(math.atan2(dx,-dy))+360)%360
    dirs=['N','NE','E','SE','S','SW','W','NW']
    return {'mph':round(mph),'dir':dirs[round(bearing/45)%8]}

def arc_query(base,bbox,extra=None):
    p={'where':'1=1','geometry':','.join(map(str,bbox)),'geometryType':'esriGeometryEnvelope','inSR':'4326','outSR':'4326','spatialRel':'esriSpatialRelIntersects','outFields':'*','returnGeometry':'true','f':'geojson'}
    if extra:p.update(extra)
    return base+'?'+urllib.parse.urlencode(p)

def simplify_feature_collection(j,limit=500):
    fs=j.get('features',[])[:limit]
    return {'type':'FeatureCollection','features':fs}

def ingest_context():
    bbox=VIEWS['regional']['bbox']
    warning='https://mapservices.weather.noaa.gov/eventdriven/rest/services/WWA/watch_warn_adv/MapServer/0/query'
    reference='https://mapservices.weather.noaa.gov/static/rest/services/nws_reference_maps/nws_reference_map/MapServer'
    tropical='https://mapservices.weather.noaa.gov/tropical/rest/services/tropical/NHC_tropical_weather_summary/MapServer'
    ctx={'generated':datetime.now(timezone.utc).isoformat(),'warnings':simplify_feature_collection(get_json(arc_query(warning,bbox))), 'states':simplify_feature_collection(get_json(arc_query(reference+'/3/query',bbox,{'maxAllowableOffset':'.01'}))), 'counties':simplify_feature_collection(get_json(arc_query(reference+'/2/query',[-81.2,25.0,-79.5,27.1],{'maxAllowableOffset':'.002'}))), 'tropics':[]}
    for layer in [3,5,6,7,8,10,11,15,16]:
      try:
        j=simplify_feature_collection(get_json(arc_query(f'{tropical}/{layer}/query',bbox,{'maxAllowableOffset':'.02'})))
        for f in j['features']:f['_layer']=layer
        ctx['tropics'].extend(j['features'])
      except Exception as e:print('tropical layer',layer,'failed',e)
    try:
      point=get_json(f'https://api.weather.gov/points/{HOME[0]:.4f},{HOME[1]:.4f}')
      hourly=get_json(point['properties']['forecastHourly'])['properties']['periods'][:6]
      ctx['forecast']=[{k:p.get(k) for k in ['startTime','temperature','temperatureUnit','probabilityOfPrecipitation','windSpeed','windDirection','shortForecast']} for p in hourly]
    except Exception as e:ctx['forecast']=[];print('forecast failed',e)
    with open(os.path.join(DATA,'context.json'),'w') as f:json.dump(ctx,f,separators=(',',':'))

def main():
    cache={}
    meta={'generated':datetime.now(timezone.utc).isoformat(),'views':{}}
    for name,defn in VIEWS.items():
      key=defn['source']
      if key not in cache:
        cache[key]=[read_mrms(*key,offset=1),read_mrms(*key,offset=0)]
      prev,cur=cache[key]
      g0=crop_grid(prev,defn['bbox']); g1=crop_grid(cur,defn['bbox'])
      Image.fromarray(colorize(g1),'RGBA').save(os.path.join(DATA,f'{name}.png'),optimize=True)
      vmeta={'time':cur['time'].isoformat(),'bbox':defn['bbox'],'source':f'MRMS {key[0]} {key[1]}'}
      if name=='home':vmeta.update(nearest_and_status(g1,defn['bbox']));vmeta['motion']=motion(g0,g1,defn['bbox'])
      meta['views'][name]=vmeta
    with open(os.path.join(DATA,'radar.json'),'w') as f:json.dump(meta,f,separators=(',',':'))
    ingest_context()
    print(json.dumps(meta,indent=2))

if __name__=='__main__':main()
