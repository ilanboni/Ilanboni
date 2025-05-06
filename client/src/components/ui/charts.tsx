import React from "react";
import {
  Bar,
  Pie,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  LineChart as RechartsLineChart,
  BarChart as RechartsBarChart,
  PieChart as RechartsPieChart
} from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "./chart";

export interface BarChartProps {
  data: any[];
  index: string;
  categories: string[];
  colors: string[];
  valueFormatter?: (value: number) => string;
  yAxisWidth?: number;
}

export interface PieChartProps {
  data: any[];
  index: string;
  category: string;
  colors: string[];
  valueFormatter?: (value: number) => string;
}

export interface LineChartProps {
  data: any[];
  index: string;
  categories: string[];
  colors: string[];
  valueFormatter?: (value: number, category?: string) => string;
  yAxisWidth?: number;
}

export const BarChart: React.FC<BarChartProps> = ({
  data,
  index,
  categories,
  colors,
  valueFormatter = (value) => String(value),
  yAxisWidth = 40
}) => {
  return (
    <ChartContainer 
      config={{}}
      className="w-full h-full"
    >
      <RechartsBarChart data={data} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
        <XAxis type="number" />
        <YAxis 
          dataKey={index} 
          type="category" 
          width={yAxisWidth} 
          tick={{ fontSize: 12 }}
        />
        <ChartTooltip
          content={({ active, payload }) => {
            if (!active || !payload || payload.length === 0) return null;
            return (
              <div className="rounded-lg border bg-background p-2 shadow-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-foreground">
                      {payload[0].payload[index]}
                    </span>
                  </div>
                  {payload.map((entry, index) => (
                    <div key={`item-${index}`} className="flex flex-col">
                      <span className="text-sm text-muted-foreground">
                        {entry.dataKey}
                      </span>
                      <span className="font-medium text-foreground">
                        {valueFormatter(entry.value as number)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          }}
        />
        <Legend />
        {categories.map((category, i) => (
          <Bar 
            key={category} 
            dataKey={category} 
            fill={colors[i % colors.length]} 
            radius={[0, 4, 4, 0]}
          />
        ))}
      </RechartsBarChart>
    </ChartContainer>
  );
};

export const PieChart: React.FC<PieChartProps> = ({
  data,
  index,
  category,
  colors,
  valueFormatter = (value) => String(value)
}) => {
  return (
    <ChartContainer 
      config={{}}
      className="w-full h-full"
    >
      <RechartsPieChart>
        <Pie
          data={data}
          nameKey={index}
          dataKey={category}
          cx="50%"
          cy="50%"
          outerRadius={80}
          fill="#8884d8"
          label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
          ))}
        </Pie>
        <ChartTooltip
          content={({ active, payload }) => {
            if (!active || !payload || payload.length === 0) return null;
            const data = payload[0].payload;
            return (
              <div className="rounded-lg border bg-background p-2 shadow-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-foreground">
                      {data[index]}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm text-muted-foreground">
                      Valore
                    </span>
                    <span className="font-medium text-foreground">
                      {valueFormatter(data[category] as number)}
                    </span>
                  </div>
                </div>
              </div>
            );
          }}
        />
        <Legend />
      </RechartsPieChart>
    </ChartContainer>
  );
};

export const LineChart: React.FC<LineChartProps> = ({
  data,
  index,
  categories,
  colors,
  valueFormatter = (value) => String(value),
  yAxisWidth = 40
}) => {
  return (
    <ChartContainer 
      config={{}}
      className="w-full h-full"
    >
      <RechartsLineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey={index} />
        <YAxis width={yAxisWidth} />
        <ChartTooltip
          content={({ active, payload }) => {
            if (!active || !payload || payload.length === 0) return null;
            return (
              <div className="rounded-lg border bg-background p-2 shadow-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-foreground">
                      {payload[0].payload[index]}
                    </span>
                  </div>
                  {payload.map((entry, index) => (
                    <div key={`item-${index}`} className="flex flex-col">
                      <span className="text-sm text-muted-foreground">
                        {entry.dataKey}
                      </span>
                      <span className="font-medium text-foreground">
                        {valueFormatter(entry.value as number, entry.dataKey as string)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          }}
        />
        <Legend />
        {categories.map((category, i) => (
          <Line 
            key={category} 
            type="monotone" 
            dataKey={category} 
            stroke={colors[i % colors.length]} 
            activeDot={{ r: 8 }} 
          />
        ))}
      </RechartsLineChart>
    </ChartContainer>
  );
};