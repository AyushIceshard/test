import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import React, { useState, useEffect } from "react";

type ShopifyOrder = {
  id?: number | string;
  name?: string;
  email?: string;
  customer?: {
    first_name?: string;
    last_name?: string;
  } | null;
  shipping_address?: {
    city?: string;
    country?: string;
  } | null;
  source_name?: string;
  financial_status?: string | null;
  fulfillment_status?: string | null;
  total_price?: string | number | null;
  currency?: string | null;
  created_at?: string | null;
};

type Filters = {
  paymentStatus: string[];
  fulfillmentStatus: string[];
  channel: string[];
  dateRange: { start: string; end: string };
};

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const url = new URL("/orders", request.url);
    console.log("Fetching orders from:", url.toString());
    
    const res = await fetch(url.toString());
    if (!res.ok) {
      console.error("Failed to fetch orders:", res.status, res.statusText);
      throw new Response("Failed to load orders", { status: res.status });
    }
    
    const data = await res.json();
    console.log("Raw response data:", data);
    
    // Ensure we always return an array
    if (!data) {
      console.log("No data returned, defaulting to empty array");
      return [];
    }
    
    if (Array.isArray(data)) {
      console.log(`Returning ${data.length} orders`);
      return data;
    }
    
    // If data has an orders property, use that
    if (data.orders && Array.isArray(data.orders)) {
      console.log(`Returning ${data.orders.length} orders from data.orders`);
      return data.orders;
    }
    
    // If it's an object but not an array, wrap it
    if (typeof data === 'object') {
      console.log("Wrapping single object in array");
      return [data];
    }
    
    console.warn("Unexpected data format, returning empty array:", typeof data, data);
    return [];
    
  } catch (error: unknown) {
    console.error("Error in loader:", error);
    if (error instanceof Response) {
      throw error;
    }
    throw new Response("Failed to load orders", { status: 500 });
  }
}

const getStatusBadgeStyle = (
  status: string,
  type: 'financial' | 'fulfillment' = 'financial'
): string => {
  const statusMap = {
    'paid': 'bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium',
    'pending': 'bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-medium',
    'refunded': 'bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs font-medium',
    'partially_paid': 'bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium',
    'authorized': 'bg-gray-100 text-gray-800 px-2 py-1 rounded-full text-xs font-medium',
    'fulfilled': 'bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium',
    'unfulfilled': 'bg-gray-100 text-gray-800 px-2 py-1 rounded-full text-xs font-medium',
    'partially_fulfilled': 'bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-medium',
    'shipped': 'bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium',
    'delivered': 'bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium'
  } as const;
  
  return statusMap[status as keyof typeof statusMap] || 'bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-xs font-medium';
};

// Helper function to format date consistently on client and server
const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return 'N/A';
  
  try {
    const date = new Date(dateString);
    // Use UTC methods to ensure consistent formatting
    const year = date.getUTCFullYear();
    const month = date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
    const day = date.getUTCDate();
    
    return `${month} ${day}, ${year}`;
  } catch (error: unknown) {
    console.error('Date formatting error:', error);
    return 'Invalid Date';
  }
};

const formatTime = (dateString: string | null | undefined): string => {
  if (!dateString) return '';
  
  try {
    const date = new Date(dateString);
    // Use UTC to avoid hydration mismatches
    const hours = date.getUTCHours();
    const minutes = date.getUTCMinutes().toString().padStart(2, '0');
    const seconds = date.getUTCSeconds().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    
    return `${displayHours}:${minutes}:${seconds} ${ampm} UTC`;
  } catch (error: unknown) {
    console.error('Time formatting error:', error);
    return '';
  }
};

