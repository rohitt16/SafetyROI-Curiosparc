import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { MapContainer, TileLayer, CircleMarker, Popup, Marker, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";
const DEFAULT_CENTER = [22.5937, 78.9629];
const riskColorMap = { Low: "#22c55e", Medium: "#f59e0b", High: "#f97316", Critical: "#991b1b" };
const routeColors = ["#2563eb", "#16a34a", "#dc2626", "#9333ea", "#0891b2"];
const riskWeight = { Low: 10, Medium: 35, High: 65, Critical: 90 };
const userIcon = L.divIcon({ className: "user-location-marker", html: '<span class="user-location-pulse"><span></span></span>', iconSize: [24,24], iconAnchor: [12,12] });

const distanceKm = (a,b) => {
  const r=Math.PI/180, dLat=(b.lat-a.lat)*r, dLon=(b.lng-a.lng)*r;
  const x=Math.sin(dLat/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dLon/2)**2;
  return 6371*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
};
const pointToSegmentKm=(p,a,b)=>{
  const lat=(p.lat+a.lat+b.lat)/3, kx=111.32*Math.cos(lat*Math.PI/180), ky=110.57;
  const px=p.lng*kx, py=p.lat*ky, ax=a.lng*kx, ay=a.lat*ky, bx=b.lng*kx, by=b.lat*ky;
  const dx=bx-ax, dy=by-ay, t=Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/(dx*dx+dy*dy||1)));
  return Math.hypot(px-(ax+t*dx),py-(ay+t*dy));
};
function MapRecenter({center,zoom=6}){ const map=useMap(); useEffect(()=>{if(center)map.flyTo(center,zoom,{duration:.7})},[center,zoom,map]); return null; }

