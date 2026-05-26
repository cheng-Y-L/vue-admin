/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface User {
  id: string;
  username: string;
  nickname: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
  permissions: string[]; // e.g., ['dashboard_view', 'user_manage', 'order_manage', 'system_logs_view', 'data_stats_view']
  status: 'active' | 'suspended';
  avatar: string;
  createTime: string;
}

export interface Order {
  id: string;
  customerName: string;
  email: string;
  productName: string;
  category: string;
  amount: number;
  status: 'pending' | 'shipping' | 'completed' | 'canceled';
  date: string;
  paymentMethod: 'Alipay' | 'WeChatPay' | 'CreditCard' | 'PayPal';
}

export interface SystemLog {
  id: string;
  operator: string;
  role: string;
  action: string;
  ip: string;
  module: 'Auth' | 'UserManage' | 'OrderManage' | 'Permissions' | 'SystemSettings';
  status: 'success' | 'failed';
  timestamp: string;
}

export interface StatSummary {
  todaySales: number;
  todaySalesChange: number; // percentage, e.g., 12 => +12%
  todayOrders: number;
  todayOrdersChange: number;
  activeUsers: number;
  activeUsersChange: number;
  conversionRate: number;
  conversionRateChange: number;
}

export interface DashboardMetric {
  date: string;
  sales: number;
  orders: number;
  visitors: number;
}

export interface CategoryRatio {
  category: string;
  sales: number;
  count: number;
  color: string;
}
