import { useState, useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

export default function StudentCard() {
  const [studentNumber, setStudentNumber] = useState('');
  const [studentName, setStudentName] = useState('');
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (svgRef.current && studentNumber) {
      // Clear previous barcode
      svgRef.current.innerHTML = '';
      
      // Generate CODE128 barcode with proper settings for scannability
      try {
        JsBarcode(svgRef.current, studentNumber, {
          format: 'CODE128',
          width: 2.5, // Bar width - increased for better scannability (minimum 2px)
          height: 100, // Barcode height - increased for better scanning reliability
          displayValue: true, // Show the text below barcode
          fontSize: 18,
          textAlign: 'center',
          textPosition: 'bottom',
          textMargin: 8,
          margin: 25, // Quiet zone - minimum 10x bar width (25px = 10x 2.5px, with extra safety margin)
          background: '#ffffff', // White background for maximum contrast
          lineColor: '#000000', // Pure black bars for maximum contrast
          // Additional settings for better scannability
          valid: function(valid) {
            if (!valid) {
              console.error('Invalid barcode data');
            }
          }
        });
      } catch (error) {
        console.error('Error generating barcode:', error);
      }
    }
  }, [studentNumber]);

  const handlePrint = () => {
    window.print();
  };

  const handleGenerate = () => {
    if (!studentNumber.trim()) {
      alert('Please enter a student number');
      return;
    }
    // Trigger barcode regeneration
    if (svgRef.current) {
      svgRef.current.innerHTML = '';
      JsBarcode(svgRef.current, studentNumber.trim(), {
        format: 'CODE128',
        width: 2.5,
        height: 100,
        displayValue: true,
        fontSize: 18,
        textAlign: 'center',
        textPosition: 'bottom',
        textMargin: 8,
        margin: 25,
        background: '#ffffff',
        lineColor: '#000000',
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl sm:text-3xl font-bold mb-6 text-center">Student Card Generator</h1>
        
        {/* Input Form */}
        <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 mb-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Student Number (Required)
              </label>
              <input
                type="text"
                value={studentNumber}
                onChange={(e) => setStudentNumber(e.target.value)}
                placeholder="Enter student number"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Student Name (Optional)
              </label>
              <input
                type="text"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="Enter student name"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={handleGenerate}
              className="w-full sm:w-auto bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 font-medium"
            >
              Generate Card
            </button>
          </div>
        </div>

        {/* Card Preview */}
        {studentNumber && (
          <div className="bg-white rounded-lg shadow-lg p-6 sm:p-8 mb-6">
            <div className="max-w-md mx-auto">
              {/* Card Design - matching the image description */}
              <div 
                className="bg-green-800 rounded-lg p-6 sm:p-8 text-white"
                style={{ minHeight: '300px' }}
              >
                {/* Header */}
                <div className="flex items-center justify-end mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-lg sm:text-xl font-semibold">الحاسب</span>
                    <svg 
                      className="w-6 h-6 sm:w-8 sm:h-8" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" 
                      />
                    </svg>
                  </div>
                </div>
                <div className="border-t border-gray-400 mb-6"></div>

                {/* Student Name */}
                {studentName && (
                  <div className="text-center mb-4">
                    <p className="text-lg sm:text-xl font-medium">{studentName}</p>
                  </div>
                )}

                {/* Barcode */}
                <div className="bg-white rounded p-4 mb-4 flex items-center justify-center">
                  <svg 
                    ref={svgRef}
                    className="max-w-full"
                    style={{ 
                      minHeight: '120px',
                      display: 'block',
                      width: '100%',
                      height: 'auto'
                    }}
                  />
                </div>

                {/* Student Number Text */}
                <div className="text-center">
                  <p className="text-sm sm:text-base opacity-90">{studentNumber}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Print Button */}
        {studentNumber && (
          <div className="text-center">
            <button
              onClick={handlePrint}
              className="bg-green-600 text-white px-6 py-3 rounded-md hover:bg-green-700 font-medium text-lg"
            >
              Print Card
            </button>
          </div>
        )}

        {/* Instructions */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4 sm:p-6">
          <h2 className="text-lg font-semibold mb-3">Barcode Scanning Tips</h2>
          <ul className="list-disc list-inside space-y-2 text-sm text-gray-700">
            <li>Ensure the barcode has proper quiet zones (white space) on both sides</li>
            <li>Print with high contrast - black bars on white background</li>
            <li>Use a high-quality printer for best results</li>
            <li>Keep the barcode flat and avoid wrinkles or damage</li>
            <li>Ensure adequate lighting when scanning</li>
            <li>Hold the scanner at a proper distance and angle</li>
          </ul>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-card, .print-card * {
            visibility: visible;
          }
          .print-card {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          button {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
