// app/routes/convert.tsx
import { useState, useEffect, useCallback } from 'react';
import useWebSocket from '~/hooks/useWebSocket';

export default function ConvertRoute() {
  const [amount, setAmount] = useState('100');
  const [fromCountry, setFromCountry] = useState('Vietnam');
  const [toCountry, setToCountry] = useState('Venezuela, República Bolivariana de');
  const [fromIndicator, setFromIndicator] = useState('');
  const [toIndicator, setToIndicator] = useState('');
  const [countries, setCountries] = useState<string[]>([]);
  const [indicators, setIndicators] = useState<any[]>([]);
  const [toIndicators, setToIndicators] = useState<any[]>([]);
  const [result, setResult] = useState<any>(null);
  const [year, setYear] = useState(2024);
  const [month, setMonth] = useState(12);
  const [isLoading, setIsLoading] = useState(false);
  
  const websocketUrl = 'ws://localhost:8000/ws/currency/';
  const { sendMessage, isConnected, lastMessage } = useWebSocket(websocketUrl);

  // Helper function to get currency display name
  const getCurrencyDisplay = useCallback((country: string, indicator: string) => {
    const countryName = country.split(',')[0].split('(')[0].trim();
    
    if (indicator.includes('US Dollar')) {
      if (indicator.includes('per domestic')) {
        return `${countryName} currency`;
      } else {
        return `USD (from ${countryName})`;
      }
    } else if (indicator.includes('Euro')) {
      if (indicator.includes('per domestic')) {
        return `${countryName} currency`;
      } else {
        return `EUR (from ${countryName})`;
      }
    } else if (indicator.includes('SDR')) {
      if (indicator.includes('per domestic')) {
        return `${countryName} currency`;
      } else {
        return `SDR (from ${countryName})`;
      }
    }
    return indicator;
  }, []);

  // Trigger conversion
  const triggerConversion = useCallback(() => {
    if (!isConnected || !amount || parseFloat(amount) <= 0 || 
        !fromIndicator || !toIndicator) {
      return;
    }
    
    setIsLoading(true);
    sendMessage({
      type: 'convert',
      amount: parseFloat(amount),
      from_country: fromCountry,
      from_indicator: fromIndicator,
      to_country: toCountry,
      to_indicator: toIndicator,
      year: year,
      month: month
    });
  }, [isConnected, amount, fromCountry, fromIndicator, toCountry, toIndicator, year, month, sendMessage]);

  // Load countries on connection
  useEffect(() => {
    if (isConnected) {
      sendMessage({ type: 'get_countries' });
      sendMessage({ type: 'get_currencies', country: fromCountry });
      sendMessage({ type: 'get_currencies', country: toCountry });
    }
  }, [isConnected, fromCountry, toCountry]);

  // Process WebSocket messages
  useEffect(() => {
    if (lastMessage) {
      try {
        const data = JSON.parse(lastMessage.data);
        
        switch (data.type) {
          case 'countries_list':
            setCountries(data.data.countries);
            break;
            
          case 'currencies_list':
            if (data.data.country === fromCountry) {
              setIndicators(data.data.currencies);
              if (data.data.currencies.length > 0 && !fromIndicator) {
                setFromIndicator(data.data.currencies[0].INDICATOR);
              }
            }
            if (data.data.country === toCountry) {
              setToIndicators(data.data.currencies);
              if (data.data.currencies.length > 0 && !toIndicator) {
                setToIndicator(data.data.currencies[0].INDICATOR);
              }
            }
            break;
            
          case 'conversion_result':
            setResult(data.data);
            setIsLoading(false);
            break;
            
          case 'error':
            alert(`Error: ${data.message}`);
            setIsLoading(false);
            break;
        }
      } catch (error) {
        console.error('Error parsing message:', error);
        setIsLoading(false);
      }
    }
  }, [lastMessage, fromCountry, toCountry, fromIndicator, toIndicator]);

  // Auto-convert when any parameter changes
  useEffect(() => {
    if (fromIndicator && toIndicator) {
      const timer = setTimeout(() => {
        triggerConversion();
      }, 300);
      
      return () => clearTimeout(timer);
    }
  }, [amount, fromCountry, fromIndicator, toCountry, toIndicator, year, month, triggerConversion]);

  const handleFromCountryChange = (country: string) => {
    setFromCountry(country);
    setFromIndicator(''); // Reset to trigger reload
    sendMessage({ type: 'get_currencies', country: country });
  };

  const handleToCountryChange = (country: string) => {
    setToCountry(country);
    setToIndicator(''); // Reset to trigger reload
    sendMessage({ type: 'get_currencies', country: country });
  };

  // Generate year options (2000-current year)
  const yearOptions = Array.from({ length: 25 }, (_, i) => 2000 + i);
  const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Real Currency Converter</h1>
      
      {/* Connection Status */}
      <div className={`p-3 mb-6 rounded ${isConnected ? 'bg-green-100' : 'bg-red-100'}`}>
        Status: {isConnected ? '✅ Connected to Database' : '❌ Disconnected'}
      </div>

      {/* Conversion Form */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Currency Conversion</h2>
        
        {/* Amount Input */}
        <div className="mb-4">
          <label className="block mb-2">Amount:</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full p-3 border rounded-lg"
            placeholder="Enter amount"
            step="0.01"
            min="0"
          />
          <p className="text-sm text-gray-500 mt-1">Converts automatically as you type or change settings</p>
        </div>

        {/* From Currency */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block mb-2">From Country:</label>
            <select
              value={fromCountry}
              onChange={(e) => handleFromCountryChange(e.target.value)}
              className="w-full p-3 border rounded-lg"
            >
              {countries.map(country => (
                <option key={`from-${country}`} value={country}>
                  {country}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block mb-2">From Currency Type:</label>
            <select
              value={fromIndicator}
              onChange={(e) => setFromIndicator(e.target.value)}
              className="w-full p-3 border rounded-lg"
              disabled={indicators.length === 0}
            >
              {indicators.map(indicator => (
                <option key={`from-ind-${indicator.id}`} value={indicator.INDICATOR}>
                  {getCurrencyDisplay(fromCountry, indicator.INDICATOR)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* To Currency */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block mb-2">To Country:</label>
            <select
              value={toCountry}
              onChange={(e) => handleToCountryChange(e.target.value)}
              className="w-full p-3 border rounded-lg"
            >
              {countries.map(country => (
                <option key={`to-${country}`} value={country}>
                  {country}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block mb-2">To Currency Type:</label>
            <select
              value={toIndicator}
              onChange={(e) => setToIndicator(e.target.value)}
              className="w-full p-3 border rounded-lg"
              disabled={toIndicators.length === 0}
            >
              {toIndicators.map(indicator => (
                <option key={`to-ind-${indicator.id}`} value={indicator.INDICATOR}>
                  {getCurrencyDisplay(toCountry, indicator.INDICATOR)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Date Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block mb-2">Year:</label>
            <select
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value))}
              className="w-full p-3 border rounded-lg"
            >
              {yearOptions.map(y => (
                <option key={`year-${y}`} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block mb-2">Month:</label>
            <select
              value={month}
              onChange={(e) => setMonth(parseInt(e.target.value))}
              className="w-full p-3 border rounded-lg"
            >
              {monthOptions.map(m => (
                <option key={`month-${m}`} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Loading Indicator */}
        {isLoading && (
          <div className="text-center p-3">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600">Converting...</p>
          </div>
        )}
      </div>

      {/* Result Display */}
      {result && !isLoading && (
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Conversion Result</h2>
          
          <div className="bg-blue-50 p-4 rounded-lg">
            {/* Main Result */}
            <div className="text-2xl font-bold text-center mb-2">
              {result.original_amount} {getCurrencyDisplay(result.from_currency.country, result.from_currency.indicator)} = 
              {result.converted_amount.toFixed(6)} {getCurrencyDisplay(result.to_currency.country, result.to_currency.indicator)}
            </div>
            
            {/* From/To Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="bg-white p-3 rounded">
                <h3 className="font-semibold">From:</h3>
                <p className="font-medium">{result.from_currency.country}</p>
                <p className="text-sm text-gray-600">{result.from_currency.indicator}</p>
                {result.from_rate && (
                  <p className="text-sm mt-2">Rate: {result.from_rate}</p>
                )}
                <p className="text-xs text-gray-500">Date: {result.year}-{result.month}</p>
              </div>
              
              <div className="bg-white p-3 rounded">
                <h3 className="font-semibold">To:</h3>
                <p className="font-medium">{result.to_currency.country}</p>
                <p className="text-sm text-gray-600">{result.to_currency.indicator}</p>
                {result.to_rate && (
                  <p className="text-sm mt-2">Rate: {result.to_rate}</p>
                )}
                <p className="text-xs text-gray-500">Date: {result.year}-{result.month}</p>
              </div>
            </div>
            
            {/* Exchange Rate */}
            <div className="mt-4 p-3 bg-gray-50 rounded">
              <h4 className="font-semibold">Exchange Rate:</h4>
              <p className="text-lg">
                1 {getCurrencyDisplay(result.from_currency.country, result.from_currency.indicator)} = 
                {result.exchange_rate.toFixed(6)} {getCurrencyDisplay(result.to_currency.country, result.to_currency.indicator)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}