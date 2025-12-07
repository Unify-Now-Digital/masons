import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Calendar, Download, TrendingUp, TrendingDown, DollarSign, Clock, Users, Star, Timer } from 'lucide-react';

export const ReportingPage: React.FC = () => {
  const [dateRange, setDateRange] = useState("30d");
  const [activeMetric, setActiveMetric] = useState("revenue");

  const metrics = {
    revenue: { current: 45200, previous: 40300, change: 12.2 },
    orders: { current: 24, previous: 22, change: 9.1 },
    satisfaction: { current: 96, previous: 94, change: 2.1 },
    avgDays: { current: 18, previous: 21, change: -14.3 },
    depositToInstall: { current: 23, previous: 28, change: -17.9 }
  };

  const topProducts = [
    { name: "Granite Headstones", revenue: "$18,500", orders: 12, percentage: 41 },
    { name: "Marble Memorials", revenue: "$15,200", orders: 8, percentage: 34 },
    { name: "Bronze Plaques", revenue: "$8,900", orders: 15, percentage: 20 },
    { name: "Custom Monuments", revenue: "$2,600", orders: 2, percentage: 6 }
  ];

  const recentActivities = [
    { action: "Invoice INV-045 paid", customer: "Smith Family", amount: "$2,500", time: "2 hours ago" },
    { action: "Order ORD-089 completed", customer: "Johnson Memorial", amount: "$3,800", time: "4 hours ago" },
    { action: "New order received", customer: "Brown Family", amount: "$1,200", time: "6 hours ago" }
  ];

  const getChangeIcon = (change: number) => {
    return change >= 0 ? 
      <TrendingUp className="h-4 w-4 text-green-600" /> : 
      <TrendingDown className="h-4 w-4 text-red-600" />;
  };

  const getChangeColor = (change: number) => {
    return change >= 0 ? "text-green-600" : "text-red-600";
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Reporting & Analytics</h1>
          <p className="text-sm text-slate-600 mt-1">
            Track performance and business insights
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setActiveMetric("revenue")}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">${metrics.revenue.current.toLocaleString()}</div>
                <p className="text-sm text-slate-600">Monthly Revenue</p>
                <div className={`flex items-center gap-1 text-xs ${getChangeColor(metrics.revenue.change)}`}>
                  {getChangeIcon(metrics.revenue.change)}
                  {Math.abs(metrics.revenue.change)}% from last month
                </div>
              </div>
              <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                <DollarSign className="h-4 w-4 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setActiveMetric("orders")}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{metrics.orders.current}</div>
                <p className="text-sm text-slate-600">Orders This Month</p>
                <div className={`flex items-center gap-1 text-xs ${getChangeColor(metrics.orders.change)}`}>
                  {getChangeIcon(metrics.orders.change)}
                  {Math.abs(metrics.orders.change)}% from last month
                </div>
              </div>
              <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                <Users className="h-4 w-4 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setActiveMetric("satisfaction")}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{metrics.satisfaction.current}%</div>
                <p className="text-sm text-slate-600">Customer Satisfaction</p>
                <div className={`flex items-center gap-1 text-xs ${getChangeColor(metrics.satisfaction.change)}`}>
                  {getChangeIcon(metrics.satisfaction.change)}
                  {Math.abs(metrics.satisfaction.change)}% from last month
                </div>
              </div>
              <div className="h-8 w-8 bg-yellow-100 rounded-full flex items-center justify-center">
                <Star className="h-4 w-4 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setActiveMetric("avgDays")}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{metrics.avgDays.current}</div>
                <p className="text-sm text-slate-600">Avg. Days to Complete</p>
                <div className={`flex items-center gap-1 text-xs ${getChangeColor(metrics.avgDays.change)}`}>
                  {getChangeIcon(metrics.avgDays.change)}
                  {Math.abs(metrics.avgDays.change)}% from last month
                </div>
              </div>
              <div className="h-8 w-8 bg-purple-100 rounded-full flex items-center justify-center">
                <Clock className="h-4 w-4 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setActiveMetric("depositToInstall")}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{metrics.depositToInstall.current}</div>
                <p className="text-sm text-slate-600">Days Deposit to Install</p>
                <div className={`flex items-center gap-1 text-xs ${getChangeColor(metrics.depositToInstall.change)}`}>
                  {getChangeIcon(metrics.depositToInstall.change)}
                  {Math.abs(metrics.depositToInstall.change)}% from last month
                </div>
              </div>
              <div className="h-8 w-8 bg-orange-100 rounded-full flex items-center justify-center">
                <Timer className="h-4 w-4 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Tabs defaultValue="revenue" className="space-y-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="revenue">Revenue</TabsTrigger>
              <TabsTrigger value="orders">Orders</TabsTrigger>
              <TabsTrigger value="performance">Performance</TabsTrigger>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
            </TabsList>

            <TabsContent value="revenue">
              <Card>
                <CardHeader>
                  <CardTitle>Revenue Analysis</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-80 bg-gradient-to-br from-green-50 to-blue-50 rounded-lg flex items-center justify-center relative overflow-hidden">
                    <div className="text-center text-slate-500 z-10">
                      <DollarSign className="h-12 w-12 mx-auto mb-2" />
                      <p>Revenue chart visualization</p>
                      <p className="text-sm">Monthly revenue trends and projections</p>
                    </div>
                    {/* Mock chart elements */}
                    <div className="absolute bottom-4 left-4 right-4 h-32 bg-green-200 opacity-50 rounded"></div>
                    <div className="absolute bottom-4 left-8 w-8 h-24 bg-green-500 rounded-t"></div>
                    <div className="absolute bottom-4 left-20 w-8 h-32 bg-green-600 rounded-t"></div>
                    <div className="absolute bottom-4 left-32 w-8 h-20 bg-green-400 rounded-t"></div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="orders">
              <Card>
                <CardHeader>
                  <CardTitle>Order Analytics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-80 bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg flex items-center justify-center">
                    <div className="text-center text-slate-500">
                      <Users className="h-12 w-12 mx-auto mb-2" />
                      <p>Order analytics visualization</p>
                      <p className="text-sm">Order volume and completion rates</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="performance">
              <Card>
                <CardHeader>
                  <CardTitle>Performance Metrics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                      <h4 className="font-medium mb-2">Average Order Value</h4>
                      <div className="text-2xl font-bold">$2,875</div>
                      <div className="flex items-center gap-1 text-sm text-green-600">
                        <TrendingUp className="h-3 w-3" />
                        +5% this month
                      </div>
                    </div>
                    <div className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                      <h4 className="font-medium mb-2">Order Completion Rate</h4>
                      <div className="text-2xl font-bold">94%</div>
                      <div className="flex items-center gap-1 text-sm text-green-600">
                        <TrendingUp className="h-3 w-3" />
                        +2% this month
                      </div>
                    </div>
                    <div className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                      <h4 className="font-medium mb-2">Customer Retention</h4>
                      <div className="text-2xl font-bold">78%</div>
                      <div className="flex items-center gap-1 text-sm text-yellow-600">
                        <TrendingDown className="h-3 w-3" />
                        -1% this month
                      </div>
                    </div>
                    <div className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                      <h4 className="font-medium mb-2">Response Time</h4>
                      <div className="text-2xl font-bold">2.4h</div>
                      <div className="flex items-center gap-1 text-sm text-green-600">
                        <TrendingUp className="h-3 w-3" />
                        -0.5h this month
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="timeline">
              <Card>
                <CardHeader>
                  <CardTitle>Installation Timeline Analysis</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h4 className="font-medium">Key Timeline Metrics</h4>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                          <span className="text-sm font-medium">Avg. Deposit to Install</span>
                          <div className="text-right">
                            <div className="text-lg font-bold">{metrics.depositToInstall.current} days</div>
                            <div className={`text-xs ${getChangeColor(metrics.depositToInstall.change)}`}>
                              {metrics.depositToInstall.change > 0 ? '+' : ''}{metrics.depositToInstall.change}%
                            </div>
                          </div>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                          <span className="text-sm font-medium">Fastest Completion</span>
                          <div className="text-lg font-bold text-green-600">12 days</div>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                          <span className="text-sm font-medium">Longest Completion</span>
                          <div className="text-lg font-bold text-red-600">45 days</div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <h4 className="font-medium">Timeline Distribution</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>10-20 days</span>
                          <span>45%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className="bg-green-600 h-2 rounded-full" style={{ width: '45%' }}></div>
                        </div>
                        
                        <div className="flex justify-between text-sm">
                          <span>21-30 days</span>
                          <span>35%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className="bg-yellow-600 h-2 rounded-full" style={{ width: '35%' }}></div>
                        </div>
                        
                        <div className="flex justify-between text-sm">
                          <span>31+ days</span>
                          <span>20%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className="bg-red-600 h-2 rounded-full" style={{ width: '20%' }}></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top Products</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {topProducts.map((product, index) => (
                <div key={product.name} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">{product.name}</span>
                    <span className="text-sm text-slate-600">{product.revenue}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full" 
                        style={{ width: `${product.percentage}%` }}
                      ></div>
                    </div>
                    <span className="text-xs text-slate-500">{product.orders} orders</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentActivities.map((activity, index) => (
                <div key={index} className="border-l-2 border-blue-200 pl-3 pb-3">
                  <div className="text-sm font-medium">{activity.action}</div>
                  <div className="text-xs text-slate-600">{activity.customer}</div>
                  <div className="flex justify-between items-center mt-1">
                    <Badge variant="outline">{activity.amount}</Badge>
                    <span className="text-xs text-slate-500">{activity.time}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ReportingPage;
