import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, PieChart, LineChart } from "@/components/ui/charts";
import { formatCurrency } from "@/lib/utils";
import { Helmet } from "react-helmet";
import { CITY_AREAS, PRICE_RANGES, SIZE_RANGES } from "@/lib/constants";
import { MarketAnalytics } from "@/types";
import HeatMap from "@/components/maps/HeatMap";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Target } from "lucide-react";

export default function AnalyticsPage() {
  const [period, setPeriod] = useState("month");
  const [area, setArea] = useState("all");
  
  // Fetch analytics data
  const { data: analytics, isLoading, isError } = useQuery({
    queryKey: ['/api/analytics', period, area],
    queryFn: async () => {
      // This would be a real API call
      const response = await fetch(`/api/analytics?period=${period}&area=${area}`);
      if (!response.ok) {
        throw new Error('Failed to fetch analytics data');
      }
      return await response.json();
    }
  });
  
  // Sample data for bar chart - price ranges
  const priceRangeData = [
    { name: "€100k - €200k", value: 15 },
    { name: "€200k - €300k", value: 45 },
    { name: "€300k - €400k", value: 28 },
    { name: "€400k - €500k", value: 8 },
    { name: "€500k+", value: 4 }
  ];
  
  // Sample data for pie chart - area distribution
  const areaDistributionData = [
    { name: "Centro", value: 42 },
    { name: "Nord", value: 52 },
    { name: "Est", value: 28 },
    { name: "Sud", value: 70 },
    { name: "Ovest", value: 25 }
  ];
  
  // Sample data for line chart - trends
  const trendData = [
    { name: "Gen", prezzi: 300000, domanda: 65 },
    { name: "Feb", prezzi: 310000, domanda: 60 },
    { name: "Mar", prezzi: 305000, domanda: 58 },
    { name: "Apr", prezzi: 320000, domanda: 70 },
    { name: "Mag", prezzi: 325000, domanda: 75 },
    { name: "Giu", prezzi: 330000, domanda: 72 }
  ];
  
  // Size distribution data
  const sizeDistributionData = [
    { name: "≤ 50m²", value: 10 },
    { name: "50-80m²", value: 35 },
    { name: "80-120m²", value: 40 },
    { name: "120-180m²", value: 10 },
    { name: "≥ 180m²", value: 5 }
  ];
  
  // Sample KPI data
  const kpiData = {
    averagePrice: 320000,
    averagePriceChange: 5.2,
    averageSize: 95,
    averageSizeChange: -2.1,
    totalProperties: 132,
    totalPropertiesChange: 8.4,
    averageDaysOnMarket: 45,
    averageDaysOnMarketChange: -12.5
  };
  
  return (
    <>
      <Helmet>
        <title>Analisi di Mercato | RealEstate CRM</title>
        <meta name="description" content="Visualizza e analizza i dati del mercato immobiliare con grafici e statistiche dettagliate." />
      </Helmet>
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-gray-900">Analisi di Mercato</h1>
          <p className="mt-1 text-sm text-gray-600">
            Esplora i trend e le statistiche del mercato immobiliare
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex flex-col sm:flex-row gap-3">
          <Link href="/analytics/search-heatmap">
            <Button variant="outline" className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Mappa Ricerche
            </Button>
          </Link>
          <Link href="/analytics/demand-analysis">
            <Button variant="outline" className="flex items-center gap-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white border-0 hover:from-purple-600 hover:to-blue-600">
              <Target className="h-4 w-4" />
              Analisi AI
            </Button>
          </Link>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Periodo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Ultimo mese</SelectItem>
              <SelectItem value="quarter">Ultimo trimestre</SelectItem>
              <SelectItem value="year">Ultimo anno</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={area} onValueChange={setArea}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Area" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutte le aree</SelectItem>
              {CITY_AREAS.map((area) => (
                <SelectItem key={area} value={area.toLowerCase()}>
                  {area}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {isLoading ? (
          Array(4).fill(null).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24 mb-1" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-28 mb-1" />
                <Skeleton className="h-4 w-16" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">Prezzo Medio</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(kpiData.averagePrice)}
                </div>
                <p className={`text-xs flex items-center ${kpiData.averagePriceChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  <span className="mr-1">{kpiData.averagePriceChange >= 0 ? '↑' : '↓'}</span>
                  {Math.abs(kpiData.averagePriceChange)}% rispetto al periodo precedente
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">Metratura Media</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {kpiData.averageSize} m²
                </div>
                <p className={`text-xs flex items-center ${kpiData.averageSizeChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  <span className="mr-1">{kpiData.averageSizeChange >= 0 ? '↑' : '↓'}</span>
                  {Math.abs(kpiData.averageSizeChange)}% rispetto al periodo precedente
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">Immobili Totali</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {kpiData.totalProperties}
                </div>
                <p className={`text-xs flex items-center ${kpiData.totalPropertiesChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  <span className="mr-1">{kpiData.totalPropertiesChange >= 0 ? '↑' : '↓'}</span>
                  {Math.abs(kpiData.totalPropertiesChange)}% rispetto al periodo precedente
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">Tempo Medio sul Mercato</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {kpiData.averageDaysOnMarket} giorni
                </div>
                <p className={`text-xs flex items-center ${kpiData.averageDaysOnMarketChange <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  <span className="mr-1">{kpiData.averageDaysOnMarketChange <= 0 ? '↓' : '↑'}</span>
                  {Math.abs(kpiData.averageDaysOnMarketChange)}% rispetto al periodo precedente
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>
      
      {/* Charts - First Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Price Range Distribution */}
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Distribuzione Fasce di Prezzo</CardTitle>
            <CardDescription>
              Percentuale di richieste per fascia di prezzo
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-80 w-full" />
            ) : (
              <div className="h-80">
                <BarChart
                  data={priceRangeData}
                  index="name"
                  categories={["value"]}
                  colors={["#3b82f6"]}
                  valueFormatter={(value) => `${value}%`}
                  yAxisWidth={48}
                />
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Area Distribution */}
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Richieste per Zona</CardTitle>
            <CardDescription>
              Distribuzione delle richieste per area geografica
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-80 w-full" />
            ) : (
              <div className="h-80">
                <PieChart
                  data={areaDistributionData}
                  index="name"
                  category="value"
                  valueFormatter={(value) => `${value}%`}
                  colors={["#3b82f6", "#2563eb", "#1d4ed8", "#1e40af", "#1e3a8a"]}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* Charts - Second Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Price and Demand Trends */}
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Trend Prezzi e Domanda</CardTitle>
            <CardDescription>
              Andamento dei prezzi medi e della domanda nel tempo
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-80 w-full" />
            ) : (
              <div className="h-80">
                <LineChart
                  data={trendData}
                  index="name"
                  categories={["prezzi", "domanda"]}
                  colors={["#3b82f6", "#f59e0b"]}
                  valueFormatter={(value, category) => 
                    category === "prezzi" 
                      ? formatCurrency(value) 
                      : `${value}/100`
                  }
                  yAxisWidth={80}
                />
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Size Distribution */}
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Distribuzione per Metratura</CardTitle>
            <CardDescription>
              Percentuale di richieste per fascia di metratura
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-80 w-full" />
            ) : (
              <div className="h-80">
                <BarChart
                  data={sizeDistributionData}
                  index="name"
                  categories={["value"]}
                  colors={["#10b981"]}
                  valueFormatter={(value) => `${value}%`}
                  yAxisWidth={48}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* Map Heatmap */}
      <div className="mb-6">
        {isLoading ? (
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[450px] w-full" />
            </CardContent>
          </Card>
        ) : (
          <HeatMap 
            // Campione di dati per la mappa di calore - normalmente verrebbero dai dati reali
            data={[]}
          />
        )}
      </div>
      
      {/* Market Insights Panel */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Suggerimenti di Mercato</CardTitle>
          <CardDescription>
            In base all'analisi delle ricerche, ecco i tipi di immobili più richiesti
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium mb-2">Target di acquisizione suggeriti:</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="font-medium text-blue-800 mb-1">Alta priorità</div>
                    <p className="text-blue-700">
                      Cerca in <strong>Zona Sud</strong> appartamenti da <strong>80-120 m²</strong> tra <strong>€200k-€300k</strong>.
                      Questa combinazione ha la domanda più alta.
                    </p>
                  </div>
                  
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="font-medium text-amber-800 mb-1">Media priorità</div>
                    <p className="text-amber-700">
                      Cerca in <strong>Zona Nord</strong> appartamenti da <strong>50-80 m²</strong> tra <strong>€150k-€250k</strong>.
                      Buona domanda, mercato più competitivo.
                    </p>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-medium mb-2">Analisi opportunità:</h3>
                <ul className="list-disc pl-5 space-y-2 text-gray-700">
                  <li>
                    <strong>Gap di mercato:</strong> Poca offerta di immobili da 80-120 m² in Zona Sud nonostante l'alta domanda.
                  </li>
                  <li>
                    <strong>Trend in crescita:</strong> La domanda per appartamenti di medie dimensioni (50-80 m²) è aumentata del 15% negli ultimi 3 mesi.
                  </li>
                  <li>
                    <strong>Suggerimento prezzi:</strong> Gli immobili nella fascia €200k-€300k vengono venduti mediamente in 30 giorni, 15 giorni più velocemente della media.
                  </li>
                </ul>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
