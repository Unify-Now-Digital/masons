
import React from 'react';
import { Mail, MapPin, MapPinCheck, CalendarClock, CalendarX, CalendarCheck } from 'lucide-react';
import englandMapImage from '/lovable-uploads/db9c4893-e31d-4214-a07e-c010da1917f3.png';

export const AutomatedCommunicationImage = () => {
  return (
    <div className="bg-white p-4 rounded-md border border-slate-200 shadow-sm">
      <div className="flex items-center mb-4">
        <div className="bg-blue-100 p-2 rounded-full">
          <Mail className="h-5 w-5 text-blue-700" />
        </div>
        <div className="ml-3">
          <h4 className="text-sm font-medium">Automated Communication</h4>
        </div>
      </div>
      
      <div className="space-y-3">
        <div className="flex items-center border-l-2 border-green-500 pl-3 py-2">
          <div className="bg-green-100 p-1 rounded-full mr-2">
            <svg className="h-3 w-3 text-green-700" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <p className="text-xs text-slate-500">Initial Inquiry Response</p>
            <p className="text-xs text-slate-700 font-medium">Sent automatically</p>
          </div>
        </div>
        
        <div className="flex items-center border-l-2 border-green-500 pl-3 py-2">
          <div className="bg-green-100 p-1 rounded-full mr-2">
            <svg className="h-3 w-3 text-green-700" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <p className="text-xs text-slate-500">Quote Delivered</p>
            <p className="text-xs text-slate-700 font-medium">3 days ago</p>
          </div>
        </div>
        
        <div className="flex items-center border-l-2 border-blue-500 pl-3 py-2">
          <div className="bg-blue-100 p-1 rounded-full mr-2">
            <svg className="h-3 w-3 text-blue-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-xs text-slate-500">Follow-up Scheduled</p>
            <p className="text-xs text-slate-700 font-medium">Tomorrow at 10:00 AM</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export const MapViewImage = () => {
  return (
    <div className="bg-slate-100 p-4 rounded-md border border-slate-200 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-medium">Job Map Overview</h4>
        <div className="flex space-x-2">
          <div className="bg-blue-100 p-1 rounded flex items-center">
            <MapPin className="h-3 w-3 text-blue-700 mr-1" />
            <span className="text-xs text-blue-700">12</span>
          </div>
          <div className="bg-green-100 p-1 rounded flex items-center">
            <MapPinCheck className="h-3 w-3 text-green-700 mr-1" />
            <span className="text-xs text-green-700">8</span>
          </div>
        </div>
      </div>
      
      <div className="border border-slate-300 rounded-md h-40 bg-slate-50 relative overflow-hidden">
        {/* Real England map with existing pins */}
        <img 
          src={englandMapImage} 
          alt="Map of England showing job locations"
          className="absolute inset-0 w-full h-full object-cover"
        />
      </div>
      
      <div className="mt-3">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center">
            <div className="h-2 w-2 rounded-full bg-blue-500 mr-1"></div>
            <span>In Progress</span>
          </div>
          <div className="flex items-center">
            <div className="h-2 w-2 rounded-full bg-green-500 mr-1"></div>
            <span>Completed</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export const OrderProgressImage = () => {
  return (
    <div className="bg-white p-4 rounded-md border border-slate-200 shadow-sm">
      <div className="flex items-center mb-4">
        <div className="bg-blue-100 p-2 rounded-full">
          <CalendarClock className="h-5 w-5 text-blue-700" />
        </div>
        <div className="ml-3">
          <h4 className="text-sm font-medium">Order Analytics Dashboard</h4>
          <p className="text-xs text-slate-500">Real-time progress tracking</p>
        </div>
      </div>
      
      <div className="border border-slate-300 rounded-md overflow-hidden">
        <img 
          src="/lovable-uploads/c4ecf4e1-86a0-4ff6-952b-2f41865083fb.png" 
          alt="Order progress analytics chart"
          className="w-full h-auto"
        />
      </div>
      
      <div className="mt-4 flex justify-between items-center text-xs">
        <p className="text-slate-500">Live order metrics</p>
        <p className="text-blue-600 font-medium">All Orders Tracked</p>
      </div>
    </div>
  );
};

export const OverdueOrdersImage = () => {
  return (
    <div className="bg-white p-4 rounded-md border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <div className="bg-red-100 p-2 rounded-full">
            <CalendarX className="h-5 w-5 text-red-700" />
          </div>
          <div className="ml-3">
            <h4 className="text-sm font-medium">Attention Required</h4>
          </div>
        </div>
        <div className="bg-red-100 px-2 py-0.5 rounded">
          <p className="text-xs font-medium text-red-700">3 Issues</p>
        </div>
      </div>
      
      <div className="space-y-3">
        <div className="bg-red-50 border-l-4 border-red-500 p-2 rounded">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs font-medium text-slate-800">Order #M-2025-036</p>
              <p className="text-xs text-slate-500">Johnson Memorial</p>
            </div>
            <div>
              <p className="text-xs font-medium text-red-600">7 days overdue</p>
            </div>
          </div>
        </div>
        
        <div className="bg-amber-50 border-l-4 border-amber-500 p-2 rounded">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs font-medium text-slate-800">Order #M-2025-039</p>
              <p className="text-xs text-slate-500">Williams Memorial</p>
            </div>
            <div>
              <p className="text-xs font-medium text-amber-600">Payment Due</p>
            </div>
          </div>
        </div>
        
        <div className="bg-blue-50 border-l-4 border-blue-500 p-2 rounded">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs font-medium text-slate-800">Order #M-2025-041</p>
              <p className="text-xs text-slate-500">Brown Memorial</p>
            </div>
            <div>
              <p className="text-xs font-medium text-blue-600">Needs Approval</p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="mt-4 text-center">
        <button className="text-xs font-medium text-blue-600 hover:text-blue-800">
          View All Alerts →
        </button>
      </div>
    </div>
  );
};
