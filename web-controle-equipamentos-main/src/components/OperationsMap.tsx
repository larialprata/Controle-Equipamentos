import React, { useEffect, useRef } from 'react';
import type { CheckOperation, User } from '../types';

function formatDateTime(s: string) {
  if (!s) return '—';
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleString('pt-BR');
}

function escapeHtml(value: unknown): string {
  const s = String(value ?? '—');
  return s.replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#039;';
      default:
        return ch;
    }
  });
}

function labelOperacao(op: CheckOperation): { equipment: string; identifier: string } {
  if (op.equipment_type?.name != null && op.ativo_placa != null) {
    const nome = String(op.equipment_type.name).trim();
    const ap = String(op.ativo_placa).trim();
    return { equipment: nome || '—', identifier: ap || '—' };
  }
  const inst = op.equipment_instance;
  if (inst) {
    const tipoNome = inst.equipment_type?.name ?? '—';
    const tipoId = inst.identifier_type === 'placa' ? 'Placa' : inst.identifier_type === 'ativo' ? 'Ativo' : '—';
    const valor = inst.identifier_value?.trim() ?? '—';
    return { equipment: tipoNome, identifier: tipoId && valor ? `${tipoId}: ${valor}` : valor };
  }
  return {
    equipment: op.equipment?.name ?? op.equipment_id ?? '—',
    identifier: '—',
  };
}

