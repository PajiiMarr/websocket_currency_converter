// app/routes/convert.tsx
import type { Route } from './+types/convert';
// app/routes/convert.tsx
import { useState, useEffect } from 'react';
import useWebSocket from '~/hooks/useWebSocket';

export default function ConvertRoute() {
  const [amount, setAmount] = useState('100');
  const [fromCountry, setFromCountry] = useState('Vietnam');
  const [toCountry, setToCountry] = useState('Vietnam');
  const [fromIndicator, setFromIndicator] = useState('Domestic currency per US Dollar');
  const [toIndicator, setToIndicator] = useState('US Dollar per domestic currency');
  const [countries, setCountries] = useState<string[]>([]);
  const [indicators, setIndicators] = useState<any[]>([]);
  const [toIndicators, setToIndicators] = useState<any[]>([]);
  const [result, setResult] = useState<any>(null);
  const [year, setYear] = useState(2024);
  const [month, setMonth] = useState(12);
  
  const websocketUrl = 'ws://localhost:8000/ws/currency/';
  const { sendMessage, isConnected, lastMessage } = useWebSocket(websocketUrl);

  // Load countries on connection
  useEffect(() => {
    if (isConnected) {
      sendMessage({ type: 'get_countries' });
      // Load indicators for default country
      sendMessage({ 
        type: 'get_currencies', 
        country: fromCountry 
      });
    }
  }, [isConnected, fromCountry]);

  // Process WebSocket messages
  useEffect(() => {
    if (lastMessage) {
      try {
        const data = JSON.parse(lastMessage.data);
        
        switch (data.type) {
          case 'countries_list':
            setCountries(data.data.countries);
            break;
            
          case 'currencies_by_country':
            if (data.data.country === fromCountry) {
              setIndicators(data.data.currencies);
              if (data.data.currencies.length > 0) {
                setFromIndicator(data.data.currencies[0].INDICATOR);
              }
            }
            if (data.data.country === toCountry) {
              setToIndicators(data.data.currencies);
              if (data.data.currencies.length > 0) {
                setToIndicator(data.data.currencies[0].INDICATOR);
              }
            }
            break;
            
          case 'conversion_result':
            setResult(data.data);
            break;
            
          case 'error':
            alert(`Error: ${data.message}`);
            break;
        }
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    }
  }, [lastMessage]);

  const handleConvert = () => {
    if (!isConnected) {
      alert('Not connected to server');
      return;
    }
    
    if (!amount || parseFloat(amount) <= 0) {
      alert('Please enter a valid amount');
      return;
    }
    
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
  };

  const handleFromCountryChange = (country: string) => {
    setFromCountry(country);
    sendMessage({ 
      type: 'get_currencies', 
      country: country 
    });
  };

  const handleToCountryChange = (country: string) => {
    setToCountry(country);
    sendMessage({ 
      type: 'get_currencies', 
      country: country 
    });
  };

  const handleGetLatestRate = () => {
    sendMessage({
      type: 'get_latest_rate',
      country: fromCountry,
      indicator: fromIndicator
    });
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
            <label className="block mb-2">From Indicator:</label>
            <select
              value={fromIndicator}
              onChange={(e) => setFromIndicator(e.target.value)}
              className="w-full p-3 border rounded-lg"
            >
              {indicators.map(indicator => (
                <option key={`from-ind-${indicator.id}`} value={indicator.INDICATOR}>
                  {indicator.INDICATOR}
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
            <label className="block mb-2">To Indicator:</label>
            <select
              value={toIndicator}
              onChange={(e) => setToIndicator(e.target.value)}
              className="w-full p-3 border rounded-lg"
            >
              {toIndicators.map(indicator => (
                <option key={`to-ind-${indicator.id}`} value={indicator.INDICATOR}>
                  {indicator.INDICATOR}
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

        {/* Buttons */}
        <div className="flex gap-4">
          <button
            onClick={handleConvert}
            disabled={!isConnected}
            className="flex-1 bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
          >
            Convert Currency
          </button>
          
          <button
            onClick={handleGetLatestRate}
            disabled={!isConnected}
            className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-300"
          >
            Get Latest Rate
          </button>
        </div>
      </div>

      {/* Result Display */}
      {result && (
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Conversion Result</h2>
          
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-center mb-2">
              {result.original_amount} {result.from_currency.indicator} = 
              {result.converted_amount.toFixed(6)} {result.to_currency.indicator}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="bg-white p-3 rounded">
                <h3 className="font-semibold">From:</h3>
                <p>{result.from_currency.country}</p>
                <p className="text-sm text-gray-600">{result.from_currency.indicator}</p>
                <p className="text-sm">Rate: {result.from_currency.rate}</p>
                <p className="text-xs text-gray-500">Date: {result.from_currency.rate_date}</p>
              </div>
              
              <div className="bg-white p-3 rounded">
                <h3 className="font-semibold">To:</h3>
                <p>{result.to_currency.country}</p>
                <p className="text-sm text-gray-600">{result.to_currency.indicator}</p>
                <p className="text-sm">Rate: {result.to_currency.rate}</p>
                <p className="text-xs text-gray-500">Date: {result.to_currency.rate_date}</p>
              </div>
            </div>
            
            <div className="mt-4 p-3 bg-gray-50 rounded">
              <h4 className="font-semibold">Exchange Rate:</h4>
              <p>1 {result.from_currency.indicator.split(' ')[0]} = 
                {result.exchange_rate.toFixed(6)} {result.to_currency.indicator.split(' ')[0]}</p>
              
              {result.calculation && (
                <div className="mt-2 text-sm">
                  <p className="font-medium">Calculation Method:</p>
                  <p className="text-gray-600">{result.calculation.details}</p>
                  {result.calculation.warning && (
                    <p className="text-yellow-600">⚠️ {result.calculation.warning}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Quick Examples */}
      <div className="bg-gray-50 rounded-xl p-6">
        <h2 className="text-xl font-semibold mb-4">Quick Examples</h2>
        <div className="space-y-2 text-sm">
          <p><strong>Example 1:</strong> Convert 100 Vietnamese Dong to USD</p>
          <ul className="list-disc pl-5">
            <li>From: Vietnam - "Domestic currency per US Dollar"</li>
            <li>To: Vietnam - "US Dollar per domestic currency"</li>
          </ul>
          
          <p className="mt-3"><strong>Example 2:</strong> Compare exchange rates</p>
          <ul className="list-disc pl-5">
            <li>Get latest rate for any currency</li>
            <li>View historical rates from 2000-2024</li>
            <li>Convert between different indicators</li>
          </ul>
        </div>
      </div>
    </div>
  );
}