import React, { FC, useEffect, useState, useRef } from 'react'
import * as d3 from 'd3'
import * as topojson from 'topojson'
import  { Topology } from 'topojson-specification'
import { Feature } from 'geojson'
import { EnterElement } from 'd3'

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
  const svg = useRef<SVGSVGElement>(null)
  useEffect(() => {
     (async () => {
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
    if (svg.current) {
      console.log('didupdate')
      const svgElem = d3.select<SVGSVGElement, Feature[]>(svg.current)
      console.log(`svgElem: ${typeof svgElem}`)
      draw(svgElem)
    }
  })

  const getProjection = (): d3.GeoProjection => {
    let width = 0
    let height = 0
    if (svg.current) {
      width = svg.current.clientWidth
      height = svg.current.clientHeight
    }
    return d3.geoOrthographic()
      .scale(300)
      .translate([width / 2, height / 2])
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
    const features: Feature[] = (feature.type === "FeatureCollection") ?
      feature.features : [feature]

    const g = svg.append('g')
    const item = g.selectAll('.item')
      .data(features)

    item.join('path')
      .attr('class', 'shape item')
      .attr('d', pathGenerator)
      .style('fill', 'black')
      .style('stroke', () => "white")
      .style('stroke-width', () => 0.1)

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
      <svg style={styles.svg} ref={svg} />
    </div>

  )
}


export default MapSample
