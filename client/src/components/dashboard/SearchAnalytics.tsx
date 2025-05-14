import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { CardContent } from "@/components/ui/card";
import { CardHeader } from "@/components/ui/card";
import { CardTitle } from "@/components/ui/card";
import { CardDescription } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { TabsContent } from "@/components/ui/tabs";
import { TabsList } from "@/components/ui/tabs";
import { TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { AlertCircle } from "lucide-react";

interface SearchAnalyticsData {
  zones: {
    name: string;
    count: number;
    percentage: number;
  }[];
  priceRanges: {
    range: string;
    count: number;
    percentage: number;
  }[];
  sizeRanges: {
    range: string;
    count: number;
    percentage: number;
  }[];
}

export default function SearchAnalytics() {
  // Fetch ricerche più popolari
  const { 
    data: analyticsData, 
    isLoading, 
    error 
  } = useQuery({
    queryKey: ['/api/analytics/searches'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/analytics/searches');
        if (!response.ok) {
          throw new Error("Errore nel caricamento delle statistiche di ricerca");
        }
        return response.json() as Promise<SearchAnalyticsData>;
      } catch (error) {
        console.error("Errore nel caricamento delle statistiche:", error);
        throw error;
      }
    }
  });

  if (isLoading) {
    return <SearchAnalyticsSkeleton />;
  }

  if (error || !analyticsData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Classifiche Ricerche</CardTitle>
          <CardDescription>Analisi delle ricerche più popolari</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center text-red-600">
            <AlertCircle className="h-5 w-5 mr-2" />
            <span>Si è verificato un errore nel caricamento delle statistiche di ricerca.</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Colori per i grafici a barre
  const zoneColors = ["#4f46e5", "#6366f1", "#818cf8", "#a5b4fc", "#c7d2fe"];
  const priceColors = ["#0891b2", "#06b6d4", "#22d3ee", "#67e8f9", "#a5f3fc"];
  const sizeColors = ["#0d9488", "#14b8a6", "#2dd4bf", "#5eead4", "#99f6e4"];

  // Formattare i dati per i grafici
  const zoneData = analyticsData.zones.slice(0, 5);
  const priceData = analyticsData.priceRanges.slice(0, 5);
  const sizeData = analyticsData.sizeRanges.slice(0, 5);

  // Tooltip personalizzato per i grafici
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-2 border rounded shadow-sm text-xs">
          <p className="font-medium">{label}</p>
          <p>{`${payload[0].value} ricerche (${payload[0].payload.percentage}%)`}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Classifiche Ricerche</CardTitle>
        <CardDescription>Analisi delle ricerche più popolari</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="zones">
          <TabsList className="mb-4 w-full">
            <TabsTrigger value="zones" className="flex-1">
              Zone
            </TabsTrigger>
            <TabsTrigger value="prices" className="flex-1">
              Prezzi
            </TabsTrigger>
            <TabsTrigger value="sizes" className="flex-1">
              Metri quadri
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="zones">
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={zoneData}
                  margin={{
                    top: 5,
                    right: 30,
                    left: 70,
                    bottom: 5,
                  }}
                >
                  <XAxis type="number" hide />
                  <YAxis 
                    type="category" 
                    dataKey="name" 
                    tick={{ fontSize: 12 }} 
                    width={65} 
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar 
                    dataKey="count" 
                    radius={[0, 4, 4, 0]} 
                    barSize={24}
                  >
                    {zoneData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={zoneColors[index % zoneColors.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4">
              <h4 className="text-sm font-medium mb-2">Le zone più ricercate:</h4>
              <ul className="space-y-1 text-sm">
                {zoneData.map((zone, index) => (
                  <li key={index} className="flex justify-between">
                    <span className="flex items-center">
                      <span 
                        className="inline-block h-3 w-3 rounded-full mr-2" 
                        style={{ backgroundColor: zoneColors[index % zoneColors.length] }}
                      ></span>
                      {zone.name}
                      {index === 0 && (
                        <span className="ml-2 px-1.5 py-0.5 text-xs bg-amber-100 text-amber-800 rounded-sm">
                          Alta richiesta
                        </span>
                      )}
                    </span>
                    <span className="text-gray-500">{zone.count} ricerche</span>
                  </li>
                ))}
              </ul>
              {zoneData.length > 0 && (
                <div className="mt-4 text-right">
                  <button 
                    className="px-3 py-1 text-xs border rounded hover:bg-slate-50"
                    onClick={() => window.location.href = "/properties/shared/add?zone=" + encodeURIComponent(zoneData[0]?.name || "")}
                  >
                    Cerca proprietà in {zoneData[0]?.name}
                  </button>
                </div>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="prices">
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={priceData}
                  margin={{
                    top: 5,
                    right: 30,
                    left: 70,
                    bottom: 5,
                  }}
                >
                  <XAxis type="number" hide />
                  <YAxis 
                    type="category" 
                    dataKey="range" 
                    tick={{ fontSize: 12 }} 
                    width={65} 
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar 
                    dataKey="count" 
                    radius={[0, 4, 4, 0]} 
                    barSize={24}
                  >
                    {priceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={priceColors[index % priceColors.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4">
              <h4 className="text-sm font-medium mb-2">Le fasce di prezzo più ricercate:</h4>
              <ul className="space-y-1 text-sm">
                {priceData.map((price, index) => (
                  <li key={index} className="flex justify-between">
                    <span className="flex items-center">
                      <span 
                        className="inline-block h-3 w-3 rounded-full mr-2" 
                        style={{ backgroundColor: priceColors[index % priceColors.length] }}
                      ></span>
                      {price.range}
                      {index === 0 && (
                        <span className="ml-2 px-1.5 py-0.5 text-xs bg-amber-100 text-amber-800 rounded-sm">
                          Alta richiesta
                        </span>
                      )}
                    </span>
                    <span className="text-gray-500">{price.count} ricerche</span>
                  </li>
                ))}
              </ul>
            </div>
          </TabsContent>
          
          <TabsContent value="sizes">
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={sizeData}
                  margin={{
                    top: 5,
                    right: 30,
                    left: 70,
                    bottom: 5,
                  }}
                >
                  <XAxis type="number" hide />
                  <YAxis 
                    type="category" 
                    dataKey="range" 
                    tick={{ fontSize: 12 }} 
                    width={65} 
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar 
                    dataKey="count" 
                    radius={[0, 4, 4, 0]} 
                    barSize={24}
                  >
                    {sizeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={sizeColors[index % sizeColors.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4">
              <h4 className="text-sm font-medium mb-2">Le dimensioni più ricercate:</h4>
              <ul className="space-y-1 text-sm">
                {sizeData.map((size, index) => (
                  <li key={index} className="flex justify-between">
                    <span className="flex items-center">
                      <span 
                        className="inline-block h-3 w-3 rounded-full mr-2" 
                        style={{ backgroundColor: sizeColors[index % sizeColors.length] }}
                      ></span>
                      {size.range}
                      {index === 0 && (
                        <span className="ml-2 px-1.5 py-0.5 text-xs bg-amber-100 text-amber-800 rounded-sm">
                          Alta richiesta
                        </span>
                      )}
                    </span>
                    <span className="text-gray-500">{size.count} ricerche</span>
                  </li>
                ))}
              </ul>
              {sizeData.length > 0 && (
                <div className="mt-4 text-right">
                  <button 
                    className="px-3 py-1 text-xs border rounded hover:bg-slate-50"
                    onClick={() => window.location.href = "/properties/shared/add?size=" + encodeURIComponent(sizeData[0]?.range || "")}
                  >
                    Cerca proprietà di {sizeData[0]?.range}
                  </button>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
        
        {/* Statistiche complessive e azioni */}
        <div className="mt-6 pt-4 border-t flex flex-wrap items-center justify-between">
          <div>
            <p className="text-sm font-medium">
              Numero totale di clienti con preferenze: <span className="font-bold">{analyticsData.zones.reduce((sum, zone) => sum + zone.count, 0)}</span>
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Usa queste statistiche per indirizzare la ricerca di nuove proprietà
            </p>
          </div>
          <button
            className="px-4 py-2 text-sm text-white bg-primary rounded hover:bg-primary/90 mt-2 sm:mt-0"
            onClick={() => window.location.href = "/properties/shared/add"}
          >
            Cerca nuove proprietà da condividere
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

function SearchAnalyticsSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Classifiche Ricerche</CardTitle>
        <CardDescription>Analisi delle ricerche più popolari</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex space-x-2 mb-4">
          <Skeleton className="h-10 w-1/3" />
          <Skeleton className="h-10 w-1/3" />
          <Skeleton className="h-10 w-1/3" />
        </div>
        <div className="h-[250px] mb-4">
          <Skeleton className="h-full w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-full" />
        </div>
      </CardContent>
    </Card>
  );
}