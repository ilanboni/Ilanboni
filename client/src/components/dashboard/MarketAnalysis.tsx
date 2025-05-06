import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { MarketAnalytics } from "@/types";

export default function MarketAnalysis() {
  // In a real app, we would fetch this data from the API
  // For this prototype, we'll use some sample data
  const { data: analytics, isLoading } = useQuery({
    queryKey: ['/api/analytics/market'],
    queryFn: async () => {
      // This would be replaced with a real API call
      return {
        areaDistribution: [
          { name: "Centro", percentage: 42 },
          { name: "Nord", percentage: 52 },
          { name: "Est", percentage: 28 },
          { name: "Sud", percentage: 70 },
          { name: "Ovest", percentage: 25 }
        ],
        priceRanges: [
          { range: "€100k - €200k", percentage: 15 },
          { range: "€200k - €300k", percentage: 45 },
          { range: "€300k - €400k", percentage: 28 },
          { range: "€400k - €500k", percentage: 8 },
          { range: "€500k+", percentage: 4 }
        ]
      } as MarketAnalytics;
    }
  });

  if (isLoading) {
    return <MarketAnalysisSkeleton />;
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-200">
        <h2 className="font-heading font-semibold text-lg text-gray-800">Analisi di Mercato</h2>
      </div>
      
      <div className="p-5">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Richieste Compratori per Zona</h3>
        <div className="relative h-32">
          <div className="absolute bottom-0 left-0 w-full flex items-end space-x-2 h-28">
            {analytics?.areaDistribution.map((area, index) => (
              <div 
                key={index} 
                className={`w-1/5 bg-primary-${500 - index * 100} rounded-t`} 
                style={{ height: `${area.percentage}%` }} 
                title={`${area.name}: ${area.percentage}%`}
              ></div>
            ))}
          </div>
        </div>
        <div className="flex justify-between mt-1 text-xs text-gray-500">
          {analytics?.areaDistribution.map((area, index) => (
            <span key={index}>{area.name}</span>
          ))}
        </div>
        
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Fasce di Prezzo Richieste</h3>
          <div className="space-y-2">
            {analytics?.priceRanges.map((range, index) => (
              <div key={index}>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600">{range.range}</span>
                  <span className="font-medium text-gray-900">{range.percentage}%</span>
                </div>
                <div className="mt-1 w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-primary-600 h-2 rounded-full" 
                    style={{ width: `${range.percentage}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="mt-4 text-center">
          <a href="/analytics" className="text-sm text-primary-600 hover:text-primary-700 font-medium">Report completo</a>
        </div>
      </div>
    </div>
  );
}

function MarketAnalysisSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-200">
        <Skeleton className="h-6 w-36" />
      </div>
      
      <div className="p-5">
        <Skeleton className="h-5 w-48 mb-3" />
        <div className="relative h-32 mb-1">
          <Skeleton className="h-28 w-full" />
        </div>
        <div className="flex justify-between mt-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-3 w-12" />
          ))}
        </div>
        
        <div className="mt-6 pt-6 border-t border-gray-200">
          <Skeleton className="h-5 w-48 mb-3" />
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i}>
                <div className="flex items-center justify-between mb-1">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-8" />
                </div>
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
            ))}
          </div>
        </div>
        
        <div className="mt-4 text-center">
          <Skeleton className="h-4 w-28 mx-auto" />
        </div>
      </div>
    </div>
  );
}
