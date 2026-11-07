import type * as LeafletTypes from "leaflet"

/** Màu nước biển chuẩn tuyệt đối của nền CARTO Voyager (`rgb(203, 225, 228)`) và OSM dự phòng */
const CARTO_VOYAGER_SEA_HEX = "#CBE1E4"
const OSM_STANDARD_SEA_HEX = "#AAD3DF"

/** Khung giới hạn vùng lãnh thổ & lãnh hải Việt Nam để giữ trọng tâm bản đồ trong nước */
const VIETNAM_MAP_BOUNDS: LeafletTypes.LatLngBoundsExpression = [
  [3.5, 98.5],
  [25.5, 121.5],
]

/**
 * Đa giác vùng nước khơi Biển Đông (cách bờ biển đất liền Việt Nam, đảo Lý Sơn, Phú Quý, Côn Đảo,
 * đảo Hải Nam và quần đảo Philippines tối thiểu 90–120 km ngoài khơi).
 * Dùng để che phủ liền mạch nhãn chữ nước ngoài in sẵn trong ảnh raster quốc tế
 * (`南海 ... South China Sea`, `Paracel`, `Spratly`) mà không chạm vào bất kỳ đường bờ biển nào.
 */
const EAST_SEA_OFFSHORE_MASK: LeafletTypes.LatLngTuple[] = [
  [17.85, 110.65],
  [17.85, 114.5],
  [17.75, 117.85],
  [15.2, 118.25],
  [12.3, 118.0],
  [10.2, 116.85],
  [8.2, 115.6],
  [6.55, 113.2],
  [6.55, 109.2],
  [8.3, 108.95],
  [10.2, 109.85],
  [12.6, 110.35],
  [14.8, 110.25],
  [16.4, 110.15],
]

interface SovereignIslandPoint {
  name: string
  archipelago: "hoangsa" | "truongsa"
  lat: number
  lng: number
}

/** Tọa độ địa lý thực tế các đảo tiêu biểu thuộc Quần đảo Hoàng Sa & Quần đảo Trường Sa của Việt Nam */
const SOVEREIGN_ISLANDS: readonly SovereignIslandPoint[] = [
  // Quần đảo Hoàng Sa (Huyện Hoàng Sa, TP. Đà Nẵng)
  { name: "Đảo Hoàng Sa", archipelago: "hoangsa", lat: 16.5344, lng: 111.6064 },
  { name: "Đảo Phú Lâm", archipelago: "hoangsa", lat: 16.8353, lng: 112.3386 },
  { name: "Đảo Linh Côn", archipelago: "hoangsa", lat: 16.6681, lng: 112.7283 },
  { name: "Đảo Tri Tôn", archipelago: "hoangsa", lat: 15.785, lng: 111.2033 },
  { name: "Đảo Cây", archipelago: "hoangsa", lat: 16.98, lng: 112.2719 },
  { name: "Đảo Bạch Quy", archipelago: "hoangsa", lat: 16.0583, lng: 111.7667 },

  // Quần đảo Trường Sa (Huyện Trường Sa, Tỉnh Khánh Hòa)
  { name: "Đảo Trường Sa Lớn", archipelago: "truongsa", lat: 8.6442, lng: 111.9203 },
  { name: "Đảo Song Tử Tây", archipelago: "truongsa", lat: 11.4292, lng: 114.3322 },
  { name: "Đảo Sinh Tồn", archipelago: "truongsa", lat: 9.8864, lng: 114.3314 },
  { name: "Đảo Nam Yết", archipelago: "truongsa", lat: 10.1794, lng: 114.365 },
  { name: "Đảo Sơn Ca", archipelago: "truongsa", lat: 10.3769, lng: 114.4794 },
  { name: "Đảo Phan Vinh", archipelago: "truongsa", lat: 8.9756, lng: 113.7089 },
  { name: "Đảo An Bang", archipelago: "truongsa", lat: 7.8911, lng: 112.9211 },
  { name: "Đá Tây", archipelago: "truongsa", lat: 8.8583, lng: 112.2533 },
]

/**
 * Gắn lớp bảo vệ chủ quyền biển đảo Việt Nam lên mọi thực thể bản đồ Leaflet của EcoLink:
 * 1. Khoá mức thu nhỏ tối thiểu (`minZoom: 5`) và biên giới hạn lãnh thổ - lãnh hải Việt Nam.
 * 2. Phủ lớp nền đồng màu nước biển CARTO Voyager (`#CBE1E4`) lên vùng khơi để triệt tiêu nhãn
 *    `南海 ... South China Sea` in cứng trong ảnh tile quốc tế mà không ảnh hưởng đất liền.
 * 3. Hiển thị chuẩn mực danh xưng **BIỂN ĐÔNG (East Sea)**, **Quần đảo Hoàng Sa (TP. Đà Nẵng, Việt Nam)**
 *    và **Quần đảo Trường Sa (Tỉnh Khánh Hòa, Việt Nam)** theo từng cấp phóng bản đồ.
 */
