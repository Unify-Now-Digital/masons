
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { MapPin, Search, Navigation, Filter, Info, ChevronRight, Calendar, User, Hammer, Box, CreditCard, Layers, Clock, Wand2, Building, ExternalLink, Map as MapIcon, MoreHorizontal, LayoutGrid, Maximize2, Minimize2, Ruler, Hash, DollarSign } from 'lucide-react';
import { DUMMY_ORDERS, DUMMY_PRODUCTS } from '@/shared/lib/prototypeConstants';
import { Order, MainStatus } from '@/shared/types/prototype.types';
import { GoogleGenAI } from "@google/genai";
import VisualProof from '@/modules/inscriptions/components/VisualProof';
import OrderDetailsSidePanel from '@/modules/orders/components/OrderDetailsSidePanel';

declare global {
  interface Window {
    google: any;
  }
}

const JobMap: React.FC = () => {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeStatusFilter, setActiveStatusFilter] = useState<MainStatus | 'all'>('all');
  const [viewMode, setViewMode] = useState<'individual' | 'cemetery'>('individual');
  const [aiSearchQuery, setAiSearchQuery] = useState('');
  const [isSearchingNearby, setIsSearchingNearby] = useState(false);
  const [nearbyResults, setNearbyResults] = useState<any[]>([]);
  
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMap = useRef<any>(null);
  const markers = useRef<{ [key: string]: any }>({});

  const cemeteryGroups = useMemo(() => {
    const groups: { [key: string]: Order[] } = {};
    DUMMY_ORDERS.forEach(order => {
      if (!groups[order.cemetery]) groups[order.cemetery] = [];
      groups[order.cemetery].push(order);
    });
    return groups;
  }, []);

  const filteredOrders = useMemo(() => {
    return DUMMY_ORDERS.filter(order => {
      const matchesSearch = order.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          order.cemetery.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = activeStatusFilter === 'all' || order.mainStatus === activeStatusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [searchQuery, activeStatusFilter]);

  const selectedOrder = useMemo(() => 
    DUMMY_ORDERS.find(o => o.id === selectedOrderId), 
    [selectedOrderId]
  );

  const selectedProduct = useMemo(() => 
    selectedOrder ? DUMMY_PRODUCTS.find(p => p.sku === selectedOrder.sku) : null,
    [selectedOrder]
  );

  useEffect(() => {
    const apiKey = 'AIzaSyBlOy42xYHJ27EBgaYQf0KpWZp5CGkqvLs';
    if (!window.google) {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = () => initializeMap();
      document.head.appendChild(script);
    } else {
      initializeMap();
    }

    function initializeMap() {
      if (!mapRef.current) return;
      googleMap.current = new window.google.maps.Map(mapRef.current, {
        center: { lat: 53.3931, lng: -3.0531 },
        zoom: 11,
        styles: mapStyles,
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: 'greedy',
      });
      syncMarkers();
    }
  }, []);

  const syncMarkers = () => {
    if (!googleMap.current) return;

    Object.keys(markers.current).forEach(id => {
      if (!filteredOrders.find(o => o.id === id)) {
        markers.current[id].setMap(null);
        delete markers.current[id];
      }
    });

    const bounds = new window.google.maps.LatLngBounds();
    let hasMarkers = false;

    filteredOrders.forEach((order, index) => {
      if (!order.coordinates) return;
      hasMarkers = true;

      const cemeteryJobs = filteredOrders.filter(o => o.cemetery === order.cemetery);
      const cemeteryCount = cemeteryJobs.length;
      const orderInCemeteryIndex = cemeteryJobs.indexOf(order);
      
      const jitteredPos = cemeteryCount > 1 
        ? { 
            lat: order.coordinates.lat + (Math.sin(orderInCemeteryIndex) * 0.0003), 
            lng: order.coordinates.lng + (Math.cos(orderInCemeteryIndex) * 0.0003) 
          }
        : order.coordinates;

      const isSelected = selectedOrderId === order.id;

      if (!markers.current[order.id]) {
        const marker = new window.google.maps.Marker({
          position: jitteredPos,
          map: googleMap.current,
          title: `${order.customerName} (${order.cemetery})`,
          icon: getMarkerIcon(order.mainStatus, isSelected, cemeteryCount),
          label: cemeteryCount > 1 ? {
            text: String(cemeteryCount),
            color: 'white',
            fontSize: '9px',
            fontWeight: '900'
          } : null
        });

        marker.addListener('click', () => {
          setSelectedOrderId(order.id);
        });

        markers.current[order.id] = marker;
      } else {
        markers.current[order.id].setIcon(getMarkerIcon(order.mainStatus, isSelected, cemeteryCount));
        markers.current[order.id].setZIndex(isSelected ? 1000 : index);
      }
      bounds.extend(jitteredPos);
    });

    if (hasMarkers && filteredOrders.length > 0 && !selectedOrderId) {
      googleMap.current.fitBounds(bounds);
      if (googleMap.current.getZoom() > 14) googleMap.current.setZoom(14);
    }
  };

  useEffect(() => {
    syncMarkers();
  }, [filteredOrders, selectedOrderId]);

  useEffect(() => {
    if (googleMap.current && selectedOrderId && selectedOrder?.coordinates) {
      googleMap.current.panTo(markers.current[selectedOrderId].getPosition());
      // Reduced zoom level when selecting orders to allow more context
      googleMap.current.setZoom(14);
    }
  }, [selectedOrderId]);

  const handleNearbySearch = async () => {
    if (!aiSearchQuery || !process.env.API_KEY) return;
    setIsSearchingNearby(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Find ${aiSearchQuery} near the Wirral area.`,
        config: { tools: [{ googleMaps: {} }] },
      });
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      setNearbyResults(chunks);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearchingNearby(false);
    }
  };

  const getMarkerIcon = (status: MainStatus, isSelected: boolean, groupCount: number) => {
    const color = getStatusHexColor(status);
    const size = isSelected ? 30 : 22; 
    const svgPath = "M 20 0 C 9 0 0 9 0 20 C 0 31 20 50 20 50 C 20 50 40 31 40 20 C 40 9 31 0 20 0 Z";
    return {
      path: svgPath,
      fillColor: color,
      fillOpacity: 1,
      strokeWeight: isSelected ? 2 : 1,
      strokeColor: '#FFFFFF',
      scale: size / 50,
      anchor: new window.google.maps.Point(20, 50),
      labelOrigin: new window.google.maps.Point(20, 20),
    };
  };

  const getStatusHexColor = (status: MainStatus) => {
    switch (status) {
      case MainStatus.INSTALL: return '#10b981'; 
      case MainStatus.PENDING: return '#f97316'; 
      case MainStatus.DEPOSIT_PAID: return '#3b82f6';
      case MainStatus.COMPLETE: return '#64748b';
      default: return '#6366f1';
    }
  };

  const getStatusTailwindColor = (status: MainStatus) => {
    switch (status) {
      case MainStatus.INSTALL: return 'bg-emerald-500';
      case MainStatus.PENDING: return 'bg-orange-500';
      case MainStatus.DEPOSIT_PAID: return 'bg-blue-600';
      case MainStatus.COMPLETE: return 'bg-slate-500';
      default: return 'bg-indigo-600';
    }
  };

  const otherJobsAtCemetery = useMemo(() => {
    if (!selectedOrder) return [];
    return DUMMY_ORDERS.filter(o => o.cemetery === selectedOrder.cemetery && o.id !== selectedOrder.id);
  }, [selectedOrder]);

  return (
    <div className="h-[calc(100vh-65px)] flex bg-gardens-page overflow-hidden">
      {/* Sidebar Job List */}
      <div className="w-[220px] xl:w-[260px] border-r flex flex-col bg-white shadow-xl z-20 shrink-0">
        <div className="p-4 xl:p-6 border-b shrink-0 bg-white">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-black text-slate-900 tracking-tighter">Logistics Hub</h2>
            <div className="flex p-1 bg-slate-100 rounded-lg">
               <button onClick={() => setViewMode('individual')} className={`p-1.5 rounded-md transition-all ${viewMode === 'individual' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400'}`}><MapIcon className="w-3.5 h-3.5" /></button>
               <button onClick={() => setViewMode('cemetery')} className={`p-1.5 rounded-md transition-all ${viewMode === 'cemetery' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400'}`}><LayoutGrid className="w-3.5 h-3.5" /></button>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Find cemetery or client..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500/10 outline-none transition-all"
              />
            </div>
            
            <div className="flex flex-wrap gap-1">
              {['all', MainStatus.INSTALL, MainStatus.PENDING].map((status) => (
                <button
                  key={status}
                  onClick={() => setActiveStatusFilter(status as any)}
                  className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border ${
                    activeStatusFilter === status 
                      ? 'bg-slate-900 border-slate-900 text-white' 
                      : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'
                  }`}
                >
                  {status === 'all' ? 'All' : status.split('/')[0]}
                </button>
              ))}
            </div>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          {viewMode === 'cemetery' ? (
            (Object.entries(cemeteryGroups) as [string, Order[]][]).map(([cemetery, jobs]) => (
              <div key={cemetery} className="space-y-2">
                 <div className="flex items-center justify-between px-1">
                   <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{cemetery}</h3>
                   <span className="text-[8px] font-black bg-slate-50 text-slate-400 px-1.5 py-0.5 rounded-full">{jobs.length}</span>
                 </div>
                 {jobs.map(order => (
                   <JobCard 
                      key={order.id} 
                      order={order} 
                      isSelected={selectedOrderId === order.id} 
                      onClick={() => setSelectedOrderId(order.id)}
                      colorClass={getStatusTailwindColor(order.mainStatus)}
                   />
                 ))}
              </div>
            ))
          ) : (
            filteredOrders.map((order) => (
              <JobCard 
                key={order.id} 
                order={order} 
                isSelected={selectedOrderId === order.id} 
                onClick={() => setSelectedOrderId(order.id)}
                colorClass={getStatusTailwindColor(order.mainStatus)}
              />
            ))
          )}
        </div>
      </div>

      {/* Map Surface */}
      <div className="flex-1 relative bg-slate-100 overflow-hidden">
        <div ref={mapRef} className="w-full h-full" />
        
        {/* Legend Box */}
        <div className="absolute top-6 right-6 flex flex-col gap-2 z-20">
           <LegendItem color="bg-emerald-500" label="Install" />
           <LegendItem color="bg-orange-500" label="Pending" />
           <LegendItem color="bg-blue-600" label="Production" />
        </div>
      </div>

      {/* Side Peek - Order Details */}
      {selectedOrder && (
        <div className="w-[320px] xl:w-[380px] border-l h-full shrink-0 animate-in slide-in-from-right duration-500 overflow-hidden bg-white shadow-2xl">
          <OrderDetailsSidePanel 
            order={selectedOrder} 
            onClose={() => setSelectedOrderId(null)} 
            isEmbedded={true}
          />
        </div>
      )}
    </div>
  );
};

const JobCard = ({ order, isSelected, onClick, colorClass }: any) => (
  <button
    onClick={onClick}
    className={`w-full text-left p-3.5 rounded-2xl transition-all border-2 relative overflow-hidden ${
      isSelected ? 'bg-white border-slate-900 shadow-lg' : 'bg-white border-slate-50 hover:border-slate-200'
    }`}
  >
    <div className={`absolute left-0 top-0 bottom-0 w-1 ${colorClass}`} />
    <div className="flex justify-between items-start mb-1">
      <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">{order.id}</span>
      <span className={`px-1.5 py-0.5 rounded text-[7px] font-black text-white uppercase ${colorClass}`}>
        {order.mainStatus.split('/')[0]}
      </span>
    </div>
    <p className="text-sm font-black text-slate-900 truncate tracking-tight">{order.customerName}</p>
    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold uppercase truncate">
      <MapPin className="w-3 h-3" /> {order.cemetery}
    </div>
  </button>
);

const LegendItem = ({ color, label }: { color: string, label: string }) => (
  <div className="flex items-center gap-2 px-3 py-1.5 bg-white/90 backdrop-blur border border-slate-200 rounded-xl shadow-md">
    <div className={`w-2 h-2 rounded-full ${color}`} />
    <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">{label}</span>
  </div>
);

const mapStyles = [
  { "featureType": "poi", "stylers": [{"visibility": "off"}] },
  { "featureType": "transit", "stylers": [{"visibility": "off"}] },
  { "featureType": "landscape", "stylers": [{"color": "#f8fafc"}] },
  { "featureType": "water", "stylers": [{"color": "#e2e8f0"}] }
];

export default JobMap;
