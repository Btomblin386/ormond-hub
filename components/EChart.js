"use client";
import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { LineChart, BarChart, PieChart } from "echarts/charts";
import { GridComponent, TooltipComponent, TitleComponent } from "echarts/components";
import { SVGRenderer } from "echarts/renderers";

echarts.use([LineChart, BarChart, PieChart, GridComponent, TooltipComponent, TitleComponent, SVGRenderer]);

// Thin React wrapper: tree-shaken ECharts (SVG renderer), auto-resize.
export default function EChart({ option, height = 110 }) {
  const ref = useRef(null);
  const chart = useRef(null);
  const optJson = JSON.stringify(option);
  useEffect(() => {
    chart.current = echarts.init(ref.current, null, { renderer: "svg" });
    const ro = new ResizeObserver(() => chart.current?.resize());
    ro.observe(ref.current);
    return () => { ro.disconnect(); chart.current?.dispose(); chart.current = null; };
  }, []);
  useEffect(() => { chart.current?.setOption(option, { notMerge: true }); }, [optJson]); // eslint-disable-line react-hooks/exhaustive-deps
  return <div ref={ref} style={{ width: "100%", height }} />;
}