export default function HotspotMap(){
 const [hotspots,setHotspots]=useState([]), [loading,setLoading]=useState(true), [error,setError]=useState("");
 const [origin,setOrigin]=useState(""), [destination,setDestination]=useState(""), [originPoint,setOriginPoint]=useState(null), [destinationPoint,setDestinationPoint]=useState(null);
 const [routes,setRoutes]=useState([]), [selectedRoute,setSelectedRoute]=useState(0), [planning,setPlanning]=useState(false), [routeError,setRouteError]=useState("");
 const [mapCenter,setMapCenter]=useState(DEFAULT_CENTER), [locationError,setLocationError]=useState(""); const [userLocation,setUserLocation]=useState(null);
 useEffect(()=>{let active=true;(async()=>{try{const r=await axios.get(`${API_BASE}/hotspots`);if(active)setHotspots(r.data||[])}catch{if(active)setError("Unable to retrieve hotspot data.")}finally{if(active)setLoading(false)}})();return()=>{active=false}},[]);
 const geocode=async(q)=>{const r=await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=in&q=${encodeURIComponent(q)}`,{headers:{Accept:"application/json"}});if(!r.ok)throw Error();const d=await r.json();if(!d.length)throw Error("notfound");return {lat:Number(d[0].lat),lng:Number(d[0].lon),label:d[0].display_name};};
 const scoreRoute=(coords)=>{
   const points=coords.map(([lng,lat])=>({lat,lng})); let exposure=0, hits=0; const seen=new Set();
   hotspots.forEach((h,i)=>{let best=Infinity; for(let j=1;j<points.length;j++)best=Math.min(best,pointToSegmentKm({lat:h.lat,lng:h.lng},points[j-1],points[j])); if(best<=15){const factor=Math.max(0,1-best/15); exposure+=riskWeight[h.risk] * factor; if(best<=5){hits++;seen.add(i)}}});
   const normalized=Math.min(100,exposure/Math.max(1,points.length/25)); const safety=Math.max(0,Math.round(100-normalized));
   return {safety, risk:safety>=80?"Low":safety>=60?"Medium":safety>=40?"High":"Critical", hotspots:hits};
 };
 const planRoute=async(e)=>{e?.preventDefault(); if(!origin.trim()||!destination.trim()){setRouteError("Enter both a starting point and destination.");return;} setPlanning(true);setRouteError("");setRoutes([]);
   try{const [a,b]=await Promise.all([geocode(origin),geocode(destination)]);setOriginPoint(a);setDestinationPoint(b);
     const url=`https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?alternatives=3&overview=full&geometries=geojson&steps=true`;
     const rr=await fetch(url);if(!rr.ok)throw Error("routing");const data=await rr.json();if(data.code!=="Ok"||!data.routes?.length)throw Error("noroute");
     const parsed=data.routes.map((r,i)=>{const risk=scoreRoute(r.geometry.coordinates.map(([lng,lat])=>[lng,lat]));const minutes=Math.round(r.duration/60);const hours=Math.floor(minutes/60),mins=minutes%60;return {...r,index:i,name:`Route ${String.fromCharCode(65+i)}`,coords:r.geometry.coordinates.map(([lng,lat])=>[lat,lng]),distanceKm:r.distance/1000,eta:hours?`${hours}h ${mins}m`:`${mins}m`,...risk,trafficProxy:r.distance/Math.max(1,r.duration/3600)};});
     parsed.sort((x,y)=>(y.safety-x.safety)||(x.duration-y.duration));setRoutes(parsed);setSelectedRoute(0);setMapCenter([a.lat,a.lng]);
   }catch(err){setRouteError(err.message==="notfound"?"One of the locations could not be found. Try a city, landmark, or road name.":"Could not calculate a driving route. Try again with more specific locations.");}finally{setPlanning(false)}};
 const locateUser=()=>{setLocationError("");if(!navigator.geolocation){setLocationError("Location services are not supported by this browser.");return;}navigator.geolocation.getCurrentPosition(({coords})=>{const p={lat:coords.latitude,lng:coords.longitude};setUserLocation(p);setOrigin(`${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`);setMapCenter([p.lat,p.lng]);},()=>setLocationError("Location permission was denied or unavailable."),{enableHighAccuracy:true,timeout:10000,maximumAge:60000})};
 const selected=routes[selectedRoute];
 const nearby=useMemo(()=>{if(!originPoint)return hotspots;return hotspots.map(h=>({...h,distance:distanceKm(originPoint,h)})).sort((a,b)=>a.distance-b.distance).slice(0,5)},[hotspots,originPoint]);
 if(loading)return <div className="map-loading">Loading hotspot network...</div>; if(error)return <div className="map-error"><p>{error}</p></div>;
 return <div className="map-layout">
   <div className="route-planner-panel">
    <div><div className="eyebrow">Safety Route Planner</div><h3>Find a safer route for any journey</h3><p className="route-help">Enter any start and destination. SafetyROI compares available driving routes using travel time and exposure to known safety hotspots.</p></div>
    <form className="route-input-grid" onSubmit={planRoute}>
      <label><span>Start location</span><input value={origin} onChange={e=>setOrigin(e.target.value)} placeholder="e.g. Pune" aria-label="Start location" /></label>
      <label><span>Destination</span><input value={destination} onChange={e=>setDestination(e.target.value)} placeholder="e.g. Mumbai" aria-label="Destination" /></label>
      <button className="primary-btn" type="submit" disabled={planning}>{planning?"Finding routes...":"Find safer routes"}</button>
      <button className="secondary-btn" type="button" onClick={locateUser}>◎ Use my location</button>
    </form>
    {routeError&&<div className="location-error">{routeError}</div>}{locationError&&<div className="location-error">{locationError}</div>}
   </div>
   {routes.length>0&&<div className="route-grid">{routes.map((r,i)=><button key={r.name} className={`route-card ${selectedRoute===i?"route-card-selected":""}`} onClick={()=>setSelectedRoute(i)} type="button">
      <div className="route-head"><strong>{r.name}</strong><span className="route-safety-badge">{r.safety}/100 safety</span></div><div className="route-meta"><span>{r.distanceKm.toFixed(0)} km</span><span>{r.eta}</span><span>{r.hotspots} hotspot{r.hotspots===1?"":"s"}</span></div><p>{r.risk} exposure along the route. {r.hotspots?"Known safety hotspots intersect or closely border this corridor.":"No known hotspot exposure in the current SafetyROI dataset."}</p></button>)}</div>}
   {selected&&<div className="recommended-route"><h3>SafetyROI route assessment: {selected.name}</h3><p><strong>{selected.safety}/100 safety score</strong> • {selected.distanceKm.toFixed(1)} km • {selected.eta} • {selected.hotspots} nearby hotspot zones.</p><small>Traffic note: live traffic is not enabled in this version; the displayed ETA comes from the routing service. Safety score is based on SafetyROI hotspot data, not a guarantee of road safety.</small></div>}
   <div className="map-legend"><div className="legend-item">🔵 Selected route</div><div className="legend-item">🟢 Lower-risk route</div><div className="legend-item">🔴 Higher-risk route</div>{Object.entries(riskColorMap).map(([k,c])=><div className="legend-item" key={k}><span className="legend-dot" style={{background:c}}/>{k} Risk</div>)}</div>
   <MapContainer center={mapCenter} zoom={6} style={{height:"500px",width:"100%",borderRadius:"18px"}}><MapRecenter center={mapCenter} zoom={routes.length?8:6}/><TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
     {userLocation&&<Marker position={[userLocation.lat,userLocation.lng]} icon={userIcon}><Popup>Your current location</Popup></Marker>}
     {originPoint&&<Marker position={[originPoint.lat,originPoint.lng]}><Popup><strong>Start</strong><br/>{origin}</Popup></Marker>}
     {destinationPoint&&<Marker position={[destinationPoint.lat,destinationPoint.lng]}><Popup><strong>Destination</strong><br/>{destination}</Popup></Marker>}
     {routes.map((r,i)=><Polyline key={`route-${i}`} positions={r.coords} pathOptions={{color:i===selectedRoute?"#2563eb":routeColors[i%routeColors.length],weight:i===selectedRoute?7:4,opacity:i===selectedRoute?0.9:0.55}} eventHandlers={{click:()=>setSelectedRoute(i)}}/>)}
     {hotspots.map((spot,index)=><CircleMarker key={`${spot.city}-${index}`} center={[spot.lat,spot.lng]} radius={spot.risk==="Critical"?14:9} pathOptions={{color:riskColorMap[spot.risk]||riskColorMap.Medium,fillColor:riskColorMap[spot.risk]||riskColorMap.Medium,fillOpacity:.55}}><Popup><strong>{spot.city}</strong><br/>Risk: {spot.risk}<br/>{spot.incident}</Popup></CircleMarker>)}
   </MapContainer>
   {routes.length>0&&<div className="route-table"><div className="eyebrow">Route comparison</div>{routes.map((r,i)=><div className={`route-row ${i===selectedRoute?"active":""}`} key={`row-${r.name}`} onClick={()=>setSelectedRoute(i)}><strong>{r.name}</strong><span>{r.distanceKm.toFixed(1)} km</span><span>{r.eta}</span><span>{r.safety}/100</span><span>{r.risk} risk</span></div>)}</div>}
   {originPoint&&nearby.length>0&&<div className="nearby-hotspots"><div className="eyebrow">Location Intelligence</div><h3>Safety hotspots near your start</h3><div className="nearby-list">{nearby.map(s=><div className="nearby-item" key={s.city}><span className="nearby-risk-dot" style={{background:riskColorMap[s.risk]||riskColorMap.Medium}}/><span className="nearby-name">{s.city}</span><span className="nearby-distance">{s.distance.toFixed(1)} km</span><span className="nearby-risk">{s.risk}</span></div>)}</div></div>}
 </div>
}
