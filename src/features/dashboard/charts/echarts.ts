// Only the ECharts pieces we use, to keep the download small.
import * as echarts from 'echarts/core';
import { BarChart, GaugeChart, LineChart, PieChart, RadarChart } from 'echarts/charts';
import { GridComponent, LegendComponent, MarkLineComponent, RadarComponent, TooltipComponent } from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';

echarts.use([BarChart, GaugeChart, LineChart, PieChart, RadarChart, GridComponent, LegendComponent, MarkLineComponent, RadarComponent, TooltipComponent, SVGRenderer]);

export { echarts };