export default function Orders() {
  const loaderData = useLoaderData() as unknown;
  const [searchQuery, setSearchQuery] = useState("");
  const [isClient, setIsClient] = useState(false);
  
  // Filter states
  const [filters, setFilters] = useState<Filters>({
    paymentStatus: [],
    fulfillmentStatus: [],
    channel: [],
    dateRange: { start: '', end: '' }
  });
  
  const [showFilters, setShowFilters] = useState(false);
  
  // Set client flag after hydration to avoid hydration mismatches
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  // Ensure orders is always an array with multiple fallbacks
  let orders: ShopifyOrder[] = [];
  if (Array.isArray(loaderData)) {
    orders = loaderData as ShopifyOrder[];
  } else if (
    loaderData && typeof loaderData === 'object' && Array.isArray((loaderData as any).orders)
  ) {
    orders = (loaderData as any).orders as ShopifyOrder[];
  } else if (loaderData && typeof loaderData === 'object') {
    orders = [loaderData as ShopifyOrder];
  }
  
  // Get unique values for filter options
  const getUniqueValues = (key: 'financial_status' | 'fulfillment_status' | 'channel'): string[] => {
    const values = orders.map((order) => {
      if (key === 'financial_status') return order.financial_status;
      if (key === 'fulfillment_status') return order.fulfillment_status || 'unfulfilled';
      if (key === 'channel') return order.source_name || 'Online Store';
      return null;
    }).filter(Boolean) as string[];
    return [...new Set(values)];
  };

  const paymentStatusOptions = getUniqueValues('financial_status');
  const fulfillmentStatusOptions = getUniqueValues('fulfillment_status');
  const channelOptions = getUniqueValues('channel');

  // Comprehensive filtering
  const filteredOrders = orders.filter((order) => {
    if (!order || typeof order !== 'object') return false;
    
    // Search query filter
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = (order.name && order.name.toLowerCase().includes(searchLower)) ||
                           (order.customer && `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.toLowerCase().includes(searchLower)) ||
                           (order.email && order.email.toLowerCase().includes(searchLower));
      if (!matchesSearch) return false;
    }
    
    // Payment status filter
    if (filters.paymentStatus.length > 0) {
      if (!filters.paymentStatus.includes(order.financial_status ?? '')) return false;
    }
    
    // Fulfillment status filter
    if (filters.fulfillmentStatus.length > 0) {
      const fulfillmentStatus = order.fulfillment_status || 'unfulfilled';
      if (!filters.fulfillmentStatus.includes(fulfillmentStatus)) return false;
    }
    
    // Channel filter
    if (filters.channel.length > 0) {
      const channel = order.source_name || 'Online Store';
      if (!filters.channel.includes(channel)) return false;
    }
    
    // Date range filter
    if (filters.dateRange.start || filters.dateRange.end) {
      if (!order.created_at) return false;
      const orderDate = new Date(order.created_at);
      if (filters.dateRange.start) {
        const startDate = new Date(filters.dateRange.start);
        if (orderDate < startDate) return false;
      }
      if (filters.dateRange.end) {
        const endDate = new Date(filters.dateRange.end);
        endDate.setHours(23, 59, 59, 999); // Include full end date
        if (orderDate > endDate) return false;
      }
    }
    
    return true;
  });

  // Helper functions for filter management
  const toggleFilter = (
    filterType: 'paymentStatus' | 'fulfillmentStatus' | 'channel',
    value: string
  ) => {
    setFilters((prev) => ({
      ...prev,
      [filterType]: prev[filterType].includes(value)
        ? prev[filterType].filter(v => v !== value)
        : [...prev[filterType], value]
    }));
  };

  const updateDateRange = (type: 'start' | 'end', value: string) => {
    setFilters((prev) => ({
      ...prev,
      dateRange: { ...prev.dateRange, [type]: value }
    }));
  };

  const clearAllFilters = () => {
    setFilters({
      paymentStatus: [],
      fulfillmentStatus: [],
      channel: [],
      dateRange: { start: '', end: '' }
    });
    setSearchQuery("");
  };

  const hasActiveFilters = filters.paymentStatus.length > 0 ||
                          filters.fulfillmentStatus.length > 0 ||
                          filters.channel.length > 0 ||
                          filters.dateRange.start ||
                          filters.dateRange.end ||
                          searchQuery;

  const getActiveFilterCount = () => {
    return filters.paymentStatus.length +
           filters.fulfillmentStatus.length +
           filters.channel.length +
           (filters.dateRange.start ? 1 : 0) +
           (filters.dateRange.end ? 1 : 0);
  };
  
  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Orders</h1>
        <p className="text-gray-600">Manage and track your store orders</p>
      </div>

      {/* Search and Filters */}
      <div className="mb-6 space-y-4">
        {/* Search and Filter Toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex-1 max-w-md">
            <input
              type="text"
              placeholder="Search orders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <span>Filters</span>
              {getActiveFilterCount() > 0 && (
                <span className="bg-blue-600 text-white rounded-full px-2 py-0.5 text-xs">
                  {getActiveFilterCount()}
                </span>
              )}
              <span className={`inline-block transition-transform ${showFilters ? 'rotate-180' : ''}`}>▼</span>
            </button>
            
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="px-4 py-2 text-sm text-red-600 hover:text-red-800"
              >
                Clear all
              </button>
            )}
          </div>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Payment Status Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Payment Status</label>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {paymentStatusOptions.map(status => (
                    <label key={status} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={filters.paymentStatus.includes(status)}
                        onChange={() => toggleFilter('paymentStatus', status)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm capitalize">{status.replace('_', ' ')}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Fulfillment Status Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Fulfillment Status</label>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {fulfillmentStatusOptions.map(status => (
                    <label key={status} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={filters.fulfillmentStatus.includes(status)}
                        onChange={() => toggleFilter('fulfillmentStatus', status)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm capitalize">{status.replace('_', ' ')}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Channel Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Channel</label>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {channelOptions.map(channel => (
                    <label key={channel} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={filters.channel.includes(channel)}
                        onChange={() => toggleFilter('channel', channel)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm">{channel}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Date Range Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
                <div className="space-y-2">
                  <input
                    type="date"
                    value={filters.dateRange.start}
                    onChange={(e) => updateDateRange('start', e.target.value)}
                    className="w-full px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Start date"
                  />
                  <input
                    type="date"
                    value={filters.dateRange.end}
                    onChange={(e) => updateDateRange('end', e.target.value)}
                    className="w-full px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="End date"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Active Filter Badges */}
        {hasActiveFilters && (
          <div className="flex flex-wrap gap-2">
            {/* Payment Status Badges */}
            {filters.paymentStatus.map(status => (
              <span key={`payment-${status}`} className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
                Payment: {status.replace('_', ' ')}
                <button
                  onClick={() => toggleFilter('paymentStatus', status)}
                  className="hover:bg-blue-200 rounded-full p-0.5 w-4 h-4 flex items-center justify-center text-xs"
                >
                  ×
                </button>
              </span>
            ))}

            {/* Fulfillment Status Badges */}
            {filters.fulfillmentStatus.map(status => (
              <span key={`fulfillment-${status}`} className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 text-sm rounded-full">
                Fulfillment: {status.replace('_', ' ')}
                <button
                  onClick={() => toggleFilter('fulfillmentStatus', status)}
                  className="hover:bg-green-200 rounded-full p-0.5 w-4 h-4 flex items-center justify-center text-xs"
                >
                  ×
                </button>
              </span>
            ))}

            {/* Channel Badges */}
            {filters.channel.map(channel => (
              <span key={`channel-${channel}`} className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-800 text-sm rounded-full">
                Channel: {channel}
                <button
                  onClick={() => toggleFilter('channel', channel)}
                  className="hover:bg-purple-200 rounded-full p-0.5 w-4 h-4 flex items-center justify-center text-xs"
                >
                  ×
                </button>
              </span>
            ))}

            {/* Date Range Badges */}
            {filters.dateRange.start && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-800 text-sm rounded-full">
                From: {filters.dateRange.start}
                <button
                  onClick={() => updateDateRange('start', '')}
                  className="hover:bg-gray-200 rounded-full p-0.5 w-4 h-4 flex items-center justify-center text-xs"
                >
                  ×
                </button>
              </span>
            )}
            {filters.dateRange.end && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-800 text-sm rounded-full">
                To: {filters.dateRange.end}
                <button
                  onClick={() => updateDateRange('end', '')}
                  className="hover:bg-gray-200 rounded-full p-0.5 w-4 h-4 flex items-center justify-center text-xs"
                >
                  ×
                </button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Orders Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {filteredOrders.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {orders.length === 0 ? "No orders found" : "No orders match your search"}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Channel</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fulfillment</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredOrders.map((order, index) => {
                  if (!order || typeof order !== 'object') return null;
                  
                  const customerName = order.customer 
                    ? `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim()
                    : '';
                  
                  return (
                    <tr key={order.id || index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="font-medium text-gray-900">#{order.name || 'N/A'}</div>
                          {order.email && (
                            <div className="text-sm text-gray-500">{order.email}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {order.created_at ? (
                          <div>
                            <div>{formatDate(order.created_at)}</div>
                            {/* Only show time on client side to avoid hydration mismatch */}
                            {isClient && (
                              <div className="text-xs">{formatTime(order.created_at)}</div>
                            )}
                          </div>
                        ) : (
                          'N/A'
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="font-medium text-gray-900">{customerName || 'Guest'}</div>
                          {order.shipping_address && (
                            <div className="text-sm text-gray-500">
                              {order.shipping_address.city}, {order.shipping_address.country}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {order.source_name || 'Online Store'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={getStatusBadgeStyle(order.financial_status ?? "") }>
                          {order.financial_status ? order.financial_status.replace('_', ' ').toUpperCase() : 'UNKNOWN'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={getStatusBadgeStyle(order.fulfillment_status ?? "", 'fulfillment')}>
                          {order.fulfillment_status ? order.fulfillment_status.replace('_', ' ').toUpperCase() : 'UNFULFILLED'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right font-medium text-gray-900">
                        {order.total_price || '0'} {order.currency || 'USD'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Summary */}
      {filteredOrders.length > 0 && (
        <div className="mt-4 text-sm text-gray-500 text-center">
          Showing {filteredOrders.length} of {orders.length} orders
        </div>
      )}
    </div>
  );
}