export function attachVietnamSovereigntyOverlay(
  L: typeof LeafletTypes,
  map: LeafletTypes.Map,
  usesCartoTiles: boolean,
): () => void {
  map.setMinZoom(5)
  map.setMaxBounds(VIETNAM_MAP_BOUNDS)
  map.options.maxBoundsViscosity = 0.85

  const maskPaneName = "ecolinkSovereigntyMaskPane"
  if (!map.getPane(maskPaneName)) {
    const maskPane = map.createPane(maskPaneName)
    maskPane.style.zIndex = "240"
    maskPane.style.pointerEvents = "none"
  }

  const labelPaneName = "ecolinkSovereigntyLabelPane"
  if (!map.getPane(labelPaneName)) {
    const labelPane = map.createPane(labelPaneName)
    labelPane.style.zIndex = "320"
    labelPane.style.pointerEvents = "none"
  }

  const seaColor = usesCartoTiles ? CARTO_VOYAGER_SEA_HEX : OSM_STANDARD_SEA_HEX

  // 1. Lớp phủ đồng màu nước biển khơi xoá nhãn tranh chấp trên tile quốc tế
  const seaMask = L.polygon(EAST_SEA_OFFSHORE_MASK, {
    pane: maskPaneName,
    stroke: false,
    fill: true,
    fillColor: seaColor,
    fillOpacity: 1,
    interactive: false,
  }).addTo(map)

  const dynamicLabelsGroup = L.layerGroup().addTo(map)

  const renderByZoom = () => {
    const zoom = map.getZoom()
    dynamicLabelsGroup.clearLayers()

    // Vẽ chấm san hô / điểm đảo thực tế của Hoàng Sa & Trường Sa
    const dotRadius = zoom >= 9 ? 3.5 : zoom >= 7 ? 2.5 : 1.8
    for (const island of SOVEREIGN_ISLANDS) {
      L.circleMarker([island.lat, island.lng], {
        pane: labelPaneName,
        radius: dotRadius,
        color: "#6b8e97",
        weight: 1,
        fillColor: "#f2efe9",
        fillOpacity: 0.95,
        interactive: false,
      }).addTo(dynamicLabelsGroup)

      // Khi phóng gần (zoom >= 9), hiển thị thêm tên từng đảo Việt Nam
      if (zoom >= 9) {
        const islandIcon = L.divIcon({
          className: "ecolink-leaflet-div-icon",
          iconSize: [0, 0],
          iconAnchor: [-6, 8],
          html: `<div style="pointer-events:none;white-space:nowrap;font-size:10.5px;font-weight:600;color:#446169;text-shadow:0 0 3px ${seaColor},0 0 3px #ffffff;">${island.name}</div>`,
        })
        L.marker([island.lat, island.lng], {
          pane: labelPaneName,
          icon: islandIcon,
          interactive: false,
          keyboard: false,
        }).addTo(dynamicLabelsGroup)
      }
    }

    // Nhãn đại dương BIỂN ĐÔNG (East Sea) hiển thị từ zoom 5..10
    if (zoom <= 10) {
      const seaFontSize = zoom <= 5 ? 12 : zoom <= 6 ? 14 : zoom <= 8 ? 16 : 18
      const subFontSize = Math.max(9.5, seaFontSize - 3.5)
      const eastSeaIcon = L.divIcon({
        className: "ecolink-leaflet-div-icon",
        iconSize: [0, 0],
        html: `
          <div style="transform:translate(-50%,-50%);pointer-events:none;text-align:center;user-select:none;">
            <div style="font-size:${seaFontSize}px;font-weight:700;font-style:italic;letter-spacing:0.18em;color:#4d7c8a;text-shadow:0 0 4px ${seaColor},0 0 8px ${seaColor};white-space:nowrap;">
              BIỂN ĐÔNG
            </div>
            <div style="margin-top:1px;font-size:${subFontSize}px;font-weight:500;font-style:italic;letter-spacing:0.08em;color:#5f8b98;text-shadow:0 0 4px ${seaColor};white-space:nowrap;">
              East Sea
            </div>
          </div>
        `,
      })
      L.marker([14.05, 113.45], {
        pane: labelPaneName,
        icon: eastSeaIcon,
        interactive: false,
        keyboard: false,
      }).addTo(dynamicLabelsGroup)
    }

    // Nhãn chủ quyền Quần đảo Hoàng Sa & Quần đảo Trường Sa (zoom 5..13)
    if (zoom <= 13) {
      const archFontSize = zoom <= 5 ? 10 : zoom <= 7 ? 11.5 : 12.5
      const archSubSize = Math.max(8.5, archFontSize - 2)

      const buildArchipelagoIcon = (title: string, subtitle: string) =>
        L.divIcon({
          className: "ecolink-leaflet-div-icon",
          iconSize: [0, 0],
          html: `
            <div style="transform:translate(-50%,-50%);pointer-events:none;text-align:center;user-select:none;">
              <div style="font-size:${archFontSize}px;font-weight:700;letter-spacing:0.03em;color:#395861;text-shadow:0 0 3px #ffffff,0 0 5px ${seaColor};white-space:nowrap;">
                ${title}
              </div>
              <div style="font-size:${archSubSize}px;font-weight:600;color:#4e727c;text-shadow:0 0 3px #ffffff,0 0 4px ${seaColor};white-space:nowrap;">
                ${subtitle}
              </div>
            </div>
          `,
        })

      L.marker([16.38, 111.95], {
        pane: labelPaneName,
        icon: buildArchipelagoIcon("Quần đảo Hoàng Sa", "(TP. Đà Nẵng, Việt Nam)"),
        interactive: false,
        keyboard: false,
      }).addTo(dynamicLabelsGroup)

      L.marker([9.55, 113.65], {
        pane: labelPaneName,
        icon: buildArchipelagoIcon("Quần đảo Trường Sa", "(Tỉnh Khánh Hòa, Việt Nam)"),
        interactive: false,
        keyboard: false,
      }).addTo(dynamicLabelsGroup)
    }
  }

  renderByZoom()
  map.on("zoomend", renderByZoom)

  return () => {
    map.off("zoomend", renderByZoom)
    dynamicLabelsGroup.clearLayers()
    dynamicLabelsGroup.remove()
    seaMask.remove()
  }
}

