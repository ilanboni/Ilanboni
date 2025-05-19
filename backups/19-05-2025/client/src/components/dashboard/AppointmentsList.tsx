import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Appointment, ClientWithDetails, PropertyWithDetails } from "@/types";
import { formatTime } from "@/lib/utils";

export default function AppointmentsList() {
  // In a real app, we would fetch this data from the API
  // For this prototype, we'll use some sample data
  const { data: appointments, isLoading } = useQuery({
    queryKey: ['/api/appointments/today'],
    queryFn: async () => {
      // This would be replaced with a real API call
      return [
        {
          id: 1,
          time: "10:30",
          client: {
            id: 101,
            firstName: "Bianchi",
            lastName: "Dott.",
            type: "buyer",
            salutation: "dott"
          },
          property: {
            id: 201,
            address: "Via Roma, 45",
            city: "Milano",
            size: 120,
            price: 320000
          },
          type: "visit"
        },
        {
          id: 2,
          time: "14:15",
          client: {
            id: 102,
            firstName: "Verdi",
            lastName: "Sig.ra",
            type: "seller",
            salutation: "sig.ra"
          },
          property: {
            id: 202,
            address: "Corso Italia, 12",
            city: "Milano",
            size: 200,
            price: 450000
          },
          type: "call"
        },
        {
          id: 3,
          time: "16:45",
          client: {
            id: 103,
            firstName: "Rossi",
            lastName: "Dott.",
            type: "buyer",
            salutation: "dott"
          },
          property: {
            id: 203,
            address: "Via Milano, 28",
            city: "Milano",
            size: 90,
            price: 280000
          },
          type: "visit"
        }
      ];
    }
  });

  if (isLoading) {
    return <AppointmentsListSkeleton />;
  }

  const renderClientAvatar = (client: any) => {
    const bgColor = client.type === "buyer" ? "bg-primary-100" : "bg-pink-100";
    const textColor = client.type === "buyer" ? "text-primary-700" : "text-pink-700";
    const icon = client.type === "buyer" ? "fa-user-tie" : "fa-user";
    
    return (
      <div className={`flex-shrink-0 h-8 w-8 rounded-full ${bgColor} flex items-center justify-center ${textColor}`}>
        <i className={`fas ${icon}`}></i>
      </div>
    );
  };

  const renderAppointmentType = (type: string) => {
    const bgColor = type === "visit" ? "bg-green-100" : "bg-blue-100";
    const textColor = type === "visit" ? "text-green-800" : "text-blue-800";
    const label = type === "visit" ? "Visita" : "Telefonata";
    
    return (
      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${bgColor} ${textColor}`}>
        {label}
      </span>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
        <h2 className="font-heading font-semibold text-lg text-gray-800">Appuntamenti Odierni</h2>
        <a href="/appointments" className="text-sm text-primary-600 hover:text-primary-700 font-medium">Vedi tutti</a>
      </div>
      
      <div className="px-5 py-3">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Orario</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Immobile</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Azioni</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {appointments?.map((appointment: any) => (
                <tr key={appointment.id}>
                  <td className="px-3 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{appointment.time}</td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <div className="flex items-center">
                      {renderClientAvatar(appointment.client)}
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {appointment.client.salutation} {appointment.client.lastName}
                        </div>
                        <div className="text-xs text-gray-500">
                          {appointment.client.type === "buyer" ? "Compratore" : "Venditore"}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {appointment.property.address}
                    </div>
                    <div className="text-xs text-gray-500">
                      {appointment.property.size}m² - €{appointment.property.price.toLocaleString()}
                    </div>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    {renderAppointmentType(appointment.type)}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex space-x-2">
                      <button className="text-gray-400 hover:text-gray-600">
                        <i className="fas fa-edit"></i>
                      </button>
                      <button className="text-gray-400 hover:text-gray-600">
                        <i className="fas fa-trash"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AppointmentsListSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-24" />
      </div>
      
      <div className="px-5 py-3">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <Skeleton className="h-4 w-16" />
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <Skeleton className="h-4 w-16" />
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <Skeleton className="h-4 w-16" />
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <Skeleton className="h-4 w-16" />
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <Skeleton className="h-4 w-16" />
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {[1, 2, 3].map((i) => (
                <tr key={i}>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <Skeleton className="h-5 w-12" />
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <div className="flex items-center">
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <div className="ml-4">
                        <Skeleton className="h-4 w-24 mb-1" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <Skeleton className="h-4 w-36 mb-1" />
                    <Skeleton className="h-3 w-24" />
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <div className="flex space-x-2">
                      <Skeleton className="h-5 w-5" />
                      <Skeleton className="h-5 w-5" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
