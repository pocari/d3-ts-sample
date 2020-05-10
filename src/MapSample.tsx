import React, { FC, useEffect, useState, useRef } from 'react'
import * as d3 from 'd3'
import * as topojson from 'topojson'
import  { Topology } from 'topojson-specification'
import { Feature } from 'geojson'
import { GeoSphere, GeoPermissibleObjects, SubjectPosition } from 'd3'

const LOADING = 'Loading' as const
const SUCCESS = 'Success' as const
const FAILURE = 'Failure' as const
type Status = typeof LOADING | typeof SUCCESS | typeof FAILURE

const styles = {
  svg: {
    width: '100vw',
    height: '100vw'
  }
}

interface MapSampleProps {
  url: string;
  objectsname: string
}

const MapSample: FC<MapSampleProps> = ({
  url,
  objectsname,
}) => {
  const [ topology, setTopology] = useState<Topology | null>(null)
  const [ status, setStatus ] = useState<Status>(LOADING)
  const svgRef = useRef<SVGSVGElement>(null)
  useEffect(() => { (async () => {
       console.log("load json")
       try {
         setStatus(LOADING)
         setTopology(await d3.json<Topology>(url))
         console.log("load json success")
         setStatus(SUCCESS)
       } catch (e) {
         console.log("load json failed")
         setStatus(FAILURE)
       }
     })()
  }, [setStatus, setTopology, url])

  useEffect(() => {
    if (svgRef.current) {
      console.log('didupdate')
      const svgElem = d3.select<SVGSVGElement, Feature[]>(svgRef.current)
      console.log(`svgElem: ${typeof svgElem}`)
      draw(svgElem)
    }
  })

  const getProjection = (): d3.GeoProjection => {
    let width = 0
    let height = 0
    if (svgRef.current) {
      width = svgRef.current.clientWidth
      height = svgRef.current.clientHeight
    }
    return d3.geoOrthographic()
      .scale(300)
      .translate([width / 2, height / 2])
  }

  const barChart = (
    svg: d3.Selection<SVGSVGElement, Feature[], null, undefined>,
    features: Feature[]
  ) => {
    let width = 0
    let height = 0

    if (svgRef.current) {
      width = svgRef.current.clientWidth
      height = svgRef.current.clientHeight
    }
    const barHeight = height / 2

    const x = d3.scaleBand().rangeRound([0, width]).padding(0.1)
    const y = d3.scaleSqrt().range([height, barHeight])

    const sortedFeature = features
      .sort((a, b) => {
        return (a.properties && b.properties &&
          +a.properties.GDP_MD_EST <= b.properties.GDP_MD_EST) ? 1 : -1
      })

    x.domain(sortedFeature.map(d => {
      return d.properties ? d.properties.NAME : null
    }))

    const max = d3.max(sortedFeature, f => f.properties ? +f.properties.GDP_MD_EST : 0)
    y.domain([0, max || 0])

    let yAxis = d3.axisLeft(y)
      .scale(y)
      .ticks(10)
    const barArea = svg.append('g')
      .attr('transform', "translate(100, -10)")

    barArea.append('g')
      .attr('class', 'y axis')
      .attr('transform', 'translate(50, 0)')
      .call(yAxis)
      .append("text")
      .attr('transform', 'rotate(-90)')
      .attr("y", 6)
      .attr('dy', '.71em')
      .style('text-anchor', 'end')
      .text('Value ($)')

    const bar = barArea.selectAll('.bar')
      .data(sortedFeature)

    bar.join('rect')
      .attr('class', 'bar')
      .attr('fill', 'steelblue')
      .attr('x', d => d.properties ? (x(d.properties.NAME) || null) : null)
      .attr('y', d => d.properties ? (y(d.properties.GDP_MD_EST) || null) : null)
      .attr('width', x.bandwidth())
      .attr('height', d => {
        return height - ((d.properties) ? y(+d.properties.GDP_MD_EST) : barHeight)
      })


  }

  const draw = (svg: d3.Selection<SVGSVGElement, Feature[], null, undefined>) => {
    console.log("draw start")
    if (status !== SUCCESS) {
      return
    }
    const mapData = topology
    if (!mapData) return

    const projection = getProjection()
    const pathGenerator = d3.geoPath()
      .projection(projection)

    console.log('objectsname')
    console.log(objectsname)
    console.log('mapData.objects[objectsname]')
    console.log(mapData.objects)

    console.log("-------- keys")
    for (let key in mapData.objects) {
      console.log(key)
    }

    const feature = topojson
      .feature(mapData, mapData.objects[objectsname])
    console.log("feature.type")
    console.log(feature.type)
    const features: Feature[] = (feature.type === "FeatureCollection") ?
      feature.features : [feature]

    const g = svg.append('g')
    // 海描画
    const sphere: GeoSphere[] = [{type: "Sphere"}]
    const sea = g.selectAll('.sea')
      .data(sphere)
    sea.join('path')
      .attr('class', 'shape sea')
      .attr('d', pathGenerator)
      .style('fill', 'blue')
      .style('fill-opacity', 0.2)

    // 海の上に陸地描画
    // 各国の人口を元に色をつける

    // 人口の最大値、最小値を取得
    const [popMin, popMax] = d3.extent(features, (f) => {
      return (f.properties) ? +f.properties.POP_EST : undefined
    });
    console.log("min, max")
    console.log([popMin, popMax])

    // インドや中国みたいに極端に実行がおおいと、人口が少ないところに
    // 差をつけずらくなるので、scaleLinearとかじゃなくて、多いほど増え方が少なくなるscaleSqrtで
    const popScale = (popMin && popMax) ?
      d3.scaleSqrt().domain([popMin, popMax]).range([0, 1])
      : undefined

    const getCountryColor = (
      d: Feature,
      scale?: d3.ScaleContinuousNumeric<number, number>
    ) => {
      return (d.properties && scale)
        ? d3.interpolateReds(scale(+d.properties.POP_EST))
        : "gray"
    }
    const item = g.selectAll('.item')
      .data(features)
    item.join('path')
      .attr('class', 'shape item')
      .attr('d', pathGenerator)
      .style('fill', d => getCountryColor(d, popScale))
      .style('stroke', () => "white")
      .style('stroke-width', () => 0.1)

    // 回転(drag)イベント
    // dragイベントを先に登録しないと zoom 側が優先されて drag が効かなくなる
    const onDraged = (
      projection: d3.GeoProjection,
      pathGenerator: d3.GeoPath<SVGPathElement, GeoPermissibleObjects>
    ) => {
      const rotate = projection.rotate()
      projection.rotate([
        d3.event.x,
        -d3.event.y,
        rotate[2],
      ])
      if (!svgRef.current) {
        return
      }
      const svg = d3.select<SVGSVGElement, Feature>(svgRef.current)
      svg.selectAll<SVGPathElement, GeoPermissibleObjects>('path')
        .attr("d", pathGenerator)
    }

    const drag = d3.drag<SVGSVGElement, Feature[], SubjectPosition>()
      .subject(() => {
        // ここでevent開始時の初期値設定しているらしい。
        // onDragStart とかの個別のeventを書かなくても良くなる
        const rotate = projection.rotate()
        return {
          x: rotate[0],
          y: -rotate[1],
        }
      })
      .on('drag', () =>  onDraged(projection, pathGenerator))
    svg.call(drag)

    // ズームイベント
    const onZoomed = () => {
      if (!svgRef.current) {
        return
      }
      d3.select<SVGSVGElement, Feature>(svgRef.current)
        .selectAll('.shape')
        .attr('transform', d3.event.transform)
    }

    const zoom = d3.zoom<SVGSVGElement, Feature[]>()
      .scaleExtent([1, 24])
      .on('zoom', onZoomed)
    svg.call(zoom)


    // 東京 - ロンドン間を線で結ぶ
    const tokyo:[number, number] = [139.7494, 35.6869];
    const london:[number, number] = [0.1278, 51.5074];

    const lines: GeoJSON.LineString[] = [
      {
        'type': 'LineString',
        'coordinates': [
          tokyo,
          london,
        ]
      }
    ];
    const line = g.selectAll('.line')
      .data(lines)
    line.join('path')
      .attr('class', 'shape line')
      .attr('fill', 'none')
      .attr('stroke', 'red')
      .attr('stroke-width', 5)

    const points: GeoJSON.Point[] = [
      {'type': 'Point', 'coordinates': tokyo},
      {'type': 'Point', 'coordinates': london},
    ]
    const point = g.selectAll('.point')
      .data(points)
    point.join('path')
      .attr('class', 'shape point')
      .attr("d", pathGenerator.pointRadius(10))
      .style('fill', 'red')


    // 人口の棒グラフを描画
    barChart(svg, features)

    console.log("draw end")
  }

  if (status === LOADING) {
    return <div>Loading ... </div>
  }

  if (status === FAILURE) {
    return <div>load json failed </div>
  }

  return (
    <div>
      <div>{url}</div>
      <div>{objectsname}</div>
      <svg style={styles.svg} ref={svgRef} />
    </div>
  )
}


export default MapSample
