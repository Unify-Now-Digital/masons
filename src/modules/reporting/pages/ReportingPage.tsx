import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Calendar, Download, TrendingUp, TrendingDown, DollarSign, Clock, Users, Star, Timer } from 'lucide-react';
import { useReportingKPIs, useRevenueChart, useTopProducts, useRecentActivity } from '../hooks/useReporting';
import { formatCurrency, formatTimeAgo } from '../utils/reportingTransform';
import { useToast } from '@/shared/hooks/use-toast';

export const ReportingPage: React.FC = () => {
  const { toast } = useToast();
  const [dateRange, setDateRange] = useState("30d");
  const [activeMetric, setActiveMetric] = useState("revenue");

  const { data: kpisData, isLoading: kpisLoading, error: kpisError } = useReportingKPIs(dateRange);
  const { data: revenueData, isLoading: revenueLoading, error: revenueError } = useRevenueChart(dateRange);
  const { data: topProductsData, isLoading: productsLoading, error: productsError } = useTopProducts(dateRange);
  const { data: recentActivityData, isLoading: activityLoading, error: activityError } = useRecentActivity(10);

  // Error handling
  useEffect(() => {
    if (kpisError) {
      console.error('KPIs error:', kpisError);
      toast({
        title: 'Error loading KPIs',
        description: kpisError instanceof Error ? kpisError.message : 'Failed to fetch KPI metrics.',
        variant: 'destructive',
      });
    }
    if (revenueError) {
      console.error('Revenue chart error:', revenueError);
      toast({
        title: 'Error loading revenue chart',
        description: revenueError instanceof Error ? revenueError.message : 'Failed to fetch revenue data.',
        variant: 'destructive',
      });
    }
    if (productsError) {
      console.error('Top products error:', productsError);
      toast({
        title: 'Error loading top products',
        description: productsError instanceof Error ? productsError.message : 'Failed to fetch product data.',
        variant: 'destructive',
      });
    }
    if (activityError) {
      console.error('Recent activity error:', activityError);
      toast({
        title: 'Error loading recent activity',
        description: activityError instanceof Error ? activityError.message : 'Failed to fetch activity data.',
        variant: 'destructive',
      });
    }
  }, [kpisError, revenueError, productsError, activityError, toast]);

  // Transform KPIs data
  const metrics = useMemo(() => {
    if (!kpisData) return null;
    return {
      revenue: {
        current: kpisData.monthlyRevenue.current,
        previous: kpisData.monthlyRevenue.previous,
        change: kpisData.monthlyRevenue.change,
      },
      orders: {
        current: kpisData.ordersThisMonth.current,
        previous: kpisData.ordersThisMonth.previous,
        change: kpisData.ordersThisMonth.change,
      },
      satisfaction: { current: 96, previous: 94, change: 2.1 }, // Placeholder
      avgDays: {
        current: kpisData.avgDaysToComplete.current,
        previous: kpisData.avgDaysToComplete.previous,
        change: kpisData.avgDaysToComplete.change,
      },
      depositToInstall: {
        current: kpisData.daysDepositToInstall.current,
        previous: kpisData.daysDepositToInstall.previous,
        change: kpisData.daysDepositToInstall.change,
      },
    };
  }, [kpisData]);

  const getChangeIcon = (change: number) => {
    return change >= 0 ? 
      <TrendingUp className="h-4 w-4 text-gardens-grn-dk" /> : 
      <TrendingDown className="h-4 w-4 text-gardens-red-dk" />;
  };

  const getChangeColor = (change: number) => {
    return change >= 0 ? "text-gardens-grn-dk" : "text-gardens-red-dk";
  };

  const renderKPICard = (
    title: string,
    value: number | string,
    change: number,
    icon: React.ReactNode,
    iconBg: string,
    onClick: () => void
  ) => {
    if (kpisLoading) {
      return <Skeleton className="h-24 w-full" />;
    }

    if (!metrics) {
      return (
        <Card>
          <CardContent className="pt-4">
            <div className="text-center text-gardens-txs py-4">No data available</div>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={onClick}>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold">{value}</div>
              <p className="text-sm text-gardens-tx">{title}</p>
              <div className={`flex items-center gap-1 text-xs ${getChangeColor(change)}`}>
                {getChangeIcon(change)}
                {Math.abs(change).toFixed(1)}% from last period
              </div>
            </div>
            <div className={`h-8 w-8 ${iconBg} rounded-full flex items-center justify-center`}>
              {icon}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Reporting & Analytics</h1>
          <p className="text-sm text-gardens-tx mt-1">
            Track performance and business insights
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="1y">This Year</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {renderKPICard(
          "Monthly Revenue",
          metrics ? formatCurrency(metrics.revenue.current) : "£0.00",
          metrics?.revenue.change || 0,
          <DollarSign className="h-4 w-4 text-gardens-grn-dk" />,
          "bg-gardens-grn-lt",
          () => setActiveMetric("revenue")
        )}

        {renderKPICard(
          "Orders This Month",
          metrics ? metrics.orders.current : 0,
          metrics?.orders.change || 0,
          <Users className="h-4 w-4 text-gardens-blu-dk" />,
          "bg-gardens-blu-lt",
          () => setActiveMetric("orders")
        )}

        {renderKPICard(
          "Customer Satisfaction",
          metrics ? `${metrics.satisfaction.current}%` : "96%",
          metrics?.satisfaction.change || 0,
          <Star className="h-4 w-4 text-gardens-amb-dk" />,
          "bg-gardens-amb-lt",
          () => setActiveMetric("satisfaction")
        )}

        {renderKPICard(
          "Avg. Days to Complete",
          metrics ? metrics.avgDays.current : 0,
          metrics?.avgDays.change || 0,
          <Clock className="h-4 w-4 text-gardens-blu-dk" />,
          "bg-gardens-blu-lt",
          () => setActiveMetric("avgDays")
        )}

        {renderKPICard(
          "Days Deposit to Install",
          metrics ? metrics.depositToInstall.current : 0,
          metrics?.depositToInstall.change || 0,
          <Timer className="h-4 w-4 text-gardens-amb-dk" />,
          "bg-gardens-amb-lt",
          () => setActiveMetric("depositToInstall")
        )}
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
                  {revenueLoading ? (
                    <Skeleton className="h-80 w-full" />
                  ) : revenueData && revenueData.length > 0 ? (
                    <div className="h-80 bg-gradient-to-br from-green-50 to-blue-50 rounded-lg flex items-center justify-center relative overflow-hidden">
                      <div className="text-center text-gardens-txs z-10">
                        <DollarSign className="h-12 w-12 mx-auto mb-2" />
                        <p>Revenue chart visualization</p>
                        <p className="text-sm">Monthly revenue: {formatCurrency(revenueData.reduce((sum, r) => sum + (r.paid_amount || 0), 0))}</p>
                        <p className="text-xs mt-2">Data points: {revenueData.length} months</p>
                      </div>
                      {/* Mock chart elements - can be replaced with real chart library later */}
                      <div className="absolute bottom-4 left-4 right-4 h-32 bg-gardens-grn-lt opacity-50 rounded"></div>
                      <div className="absolute bottom-4 left-8 w-8 h-24 bg-gardens-grn rounded-t"></div>
                      <div className="absolute bottom-4 left-20 w-8 h-32 bg-gardens-grn rounded-t"></div>
                      <div className="absolute bottom-4 left-32 w-8 h-20 bg-gardens-grn rounded-t"></div>
                    </div>
                  ) : (
                    <div className="h-80 bg-gradient-to-br from-green-50 to-blue-50 rounded-lg flex items-center justify-center">
                      <div className="text-center text-gardens-txs">
                        <DollarSign className="h-12 w-12 mx-auto mb-2" />
                        <p>No revenue data available</p>
                      </div>
                    </div>
                  )}
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
                    <div className="text-center text-gardens-txs">
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
                      <div className="flex items-center gap-1 text-sm text-gardens-grn-dk">
                        <TrendingUp className="h-3 w-3" />
                        +5% this month
                      </div>
                    </div>
                    <div className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                      <h4 className="font-medium mb-2">Order Completion Rate</h4>
                      <div className="text-2xl font-bold">94%</div>
                      <div className="flex items-center gap-1 text-sm text-gardens-grn-dk">
                        <TrendingUp className="h-3 w-3" />
                        +2% this month
                      </div>
                    </div>
                    <div className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                      <h4 className="font-medium mb-2">Customer Retention</h4>
                      <div className="text-2xl font-bold">78%</div>
                      <div className="flex items-center gap-1 text-sm text-gardens-amb-dk">
                        <TrendingDown className="h-3 w-3" />
                        -1% this month
                      </div>
                    </div>
                    <div className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                      <h4 className="font-medium mb-2">Response Time</h4>
                      <div className="text-2xl font-bold">2.4h</div>
                      <div className="flex items-center gap-1 text-sm text-gardens-grn-dk">
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
                        <div className="flex justify-between items-center p-3 bg-gardens-page rounded-lg">
                          <span className="text-sm font-medium">Avg. Deposit to Install</span>
                          <div className="text-right">
                            <div className="text-lg font-bold">{metrics ? metrics.depositToInstall.current : 0} days</div>
                            {metrics && (
                              <div className={`text-xs ${getChangeColor(metrics.depositToInstall.change)}`}>
                                {metrics.depositToInstall.change > 0 ? '+' : ''}{metrics.depositToInstall.change.toFixed(1)}%
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-gardens-page rounded-lg">
                          <span className="text-sm font-medium">Fastest Completion</span>
                          <div className="text-lg font-bold text-gardens-grn-dk">12 days</div>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-gardens-page rounded-lg">
                          <span className="text-sm font-medium">Longest Completion</span>
                          <div className="text-lg font-bold text-gardens-red-dk">45 days</div>
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
                        <div className="w-full bg-gardens-bdr rounded-full h-2">
                          <div className="bg-gardens-grn h-2 rounded-full" style={{ width: '45%' }}></div>
                        </div>
                        
                        <div className="flex justify-between text-sm">
                          <span>21-30 days</span>
                          <span>35%</span>
                        </div>
                        <div className="w-full bg-gardens-bdr rounded-full h-2">
                          <div className="bg-gardens-amb h-2 rounded-full" style={{ width: '35%' }}></div>
                        </div>
                        
                        <div className="flex justify-between text-sm">
                          <span>31+ days</span>
                          <span>20%</span>
                        </div>
                        <div className="w-full bg-gardens-bdr rounded-full h-2">
                          <div className="bg-gardens-red h-2 rounded-full" style={{ width: '20%' }}></div>
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
              {productsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : topProductsData && topProductsData.length > 0 ? (
                (() => {
                  const totalRevenue = topProductsData.reduce((sum, p) => sum + (p.total_revenue || 0), 0);
                  return topProductsData.map((product) => {
                    const percentage = totalRevenue > 0 ? ((product.total_revenue || 0) / totalRevenue) * 100 : 0;
                    return (
                      <div key={product.product_name} className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">{product.product_name}</span>
                          <span className="text-sm text-gardens-tx">{formatCurrency(product.total_revenue)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gardens-bdr rounded-full h-2">
                            <div 
                              className="bg-gardens-blu h-2 rounded-full" 
                              style={{ width: `${percentage}%` }}
                            ></div>
                          </div>
                          <span className="text-xs text-gardens-txs">{product.order_count} orders</span>
                        </div>
                      </div>
                    );
                  });
                })()
              ) : (
                <div className="text-center py-8 text-gardens-tx">No products data available</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {activityLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : recentActivityData && recentActivityData.length > 0 ? (
                recentActivityData.map((activity, index) => (
                  <div key={index} className="border-l-2 border-gardens-blu-lt pl-3 pb-3">
                    <div className="text-sm font-medium">{activity.description}</div>
                    <div className="text-xs text-gardens-tx">{activity.customer}</div>
                    <div className="flex justify-between items-center mt-1">
                      <Badge variant="outline">{formatCurrency(activity.amount)}</Badge>
                      <span className="text-xs text-gardens-txs">{formatTimeAgo(activity.activity_date)}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gardens-tx">No recent activity</div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ReportingPage;