const OperationsMap: React.FC<{ operations: CheckOperation[] }> = ({ operations }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const searchMarkerRef = useRef<google.maps.Marker | null>(null);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const searchInfoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

  useEffect(() => {
    const points = operations.filter((op) => {
      const lat = op.latitude != null ? Number(op.latitude) : NaN;
      const lng = op.longitude != null ? Number(op.longitude) : NaN;
      return !Number.isNaN(lat) && !Number.isNaN(lng) && lat !== 0 && lng !== 0;
    });
    if (!containerRef.current || points.length === 0 || !apiKey) return;

    const loadGoogleMaps = (): Promise<typeof google.maps> => {
      const w = window as Window & { google?: { maps: typeof google.maps } };
      if (w.google?.maps) return Promise.resolve(w.google.maps);
      return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve((window as Window & { google: { maps: typeof google.maps } }).google.maps);
        script.onerror = () => reject(new Error('Falha ao carregar Google Maps'));
        document.head.appendChild(script);
      });
    };

    loadGoogleMaps().then((maps) => {
      if (!containerRef.current) return;
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];
      if (searchMarkerRef.current) {
        searchMarkerRef.current.setMap(null);
        searchMarkerRef.current = null;
      }
      if (infoWindowRef.current) {
        infoWindowRef.current.close();
        infoWindowRef.current = null;
      }
      if (searchInfoWindowRef.current) {
        searchInfoWindowRef.current.close();
        searchInfoWindowRef.current = null;
      }
      if (autocompleteRef.current) autocompleteRef.current = null;
      if (mapRef.current) mapRef.current = null;

      const center = points.length
        ? { lat: Number(points[0].latitude), lng: Number(points[0].longitude) }
        : { lat: -22.9, lng: -43.2 };

      const map = new maps.Map(containerRef.current, {
        center,
        zoom: 13,
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: true,
        zoomControl: true,
      });
      mapRef.current = map;

      const infoWindow = new maps.InfoWindow();
      infoWindowRef.current = infoWindow;
      const searchInfoWindow = new maps.InfoWindow();
      searchInfoWindowRef.current = searchInfoWindow;

      const bounds = new maps.LatLngBounds();
      const PIN_BASE = 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x';
      const pinUrl = (color: string) => `${PIN_BASE}-${color}.png`;

      points.forEach((op) => {
        const lat = Number(op.latitude);
        const lng = Number(op.longitude);
        const isCheckin = op.operation_type === 'checkin';
        const marker = new maps.Marker({
          position: { lat, lng },
          map,
          icon: {
            url: pinUrl(isCheckin ? 'green' : 'red'),
            scaledSize: new maps.Size(25, 41),
            anchor: new maps.Point(12, 41),
          },
          title: labelOperacao(op).equipment,
        });
        const { equipment: eqName, identifier: eqId } = labelOperacao(op);
        const equipmentLabel = eqId !== '—' ? `${eqName} – ${eqId}` : eqName;
        const contractLabel = op.contract?.name ?? op.contract_id ?? '—';
        const createdBy = op.created_by_user;
        const userLabel =
          op.user?.full_name ??
          (typeof createdBy === 'object' && createdBy != null && 'full_name' in createdBy
            ? String((createdBy as User).full_name ?? '')
            : undefined) ??
          (typeof createdBy === 'string' ? createdBy : undefined) ??
          op.user_id ??
          '—';
        const content = `<style>.gm-style-iw-d{min-height:0!important;padding:0!important}.gm-style-iw-c{padding:4px!important}</style><div style="padding:6px 10px;font-size:13px;line-height:1.35;"><strong>Equipamento:</strong> ${escapeHtml(equipmentLabel)}<br/><strong>Contrato:</strong> ${escapeHtml(contractLabel)}<br/><strong>Usuário:</strong> ${escapeHtml(userLabel)}<br/><strong>${isCheckin ? 'Abertura' : 'Fechamento'}</strong><br/>${escapeHtml(formatDateTime(op.operation_datetime))}</div>`;
        marker.addListener('click', () => {
          searchInfoWindow.close();
          infoWindow.setContent(content);
          infoWindow.open(map, marker);
        });
        markersRef.current.push(marker);
        bounds.extend({ lat, lng });
      });

      if (points.length > 1) {
        map.fitBounds(bounds, { top: 20, right: 20, bottom: 20, left: 20 });
      }

      const input = inputRef.current;
      if (input && maps.places) {
        const autocomplete = new maps.places.Autocomplete(input, {
          fields: ['place_id', 'geometry', 'name', 'formatted_address'],
          types: ['establishment', 'geocode'],
        });
        autocompleteRef.current = autocomplete;

        autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();
          if (!place.geometry?.location) {
            if (place.name) {
              window.alert(`Nenhum detalhe disponível para: "${place.name}"`);
            }
            searchInfoWindow.close();
            if (searchMarkerRef.current) {
              searchMarkerRef.current.setMap(null);
              searchMarkerRef.current = null;
            }
            return;
          }
          const loc = place.geometry.location;
          if (place.geometry.viewport) {
            map.fitBounds(place.geometry.viewport, { top: 60, right: 20, bottom: 20, left: 20 });
          } else {
            map.setCenter(loc);
            map.setZoom(17);
          }
          if (searchMarkerRef.current) searchMarkerRef.current.setMap(null);
          const searchMarker = new maps.Marker({
            position: loc,
            map,
            title: place.name ?? place.formatted_address ?? undefined,
          });
          searchMarkerRef.current = searchMarker;
          const placeName = place.name ?? 'Local';
          const placeAddress = place.formatted_address ?? '';
          searchInfoWindow.setContent(`<div class="p-1"><strong>${placeName}</strong><br/><span>${placeAddress}</span></div>`);
          searchInfoWindow.open(map, searchMarker);
        });
      }
    });

    return () => {
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];
      if (searchMarkerRef.current) {
        searchMarkerRef.current.setMap(null);
        searchMarkerRef.current = null;
      }
      if (infoWindowRef.current) {
        infoWindowRef.current.close();
        infoWindowRef.current = null;
      }
      if (searchInfoWindowRef.current) {
        searchInfoWindowRef.current.close();
        searchInfoWindowRef.current = null;
      }
      autocompleteRef.current = null;
      mapRef.current = null;
    };
  }, [operations, apiKey]);

  const hasCoords = operations.some((op) => {
    const lat = op.latitude != null ? Number(op.latitude) : NaN;
    const lng = op.longitude != null ? Number(op.longitude) : NaN;
    return !Number.isNaN(lat) && !Number.isNaN(lng) && lat !== 0 && lng !== 0;
  });

  if (!apiKey) {
    return (
      <div className="h-full min-h-[400px] bg-gray-100 rounded-lg flex flex-col items-center justify-center text-gray-600 gap-2 p-4 text-center">
        <p>Para exibir o mapa do Google, configure a chave da API.</p>
        <p className="text-sm text-gray-500">Crie um arquivo <code className="bg-gray-200 px-1 rounded">.env</code> com <code className="bg-gray-200 px-1 rounded">VITE_GOOGLE_MAPS_API_KEY=sua_chave</code></p>
        <p className="text-xs text-gray-400">Ative a &quot;Maps JavaScript API&quot; no Google Cloud Console.</p>
      </div>
    );
  }

  if (operations.length === 0 || !hasCoords) {
    return (
      <div className="h-full min-h-[400px] bg-gray-100 rounded-lg flex items-center justify-center text-gray-500">
        Nenhuma operação com coordenadas para exibir no mapa.
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-[400px] w-full rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-500">
      <input
        ref={inputRef}
        type="text"
        placeholder="Buscar lugar ou endereço..."
        className="absolute top-3 left-3 z-10 w-[min(100%-1.5rem,320px)] py-2 px-3 rounded-md border border-gray-300 dark:border-gray-400 shadow-md bg-white dark:bg-gray-600 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-red-600 focus:border-blue-500 dark:focus:border-red-600 text-sm"
        autoComplete="off"
      />
      <div ref={containerRef} className="h-full min-h-[400px] w-full" />
    </div>
  );
};

export default OperationsMap;
